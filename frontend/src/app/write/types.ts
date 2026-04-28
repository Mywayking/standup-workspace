// ============================================================
// v3 核心类型定义
// Standup Workspace v3.0
// ============================================================

// ─── 创作步骤 ────────────────────────────────────────────────

export type WorkflowStep =
  | "input"       // 用户输入
  | "detect"      // AI 检测输入类型
  | "material"    // 素材提炼
  | "premise"     // 前提提炼
  | "joke_to_premise"  // 梗写前提
  | "premise_check"    // 前提体检
  | "angles"      // 角度分析
  | "draft"       // 写第一版
  | "rewrite"     // 改稿
  | "performance_review" // 演后复盘
  | "save";       // 保存

export const WORKFLOW_STEP_LABELS: Record<WorkflowStep, string> = {
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

export const WORKFLOW_STEP_ICONS: Record<WorkflowStep, string> = {
  input: "📝",
  detect: "🔍",
  material: "💡",
  premise: "🎯",
  joke_to_premise: "🔥",
  premise_check: "🩺",
  angles: "🔎",
  draft: "📄",
  rewrite: "✏️",
  performance_review: "🎤",
  save: "✅",
};

// ─── 输入类型检测 ───────────────────────────────────────────

export type InputType =
  | "material"       // 生活素材/事件/观察
  | "premise"        // 已有前提/判断
  | "joke"           // 一句梗/笑点/吐槽
  | "draft"          // 草稿/段子
  | "performance";   // 演出反馈

export const INPUT_TYPE_LABELS: Record<InputType, string> = {
  material: "生活素材",
  premise: "已有前提",
  joke: "一句梗",
  draft: "草稿",
  performance: "演出反馈",
};

// ─── 段子库状态 ─────────────────────────────────────────────

export type ScriptStatus =
  | "idea"        // 灵感
  | "premise"     // 前提
  | "draft"       // 草稿
  | "performable"  // 可演
  | "performed"   // 已演
  | "mature";    // 成熟段子

export const SCRIPT_STATUS_LABELS: Record<ScriptStatus, string> = {
  idea: "灵感",
  premise: "前提",
  draft: "草稿",
  performable: "可演",
  performed: "已演",
  mature: "成熟",
};

export const NEXT_ACTION_BY_STATUS: Record<ScriptStatus, string> = {
  idea: "找到好笑点",
  premise: "换几个讲法",
  draft: "改成上台版",
  performable: "记录演出反馈",
  performed: "演后复盘",
  mature: "加入专场",
};

// ─── 保存状态 ───────────────────────────────────────────────

export type ActionState = "idle" | "pending" | "success" | "error";

export type SaveStatus =
  | "idle"         // 未保存
  | "saving"       // 保存中
  | "saved_local"   // 已存本地
  | "saved_cloud"   // 已存云端
  | "failed";       // 保存失败

// ─── 同步状态 ───────────────────────────────────────────────

export type SyncStatus =
  | "local_only"    // 仅本地
  | "pending_sync"  // 待同步
  | "syncing"       // 同步中
  | "synced"        // 已同步
  | "conflict"      // 冲突
  | "failed";       // 同步失败

// ─── 创作模式 ───────────────────────────────────────────────

export type WorkflowMode = "guided" | "quick";

// ─── AI 任务类型 ─────────────────────────────────────────────

export type AITaskType =
  | "detect_input"
  | "premise"
  | "joke_to_premise"
  | "premise_check"
  | "angles"
  | "draft"
  | "rewrite"
  | "performance_review";

// ─── WorkflowSession ────────────────────────────────────────

export interface WorkflowSession {
  id: string;
  userId?: string;
  title: string;
  sourceInput: string;
  inputType: InputType | null;
  currentStep: WorkflowStep;
  scriptStatus: ScriptStatus;
  mode: WorkflowMode;
  saveStatus: SaveStatus;
  syncStatus: SyncStatus;
  rootCardIds: string[];
  mainlineCardId?: string;
  cards: WorkflowCard[]; // v3 inline cards for GuidedClient
  createdAt: string;
  updatedAt: string;
}

// ─── WorkflowCard ───────────────────────────────────────────

export interface WorkflowCard {
  id: string;
  sessionId: string;
  parentId?: string;
  childrenIds: string[];
  type: WorkflowStep;
  title: string;
  content: string;
  structuredData?: unknown;
  sourcePath: string[];
  isSelected: boolean;
  isMainline: boolean;
  version: number;
  model?: string;
  provider?: string;
  latencyMs?: number;
  tokenUsage?: TokenUsage;
  createdAt: string;
  updatedAt: string;
}

// ─── Token 用量 ─────────────────────────────────────────────

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ─── AI Task 统一请求 ────────────────────────────────────────

export interface AITaskRequest {
  taskType: AITaskType;
  sessionId: string;
  input: string;
  context?: {
    sourceInput?: string;
    selectedPremise?: string;
    selectedAngle?: string;
    previousDraft?: string;
    sourcePath?: string[];
  };
  userStyle?: UserStyleProfile;
  options?: {
    scene?: "open_mic" | "commercial" | "short_video" | "company_show";
    length?: "short" | "1-3min" | "3-5min";
    variant?: string;
  };
}

// ─── AI Task 统一响应元信息 ─────────────────────────────────

export interface AITaskMeta {
  taskId: string;
  model: string;
  provider: string;
  requestId: string;
}

export interface AITaskDone {
  latencyMs: number;
  tokenUsage: TokenUsage;
}

export interface AITaskError {
  code: string;
  message: string;
}

// ─── 统一 SSE 事件 ──────────────────────────────────────────

export type SSETokenEvent =
  | { type: "meta"; data: AITaskMeta }
  | { type: "token"; data: { text: string } }
  | { type: "structured"; data: unknown }
  | { type: "done"; data: AITaskDone }
  | { type: "error"; data: AITaskError };

// ─── 段子库项 ───────────────────────────────────────────────

export interface JokeLibraryItem {
  sessionId: string;
  title: string;
  summary: string;
  scriptStatus: ScriptStatus;
  tags: string[];
  nextAction: string;
  syncStatus: SyncStatus;
  updatedAt: string;
}

// ─── 专场 (Special Set) ───────────────────────────────────────

export interface SpecialSet {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  scriptIds: string[];
  totalDurationMin: number;
  createdAt: string;
  updatedAt: string;
}

// ─── 用户风格 Profile ────────────────────────────────────────

export interface UserStyleProfile {
  userId: string;
  stageName?: string;
  persona?: string;
  commonTopics?: string[];
  forbiddenTopics?: string[];
  tone?: string;
  preferredTechniques?: string[];
  updatedAt?: string;
}

// ─── 任务入口卡片 ────────────────────────────────────────────

export interface TaskEntryCard {
  key: string;
  icon: string;
  title: string;
  desc: string;
  step: WorkflowStep;
  inputType?: InputType; // 用于 auto-detect 时的默认类型
}

export const TASK_ENTRY_CARDS: TaskEntryCard[] = [
  {
    key: "素材",
    icon: "📝",
    title: "我有一段生活素材",
    desc: "一件事、一个观察、一段情绪",
    step: "material",
    inputType: "material",
  },
  {
    key: "梗",
    icon: "🔥",
    title: "我有一句梗",
    desc: "一个笑点、一句吐槽、一个灵感",
    step: "joke_to_premise",
    inputType: "joke",
  },
  {
    key: "前提",
    icon: "💡",
    title: "我有一个前提",
    desc: "已经有判断或结论，想找角度",
    step: "angles",
    inputType: "premise",
  },
  {
    key: "草稿",
    icon: "✍️",
    title: "我有一段草稿",
    desc: "完整段子，想改稿或上台版",
    step: "rewrite",
    inputType: "draft",
  },
  {
    key: "复盘",
    icon: "🎤",
    title: "我刚演完一段",
    desc: "记录演出反馈，生成下一版",
    step: "performance_review",
    inputType: "performance",
  },
];

// ─── AI Task 日志 ───────────────────────────────────────────

export interface AITaskLog {
  id: string;
  sessionId?: string;
  userId?: string;
  taskType: AITaskType;
  provider: string;
  model: string;
  status: "success" | "failed" | "aborted" | "timeout";
  latencyMs: number;
  retryCount: number;
  inputLength: number;
  outputLength: number;
  errorCode?: string;
  errorMessage?: string;
  requestId?: string;
  createdAt: string;
}

// ─── 工具函数 ───────────────────────────────────────────────

export function isFinishedStep(step: WorkflowStep): boolean {
  return step === "save" || step === "performance_review";
}

export function isAIGeneratingStep(step: WorkflowStep): boolean {
  return [
    "detect", "material", "premise", "joke_to_premise",
    "premise_check", "angles", "draft", "rewrite",
    "performance_review",
  ].includes(step);
}

export function getNextStep(currentStep: WorkflowStep, inputType?: InputType | null): WorkflowStep {
  switch (currentStep) {
    case "input": return "detect";
    case "detect": {
      if (inputType === "material") return "premise";
      if (inputType === "joke") return "joke_to_premise";
      if (inputType === "premise") return "angles";
      if (inputType === "draft") return "rewrite";
      if (inputType === "performance") return "performance_review";
      return "premise";
    }
    case "material": return "premise";
    case "premise": return "angles";
    case "joke_to_premise": return "angles";
    case "angles": return "draft";
    case "draft": return "rewrite";
    case "rewrite": return "save";
    case "performance_review": return "save";
    case "save": return "save";
    default: return "detect";
  }
}

export function generateSessionTitle(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length <= 20) return trimmed;
  return trimmed.slice(0, 20) + "…";
}

export function newSession(mode: WorkflowMode = "guided"): WorkflowSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "",
    sourceInput: "",
    inputType: null,
    currentStep: "input",
    scriptStatus: "idea",
    mode,
    saveStatus: "idle",
    syncStatus: "local_only",
    rootCardIds: [],
    cards: [],
    createdAt: now,
    updatedAt: now,
  };
}
