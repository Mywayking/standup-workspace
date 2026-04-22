"use client";
import React, { useState } from "react";
import { useWorkflow, type WorkflowCard, type CardType } from "./WorkflowContext";

const CARD_TYPE_LABELS: Record<CardType, string> = {
  source: "原始素材",
  premise: "前提提炼",
  angles: "角度分析",
  rewrite: "改稿",
  joke_to_premise: "梗写前提",
};

const CARD_TYPE_ICONS: Record<CardType, string> = {
  source: "📝",
  premise: "💡",
  angles: "🔍",
  rewrite: "✏️",
  joke_to_premise: "🎯",
};

const SEND_TARGETS: { label: string; type: CardType }[] = [
  { label: "→ 提炼前提", type: "premise" },
  { label: "→ 梗写前提", type: "joke_to_premise" },
  { label: "→ 找角度", type: "angles" },
  { label: "→ 改稿", type: "rewrite" },
];

function SourceBadge({ step, version }: { step?: string; version?: number }) {
  if (!step && !version) return null;
  return (
    <span className="text-xs text-gray-400 ml-auto shrink-0">
      {step && `来自：${step}`}
      {version && ` v${version}`}
    </span>
  );
}

function CardItem({ card, isLatest }: { card: WorkflowCard; isLatest?: boolean }) {
  const { deleteCard, handoff } = useWorkflow();
  const [showMore, setShowMore] = useState(false);

  // 发送内容到目标步骤（只负责切换 Tab + 带入内容，不预插结果卡）
  // 结果卡只在目标步骤真正生成后，通过 onResultDone 写入 session
  const handleSendTo = (targetType: CardType) => {
    const myLabel = CARD_TYPE_LABELS[card.type];
    // 追加来源链：跳过与上一个节点相同的重复（如前提→角度→角度→改稿）
    const sourceChain = card.sourceStep
      ? card.sourceStep.endsWith(myLabel)
        ? card.sourceStep  // 已以当前卡类型结尾，不重复追加
        : `${card.sourceStep} → ${myLabel}`
      : myLabel;
    handoff(targetType, card.content, sourceChain);
    setShowMore(false);
  };

  // 主路径按钮（根据当前卡片类型决定最自然的下一步）
  const getPrimaryTarget = (): CardType | null => {
    if (card.type === "premise" || card.type === "joke_to_premise") return "angles";
    if (card.type === "angles") return "rewrite";
    return null;
  };

  const primaryTarget = getPrimaryTarget();
  const primaryLabel = primaryTarget ? SEND_TARGETS.find(t => t.type === primaryTarget)?.label : null;
  const otherTargets = SEND_TARGETS.filter(t => t.type !== card.type && t.type !== primaryTarget);

  return (
    <div className={`p-3 rounded-xl border transition-all ${
      isLatest
        ? "bg-blue-50/30 border-blue-200 shadow-sm"
        : "bg-white border-gray-100 hover:border-blue-200"
    }`}>
      {/* Header */}
      <div className="flex items-start gap-1.5 mb-1.5">
        <span className="text-sm shrink-0">{CARD_TYPE_ICONS[card.type]}</span>
        <div className="flex items-center flex-wrap gap-1 min-w-0 flex-1">
          <span className="text-xs font-medium text-gray-600 shrink-0">{CARD_TYPE_LABELS[card.type]}</span>
          {card.version && (
            <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
              v{card.version}
            </span>
          )}
          {isLatest && (
            <span className="text-xs px-1.5 py-0.5 bg-green-50 text-green-600 rounded font-medium">
              最新
            </span>
          )}
        </div>
        <button
          onClick={() => deleteCard(card.id)}
          className="text-gray-300 hover:text-red-400 text-xs shrink-0 transition-colors"
          title="删除"
        >
          ✕
        </button>
      </div>

      {/* 来源链 */}
      {card.sourceStep && (
        <div className="mb-1.5">
          <span className="text-xs text-gray-400">
            {card.sourceStep}
          </span>
        </div>
      )}

      {/* 内容预览 */}
      <p className="text-sm text-gray-800 line-clamp-3 leading-relaxed">
        {card.content.slice(0, 100)}
        {card.content.length > 100 ? "…" : ""}
      </p>

      {/* 按钮组 */}
      {primaryTarget && (
        <div className="flex items-center gap-1.5 mt-2">
          <button
            onClick={() => handleSendTo(primaryTarget)}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            {primaryLabel}
          </button>

          {otherTargets.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowMore(!showMore)}
                className="text-xs px-2 py-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
              >
                更多 ▾
              </button>
              {showMore && (
                <div className="absolute bottom-full mb-1 right-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-10 min-w-[120px]">
                  {otherTargets.map((target) => (
                    <button
                      key={target.type}
                      onClick={() => handleSendTo(target.type)}
                      className="w-full text-left text-xs px-3 py-1.5 text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      {target.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HistorySessionItem({
  s,
  onRestore,
  onDelete,
}: {
  s: { id: string; sourceInput: string; cards: WorkflowCard[]; createdAt: string; updatedAt: string };
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const date = new Date(s.updatedAt).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // 统计各类型卡片数
  const typeCount: Record<string, number> = {};
  s.cards.forEach((c) => {
    typeCount[c.type] = (typeCount[c.type] ?? 0) + 1;
  });
  const typeSummary = Object.entries(typeCount)
    .map(([t, n]) => `${CARD_TYPE_ICONS[t as CardType]}${n}`)
    .join(" ");

  return (
    <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700 line-clamp-1 truncate">{s.sourceInput}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {date} · {s.cards.length} 个结果{typeSummary ? ` · ${typeSummary}` : ""}
        </p>
      </div>
      <button
        onClick={() => onRestore(s.id)}
        className="text-xs text-blue-600 hover:text-blue-700 shrink-0 font-medium"
      >
        继续
      </button>
      <button
        onClick={() => onDelete(s.id)}
        className="text-xs text-gray-400 hover:text-red-400 shrink-0"
      >
        删除
      </button>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  const { sessions, restoreSession } = useWorkflow();

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <p className="text-sm font-bold text-gray-800 mb-1">创作会话</p>
      <p className="text-xs text-gray-400 mb-4">从左侧开始，生成结果会自动出现在这里</p>

      {sessions.length > 0 && (
        <>
          <p className="text-xs font-semibold text-gray-400 mb-2">最近创作</p>
          <div className="space-y-2">
            {sessions.slice(0, 3).map((s) => (
              <HistorySessionItem
                key={s.id}
                s={s}
                onRestore={restoreSession}
                onDelete={() => {}}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Active Session Panel ────────────────────────────────────────────────────

export default function WorkflowSessionPanel() {
  const { session, resetSession, sessions, restoreSession, deleteSession } = useWorkflow();
  const [showHistory, setShowHistory] = useState(false);

  if (!session) {
    return <EmptyState />;
  }

  const rewriteCards = session.cards.filter((c) => c.type === "rewrite");
  const nonRewriteCards = session.cards.filter((c) => c.type !== "rewrite");
  const latestCardId = session.cards.length > 0
    ? session.cards.reduce((latest, c) => c.createdAt > latest.createdAt ? c : latest, session.cards[0]).id
    : null;

  // 卡片类型分布
  const typeCount: Record<string, number> = {};
  session.cards.forEach((c) => {
    typeCount[c.type] = (typeCount[c.type] ?? 0) + 1;
  });
  const typeSummary = Object.entries(typeCount)
    .map(([t, n]) => `${CARD_TYPE_ICONS[t as CardType]}${n}`)
    .join(" ");

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-sm font-bold text-gray-800">当前创作会话</p>
          <p className="text-xs text-gray-400">
            {session.cards.length} 个结果
            {typeSummary ? ` · ${typeSummary}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {showHistory ? "收起历史" : `历史(${sessions.length})`}
          </button>
          <button
            onClick={resetSession}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            结束
          </button>
        </div>
      </div>

      {/* 历史面板（可折叠） */}
      {showHistory && (
        <div className="mb-3 space-y-2 max-h-48 overflow-y-auto border-t border-gray-100 pt-3">
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-400 text-center">暂无其他历史</p>
          ) : (
            sessions.map((s) => (
              <HistorySessionItem
                key={s.id}
                s={s}
                onRestore={restoreSession}
                onDelete={deleteSession}
              />
            ))
          )}
        </div>
      )}

      {/* Source */}
      <div className="mb-3 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-xs text-gray-400 font-medium mb-1">原始素材</p>
        <p className="text-xs text-gray-600 line-clamp-2">{session.sourceInput}</p>
      </div>

      {/* Cards */}
      {session.cards.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-gray-400">开始创作后结果会显示在这里</p>
          <p className="text-xs text-gray-300 mt-1">
            在左侧任一工具输入内容，完成后保存到会话
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {/* 非改稿卡片 */}
          {nonRewriteCards.map((card) => (
            <CardItem key={card.id} card={card} />
          ))}

          {/* 改稿多版本 */}
          {rewriteCards.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5 mt-2">✏️ 改稿版本</p>
              <div className="space-y-1.5">
                {rewriteCards.map((card) => (
                  <CardItem key={card.id} card={card} isLatest={card.id === latestCardId} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
