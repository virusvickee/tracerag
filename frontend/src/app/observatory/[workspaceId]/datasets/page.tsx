"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Database,
  Upload,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Filter,
  FileUp,
  File,
} from "lucide-react";
import {
  createDataset,
  createTestCase,
  deleteDocument,
  deleteTestCase,
  fetchDatasets,
  fetchDocuments,
  fetchTestCases,
  generateSyntheticCases,
  uploadDocument,
} from "@/lib/api-client";
import { GoldenDataset, TestCaseItem, WorkspaceDocument } from "@/lib/types";

export default function DatasetsAndCorpusPage({
  params,
}: {
  params: { workspaceId: string };
}) {
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [datasets, setDatasets] = useState<GoldenDataset[]>([]);
  const [activeDataset, setActiveDataset] = useState<GoldenDataset | null>(null);
  const [testCases, setTestCases] = useState<TestCaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Synthetic Generator state
  const [generating, setGenerating] = useState(false);
  const [synthCount, setSynthCount] = useState<number>(5);

  // Manual Test Case Form state
  const [showAddCaseForm, setShowAddCaseForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [groundTruth, setGroundTruth] = useState("");
  const [difficultyTag, setDifficultyTag] = useState<
    "SINGLE_HOP" | "MULTI_HOP" | "UNANSWERABLE"
  >("SINGLE_HOP");
  const [expectedDocId, setExpectedDocId] = useState<string>("");
  const [submittingCase, setSubmittingCase] = useState(false);

  // Filters & Notifications
  const [filterDifficulty, setFilterDifficulty] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [docs, dsets] = await Promise.all([
        fetchDocuments(params.workspaceId),
        fetchDatasets(params.workspaceId),
      ]);
      setDocuments(docs);
      setDatasets(dsets);

      let ds = dsets[0] || null;
      if (!ds && docs.length > 0) {
        // Auto-create initial golden dataset if none exists
        ds = await createDataset(params.workspaceId, {
          name: "Default Golden Dataset",
          description: "Benchmark test cases for RAG evaluation",
        });
        setDatasets([ds]);
      }
      setActiveDataset(ds);

      if (ds) {
        const cases = await fetchTestCases(ds.id);
        setTestCases(cases);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to load corpus and datasets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [params.workspaceId]);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg("Please select a file (.pdf, .md, or .txt) to upload.");
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const uploadedDoc = await uploadDocument(params.workspaceId, selectedFile);
      setSuccessMsg(`Uploaded "${uploadedDoc.filename}" (${uploadedDoc.token_count} tokens) successfully!`);
      setSelectedFile(null);
      const updatedDocs = await fetchDocuments(params.workspaceId);
      setDocuments(updatedDocs);
    } catch (err: any) {
      setErrorMsg(err.message || "File upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (id: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;
    try {
      await deleteDocument(params.workspaceId, id);
      setDocuments(documents.filter((d) => d.id !== id));
      setSuccessMsg(`Document "${filename}" deleted.`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete document");
    }
  };

  const handleGenerateSynthetic = async () => {
    if (!activeDataset) {
      setErrorMsg("No active dataset found to hold generated test cases.");
      return;
    }
    if (documents.length === 0) {
      setErrorMsg("Please upload at least one document before generating synthetic test cases.");
      return;
    }

    setGenerating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await generateSyntheticCases(activeDataset.id, synthCount);
      setSuccessMsg(`Generated ${res.generated_count} synthetic test cases successfully!`);
      const updatedCases = await fetchTestCases(activeDataset.id);
      setTestCases(updatedCases);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate synthetic test cases");
    } finally {
      setGenerating(false);
    }
  };

  const handleAddTestCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDataset) return;
    if (!question.trim() || !groundTruth.trim()) {
      setErrorMsg("Question and Ground Truth answer are both required.");
      return;
    }

    setSubmittingCase(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await createTestCase(activeDataset.id, {
        question: question.trim(),
        ground_truth: groundTruth.trim(),
        difficulty_tag: difficultyTag,
        expected_doc_id: expectedDocId ? expectedDocId : null,
      });

      setSuccessMsg("Test case added successfully!");
      setQuestion("");
      setGroundTruth("");
      setShowAddCaseForm(false);
      const updatedCases = await fetchTestCases(activeDataset.id);
      setTestCases(updatedCases);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add test case");
    } finally {
      setSubmittingCase(false);
    }
  };

  const handleDeleteTestCase = async (caseId: string) => {
    if (!activeDataset) return;
    if (!confirm("Are you sure you want to delete this test case?")) return;
    try {
      await deleteTestCase(activeDataset.id, caseId);
      setTestCases(testCases.filter((tc) => tc.id !== caseId));
      setSuccessMsg("Test case deleted.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete test case");
    }
  };

  const filteredCases = useMemo(() => {
    return testCases.filter((tc) => {
      const matchesDifficulty =
        filterDifficulty === "ALL" || tc.difficulty_tag === filterDifficulty;
      const matchesSearch =
        searchQuery === "" ||
        tc.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tc.ground_truth.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDifficulty && matchesSearch;
    });
  }, [testCases, filterDifficulty, searchQuery]);

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-slate-400">
        Loading document corpus & datasets...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Corpus & Golden Benchmark Datasets</h1>
          <p className="text-xs text-slate-400">
            Upload source knowledge documents and curate high-signal evaluation test cases.
          </p>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-950/40 px-4 py-2.5 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-4 py-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          {successMsg}
        </div>
      )}

      {/* Section 1: Document Upload & Knowledge Corpus */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-400" />
              Source Documents Corpus ({documents.length})
            </h2>
            <p className="text-xs text-slate-400">
              Knowledge base documents chunked and indexed with pgvector HNSW and tsvector GIN indexes.
            </p>
          </div>
        </div>

        {/* Upload form */}
        <form onSubmit={handleFileUpload} className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[280px]">
            <input
              type="file"
              accept=".pdf,.md,.txt"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-200 hover:file:bg-slate-700"
            />
          </div>
          <button
            type="submit"
            disabled={!selectedFile || uploading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Ingesting..." : "Upload Document"}
          </button>
        </form>

        {/* Documents Table */}
        {documents.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                <tr>
                  <th className="px-4 py-2.5">Filename</th>
                  <th className="px-4 py-2.5">Format</th>
                  <th className="px-4 py-2.5">Approx. Tokens</th>
                  <th className="px-4 py-2.5">Document ID</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {documents.map((doc) => {
                  const ext = doc.filename.split(".").pop()?.toUpperCase() || "TXT";
                  return (
                    <tr key={doc.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-2.5 font-medium text-slate-100 flex items-center gap-2">
                        <File className="h-3.5 w-3.5 text-slate-400" />
                        {doc.filename}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                          {ext}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-300">
                        {doc.token_count}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">
                        {doc.id}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                          className="rounded p-1 text-slate-500 hover:text-rose-400"
                          title="Delete document"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-800 p-8 text-center text-xs text-slate-400">
            <FileUp className="mx-auto mb-2 h-6 w-6 text-slate-500" />
            No documents uploaded yet. Upload a PDF, Markdown, or text file to index knowledge chunks.
          </div>
        )}
      </div>

      {/* Section 2: 1-Click Synthetic Q&A Generator */}
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-sm font-semibold text-white">
                1-Click Synthetic Q&A Generator
              </h2>
            </div>
            <p className="mt-1 text-xs text-indigo-200/80 leading-relaxed">
              Synthesize diverse test questions (Single-Hop, Multi-Hop, and Unanswerable queries)
              strictly grounded in your uploaded documents using LLM structured outputs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-indigo-300 font-medium">Count:</label>
              <select
                value={synthCount}
                onChange={(e) => setSynthCount(Number(e.target.value))}
                className="rounded-lg border border-indigo-500/40 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-indigo-500"
              >
                <option value={3}>3 test cases</option>
                <option value={5}>5 test cases</option>
                <option value={10}>10 test cases</option>
              </select>
            </div>

            <button
              onClick={handleGenerateSynthetic}
              disabled={generating || documents.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {generating ? "Synthesizing Test Cases..." : "Generate Synthetic Q&A"}
            </button>
          </div>
        </div>
      </div>

      {/* Section 3: Golden Benchmark Test Cases */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-400" />
              Golden Dataset Test Cases ({testCases.length})
            </h2>
            <p className="text-xs text-slate-400">
              Benchmark queries and locked ground truth answers used to measure Faithfulness, Context Recall, and Answer Relevance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddCaseForm(!showAddCaseForm)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-indigo-500"
            >
              <Plus className="h-3.5 w-3.5" />
              {showAddCaseForm ? "Cancel" : "Add Test Case"}
            </button>
          </div>
        </div>

        {/* Manual Test Case Form */}
        {showAddCaseForm && (
          <form
            onSubmit={handleAddTestCase}
            className="mb-6 rounded-lg border border-slate-700 bg-slate-950 p-4 space-y-4"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Add Golden Test Case
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-300">Test Question</label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. How are prorated refunds calculated on cancelled Enterprise plans?"
                required
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Ground Truth Answer
              </label>
              <textarea
                rows={2}
                value={groundTruth}
                onChange={(e) => setGroundTruth(e.target.value)}
                placeholder="The verified factual answer that pipelines are judged against..."
                required
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-300">Difficulty Tag</label>
                <select
                  value={difficultyTag}
                  onChange={(e: any) => setDifficultyTag(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-indigo-500"
                >
                  <option value="SINGLE_HOP">SINGLE_HOP (Direct retrieval)</option>
                  <option value="MULTI_HOP">MULTI_HOP (Multi-clause reasoning)</option>
                  <option value="UNANSWERABLE">UNANSWERABLE (Hallucination trap)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Target Document (Optional)
                </label>
                <select
                  value={expectedDocId}
                  onChange={(e) => setExpectedDocId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-indigo-500"
                >
                  <option value="">Any / Not Specified</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.filename}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddCaseForm(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingCase}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {submittingCase ? "Adding..." : "Add to Golden Set"}
              </button>
            </div>
          </form>
        )}

        {/* Filter Bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Filter:</span>
            {["ALL", "SINGLE_HOP", "MULTI_HOP", "UNANSWERABLE"].map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterDifficulty(tag)}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
                  filterDifficulty === tag
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search test questions..."
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Test Cases Table */}
        {filteredCases.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 w-28">Difficulty</th>
                  <th className="px-4 py-2.5">Question</th>
                  <th className="px-4 py-2.5">Ground Truth</th>
                  <th className="px-4 py-2.5 text-right w-16">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredCases.map((tc) => (
                  <tr key={tc.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-block rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                          tc.difficulty_tag === "SINGLE_HOP"
                            ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                            : tc.difficulty_tag === "MULTI_HOP"
                            ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                            : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {tc.difficulty_tag}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top font-medium text-slate-100">
                      {tc.question}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-300 leading-relaxed">
                      {tc.ground_truth}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <button
                        onClick={() => handleDeleteTestCase(tc.id)}
                        className="rounded p-1 text-slate-500 hover:text-rose-400"
                        title="Delete test case"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-800 p-8 text-center text-xs text-slate-400">
            No test cases found. Click "Generate Synthetic Q&A" to automatically synthesize test cases from your corpus!
          </div>
        )}
      </div>
    </div>
  );
}
