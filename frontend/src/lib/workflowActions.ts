import type { CardType, WorkflowCard } from "@/contexts/WorkflowContext";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { useToast } from "@/components/Toast";

/**
 * 从不同类型卡片提取改稿所需的结构化内容
 * 禁止 fallback 到 currentDraft 或 globalState
 */
export function extractRewriteContent(card: WorkflowCard): string {
  const raw = card.rawData as any;

  if (card.type === "angles") {
    const recommended = raw?.recommended || {};
    const angleList = raw?.angles || raw?.items || [];

    const recommendedText = recommended.title || recommended.name
      ? [
          "【推荐角度】",
          `${recommended.title || recommended.name}${recommended.reason ? "：「" + recommended.reason + "」" : ""}`,
        ].filter(Boolean).join("\n")
      : "";

    const listText = Array.isArray(angleList) && angleList.length
      ? [
          "【可用角度列表】",
          ...angleList.map((item: any, i: number) => {
            const title = item.title || item.name || item.angle || "";
            const content = item.content || item.description || item.text || "";
            return `${i + 1}. ${title}${content ? "：「" + content + "」" : ""}`;
          }),
        ].join("\n")
      : "";

    const combined = [recommendedText, listText].filter(Boolean).join("\n\n");
    if (combined) return combined;
  }

  if (card.type === "premise") {
    const candidates = raw?.premise_candidates || [];
    const recommended = raw?.recommendation || {};

    const candidatesText = Array.isArray(candidates) && candidates.length
      ? [
          "【前提候选】",
          ...candidates.map((c: any, i: number) =>
            `${i + 1}. ${c.text || c.premise || ""}${c.reason ? "（" + c.reason + "）" : ""}`
          ),
        ].join("\n")
      : "";

    const recommendedText = recommended.text || recommended.premise
      ? [
          "【推荐前提】",
          `${recommended.text || recommended.premise}`,
        ].join("\n")
      : "";

    const combined = [recommendedText, candidatesText].filter(Boolean).join("\n\n");
    if (combined) return combined;
  }

  if (card.type === "joke_to_premise") {
    const candidates = raw?.candidates || [];

    const candidatesText = Array.isArray(candidates) && candidates.length
      ? [
          "【梗写前提】",
          ...candidates.map((c: any, i: number) =>
            `${i + 1}. ${c.premise || ""}${c.logic ? "：「" + c.logic + "」" : ""}`
          ),
        ].join("\n")
      : "";

    const combined = candidatesText;
    if (combined) return combined;
  }

  if (card.type === "rewrite") {
    return card.content || "";
  }

  // 最终兜底：只取 content，不 fallback 到任何全局状态
  return card.content || "";
}

export interface WorkflowAction {
  label: string;
  target?: CardType | "rewrite";
  action?: "copy" | "delete";
  danger?: boolean;
}

export interface WorkflowActionConfig {
  primary: WorkflowAction;
  more: WorkflowAction[];
}

export const WORKFLOW_ACTIONS: Record<CardType, WorkflowActionConfig> = {
  premise: {
    primary: { label: "找角度", target: "angles" },
    more: [
      { label: "改稿", target: "rewrite" },
      { label: "复制", action: "copy" },
      { label: "删除", action: "delete", danger: true },
    ],
  },
  joke_to_premise: {
    primary: { label: "找角度", target: "angles" },
    more: [
      { label: "改稿", target: "rewrite" },
      { label: "复制", action: "copy" },
      { label: "删除", action: "delete", danger: true },
    ],
  },
  angles: {
    primary: { label: "改稿", target: "rewrite" },
    more: [
      { label: "复制", action: "copy" },
      { label: "删除", action: "delete", danger: true },
    ],
  },
  rewrite: {
    primary: { label: "复制成稿", action: "copy" },
    more: [
      { label: "继续改稿", target: "rewrite" },
      { label: "删除", action: "delete", danger: true },
    ],
  },
  source: {
    primary: { label: "提炼前提", target: "premise" },
    more: [
      { label: "复制", action: "copy" },
      { label: "删除", action: "delete", danger: true },
    ],
  },
};

export function useWorkflowActions() {
  const { handoff } = useWorkflow();
  const { toast } = useToast();

  function getCardContent(card: WorkflowCard): string {
    const raw = card.rawData as Record<string, unknown>;
    // 优先用 recommendation.text
    if ((raw?.recommendation as any)?.text) return (raw.recommendation as any).text;
    // 其次用 premise_candidates
    if ((raw?.premise_candidates as any[])?.[0]?.text) return (raw.premise_candidates as any[])[0].text;
    // 再次用 angles
    if ((raw?.angles as any[])?.[0]?.angle) return (raw.angles as any[])[0].angle;
    // 最后用 content
    return card.content || "";
  }

  function executeAction(
    action: WorkflowAction,
    card: WorkflowCard,
    onDelete?: (cardId: string) => void
  ): boolean {
    if (!action) return false;

    if (action.action === "copy") {
      const content = getCardContent(card);
      if (!content.trim()) {
        toast("内容为空，无法复制", "error");
        return false;
      }
      navigator.clipboard.writeText(content).then(() => {
        toast("已复制到剪贴板");
      });
      return true;
    }

    if (action.action === "delete") {
      if (onDelete) onDelete(card.id);
      return true;
    }

    if (action.target) {
      // 改稿目标使用 extractRewriteContent 获取完整结构化内容
      const isRewrite = action.target === "rewrite";
      const content = isRewrite ? extractRewriteContent(card) : getCardContent(card);
      if (!content.trim()) {
        toast("这条记录没有可带入改稿的内容", "error");
        return false;
      }
      const shortTitle = card.title?.slice(0, 25) || "内容";
      handoff(action.target, content, card.sourcePath, shortTitle);
      return true;
    }

    return false;
  }

  return { executeAction, getCardContent };
}
