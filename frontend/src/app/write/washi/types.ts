// ============================================================
// washi/types.ts — Washi UI 类型定义
// Standup Workspace v3.0
// ============================================================

// ─── 创作意图 ────────────────────────────────────────────────

export type WriteIntentType =
  | "premise"
  | "joke_to_premise"
  | "angles"
  | "rewrite"
  | "feedback"
  | "unknown";

export interface WriteIntent {
  type: WriteIntentType;
  endpoint: string;
  confidence: number;
  reason: string;
  mode?: string;
}

// ─── 作品状态 ────────────────────────────────────────────────

export type WorkStatus =
  | "idea"
  | "premise"
  | "draft"
  | "performable"
  | "performed"
  | "mature"
  | "archived";

// ─── 卡片类型 ────────────────────────────────────────────────

export type WorkCardType =
  | "material"
  | "premise"
  | "joke_to_premise"
  | "angle"
  | "angles"
  | "rewrite"
  | "draft"
  | "feedback"
  | "error";

// ─── 卡片动作 ────────────────────────────────────────────────

export type CardActionType =
  | "expand_to_draft"
  | "make_sharper"
  | "make_softer"
  | "find_angles"
  | "rewrite"
  | "save"
  | "copy"
  | "continue";

export interface CardAction {
  id: string;
  type: CardActionType;
  label: string;
  nextIntent?: WriteIntentType;
  payload?: Record<string, unknown>;
}

// ─── WorkCard ────────────────────────────────────────────────

export interface WorkCard {
  id: string;
  sessionId: string;
  type: WorkCardType;
  role: "user" | "assistant" | "system";
  title: string;
  content: string;
  rawData?: unknown;
  sourceCardId?: string;
  sourcePath: string[];
  createdAt: number;
  updatedAt?: number;
  meta?: {
    endpoint?: string;
    model?: string;
    provider?: string;
    latencyMs?: number;
    requestId?: string;
    attemptCount?: number;
  };
  actions?: CardAction[];
}

// ─── WorkSession ─────────────────────────────────────────────

export interface WorkSession {
  id: string;
  title: string;
  status: WorkStatus;
  activeCardId?: string;
  sourceInput: string;
  inputType: string | null;
  createdAt: number;
  updatedAt: number;
  cards: WorkCard[];
}

// ─── 步骤标签 ────────────────────────────────────────────────

export const WORKFLOW_STEP_LABELS: Record<string, string> = {
  input: "输入",
  detect: "检测中",
  material: "素材",
  premise: "前提",
  joke_to_premise: "梗写前提",
  premise_check: "前提体检",
  angles: "角度",
  draft: "初稿",
  rewrite: "改稿",
  performance_review: "演后复盘",
  save: "已保存",
};

// ─── 辅助函数 ────────────────────────────────────────────────

export function generateSessionTitle(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length <= 20) return trimmed;
  return trimmed.slice(0, 20) + "…";
}

export function newWorkSession(sourceInput: string): WorkSession {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: generateSessionTitle(sourceInput),
    status: "idea",
    sourceInput,
    inputType: null,
    createdAt: now,
    updatedAt: now,
    cards: [],
  };
}

/**
 * Build a sourcePath by appending the current step type to the parent's path.
 * Avoids duplicating the last step if it matches the current step.
 */
export function buildSourcePath(
  parentCard: { sourcePath?: string[]; type?: string } | null | undefined,
  currentStep: string
): string[] {
  const base: string[] = parentCard?.sourcePath?.length
    ? [...parentCard.sourcePath]
    : parentCard?.type
    ? [parentCard.type]
    : ["用户输入"];
  return [...base, currentStep];
}
