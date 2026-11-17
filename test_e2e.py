"""
TraceRAG End-to-End Automated Test Suite
Verifies all core services, API routes, streaming, and rate limiting.
Run with: python test_e2e.py
"""

import json
import time
import urllib.request
import urllib.error

API_BASE = "http://localhost:8000/api/v1"
HEALTH_URL = "http://localhost:8000/health"


def log_step(name: str):
    print(f"\n[RUNNING] {name}...")


def log_pass(msg: str):
    print(f"  [PASS] {msg}")


def make_request(url: str, method: str = "GET", data: dict = None, headers: dict = None):
    req_headers = headers or {}
    req_data = None
    if data is not None:
        req_headers["Content-Type"] = "application/json"
        req_data = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(url, data=req_data, headers=req_headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        return resp.status, json.loads(body) if body else {}


def test_health():
    log_step("1. Health Check Endpoint")
    with urllib.request.urlopen(HEALTH_URL, timeout=5) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert resp.status == 200
        assert data.get("status") == "ok"
        log_pass("Backend is healthy and running.")


def test_workspaces():
    log_step("2. Workspace & Pre-Seeded Demo Data")
    status, workspaces = make_request(f"{API_BASE}/workspaces")
    assert status == 200
    assert len(workspaces) > 0
    ws = workspaces[0]
    log_pass(f"Loaded workspace: '{ws['name']}' (ID: {ws['id']})")
    assert len(ws.get("pipelines", [])) >= 2
    assert len(ws.get("datasets", [])) >= 1
    log_pass(f"Pre-seeded with {len(ws['pipelines'])} pipelines and dataset '{ws['datasets'][0]['name']}'")
    return ws


def test_pipeline_creation(workspace_id: str):
    log_step("3. Custom Pipeline Creation (Recursive + Hybrid + Reranker)")
    payload = {
        "workspace_id": workspace_id,
        "name": "E2E Test Hybrid Pipeline",
        "chunk_strategy": "RECURSIVE",
        "chunk_size": 256,
        "chunk_overlap": 32,
        "retrieval_mode": "HYBRID",
        "top_k": 4,
        "use_reranker": True,
        "model_name": "gpt-4o-mini",
        "system_prompt": "Answer strictly using provided context.",
    }
    status, pipe = make_request(f"{API_BASE}/pipelines", method="POST", data=payload)
    assert status == 200
    assert pipe.get("name") == payload["name"]
    log_pass(f"Created custom pipeline: '{pipe['name']}' (ID: {pipe['id']})")
    return pipe["id"]


def test_document_upload(workspace_id: str):
    log_step("4. Document Upload (Multipart Text/Markdown)")
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    filename = "test_sla_policy.md"
    content = (
        "# Enterprise Service Level Agreement\n\n"
        "Enterprise tier provides 99.95% uptime commitment. Unscheduled downtime exceeding "
        "0.05% in a billing calendar month qualifies for a 15% service credit on request.\n\n"
        "Standard tier provides 99.0% uptime with no monetary credits."
    )
    
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: text/markdown\r\n\r\n"
        f"{content}\r\n"
        f"--{boundary}--\r\n"
    ).encode("utf-8")

    req = urllib.request.Request(
        f"{API_BASE}/workspaces/{workspace_id}/documents",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert resp.status == 200
        assert data.get("filename") == filename
        log_pass(f"Uploaded '{filename}' (ID: {data['id']}, Approx Tokens: {data['token_count']})")
        return data["id"]


def test_synthetic_generation(dataset_id: str):
    log_step("5. 1-Click Synthetic Q&A Generation")
    status, res = make_request(
        f"{API_BASE}/datasets/{dataset_id}/generate-synthetic?count=3",
        method="POST",
    )
    assert status == 200
    gen_count = res.get("generated_count", 0)
    assert gen_count > 0
    log_pass(f"Synthesized {gen_count} diverse test cases from document corpus.")

    status, cases = make_request(f"{API_BASE}/datasets/{dataset_id}/cases")
    assert status == 200
    assert len(cases) >= gen_count
    log_pass(f"Dataset now contains {len(cases)} total test cases.")


def test_live_ab_eval_and_streaming(dataset_id: str, pipe_a_id: str, pipe_b_id: str):
    log_step("6. Live A/B Experiment Run & SSE Progress Streaming")
    payload = {
        "dataset_id": dataset_id,
        "pipeline_a_id": pipe_a_id,
        "pipeline_b_id": pipe_b_id,
    }
    status, run_data = make_request(f"{API_BASE}/experiments", method="POST", data=payload)
    assert status == 200
    run_id = run_data.get("run_id")
    log_pass(f"Launched evaluation run: {run_id} (Status: {run_data.get('status')})")

    # Read SSE stream
    log_step("7. Reading Live SSE Stream Events")
    stream_url = f"{API_BASE}/experiments/{run_id}/stream"
    req = urllib.request.Request(stream_url)
    completed = False
    with urllib.request.urlopen(req, timeout=60) as resp:
        for line in resp:
            decoded = line.decode("utf-8").strip()
            if decoded.startswith("data:"):
                raw_json = decoded[5:].strip()
                event = json.loads(raw_json)
                ev_type = event.get("type")
                if ev_type == "progress":
                    print(f"    -> Progress: {event.get('completed')}/{event.get('total')} traces graded")
                elif ev_type == "completed":
                    completed = True
                    log_pass("Received 'completed' SSE event.")
                    break
                elif ev_type == "error":
                    raise RuntimeError(f"SSE Error: {event.get('message')}")

    assert completed

    # Fetch results
    log_step("8. Fetching Comparative Results & Failure Taxonomy")
    status, results = make_request(f"{API_BASE}/experiments/{run_id}/results")
    assert status == 200
    assert results.get("status") == "COMPLETED"
    cases = results.get("cases", [])
    log_pass(f"Evaluated {len(cases)} test cases.")

    for c in cases[:2]:
        q = c["question"][:50] + "..." if len(c["question"]) > 50 else c["question"]
        cat_a = c["traces"].get("pipeline_a", {}).get("failure_category", "N/A")
        cat_b = c["traces"].get("pipeline_b", {}).get("failure_category", "N/A")
        print(f"    Case: '{q}' -> Pipe A: {cat_a} | Pipe B: {cat_b}")


def test_rate_limiting(dataset_id: str, pipe_a_id: str, pipe_b_id: str):
    log_step("9. Demo Mode Rate Limiting Enforcement")
    payload = {
        "dataset_id": dataset_id,
        "pipeline_a_id": pipe_a_id,
        "pipeline_b_id": pipe_b_id,
    }
    # Demo mode allows up to 5 runs per 10 minutes per IP
    blocked = False
    for i in range(10):
        try:
            make_request(f"{API_BASE}/experiments", method="POST", data=payload)
        except urllib.error.HTTPError as err:
            if err.code == 429:
                blocked = True
                log_pass(f"Rate limiter correctly triggered on request #{i+1} with HTTP 429 Too Many Requests.")
                break

    assert blocked, "Expected Demo Mode rate limiter to return 429 after exceeding limit."


def main():
    print("=" * 65)
    print("  TraceRAG Production End-to-End Test Suite")
    print("=" * 65)

    test_health()
    ws = test_workspaces()
    ws_id = ws["id"]
    ds_id = ws["datasets"][0]["id"]
    pipe_a_id = ws["pipelines"][0]["id"]
    pipe_b_id = ws["pipelines"][1]["id"]

    new_pipe_id = test_pipeline_creation(ws_id)
    doc_id = test_document_upload(ws_id)
    test_synthetic_generation(ds_id)
    test_live_ab_eval_and_streaming(ds_id, pipe_a_id, pipe_b_id)
    test_rate_limiting(ds_id, pipe_a_id, pipe_b_id)

    print("\n" + "=" * 65)
    print("  ALL 9 END-TO-END VERIFICATION TESTS PASSED SUCCESSFULLY! ")
    print("=" * 65)


if __name__ == "__main__":
    main()
