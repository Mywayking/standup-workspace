"use client";
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CardType = "source" | "premise" | "angles" | "rewrite" | "joke_to_premise";

export type CardStatus = "success" | "error" | "streaming";

export interface WorkflowCard {
  id: string;
  type: CardType;
  title: string;
  content: string;
  rawData: unknown;
  status: CardStatus;
  sourceStep?: string;
  version?: number;
  createdAt: string;
}

export interface WorkflowSession {
  id: string;
  sourceInput: string;
  currentStep: CardType;
  cards: WorkflowCard[];
  createdAt: string;
  updatedAt: string;
}

// ─── LocalStorage ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "workflow_sessions";
const ACTIVE_KEY = "workflow_active_session";

function loadActiveSession(): WorkflowSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveActiveSession(session: WorkflowSession | null) {
  try {
    if (session) localStorage.setItem(ACTIVE_KEY, JSON.stringify(session));
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {}
}

function loadSessions(): WorkflowSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessions(sessions: WorkflowSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface WorkflowContextValue {
  session: WorkflowSession | null;
  initSession: (sourceInput: string) => void;
  resetSession: () => void;
  addCard: (card: Omit<WorkflowCard, "id" | "createdAt">) => string;
  deleteCard: (cardId: string) => void;
  appendRewriteVersion: (rewriteContent: string, rawData: unknown, sourceStep?: string) => string;
  // Handoff: SessionPanel calls this to trigger WriteTabs' pending fill + tab switch
  handoff: (type: CardType, content: string, sourceStep?: string) => void;
  setHandoffCallback: (fn: (type: CardType, content: string, sourceStep?: string) => void) => void;
  sessions: WorkflowSession[];
  restoreSession: (id: string) => void;
  deleteSession: (id: string) => void;
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function useWorkflow(): WorkflowContextValue {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error("useWorkflow must be inside WorkflowProvider");
  return ctx;
}

// ─── Provider ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function genId(prefix: string) { return `${prefix}-${Date.now()}-${++_idCounter}`; }

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<WorkflowSession | null>(null);
  const [sessions, setSessions] = useState<WorkflowSession[]>([]);
  // Use ref so SessionPanel can call the callback without re-render trigger
  const handoffRef = useRef<((type: CardType, content: string, sourceStep?: string) => void) | null>(null);

  useEffect(() => {
    setSessions(loadSessions());
    // P1-6: restore active session from localStorage
    const active = loadActiveSession();
    if (active) setSession(active);
    // UX-4 Step 2: clean up legacy tab-level history keys
    try {
      localStorage.removeItem("premise_history");
      localStorage.removeItem("angles_history");
    } catch {}
  }, []);

  // P1-6: sync session to localStorage on every change
  useEffect(() => {
    saveActiveSession(session);
  }, [session]);

  const initSession = useCallback((sourceInput: string) => {
    setSession({
      id: genId("session"),
      sourceInput,
      currentStep: "source",
      cards: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const resetSession = useCallback(() => {
    setSession((prev) => {
      if (prev) {
        setSessions((prevSessions) => {
          const next = [prev, ...prevSessions].slice(0, 10);
          saveSessions(next);
          return next;
        });
      }
      return null;
    });
  }, []);

  const addCard = useCallback((card: Omit<WorkflowCard, "id" | "createdAt">): string => {
    const id = genId("card");
    const now = new Date().toISOString();
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: [...prev.cards, { ...card, id, createdAt: now }],
        updatedAt: now,
      };
    });
    return id;
  }, []);

  const deleteCard = useCallback((cardId: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: prev.cards.filter((c) => c.id !== cardId),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const appendRewriteVersion = useCallback((rewriteContent: string, rawData: unknown, sourceStep?: string): string => {
    const id = genId("card");
    const now = new Date().toISOString();

    setSession((prev) => {
      if (!prev) return prev;
      const rewriteCards = prev.cards.filter((c) => c.type === "rewrite");
      const maxVersion = rewriteCards.reduce((max, c) => Math.max(max, c.version ?? 1), 0);
      const newVersion = maxVersion + 1;

      const card: WorkflowCard = {
        id,
        type: "rewrite",
        title: `改稿版本 v${newVersion}`,
        content: rewriteContent,
        rawData,
        status: "success",
        sourceStep,
        version: newVersion,
        createdAt: now,
      };

      return { ...prev, cards: [...prev.cards, card], updatedAt: now };
    });

    return id;
  }, []);

  const handoff = useCallback((type: CardType, content: string, sourceStep?: string) => {
    handoffRef.current?.(type, content, sourceStep);
  }, []);

  const setHandoffCallback = useCallback((fn: (type: CardType, content: string, sourceStep?: string) => void) => {
    handoffRef.current = fn;
  }, []);

  const restoreSession = useCallback((id: string) => {
    setSessions((prevSessions) => {
      const found = prevSessions.find((s) => s.id === id);
      if (found) setSession(found);
      return prevSessions;
    });
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSessions(next);
      return next;
    });
  }, []);

  return (
    <WorkflowContext.Provider
      value={{
        session,
        initSession, resetSession,
        addCard, deleteCard,
        appendRewriteVersion,
        handoff, setHandoffCallback,
        sessions, restoreSession, deleteSession,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

// Export a helper for SessionPanel to call the handoff directly

