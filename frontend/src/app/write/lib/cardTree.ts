/**
 * cardTree.ts — WorkflowCard tree utilities
 * Standup Workspace v3.0 Phase 8
 */

import type { WorkflowSession, WorkflowCard } from "../types";

/**
 * Flatten all cards from all sessions into a Map keyed by cardId.
 * Also populates childrenIds based on parentId relationships.
 */
export function buildCardTree(sessions: WorkflowSession[]): Map<string, WorkflowCard> {
  const cardMap = new Map<string, WorkflowCard>();

  // First pass: add all cards to the map
  for (const session of sessions) {
    for (const card of session.cards) {
      cardMap.set(card.id, { ...card, childrenIds: [] });
    }
  }

  // Second pass: populate childrenIds
  for (const card of cardMap.values()) {
    if (card.parentId) {
      const parent = cardMap.get(card.parentId);
      if (parent) {
        if (!parent.childrenIds.includes(card.id)) {
          parent.childrenIds.push(card.id);
        }
      }
    }
  }

  return cardMap;
}

/**
 * Get all ancestor cards from root to the given cardId.
 */
export function getCardAncestors(
  cardId: string,
  cardMap: Map<string, WorkflowCard>
): WorkflowCard[] {
  const ancestors: WorkflowCard[] = [];
  let current = cardMap.get(cardId);
  while (current?.parentId) {
    const parent = cardMap.get(current.parentId);
    if (parent) {
      ancestors.unshift(parent);
      current = parent;
    } else {
      break;
    }
  }
  return ancestors;
}

/**
 * Get direct child cards of the given cardId.
 */
export function getCardChildren(
  cardId: string,
  cardMap: Map<string, WorkflowCard>
): WorkflowCard[] {
  return Array.from(cardMap.values()).filter((c) => c.parentId === cardId);
}

/**
 * Get all descendant card IDs of a given card (recursive).
 */
export function getAllDescendantIds(
  cardId: string,
  cardMap: Map<string, WorkflowCard>
): string[] {
  const children = getCardChildren(cardId, cardMap);
  const ids: string[] = [];
  for (const child of children) {
    ids.push(child.id);
    ids.push(...getAllDescendantIds(child.id, cardMap));
  }
  return ids;
}

/**
 * Set a card as the mainline card for its session.
 * Also marks all sibling and cousin cards in the same tree branch as non-mainline.
 */
export function setMainlineCard(
  session: WorkflowSession,
  cardId: string
): WorkflowSession {
  const cardMap = buildCardTree([session]);
  const targetCard = cardMap.get(cardId);
  if (!targetCard) return session;

  // Get all descendant IDs of the target card
  const descendantIds = new Set(getAllDescendantIds(cardId, cardMap));
  descendantIds.add(cardId);

  // Get the branch root (topmost ancestor or the card itself)
  const ancestors = getCardAncestors(cardId, cardMap);
  const branchRootId = ancestors[0]?.id ?? cardId;

  // Mark all cards in the same session as non-mainline,
  // except those in the target card's direct ancestry
  const updatedCards = session.cards.map((c) => {
    // Keep mainline for ancestors of target card
    if (c.id === branchRootId || ancestors.some((a) => a.id === c.id)) {
      return { ...c, isMainline: c.id === branchRootId };
    }
    // Mark descendants of target as non-mainline
    if (descendantIds.has(c.id)) {
      return { ...c, isMainline: c.id === cardId };
    }
    return { ...c, isMainline: false };
  });

  return {
    ...session,
    mainlineCardId: cardId,
    cards: updatedCards,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get sibling cards (same parentId) for version comparison.
 */
export function getCardSiblings(
  cardId: string,
  cardMap: Map<string, WorkflowCard>
): WorkflowCard[] {
  const card = cardMap.get(cardId);
  if (!card?.parentId) return [];
  return getCardChildren(card.parentId, cardMap);
}

/**
 * Find the previous card in the mainline path (for tree navigation).
 */
export function getPreviousMainlineCard(
  cardId: string,
  cardMap: Map<string, WorkflowCard>
): WorkflowCard | null {
  const ancestors = getCardAncestors(cardId, cardMap);
  if (ancestors.length === 0) return null;
  return ancestors[ancestors.length - 1]; // last ancestor = immediate parent
}

/**
 * Get the full mainline path from root to the given card.
 */
export function getMainlinePath(
  cardId: string,
  cardMap: Map<string, WorkflowCard>
): WorkflowCard[] {
  return [...getCardAncestors(cardId, cardMap), cardMap.get(cardId)!].filter(Boolean);
}

/**
 * Count how many versions exist for a given parent (branching factor).
 */
export function countSiblingVersions(
  cardId: string,
  cardMap: Map<string, WorkflowCard>
): number {
  return getCardSiblings(cardId, cardMap).length;
}
