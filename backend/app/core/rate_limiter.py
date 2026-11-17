import time
from collections import defaultdict
from typing import Dict, List, Optional
from fastapi import HTTPException, Request

# In-memory sliding window store: IP -> list of request timestamps
_demo_requests: Dict[str, List[float]] = defaultdict(list)

# Rate limit configuration for Demo Mode (when no X-Provider-Key is supplied)
DEMO_MAX_REQUESTS: int = 5
DEMO_WINDOW_SECONDS: int = 600  # 10 minutes


def check_demo_rate_limit(request: Request, x_provider_key: Optional[str] = None) -> None:
    """
    Enforces a rate limit on Demo Mode runs when no X-Provider-Key header is supplied.
    BYOK requests (with a valid non-empty X-Provider-Key) bypass this limiter.
    """
    if x_provider_key and x_provider_key.strip():
        # User provided their own key; bypass demo rate limit
        return

    # Extract client IP
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    elif request.client and request.client.host:
        client_ip = request.client.host
    else:
        client_ip = "demo_client"

    now = time.time()
    cutoff = now - DEMO_WINDOW_SECONDS

    # Clean old requests outside the sliding window
    timestamps = [t for t in _demo_requests[client_ip] if t > cutoff]
    _demo_requests[client_ip] = timestamps

    if len(timestamps) >= DEMO_MAX_REQUESTS:
        oldest_ts = timestamps[0]
        retry_after = max(1, int(oldest_ts + DEMO_WINDOW_SECONDS - now))
        raise HTTPException(
            status_code=429,
            detail=(
                f"Demo Mode rate limit exceeded ({DEMO_MAX_REQUESTS} runs per {DEMO_WINDOW_SECONDS // 60} minutes). "
                f"Please wait {retry_after}s or provide your OpenAI API key via 'Bring Your Own API Key' to unlock unlimited evaluations."
            ),
            headers={"Retry-After": str(retry_after)},
        )

    # Record this request
    _demo_requests[client_ip].append(now)
