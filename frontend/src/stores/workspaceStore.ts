import { create } from "zustand";
import type { Analysis, SegmentDetail, Script, AnalysisJob } from "@/types";

interface WorkspaceState {
  // Current context
  scriptId: number | null;
  projectId: number | null;

  // Analysis data
  analysis: Analysis | null;
  selectedSegmentId: number | null;

  // Active tab in bottom bar
  activeTab: "notes" | "compare" | "summary" | "methodology";

  // Filter state
  filterMode: boolean;
  filterKeyword: string;

  // Job progress
  currentJob: AnalysisJob | null;

  // Actions
  setScript: (scriptId: number, projectId?: number) => void;
  setAnalysis: (analysis: Analysis) => void;
  selectSegment: (segmentId: number | null) => void;
  setActiveTab: (tab: WorkspaceState["activeTab"]) => void;
  setFilterMode: (on: boolean) => void;
  setFilterKeyword: (kw: string) => void;
  setCurrentJob: (job: AnalysisJob | null) => void;
  clear: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  scriptId: null,
  projectId: null,
  analysis: null,
  selectedSegmentId: null,
  activeTab: "notes",
  filterMode: false,
  filterKeyword: "",
  currentJob: null,

  setScript: (scriptId, projectId) =>
    set({ scriptId, projectId: projectId ?? null, analysis: null, selectedSegmentId: null }),

  setAnalysis: (analysis) => set({ analysis }),

  selectSegment: (segmentId) => set({ selectedSegmentId: segmentId }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setFilterMode: (on) => set({ filterMode: on }),

  setFilterKeyword: (kw) => set({ filterKeyword: kw }),

  setCurrentJob: (job) => set({ currentJob: job }),

  clear: () =>
    set({
      scriptId: null,
      projectId: null,
      analysis: null,
      selectedSegmentId: null,
      currentJob: null,
    }),
}));
