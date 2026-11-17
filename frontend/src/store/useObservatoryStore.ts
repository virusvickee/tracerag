import { create } from "zustand";

interface HoveredClaim {
  pipelineSide: "pipeline_a" | "pipeline_b";
  supportingChunkId: string | null;
  supportingQuote: string | null;
}

interface ObservatoryState {
  selectedTestCaseId: string | null;
  hoveredClaim: HoveredClaim | null;
  setSelectedTestCaseId: (id: string | null) => void;
  setHoveredClaim: (claim: HoveredClaim | null) => void;
}

export const useObservatoryStore = create<ObservatoryState>((set) => ({
  selectedTestCaseId: null,
  hoveredClaim: null,
  setSelectedTestCaseId: (id) => set({ selectedTestCaseId: id, hoveredClaim: null }),
  setHoveredClaim: (claim) => set({ hoveredClaim: claim }),
}));
