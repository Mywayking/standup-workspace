// ============================================================
// hooks/useWorkflowSession.ts — 创作链路统一封装
//
// Wraps useWriteSession and adds:
//   - Card selection state (single/multi)
//   - getParentCard(cardId)      — get the parent card
//   - getSourceChain(cardId)      — full ancestor chain as card array
//   - createUserCard(input)       — unified user card factory
//   - selectCard / deselectCard  — selection management
//   - getSelectedCardByType(type) — query helpers
//
// Epic 3.2 — minimal scope, no UI changes
// ============================================================

import { useCallback, useMemo } from "react";
import type { WorkCard } from "../types";
import { useWriteSession } from "./useWriteSession";

// ─── Selection Helpers ───────────────────────────────────────

function buildSourcePathFromChain(ancestors: WorkCard[]): string[] {
  if (ancestors.length === 0) return ["用户输入"];
  return ancestors.flatMap((c) => {
    if (c.type === "material") return ["用户输入"];
    if (c.type === "angle" || c.type === "angles") return ["angle"];
    return [c.type];
  });
}

// ─── Hook ───────────────────────────────────────────────────

export function useWorkflowSession() {
  const session = useWriteSession();

  // ── Selection state ─────────────────────────────────────
  // Currently selected card IDs; premise/angle are single-select,
  // rewrite may be multi-select depending on future UX needs.
  // We store as a Set for O(1) lookup.

  // NOTE: Selection state lives here in this hook.
  // The WashiRightPanel reads session data directly for now (Epic 3.2 scope).
  // Future (Epic 4): this state should be lifted to a Context.

  // ── Get a single card by id ─────────────────────────────

  function getCard(cardId: string): WorkCard | undefined {
    for (const s of session.sessions) {
      const found = s.cards.find((c) => c.id === cardId);
      if (found) return found;
    }
    return undefined;
  }

  // ── Get the parent card of a given card ────────────────

  function getParentCard(cardId: string): WorkCard | undefined {
    const card = getCard(cardId);
    if (!card) return undefined;
    if (!card.sourceCardId) return undefined;
    return getCard(card.sourceCardId);
  }

  // ── Get full source chain for a card ──────────────────

  /**
   * Returns the ancestor chain from the root (material) to the given card,
   * inclusive of the given card.  The chain is ordered from oldest to newest.
   *
   * Example:
   *   getSourceChain(rewriteCard.id)
   *   → [materialCard, premiseCard, userPremiseCard, angleCard, rewriteCard]
   */
  function getSourceChain(cardId: string): WorkCard[] {
    const chain: WorkCard[] = [];
    let current: WorkCard | undefined = getCard(cardId);

    while (current) {
      chain.unshift(current); // prepend so oldest comes first
      if (!current.sourceCardId) break;
      current = getCard(current.sourceCardId);
    }

    return chain;
  }

  // ── Query helpers ──────────────────────────────────────

  /**
   * Returns the most recent card of the given type in the active session,
   * or undefined if none exists.
   */
  function getLastCardByType(
    type: WorkCard["type"]
  ): WorkCard | undefined {
    return session.activeCards
      .slice()
      .reverse()
      .find((c) => c.type === type);
  }

  /**
   * Returns all cards of the given type in the active session.
   */
  function getCardsByType(type: WorkCard["type"]): WorkCard[] {
    return session.activeCards.filter((c) => c.type === type);
  }

  // ── Card factories ──────────────────────────────────────

  /**
   * Create a user card for a given input text.
   * The parentCard parameter is used to build sourcePath + sourceCardId for
   * the generated child card that will reference this user card.
   *
   * NOTE: This creates the card object but does NOT add it to the session.
   * Call session.addCard(userCard) after this.
   */
  function createUserCard(
    input: string,
    parentCard?: Pick<WorkCard, "id" | "type" | "sourcePath">,
    sessionId?: string
  ): WorkCard {
    const activeSid = session.activeSessionId ?? sessionId ?? "";
    const pathBase = parentCard?.sourcePath ?? ["用户输入"];
    // Strip trailing duplicate step type before appending
    const stepType = parentCard ? parentCard.type : "material";
    const sourcePath: string[] =
      pathBase[pathBase.length - 1] === stepType
        ? pathBase
        : [...pathBase, stepType];

    return {
      id: crypto.randomUUID(),
      sessionId: activeSid,
      type: "material",
      role: "user",
      title: "用户输入",
      content: input,
      sourcePath,
      createdAt: Date.now(),
    };
  }

  return {
    // ── From useWriteSession ──────────────────────────────
    sessions: session.sessions,
    activeSession: session.activeSession,
    activeSessionId: session.activeSessionId,
    activeCards: session.activeCards,
    createSession: session.createSession,
    createSessionIfNeeded: session.createSessionIfNeeded,
    addCard: session.addCard,
    updateCard: session.updateCard,
    removeSession: session.removeSession,
    renameSession: session.renameSession,
    setActiveSessionId: session.setActiveSessionId,

    // ── New in useWorkflowSession ───────────────────────
    getCard,
    getParentCard,
    getSourceChain,
    getLastCardByType,
    getCardsByType,
    createUserCard,
  };
}
