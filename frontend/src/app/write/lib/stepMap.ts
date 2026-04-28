// ============================================================
// stepMap.ts — 步骤与接口映射
// Standup Workspace v3.0
// ============================================================

import type {
  WorkflowStep,
  InputType,
  AITaskType,
  WorkflowSession,
  WorkflowCard,
} from "../types";

// 步骤对应的后端 API 端点
export const STEP_API_MAP: Record<WorkflowStep, string> = {
  input: "",
  detect: "/api/write/detect-input",
  material: "/api/write/premise/stream",
  premise: "/api/write/premise/stream",
  joke_to_premise: "/api/write/joke-to-premise/stream",
  premise_check: "/api/write/premise-check/stream",
  angles: "/api/write/angles/stream",
  draft: "/api/write/draft/stream",
  rewrite: "/api/write/rewrite/stream",
  performance_review: "/api/write/performance-review/stream",
  save: "",
};

// AI Task Type 映射
export const STEP_TO_TASK_TYPE: Record<WorkflowStep, AITaskType> = {
  input: "detect_input",
  detect: "detect_input",
  material: "premise",
  premise: "premise",
  joke_to_premise: "joke_to_premise",
  premise_check: "premise_check",
  angles: "angles",
  draft: "draft",
  rewrite: "rewrite",
  performance_review: "performance_review",
  save: "detect_input",
};

// 输入类型 → 初始步骤
export const INPUT_TYPE_TO_INITIAL_STEP: Record<InputType, WorkflowStep> = {
  material: "material",
  premise: "angles",
  joke: "joke_to_premise",
  draft: "rewrite",
  performance: "performance_review",
};

// 输入检测结果 → 初始步骤
export function resolveInitialStep(inputType: InputType | null | undefined): WorkflowStep {
  if (!inputType) return "material";
  return INPUT_TYPE_TO_INITIAL_STEP[inputType] ?? "material";
}

// 当前步骤 → 下一步
export function resolveNextStep(session: WorkflowSession): WorkflowStep {
  const { currentStep, inputType } = session;
  switch (currentStep) {
    case "input": return "detect";
    case "detect": return resolveInitialStep(inputType);
    case "material": return "premise";
    case "premise": return "angles";
    case "joke_to_premise": return "angles";
    case "angles": return "draft";
    case "draft": return "rewrite";
    case "rewrite": return "save";
    case "performance_review": return "save";
    default: return "save";
  }
}

// 检测输入类型映射
export function mapDetectResultToInputType(detectResult: string): InputType {
  const r = detectResult.toLowerCase();
  if (r.includes("素材") || r.includes("material")) return "material";
  if (r.includes("梗") || r.includes("joke") || r.includes("笑点")) return "joke";
  if (r.includes("前提") || r.includes("premise") || r.includes("判断")) return "premise";
  if (r.includes("草稿") || r.includes("draft") || r.includes("段子")) return "draft";
  if (r.includes("演出") || r.includes("performance") || r.includes("反馈")) return "performance";
  return "material";
}

// 步骤是否需要 AI 调用
export function stepNeedsAI(step: WorkflowStep): boolean {
  return !["input", "save"].includes(step);
}

// 步骤是否需要用户输入
export function stepNeedsUserInput(step: WorkflowStep): boolean {
  return step === "input";
}

// 步骤是否可以前进
export function canAdvanceToNextStep(session: WorkflowSession): boolean {
  const { currentStep, scriptStatus } = session;
  if (currentStep === "save") return false;
  if (currentStep === "input") return session.sourceInput.trim().length > 0;
  if (scriptStatus === "idea" && currentStep === "material") return true;
  return true;
}
