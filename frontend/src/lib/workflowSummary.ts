import type { WorkflowCard, CardType } from "@/contexts/WorkflowContext";

export function getWorkflowCardSummary(card: WorkflowCard): {
  title: string;
  subtitle: string;
  body: string;
  tags: string[];
  primaryAction: {
    label: string;
    targetType: CardType;
    content: string;
  } | null;
} {
  if (card.type === "premise") {
    const raw = card.rawData as any;
    return {
      title: "前提提炼",
      subtitle: raw.theme ? `主题：${raw.theme}` : "已生成前提",
      body: raw.recommendation?.text || raw.premise_candidates?.[0]?.text || card.content.slice(0, 100),
      tags: [raw.attitude, raw.core_contradiction].filter(Boolean),
      primaryAction: {
        label: "找角度",
        targetType: "angles",
        content: raw.recommendation?.text || card.content,
      },
    };
  }
  if (card.type === "angles") {
    const raw = card.rawData as any;
    return {
      title: "角度分析",
      subtitle: raw.recommendation?.name ? `推荐角度：${raw.recommendation.name}` : "已生成角度",
      body: raw.recommendation?.reason || raw.angles?.[0]?.description || card.content.slice(0, 100),
      tags: raw.angles?.slice(0, 3).map((a: any) => a.name) ?? [],
      primaryAction: {
        label: "改稿",
        targetType: "rewrite",
        content: raw.recommendation?.name || card.content,
      },
    };
  }
  if (card.type === "rewrite") {
    return {
      title: card.version ? `改稿版本 v${card.version}` : "改稿结果",
      subtitle: "草稿 → 成品",
      body: card.content.slice(0, 120),
      tags: ["可复制", "可继续改"],
      primaryAction: null,
    };
  }
  if (card.type === "joke_to_premise") {
    const raw = card.rawData as any;
    return {
      title: "梗写前提",
      subtitle: raw.theme ? `主题：${raw.theme}` : "已生成前提",
      body: raw.recommendation?.text || card.content.slice(0, 100),
      tags: [],
      primaryAction: {
        label: "找角度",
        targetType: "angles",
        content: raw.recommendation?.text || card.content,
      },
    };
  }
  return {
    title: card.title,
    subtitle: "",
    body: card.content.slice(0, 100),
    tags: [],
    primaryAction: null,
  };
}
