// ─── Shared Types ───────────────────────────────────────────────────────────

export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  script_count: number;
}

export interface Script {
  id: number;
  project_id: number;
  filename: string;
  actor_name: string;
  show_name: string;
  title: string;
  segment_count: number;
  has_report: boolean;
  created_at: string;
  updated_at: string;
}

export interface Segment {
  id: number;
  script_id: number;
  index: number;
  raw_text: string;
  start_char: number;
  end_char: number;
  starred: boolean;
}

export interface SegmentAnalysis {
  id: number;
  segment_id: number;
  structure: string;
  structure_note: string;
  attitude_object: string;
  attitude_type: string;
  attitude_insight: string;
  techniques: string;
  technique_notes: string;
  problems: string;
  problem_notes: string;
  notes: string;
  notes_type: string;
  inspiration: string;
  analysis_text: string;
  starred: boolean;
  created_at: string;
  updated_at: string;
}

export interface SegmentDetail extends Segment {
  analysis: SegmentAnalysis | null;
}

export interface ScriptReport {
  id: number;
  script_id: number;
  summary: string;
  strengths: string;
  weaknesses: string;
  methodology: string;
  key_insights: string;
  overall_score: number;
  created_at: string;
  updated_at: string;
}

export interface ScriptDetail extends Script {
  raw_text: string;
  cleaned_text: string;
  segments: Segment[];
  report: ScriptReport | null;
}

export interface Analysis {
  script_id: number;
  actor_name: string;
  show_name: string;
  title: string;
  report: ScriptReport | null;
  segments: SegmentDetail[];
  total_segments: number;
  starred_count: number;
}

export interface AnalysisJob {
  id: number;
  script_id: number;
  status: "pending" | "running" | "completed" | "failed";
  step: number;
  step_name: string;
  progress: number;
  message: string;
  error: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface FilterRequest {
  script_id?: number;
  project_id?: number;
  keywords: string[];
  structures: string[];
  attitudes: string[];
  techniques: string[];
  problems: string[];
  starred_only: boolean;
  page: number;
  page_size: number;
}

export interface FilterResult {
  segments: SegmentDetail[];
  total: number;
}

// ─── Tag colors ─────────────────────────────────────────────────────────────

export type TagCategory = "structure" | "attitude" | "technique" | "problem" | "note";

export interface TagDef {
  label: string;
  color: TagCategory;
}
