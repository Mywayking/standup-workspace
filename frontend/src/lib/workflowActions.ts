import type { CardType, WorkflowCard } from "@/contexts/WorkflowContext";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { useToast } from "@/components/Toast";

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
      const content = getCardContent(card);
      if (!content.trim()) {
        toast("这条记录没有可继续的内容", "error");
        return false;
      }
      handoff(action.target, content, card.sourcePath);
      toast(`已带入「${action.label}」`);
      return true;
    }

    return false;
  }

  return { executeAction, getCardContent };
}
