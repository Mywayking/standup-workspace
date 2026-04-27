import type { WorkflowCard, WorkflowSession } from "@/contexts/WorkflowContext";

/**
 * 获取卡片有效结果数量
 */
export function getCardResultCount(card: WorkflowCard): number {
  // 优先用 rawData
  const raw = card.rawData as any;
  if (raw) {
    if (Array.isArray(raw.results)) return raw.results.length;
    if (Array.isArray(raw.items)) return raw.items.length;
    if (Array.isArray(raw.candidates)) return raw.candidates.length;
    if (Array.isArray(raw.angles)) return raw.angles.length;
    if (Array.isArray(raw.premise_candidates)) return raw.premise_candidates.length;
  }
  // 其次用 content 长度
  if (card.content && card.content.trim().length > 0) return 1;
  return 0;
}

/**
 * 判断卡片是否可继续
 */
export function canContinueCard(card: WorkflowCard): boolean {
  return getCardResultCount(card) > 0;
}

/**
 * 判断 session 是否可继续
 */
export function canContinueSession(session: WorkflowSession): boolean {
  return session.cards.some(canContinueCard);
}

/**
 * 获取 session 中有效卡片数量
 */
export function getValidCardCount(session: WorkflowSession): number {
  return session.cards.filter(canContinueCard).length;
}

/**
 * 迁移旧格式历史数据
 */
export function migrateHistoryItem(raw: any): WorkflowCard | null {
  const content =
    raw.content ||
    raw.text ||
    raw.result ||
    raw.output ||
    "";

  const rawData = raw.rawData || raw;
  const resultCount = getCardResultCount({
    ...raw,
    content,
    rawData,
  } as WorkflowCard);

  // 过滤完全无内容的历史
  if (resultCount === 0 && !content.trim()) {
    return null;
  }

  return {
    id: raw.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: raw.type || raw.step || "unknown",
    title: raw.title || "未命名记录",
    content,
    rawData,
    status: raw.status || "success",
    sourcePath: raw.sourcePath || [],
    version: raw.version,
    createdAt: raw.createdAt || new Date().toISOString(),
  } as WorkflowCard;
}
