"use client";
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { authApi } from "@/lib/api";

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
  sourcePath: string[];
  version?: number;
  createdAt: string;
  // V1.2 扩展字段
  stage_version?: string;
  stage_annotations?: Array<{
    type: "pause" | "stress" | "laugh" | "callback";
    position: number;
    text: string;
    note: string;
  }>;
  stages?: Array<"source" | "premise" | "angles" | "rewrite" | "stage_version">;
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

// ─── API ─────────────────────────────────────────────────────────────────────

const API_BASE = "/api";

async function cloudListSessions(userId: string): Promise<WorkflowSession[]> {
  const res = await fetch(`${API_BASE}/workflow-sessions?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error("Failed to fetch sessions");
  return res.json();
}

async function cloudCreateSession(
  userId: string,
  title: string,
  sourceInput: string
): Promise<WorkflowSession> {
  const res = await fetch(`${API_BASE}/workflow-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, title, source_input: sourceInput }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

async function cloudUpdateSession(
  sessionId: string,
  title?: string,
  status?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/workflow-sessions/${sessionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, status }),
  });
  if (!res.ok) throw new Error("Failed to update session");
}

async function cloudDeleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/workflow-sessions/${sessionId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete session");
}

async function cloudAddCard(
  sessionId: string,
  card: Omit<WorkflowCard, "id" | "createdAt">
): Promise<void> {
  const res = await fetch(`${API_BASE}/workflow-sessions/${sessionId}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      card: {
        ...card,
        id: "", // server generates
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }),
  });
  if (!res.ok) throw new Error("Failed to add card");
}

// ─── Mappers ────────────────────────────────────────────────────────────────

function toApiCard(card: WorkflowCard) {
  return {
    id: card.id,
    type: card.type,
    title: card.title,
    content: card.content,
    summary: "",
    raw_data: card.rawData ?? {},
    source_step: card.sourcePath?.[card.sourcePath.length - 1] ?? null,
    source_card_id: null,
    source_chain: card.sourcePath ?? [],
    model: null,
    latency_ms: null,
    created_at: card.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function fromApiSession(s: any): WorkflowSession {
  return {
    id: s.id,
    sourceInput: s.source_input || "",
    currentStep: "source" as CardType,
    cards: (s.cards || []).map((c: any) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      content: c.content || "",
      rawData: c.raw_data || {},
      status: "success" as CardStatus,
      sourcePath: c.source_chain || [],
      createdAt: c.created_at,
    })),
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface WorkflowContextValue {
  session: WorkflowSession | null;
  initSession: (sourceInput: string) => void;
  resetSession: () => void;
  addCard: (card: Omit<WorkflowCard, "id" | "createdAt">) => string;
  addCardEnsuringSession: (sourceInput: string, card: Omit<WorkflowCard, "id" | "createdAt">) => string;
  deleteCard: (cardId: string) => void;
  appendRewriteVersion: (rewriteContent: string, rawData: unknown, sourcePath: string[], sourceInput?: string) => string;
  // Handoff: SessionPanel calls this to trigger WriteTabs' pending fill + tab switch
  handoff: (type: CardType, content: string, sourcePath: string[]) => void;
  setHandoffCallback: (fn: (type: CardType, content: string, sourcePath: string[]) => void) => void;
  sessions: WorkflowSession[];
  restoreSession: (id: string) => void;
  deleteSession: (id: string) => void;
  setSession: React.Dispatch<React.SetStateAction<WorkflowSession | null>>;
  cloudSynced: boolean; // true if user is logged in
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
  const { user, loggedIn } = useAuth();
  const [session, setSession] = useState<WorkflowSession | null>(null);
  const [sessions, setSessions] = useState<WorkflowSession[]>([]);
  const handoffRef = useRef<((type: CardType, content: string, sourcePath: string[]) => void) | null>(null);

  // P2: Load sessions on mount (localStorage for all; cloud for logged-in users)
  useEffect(() => {
    const local = loadSessions();
    const active = loadActiveSession();

    if (loggedIn && user) {
      // Logged-in: merge cloud sessions with local
      cloudListSessions(String(user.id))
        .then((cloudSessions) => {
          const merged = mergeSessions(
            cloudSessions.map(fromApiSession),
            local
          );
          setSessions(merged);
          // Restore active session if it exists locally
          if (active) setSession(active);
        })
        .catch(() => {
          // Network error: fall back to local
          setSessions(local);
          if (active) setSession(active);
        });
    } else {
      // Not logged in: use local only
      setSessions(local);
      if (active) setSession(active);
    }

    // Clean up legacy keys
    try {
      localStorage.removeItem("premise_history");
      localStorage.removeItem("angles_history");
    } catch {}
  }, [loggedIn, user]);

  // Sync session to localStorage on every change
  useEffect(() => {
    saveActiveSession(session);
  }, [session]);

  // P2: Sync session changes to cloud (debounced, fire-and-forget)
  useEffect(() => {
    if (!loggedIn || !user || !session) return;
    const timer = setTimeout(() => {
      cloudSyncSession(String(user.id), session).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [session, loggedIn, user]);

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

  const resetSession = useCallback(async () => {
    setSession((prev) => {
      if (prev) {
        const archived = { ...prev, updatedAt: new Date().toISOString() };
        setSessions((prevSessions) => {
          const next = [archived, ...prevSessions].slice(0, 30);
          saveSessions(next);
          return next;
        });

        // P2 cloud sync
        if (loggedIn && user) {
          cloudUpdateSession(prev.id, undefined, "archived").catch(() => {});
        }
      }
      return null;
    });
  }, [loggedIn, user]);

  const addCard = useCallback(
    (card: Omit<WorkflowCard, "id" | "createdAt">): string => {
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
    },
    []
  );

  // Atomically creates session if null, then adds the card
  const addCardEnsuringSession = useCallback(
    (sourceInput: string, card: Omit<WorkflowCard, "id" | "createdAt">): string => {
      const id = genId("card");
      const now = new Date().toISOString();
      setSession((prev) => {
        const session = prev ?? {
          id: genId("session"),
          sourceInput,
          currentStep: "source" as const,
          cards: [],
          createdAt: now,
          updatedAt: now,
        };
        return {
          ...session,
          cards: [...session.cards, { ...card, id, createdAt: now }],
          updatedAt: now,
        };
      });
      return id;
    },
    []
  );

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

  const appendRewriteVersion = useCallback(
    (rewriteContent: string, rawData: unknown, sourcePath: string[], sourceInput: string = "改稿"): string => {
      const id = genId("card");
      const now = new Date().toISOString();

      setSession((prev) => {
        const session = prev ?? {
          id: genId("session"),
          sourceInput,
          currentStep: "source" as const,
          cards: [],
          createdAt: now,
          updatedAt: now,
        };
        const rewriteCards = session.cards.filter((c) => c.type === "rewrite");
        const maxVersion = rewriteCards.reduce((max, c) => Math.max(max, c.version ?? 1), 0);
        const newVersion = maxVersion + 1;

        const card: WorkflowCard = {
          id,
          type: "rewrite",
          title: `改稿版本 v${newVersion}`,
          content: rewriteContent,
          rawData,
          status: "success",
          sourcePath,
          version: newVersion,
          createdAt: now,
        };

        return { ...session, cards: [...session.cards, card], updatedAt: now };
      });

      return id;
    },
    []
  );

  const handoff = useCallback((type: CardType, content: string, sourcePath: string[]) => {
    handoffRef.current?.(type, content, sourcePath);
  }, []);

  const setHandoffCallback = useCallback(
    (fn: (type: CardType, content: string, sourcePath: string[]) => void) => {
      handoffRef.current = fn;
    },
    []
  );

  const restoreSession = useCallback((id: string) => {
    setSessions((prevSessions) => {
      const found = prevSessions.find((s) => s.id === id);
      if (found) setSession(found);
      return prevSessions;
    });
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        saveSessions(next);
        return next;
      });

      // P2 cloud sync
      if (loggedIn && user) {
        cloudDeleteSession(id).catch(() => {});
      }
    },
    [loggedIn, user]
  );

  const cloudSynced = loggedIn;

  return (
    <WorkflowContext.Provider
      value={{
        session,
        initSession, resetSession,
        addCard, addCardEnsuringSession, deleteCard,
        appendRewriteVersion,
        handoff, setHandoffCallback,
        sessions, restoreSession, deleteSession, setSession,
        cloudSynced,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Sync a local session to the cloud:
 * - If session exists on cloud: update it
 * - If not: create it, then add all cards
 */
async function cloudSyncSession(
  userId: string,
  localSession: WorkflowSession
): Promise<string> {
  let sessionId = localSession.id;

  try {
    // Try to create (if already exists, server will return existing)
    const created = await cloudCreateSession(
      userId,
      localSession.sourceInput.slice(0, 100) || "新会话",
      localSession.sourceInput
    );
    sessionId = created.id;

    // Add all cards
    for (const card of localSession.cards) {
      await cloudAddCard(sessionId, card);
    }
  } catch {
    // Session may already exist — update title/status
    try {
      await cloudUpdateSession(sessionId);
    } catch {}
  }

  return sessionId;
}

/**
 * Merge cloud sessions with local sessions.
 * Prefer cloud version when same ID exists; otherwise combine both lists.
 * Sort by updatedAt descending.
 */
function mergeSessions(
  cloud: WorkflowSession[],
  local: WorkflowSession[]
): WorkflowSession[] {
  const byId = new Map<string, WorkflowSession>();

  for (const s of cloud) byId.set(s.id, s);
  for (const s of local) {
    if (!byId.has(s.id)) byId.set(s.id, s);
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
