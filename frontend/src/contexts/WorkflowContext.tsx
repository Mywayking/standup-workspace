"use client";
import React, { createContext, useContext, useState, useCallback, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CardType = "source" | "premise" | "angles" | "rewrite" | "joke_to_premise";

export type CardStatus = "success" | "error" | "streaming";

export interface WorkflowCard {
  id: string;
  type: CardType;
  title: string;
  content: string;              // 主要内容（纯文本或结构化摘要）
  rawData: unknown;             // 原始完整数据，供下游使用
  status: CardStatus;
  sourceStep?: string;         // "前提提炼" "第2个角度" 等
  createdAt: string;
}

export interface WorkflowSession {
  id: string;
  sourceInput: string;          // 最初素材/段子
  currentStep: CardType;
  cards: WorkflowCard[];
  createdAt: string;
  updatedAt: string;
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface WorkflowContextValue {
  session: WorkflowSession | null;
  pendingCard: { type: CardType; content: string; rawData: unknown; sourceStep?: string } | null;

  // 创建/重置 session
  initSession: (sourceInput: string) => void;
  resetSession: () => void;

  // 追加结果卡片
  addCard: (card: Omit<WorkflowCard, "id" | "createdAt">) => string;

  // 切换步骤（但不追加卡片）
  setCurrentStep: (step: CardType) => void;

  // 从结果卡片继续（带数据跳转）
  resumeFromCard: (cardId: string) => void;

  // 清除 pending
  clearPending: () => void;
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function useWorkflow(): WorkflowContextValue {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error("useWorkflow must be used inside WorkflowProvider");
  return ctx;
}

// ─── Provider ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${++_idCounter}`;
}

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<WorkflowSession | null>(null);
  const [pending, setPending] = useState<{
    type: CardType;
    content: string;
    rawData: unknown;
    sourceStep?: string;
  } | null>(null);

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
    setSession(null);
    setPending(null);
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

  const setCurrentStep = useCallback((step: CardType) => {
    setSession((prev) => {
      if (!prev) return prev;
      return { ...prev, currentStep: step, updatedAt: new Date().toISOString() };
    });
  }, []);

  const resumeFromCard = useCallback((cardId: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const card = prev.cards.find((c) => c.id === cardId);
      if (!card) return prev;

      // 根据卡片类型决定 pending 内容
      let content = "";
      let rawData: unknown = null;
      let sourceStep = card.title;

      if (card.type === "premise") {
        content = typeof card.rawData === "string" ? card.rawData : card.content;
        rawData = card.rawData;
      } else if (card.type === "angles") {
        content = card.content; // 角度文本
        rawData = card.rawData;
      } else if (card.type === "joke_to_premise") {
        content = card.content;
        rawData = card.rawData;
      } else if (card.type === "rewrite") {
        content = card.content;
        rawData = card.rawData;
      }

      setPending({ type: card.type, content, rawData, sourceStep });
      return { ...prev, currentStep: card.type, updatedAt: new Date().toISOString() };
    });
  }, []);

  const clearPending = useCallback(() => setPending(null), []);

  return (
    <WorkflowContext.Provider
      value={{
        session,
        pendingCard: pending,
        initSession,
        resetSession,
        addCard,
        setCurrentStep,
        resumeFromCard,
        clearPending,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}
