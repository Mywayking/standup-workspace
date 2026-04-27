"use client";
import React, { useState } from "react";
import { useWorkflow, type WorkflowCard, type CardType } from "./WorkflowContext";
import { getWorkflowCardSummary } from "@/lib/workflowSummary";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/Toast";

const CARD_TYPE_LABELS: Record<CardType, string> = {
  source: "原始素材",
  premise: "前提提炼",
  angles: "角度分析",
  rewrite: "改稿",
  joke_to_premise: "梗写前提",
};

const STAGE_LABELS: Record<string, string> = {
  source: "素材",
  premise: "前提",
  angles: "角度",
  rewrite: "改稿",
  stage_version: "上台版",
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

function esc(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Card Detail Modal ───────────────────────────────────────────────────────

function CardDetailModal({
  card,
  onClose,
  onContinue,
}: {
  card: WorkflowCard;
  onClose: () => void;
  onContinue?: (target: CardType, content: string, sourcePath: string[]) => void;
}) {
  const raw = card.rawData as Record<string, unknown>;
  const type = card.type;

  // ESC to close + body scroll lock
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const actionMap: Record<string, { label: string; target: CardType | null } | null> = {
    premise: { label: "继续找角度", target: "angles" },
    joke_to_premise: { label: "继续找角度", target: "angles" },
    angles: { label: "继续改稿", target: "rewrite" },
    rewrite: null,
  };
  const action = actionMap[type];

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[760px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{CARD_TYPE_ICONS[card.type]}</span>
            <div>
              <p className="text-sm font-bold text-gray-800">
                {CARD_TYPE_LABELS[card.type]}
                {card.version ? ` v${card.version}` : ""}
              </p>
              {card.sourcePath.length > 0 && (
                <p className="text-xs text-gray-400">{card.sourcePath.join(" → ")}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Premise card detail */}
          {(type === "premise" || type === "joke_to_premise") && (
            <>
              {raw.theme && (
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-600 mb-1">主题</p>
                  <p className="text-sm text-gray-800">{esc(raw.theme)}</p>
                </div>
              )}
              {raw.attitude && (
                <div className="bg-orange-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-orange-600 mb-1">态度</p>
                  <p className="text-sm text-gray-800">{esc(raw.attitude)}</p>
                </div>
              )}
              {raw.core_contradiction && (
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-600 mb-1">核心矛盾</p>
                  <p className="text-sm text-gray-800">{esc(raw.core_contradiction)}</p>
                </div>
              )}
              {(raw.premise_candidates as any[])?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">前提候选</p>
                  <div className="space-y-2">
                    {(raw.premise_candidates as any[]).map((c: any, i: number) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                            {esc(c.type || c.best_type)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 mb-1">{esc(c.text)}</p>
                        {c.attitude && <p className="text-xs text-gray-500">态度：{esc(c.attitude)}</p>}
                        {c.core_contradiction && <p className="text-xs text-gray-500">矛盾：{esc(c.core_contradiction)}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {raw.recommendation && (raw.recommendation as any).text && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <p className="text-xs font-bold text-green-700 mb-2">⭐ 推荐前提</p>
                  <p className="text-base font-semibold text-gray-900 mb-1">
                    {esc((raw.recommendation as any).text)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {esc((raw.recommendation as any).reason)}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Angles card detail */}
          {type === "angles" && (
            <>
              {raw.premise && (
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-600 mb-1">当前前提</p>
                  <p className="text-sm text-gray-800">{esc(raw.premise)}</p>
                </div>
              )}
              {(raw.angles as any[])?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">角度列表</p>
                  <div className="space-y-3">
                    {(raw.angles as any[]).map((a: any, i: number) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800">{esc(a.name)}</span>
                          {(a.key_points as string[])?.slice(0, 3).map((kp: string) => (
                            <span key={kp} className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 rounded">
                              {esc(kp)}
                            </span>
                          ))}
                        </div>
                        {a.description && (
                          <p className="text-sm text-gray-600 mb-1">{esc(a.description)}</p>
                        )}
                        {a.rewrite_direction && (
                          <p className="text-xs text-orange-600 mt-1">
                            → {esc(a.rewrite_direction)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {raw.recommendation && (raw.recommendation as any).name && (
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                  <p className="text-xs font-bold text-purple-700 mb-2">⭐ 推荐角度</p>
                  <p className="text-base font-semibold text-gray-900 mb-1">
                    {esc((raw.recommendation as any).name)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {esc((raw.recommendation as any).reason)}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Rewrite card detail */}
          {type === "rewrite" && (
            <>
              {(raw.segments as any[])?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">段落拆解</p>
                  <div className="space-y-3">
                    {(raw.segments as any[]).map((seg: any, i: number) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">
                            {esc(seg.structure)}
                          </span>
                          {seg.attitude && (
                            <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">
                              {esc(seg.attitude)}
                            </span>
                          )}
                          {(seg.techniques as string[])?.map((t: string) => (
                            <span key={t} className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                              {esc(t)}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed">{esc(seg.text)}</p>
                        {seg.problem && (
                          <p className="text-xs text-red-600 mt-2 pt-2 border-t border-red-100">
                            ⚠️ {esc(seg.problem)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(raw.script_changes as any[])?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">✏️ 改写建议</p>
                  <div className="space-y-3">
                    {(raw.script_changes as any[]).map((c: any, i: number) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        {c.location && (
                          <p className="text-xs text-gray-400 mb-1.5">{esc(c.location)}</p>
                        )}
                        {c.original && c.improved && (
                          <div className="flex items-start gap-2">
                            <p className="text-sm text-gray-400 line-through flex-1">{esc(c.original)}</p>
                            <span className="text-gray-300 shrink-0">→</span>
                            <p className="text-sm text-gray-800 font-medium flex-1">{esc(c.improved)}</p>
                          </div>
                        )}
                        {c.technique_added && (
                          <p className="text-xs text-orange-600 mt-1 font-medium">
                            技巧：{esc(c.technique_added)}
                          </p>
                        )}
                        {c.reason && (
                          <p className="text-xs text-gray-500 mt-1">{esc(c.reason)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {raw.improved_script && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <p className="text-xs font-bold text-green-700 mb-2">✨ 优化版本</p>
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {esc(raw.improved_script)}
                  </p>
                </div>
              )}
              {(raw.techniques as string[])?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">技巧标签</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(raw.techniques as string[]).map((t: string) => (
                      <span key={t} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                        {esc(t)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(raw.next_suggestion as string) && (
                <div className="bg-indigo-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-indigo-600 mb-1">下一步建议</p>
                  <p className="text-sm text-gray-700">{esc(raw.next_suggestion)}</p>
                </div>
              )}
            </>
          )}

          {/* source card - just show content */}
          {type === "source" && (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {card.content}
            </p>
          )}

          {/* Fallback: if no structured rawData, show full content */}
          {!raw || Object.keys(raw).length === 0 ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {card.content}
            </p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex justify-between items-center">
          <div />
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            关闭
          </button>
          {action && onContinue && (
            <button
              onClick={() => {
                onContinue(action.target!, card.content, card.sourcePath);
                onClose();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Card Item ────────────────────────────────────────────────────────────────

function CardItem({
  card,
  isLatest,
  onView,
}: {
  card: WorkflowCard;
  isLatest?: boolean;
  onView: (card: WorkflowCard) => void;
}) {
  const { deleteCard, handoff } = useWorkflow();
  const [showMore, setShowMore] = useState(false);

  const handleSendTo = (targetType: CardType) => {
    const myLabel = CARD_TYPE_LABELS[card.type];
    const newPath = card.sourcePath
      ? (card.sourcePath[card.sourcePath.length - 1] === myLabel
          ? card.sourcePath
          : [...card.sourcePath, CARD_TYPE_LABELS[targetType]])
      : [CARD_TYPE_LABELS[targetType]];
    handoff(targetType, card.content, newPath);
    setShowMore(false);
  };

  const getPrimaryTarget = (): CardType | null => {
    if (card.type === "premise" || card.type === "joke_to_premise") return "angles";
    if (card.type === "angles") return "rewrite";
    return null;
  };

  const primaryTarget = getPrimaryTarget();
  const primaryLabel = primaryTarget
    ? SEND_TARGETS.find((t) => t.type === primaryTarget)?.label
    : null;
  const otherTargets = SEND_TARGETS.filter(
    (t) => t.type !== card.type && t.type !== primaryTarget
  );

  const summary = getWorkflowCardSummary(card);

  return (
    <div
      className={`p-3 rounded-xl border transition-all ${
        isLatest
          ? "bg-blue-50/30 border-blue-200 shadow-sm"
          : "bg-white border-gray-100 hover:border-blue-200"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-1.5 mb-1.5">
        <span className="text-sm shrink-0">{CARD_TYPE_ICONS[card.type]}</span>
        <div className="flex items-center flex-wrap gap-1 min-w-0 flex-1">
          <span className="text-xs font-medium text-gray-600 shrink-0">
            {summary.title}
          </span>
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
        <div className="flex items-center gap-1 shrink-0">
          {/* P1-1: 查看按钮 */}
          <button
            onClick={() => onView(card)}
            className="text-gray-300 hover:text-blue-500 text-xs shrink-0 transition-colors px-1 flex items-center gap-0.5"
            title="查看详情"
          >
            <span>👁</span><span>查看</span>
          </button>
          <button
            onClick={() => deleteCard(card.id)}
            className="text-gray-300 hover:text-red-400 text-xs shrink-0 transition-colors"
            title="删除"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 副标题 */}
      {summary.subtitle && (
        <p className="text-xs text-gray-400 mb-1">{summary.subtitle}</p>
      )}

      {/* 来源链 */}
      {card.sourcePath?.length > 0 && (
        <div className="mb-1.5">
          <span className="text-xs text-gray-400">{card.sourcePath.join(" → ")}</span>
        </div>
      )}

      {/* 内容预览 */}
      <p className="text-sm text-gray-800 line-clamp-3 leading-relaxed">
        {summary.body}
      </p>

      {/* Tags */}
      {summary.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {summary.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 按钮组 */}
      {summary.primaryAction && (
        <div className="flex items-center gap-1.5 mt-2">
          <button
            onClick={() => handleSendTo(summary.primaryAction!.targetType)}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            {summary.primaryAction!.label}
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

      {/* Version / Stage Timeline */}
      {(card as any).stages && (card as any).stages.length > 1 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-400 flex-wrap">
          {(card as any).stages.map((s: string, i: number) => (
            <span key={i} className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
                {STAGE_LABELS[s] || s}
              </span>
              {i < (card as any).stages.length - 1 && (
                <span className="text-gray-300">→</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── History Session Item ─────────────────────────────────────────────────────

function HistorySessionItem({
  s,
  onRestore,
  onDelete,
}: {
  s: {
    id: string;
    sourceInput: string;
    cards: WorkflowCard[];
    createdAt: string;
    updatedAt: string;
  };
  onRestore: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const date = new Date(s.updatedAt).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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
      {onDelete && (
        <button
          onClick={() => onDelete(s.id)}
          className="text-xs text-gray-400 hover:text-red-400 shrink-0"
        >
          删除
        </button>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  const { sessions, restoreSession, cloudSynced } = useWorkflow();
  const { loggedIn } = useAuth();

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <p className="text-sm font-bold text-gray-800 mb-1">创作会话</p>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        你的创作过程会自动沉淀在这里。前提、角度、改稿都会按顺序保存，方便你回看和继续创作。
      </p>

      {/* P2: 同步状态提示 */}
      <div className={`text-xs px-3 py-2 rounded-lg mb-4 ${
        cloudSynced
          ? "bg-green-50 text-green-600 border border-green-100"
          : "bg-amber-50 text-amber-600 border border-amber-100"
      }`}>
        {cloudSynced
          ? "☁️ 记录已同步到账号"
          : loggedIn
            ? "📱 已保存到本机 · 云同步开发中"
            : "📱 已保存到本机 · 登录后可跨设备同步，不怕刷新丢稿"}
      </div>

      {sessions.length > 0 && (
        <>
          <p className="text-xs font-semibold text-gray-400 mb-2">最近创作</p>
          <div className="space-y-2">
            {sessions.slice(0, 3).map((s) => (
              <HistorySessionItem
                key={s.id}
                s={s}
                onRestore={restoreSession}
                onDelete={undefined}
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
  const { session, resetSession, sessions, restoreSession, deleteSession, setSession, handoff, cloudSynced } =
    useWorkflow();
  const { toast } = useToast();
  const { loggedIn } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const [detailCard, setDetailCard] = useState<WorkflowCard | null>(null);

  if (!session) {
    return <EmptyState />;
  }

  const rewriteCards = session.cards.filter((c) => c.type === "rewrite");
  const nonRewriteCards = session.cards.filter((c) => c.type !== "rewrite");
  const latestCardId =
    session.cards.length > 0
      ? session.cards.reduce((latest, c) =>
          c.createdAt > latest.createdAt ? c : latest, session.cards[0]
        ).id
      : null;

  const typeCount: Record<string, number> = {};
  session.cards.forEach((c) => {
    typeCount[c.type] = (typeCount[c.type] ?? 0) + 1;
  });
  const typeSummary = Object.entries(typeCount)
    .map(([t, n]) => `${CARD_TYPE_ICONS[t as CardType]}${n}`)
    .join(" ");

  return (
    <>
      {detailCard && (
        <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} onContinue={handoff} />
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-sm font-bold text-gray-800">创作记录</p>
            <p className="text-xs text-gray-400">
              {session.cards.length} 个结果
              {typeSummary ? ` · ${typeSummary}` : ""}
            </p>
            {session.cards.length > 0 && (
              <p className="text-xs text-green-600 mt-0.5 font-medium">
                {session.saveStatus === "saved_cloud"
                  ? "已保存到你的创作会话"
                  : session.saveStatus === "saved_local"
                    ? "已保存到本机浏览器，登录后可跨设备保存"
                    : session.saveStatus === "failed"
                      ? "保存失败，已保存到本机"
                      : "已自动保存 · 刚刚更新"}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {showHistory ? "收起历史" : `历史会话(${sessions.length})`}
            </button>
            <button
              onClick={() => {
                if (session.cards.length > 0) {
                  resetSession();
                  toast("当前会话已保存，可以开始新的创作");
                } else {
                  setSession(null);
                  toast("已开始新的创作");
                }
              }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              保存并新建
            </button>
          </div>
        </div>

        {/* P2: 同步状态提示 */}
        <div className={`text-xs px-3 py-2 rounded-lg mb-3 ${
          cloudSynced
            ? "bg-green-50 text-green-600 border border-green-100"
            : "bg-amber-50 text-amber-600 border border-amber-100"
        }`}>
          {cloudSynced
            ? "☁️ 记录已同步到账号"
            : loggedIn
              ? "📱 已保存到本机 · 云同步开发中"
              : "📱 已保存到本机 · 登录后可跨设备同步，不怕刷新丢稿"}
        </div>

        {/* 历史面板（可折叠）P1-2: 添加 30 条限制提示 */}
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
            {/* P1-2: 历史保存上限提示 */}
            <p className="text-xs text-gray-300 text-center pt-1">
              本地最多保存最近 30 个会话
            </p>
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
              <CardItem
                key={card.id}
                card={card}
                onView={setDetailCard}
              />
            ))}

            {/* 改稿多版本 */}
            {rewriteCards.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1.5 mt-2">
                  ✏️ 改稿版本
                </p>
                <div className="space-y-1.5">
                  {rewriteCards.map((card) => (
                    <CardItem
                      key={card.id}
                      card={card}
                      isLatest={card.id === latestCardId}
                      onView={setDetailCard}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
