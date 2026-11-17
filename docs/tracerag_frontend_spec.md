# Frontend UI/UX & Component Architecture Specification
**Framework:** Next.js 14+ (App Router, TypeScript), Tailwind CSS, Recharts, TanStack Query, Zustand  

## Core Views
- **Observatory Dashboard (`/observatory/[workspaceId]`):** KPI delta cards, Pareto Trade-Off scatter chart (Cost/Latency vs. Faithfulness), and interactive test case failure table.
- **Split-Screen Trace Inspector (`TraceDiffDrawer`):** Side-by-side comparison of Pipeline A vs. Pipeline B with sentence-level grounding highlights (`SUPPORTED` in emerald, `HALLUCINATED` in rose).
