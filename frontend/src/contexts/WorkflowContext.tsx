"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CardType = "source" | "premise" | "angles" | "rewrite" | "joke_to_premise";

export type CardStatus = "success" | "error" | "streaming";

export interface WorkflowCard {
  id: string;
  type: CardType;
  title: string;         // 卡片标题（用于展示）
  content: string;       // 主要文本内容
  rawData: unknown;      // 完整原始数据
  status: CardStatus;
  sourceStep?: string;   // "来自：前提提炼结果 v2" 等
  version?: number;      // 版本号（改稿多版本）
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
  // 当前活跃 session
  session: WorkflowSession | null;
  // pending 数据（待填充到目标步骤的输入）
  pendingCard: { type: CardType; content: string; rawData: unknown; sourceStep?: string } | null;

  // Session CRUD
  initSession: (sourceInput: string) => void;
  resetSession: () => void;

  // 卡操作
  addCard: (card: Omit<WorkflowCard, "id" | "createdAt">) => string;
  deleteCard: (cardId: string) => void;

  // 多版本：改稿结果追加新版本（不覆盖）
  appendRewriteVersion: (rewriteContent: string, rawData: unknown, sourceStep?: string) => string;

  // pending 填充
  setPending: (data: { type: CardType; content: string; rawData: unknown; sourceStep?: string } | null) => void;

  // 历史 session（已结束）
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
  const [pending, setPending] = useState<{
    type: CardType; content: string; rawData: unknown; sourceStep?: string;
  } | null>(null);
  const [sessions, setSessions] = useState<WorkflowSession[]>([]);

  // 初始化时加载历史
  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const initSession = useCallback((sourceInput: string) => {
    const now = new Date().toISOString();
    setSession({
      id: genId("session"),
      sourceInput,
      currentStep: "source",
      cards: [],
      createdAt: now,
      updatedAt: now,
    });
    setPending(null);
  }, []);

  const resetSession = useCallback(() => {
    setSession((prev) => {
      if (prev) {
        // 保留最近 10 个历史 session
        const saved = [prev, ...sessions].slice(0, 10);
        setSessions(saved);
        saveSessions(saved);
      }
      return null;
    });
  }, [sessions]);

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

  // 改稿多版本：追加而不是覆盖
  const appendRewriteVersion = useCallback((rewriteContent: string, rawData: unknown, sourceStep?: string): string => {
    const id = genId("card");
    const now = new Date().toISOString();

    setSession((prev) => {
      if (!prev) return prev;

      // 找出当前已有的 rewrite 卡片最大版本号
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

  const setPendingFn = useCallback((data: typeof pending) => {
    setPending(data);
  }, []);

  const restoreSession = useCallback((id: string) => {
    const found = sessions.find((s) => s.id === id);
    if (found) {
      setSession(found);
      setPending(null);
    }
  }, [sessions]);

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
        session, pendingCard: pending,
        initSession, resetSession,
        addCard, deleteCard,
        appendRewriteVersion,
        setPending: setPendingFn,
        sessions, restoreSession, deleteSession,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}
