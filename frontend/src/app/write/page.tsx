"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const BASE = "";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SegmentResult {
  text: string;
  structure: string;
  attitude: string;
  theme: string;
  premise: string;
  problem: string;
}

interface EvaluationResult {
  "观点和立场": string;
  "紧扣主题": string;
  "前提清晰": string;
  "语言幽默精炼": string;
  "包含转折和惊喜": string;
  "情感共鸣": string;
  "展现个性": string;
  "结构完整": string;
}

interface SegmentResult {
  text: string;
  structure: string;
  attitude: string;
  theme: string;
  premise: string;
  techniques: string[];
  problem: string;
}

interface ScriptChange {
  location: string;
  original: string;
  improved: string;
  reason: string;
  technique_added: string;
}

interface AnalyzeResult {
  evaluation: EvaluationResult;
  performer_tags: string[];
  premise: string;
  theme_refined: string;
  comedy_type: string;
  structures: string;
  techniques: string[];
  segments: SegmentResult[];
  improved_script: string;
  script_changes: ScriptChange[];
  style_hints: string[];
  next_suggestion: string;
}

interface StreamingState {
  phase: "idle" | "thinking" | "done" | "error";
  rawTokens: string;
  displayText: string;
  result: AnalyzeResult | null;
  error: string | null;
  sessionId: string;
  feedbackSent: number | null;  // null=not sent, 1=thumbs up, 0=thumbs down
}

interface KbSegment {
  segment_id: string;
  performer_name: string;
  show: string;
  text: string;
  technique_tags: string[];
  theme_tags: string[];
}

interface HistoryItem {
  id: string;
  text: string;
  result: AnalyzeResult;
  timestamp: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scoreColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-500";
}

function scoreLabel(score: number) {
  if (score >= 86) return { label: "炸场级", color: "text-green-600 bg-green-50" };
  if (score >= 76) return { label: "优秀", color: "text-green-600 bg-green-50" };
  if (score >= 61) return { label: "结构完整", color: "text-blue-600 bg-blue-50" };
  if (score >= 41) return { label: "有笑点", color: "text-yellow-600 bg-yellow-50" };
  return { label: "基础搭建", color: "text-red-500 bg-red-50" };
}

const TECH_EXPLAIN: Record<string, string> = {
  "铺垫": "开场内容，建立预期，让观众代入场景",
  "递进": "层层加码，不断升级紧张感或笑点预期",
  "收尾": "段子最后部分，用反转或callback制造爆点",
  "爆点": "段子高潮，笑点最集中的部分",
  "开场": "段子的开场白，用来暖场或建立人设",
  "观察": "对日常生活的细腻观察，越具体越好笑",
  "自嘲": "拿自己开玩笑，让观众放下防备",
  "反转": "打破观众预期，用意外感制造笑点",
  "夸张": "把事情说到极端，用荒谬感制造笑点",
  "callback": "回扣前面说过的内容，让笑点前后呼应",
  "对比反差": "把两个完全相反的东西放在一起，产生荒诞感",
  "歪理": "用荒谬的逻辑推导出一个搞笑的结论",
  "叙事": "讲一个故事，让观众代入情境",
  "对话": "用人物对话推进段子节奏",
  "重复": "重复某个词或动作来强化笑点",
};

const STRUCT_EXPLAIN: Record<string, string> = {
  "铺垫": "建立场景和预期，让观众进入你的故事",
  "递进": "层层加码，让笑点不断升级",
  "收尾": "用反转或callback制造最终爆点",
  "开场": "开场暖场，建立角色或拉近与观众的距离",
};

function structExplain(s: string) {
  const key = s.toLowerCase().replace(/[^\u4e00-\u9fa5a-z]/g, "");
  return STRUCT_EXPLAIN[key] ?? null;
}

function techExplain(t: string) {
  const key = t.toLowerCase().replace(/[^\u4e00-\u9fa5a-z]/g, "");
  return TECH_EXPLAIN[key] || TECH_EXPLAIN[t] || null;
}

function structureLabel(s: string) {
  const map: Record<string, string> = {
    setup: "铺垫",
    buildup: "递进",
    callback: "Callback",
    punchline: "爆点",
    observation: "观察",
    story: "故事",
    personal: "自嘲",
  };
  return map[s.toLowerCase()] ?? s;
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function apiJson<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json() as Promise<T>;
}

// ─── Thinking Indicator ───────────────────────────────────────────────────────

const THINKING_PHRASES = [
  "🎤 思考段子结构中...",
  "🎤 分析笑点节奏...",
  "🎤 找最强爆点...",
  "🎤 评估整体水平...",
  "🎤 同行视角审视中...",
  "🎤 寻找weakest link...",
  "🎤 给出修改建议...",
];

function ThinkingDots({ phase }: { phase: "thinking" | "idle" }) {
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    if (phase !== "thinking") return;
    const id = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % THINKING_PHRASES.length);
    }, 1500);
    return () => clearInterval(id);
  }, [phase]);

  if (phase !== "thinking") return null;
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
      <span className="animate-pulse">{THINKING_PHRASES[phraseIdx]}</span>
    </div>
  );
}

// ─── Streaming Summary ────────────────────────────────────────────────────────

function StreamingSummary({ tokens }: { tokens: string }) {
  const isEmpty = !tokens || tokens.trim().length === 0;
  return (
    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
      {isEmpty ? (
        <span className="text-gray-400 italic">正在连接...</span>
      ) : (
        <>
          {tokens}
          <span className="inline-block w-2 h-4 bg-blue-400 ml-0.5 align-middle animate-pulse rounded-sm" />
        </>
      )}
    </div>
  );
}

// ─── Command-K Modal ──────────────────────────────────────────────────────────

interface KbSearchResult {
  total: number;
  segments: KbSegment[];
}

function CmdKModal({
  open,
  onClose,
  query,
  onQuery,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  onQuery: (q: string) => void;
}) {
  const [results, setResults] = useState<KbSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      if (query) doSearch(query);
    }
  }, [open, query]);

  const doSearch = async (q: string) => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, limit: "6" });
      const data = await apiJson<KbSearchResult>(`/api/kb/search?${params}`);
      setResults(data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter") doSearch(e.currentTarget.value);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-start justify-center pt-24 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[700px] max-h-[70vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <span className="text-gray-400 text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { onQuery(e.target.value); doSearch(e.target.value); }}
            onKeyDown={handleKey}
            placeholder="搜索素材片段..."
            className="flex-1 text-base text-gray-800 placeholder-gray-300 outline-none"
          />
          <kbd className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">ESC</kbd>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">搜索中...</div>
          ) : results?.segments.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">没有找到相关素材</div>
          ) : results ? (
            <div className="p-3 space-y-2">
              {results.segments.map((seg) => (
                <div key={seg.segment_id} className="p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/40 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-medium text-gray-700">{esc(seg.performer_name || "未知演员")}</span>
                    {seg.show && <span className="text-xs text-gray-400">{esc(seg.show)}</span>}
                    <div className="flex gap-1 ml-auto">
                      {seg.technique_tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-xs px-1.5 py-0.5 bg-green-50 text-green-600 rounded">{esc(t)}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{seg.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-gray-400">
              输入关键词搜索素材片段
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── History Panel ────────────────────────────────────────────────────────────

function HistoryPanel({
  open,
  onToggle,
  items,
  onRestore,
}: {
  open: boolean;
  onToggle: () => void;
  items: HistoryItem[];
  onRestore: (item: HistoryItem) => void;
}) {
  if (!open) return null;

  return (
    <div className="border-t border-gray-100 bg-gray-50/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase">历史记录</p>
        <button onClick={onToggle} className="text-xs text-gray-400 hover:text-gray-600">收起 ▲</button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">暂无历史记录</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onRestore(item)}
              className="shrink-0 w-48 p-3 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all text-left"
            >
              <p className="text-xs text-gray-500 line-clamp-2 mb-1.5">{item.text}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-600">{item.result.comedy_type || item.result.theme_refined?.slice(0, 20) || '已分析'}...</span>
                <span className="text-xs text-gray-300">
                  {new Date(item.timestamp).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Similar Materials ───────────────────────────────────────────────────────

function SimilarMaterials({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<KbSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async () => {
    setOpen(true);
    if (searched) return;
    setLoading(true);
    try {
      const q = text.replace(/\n/g, " ").trim().slice(0, 80);
      const data = await apiJson<KbSearchResult>(`/api/kb/search?q=${encodeURIComponent(q)}&limit=4`);
      setResults(data);
      setSearched(true);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <button
        onClick={doSearch}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <span>🔗</span>
        <span>相似素材</span>
        <span className="text-xs text-gray-300">（调用素材库搜索）</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {loading ? (
            <p className="text-xs text-gray-400 py-2">搜索中...</p>
          ) : results?.segments.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">没有找到相似素材</p>
          ) : (
            results?.segments.map((seg) => (
              <div key={seg.segment_id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-600">{esc(seg.performer_name)}</span>
                  {seg.technique_tags.slice(0, 1).map((t) => (
                    <span key={t} className="text-xs px-1.5 py-0.5 bg-green-50 text-green-600 rounded">{esc(t)}</span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{esc(seg.text)}</p>
              </div>
            ))
          )}
          <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">收起</button>
        </div>
      )}
    </div>
  );
}

// ─── Streaming Result Card ────────────────────────────────────────────────────

function StreamingResultCard({
  stream,
  onFeedback,
}: {
  stream: StreamingState;
  onFeedback: (rating: 1 | 0, sessionId: string) => void;
}) {
  if (stream.phase === "error") {
    let msg = stream.error ?? "";
    // Try to parse JSON error {error: "...", request_id: "..."}
    try {
      const parsed = JSON.parse(msg);
      if (parsed.error) msg = parsed.error;
    } catch { /* not JSON, use raw */ }
    // Truncate super-long raw JSON displays
    const display = msg.length > 200 ? msg.slice(0, 200) + "…（内容过长，可刷新重试）" : msg;
    return (
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5">
        <p className="text-sm text-red-500 mb-3 font-medium">⚠️ 分析失败</p>
        <p className="text-sm text-gray-600 leading-relaxed">{display}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          刷新重试
        </button>
      </div>
    );
  }

  if (stream.phase === "idle" || (!stream.displayText && stream.phase === "thinking")) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 flex flex-col items-center justify-center text-center min-h-64">
        <svg className="mb-3" width="48" height="48" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="8" fill="#e0e7ff"/>
          <ellipse cx="16" cy="12" rx="6" ry="8" fill="#6366f1"/>
          <rect x="13" y="20" width="6" height="6" rx="1" fill="#6366f1"/>
          <rect x="14.5" y="26" width="3" height="2" rx="0.5" fill="#6366f1"/>
          <rect x="10" y="8" width="12" height="3" rx="1.5" fill="none" stroke="#6366f1" stroke-width="1.5"/>
        </svg>
        <p className="text-base font-medium text-gray-500">左侧输入段子后点击分析</p>
        <p className="text-sm text-gray-400 mt-1">评分、结构、技巧分析马上呈现</p>
      </div>
    );
  }

  // Show streaming tokens — strip JSON noise, show meaningful content
  if (stream.phase === "thinking") {
    // Strip JSON syntax to show only meaningful Chinese text
    const raw = stream.displayText ?? "";
    const cleaned = raw
      .replace(/[{}\[\]"":\\]/g, "")
      .replace(/\n/g, "")
      .replace(/,{2,}/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-gray-700">AI 分析中</span>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            已解析 {raw.length} 字符
          </span>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 min-h-[80px]">
          {cleaned ? (
            <div className="text-sm text-gray-500 leading-relaxed animate-pulse overflow-hidden">
              {cleaned}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-4/5" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-3/5" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Done — show full result card
  const r = stream.result;
  if (!r) return null;

  const ev = r.evaluation ?? {};
  const evKeys = ["观点和立场", "紧扣主题", "前提清晰", "语言幽默精炼", "包含转折和惊喜", "情感共鸣", "展现个性", "结构完整"] as const;
  const evLabels: Record<string, string> = {
    "观点和立场": "观点立场",
    "紧扣主题": "紧扣主题",
    "前提清晰": "前提清晰",
    "语言幽默精炼": "语言幽默",
    "包含转折和惊喜": "转折惊喜",
    "情感共鸣": "情感共鸣",
    "展现个性": "展现个性",
    "结构完整": "结构完整",
  };

  return (
    <>
      {/* Evaluation Dimensions */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-base font-bold text-gray-800 mb-4">📋 八维评价</p>
        <div className="grid grid-cols-2 gap-3">
          {evKeys.map((key) => (
            <div key={key} className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
              <span className="text-sm font-medium text-gray-600 shrink-0 mt-0.5 min-w-[3rem]">{evLabels[key]}</span>
              <p className="text-sm text-gray-800 leading-relaxed font-medium">{esc(ev[key] ?? "—")}</p>
            </div>
          ))}
        </div>
        {r.performer_tags && r.performer_tags.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-600 font-medium">人设标签</span>
            {r.performer_tags.map((tag) => (
              <span key={tag} className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">{esc(tag)}</span>
            ))}
          </div>
        )}
      </div>

      {/* Core Info */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="space-y-2">
          {r.comedy_type && (
            <div className="flex items-start gap-2">
              <span className="text-indigo-500 mt-0.5">🎭</span>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-0.5">喜剧类型</p>
                <p className="text-base text-gray-800 font-medium">{esc(r.comedy_type)}</p>
              </div>
            </div>
          )}
          {r.premise && (
            <div className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">💡</span>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-0.5">核心前提</p>
                <p className="text-base text-gray-800">{esc(r.premise)}</p>
              </div>
            </div>
          )}
          {r.theme_refined && (
            <div className="flex items-start gap-2">
              <span className="text-teal-500 mt-0.5">🏷️</span>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-0.5">细化主题</p>
                <p className="text-base text-gray-800">{esc(r.theme_refined)}</p>
              </div>
            </div>
          )}
          {r.structures && (
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✅</span>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-0.5">结构</p>
                <p className="text-base text-gray-800">{esc(r.structures)}</p>
              </div>
            </div>
          )}
          {r.techniques.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">🎯</span>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">技巧</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.techniques.map((t) => (
                    <span key={t} className="text-sm px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">{esc(t)}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Segments */}
      {r.segments.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">段落拆解</p>
          <div className="space-y-3">
            {r.segments.map((seg, i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-sm px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg font-bold">{structureLabel(seg.structure)}</span>
                  {seg.attitude && <span className="text-sm px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg font-medium">态度: {esc(seg.attitude)}</span>}
                  {seg.techniques.map((t) => (
                    <span key={t} className="text-sm px-2 py-0.5 bg-green-100 text-green-700 rounded font-medium">{t}</span>
                  ))}
                </div>
                <p className="text-base text-gray-800 leading-relaxed mb-3 font-medium">{esc(seg.text)}</p>
                {seg.attitude && <p className="text-sm text-gray-600 mb-1"><span className="font-semibold text-gray-700">态度:</span> {esc(seg.attitude)}</p>}
                {seg.theme && <p className="text-sm text-gray-600 mb-1"><span className="font-semibold text-gray-700">主题:</span> {esc(seg.theme)}</p>}
                {seg.premise && <p className="text-sm text-gray-600 mb-1"><span className="font-semibold text-gray-700">前提:</span> {esc(seg.premise)}</p>}
                {seg.problem && <p className="text-sm text-red-600 font-medium mt-2 pt-2 border-t border-red-100">⚠️ {esc(seg.problem)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improved Script */}
      {r.improved_script && (
        <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">✨ 优化版本</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{esc(r.improved_script)}</p>
        </div>
      )}

      {/* Script Changes */}
      {r.script_changes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">🔧 具体修改</p>
          <div className="space-y-3">
            {r.script_changes.map((c, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-xl space-y-1.5">
                {c.location && <p className="text-sm text-gray-600 font-semibold">{esc(c.location)}</p>}
                {c.original && (
                  <div className="flex items-start gap-2">
                    <span className="text-sm text-red-500 shrink-0 font-bold">-</span>
                    <p className="text-sm text-gray-500 line-through">{esc(c.original)}</p>
                  </div>
                )}
                {c.improved && (
                  <div className="flex items-start gap-2">
                    <span className="text-sm text-green-600 shrink-0 font-bold">+</span>
                    <p className="text-sm text-gray-800">{esc(c.improved)}</p>
                  </div>
                )}
                {(c.reason || c.technique_added) && (
                  <p className="text-sm text-gray-600 pl-6 border-l-2 border-purple-200">
                    {c.technique_added && <span className="text-purple-600 font-medium">[{esc(c.technique_added)}] </span>}
                    {esc(c.reason)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Style Hints */}
      {r.style_hints.length > 0 && (
        <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-2">💅 风格提示</p>
          <div className="flex flex-wrap gap-1.5">
            {r.style_hints.map((hint, i) => (
              <span key={i} className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded-lg">{esc(hint)}</span>
            ))}
          </div>
        </div>
      )}

      {/* Next Suggestion */}
      {r.next_suggestion && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-2">👉 下一步建议</p>
          <p className="text-sm text-gray-600 leading-relaxed">{esc(r.next_suggestion)}</p>
        </div>
      )}

      {/* Feedback */}
      <div className="flex items-center justify-center gap-6 py-4">
        {stream.feedbackSent === null ? (
          <>
            <button
              onClick={() => onFeedback(1, stream.sessionId)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 rounded-xl transition-all text-sm text-gray-500 hover:text-green-600 font-medium"
            >
              <span className="text-lg">👍</span>
              <span>有帮助</span>
            </button>
            <button
              onClick={() => onFeedback(0, stream.sessionId)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-300 rounded-xl transition-all text-sm text-gray-500 hover:text-red-600 font-medium"
            >
              <span className="text-lg">👎</span>
              <span>不够好</span>
            </button>
          </>
        ) : (
          <p className={`text-sm font-medium ${stream.feedbackSent === 1 ? "text-green-600" : "text-red-600"}`}>
            {stream.feedbackSent === 1 ? "👍 感谢反馈" : "👎 已记录，感谢反馈"}
          </p>
        )}
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WritePage() {
  const [inputText, setInputText] = useState("");
  const [stream, setStream] = useState<StreamingState>({
    phase: "idle",
    rawTokens: "",
    displayText: "",
    result: null,
    error: null,
    sessionId: "",
    feedbackSent: null,
  });
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cmdKOpen, setCmdKOpen] = useState(false);
  const [cmdKQuery, setCmdKQuery] = useState("");
  const charCount = inputText.length;
  const streamRef = useRef<StreamingState>(stream);
  streamRef.current = stream;

  // Load history from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("comedy_history");
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  // Global Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdKOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const saveHistory = (item: HistoryItem) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.id !== item.id);
      const next = [item, ...filtered].slice(0, 20);
      try { localStorage.setItem("comedy_history", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleAnalyze = async () => {
    if (inputText.trim().length < 20) return;

    const sid = crypto.randomUUID();
    setStream((s) => ({ ...s, phase: "thinking", rawTokens: "", displayText: "", result: null, error: null, sessionId: sid, feedbackSent: null }));

    try {
      const resp = await fetch(`${BASE}/api/analyze/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, mode: "quick", session_id: sid }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        setStream((s) => ({ ...s, phase: "error", error: `HTTP ${resp.status}: ${body}` }));
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events in buffer
        while (buffer.includes("\n\n")) {
          const eventEnd = buffer.indexOf("\n\n");
          const eventBlock = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);

          const lines = eventBlock.split("\n");
          let eventType = "message";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              eventData = line.slice(5);
            }
          }

          if (eventType === "token" && eventData) {
            // Unescape SSE data: the server sends JSON with \\n (escaped backslash-n)
            const unescaped = eventData
              .replace(/\\\\n/g, "\n")
              .replace(/\\\\r/g, "\r")
              .replace(/\\\\t/g, "\t");
            setStream((s) => {
              const newRaw = s.rawTokens + unescaped;
              // Smart truncation: keep last 300 chars to show relevant content
              const display = newRaw.length > 300 ? "..." + newRaw.slice(-300) : newRaw;
              return { ...s, rawTokens: newRaw, displayText: display };
            });
          } else if (eventType === "done" && eventData) {
            // Clean control chars before parse (defensive)
            // Try to parse; if fails, extract JSON from raw string
            let final: any = null;
            try {
              final = JSON.parse(eventData);
            } catch {
              // Try extracting last complete JSON object
              const first = eventData.indexOf("{");
              const last = eventData.lastIndexOf("}");
              if (first >= 0 && last > first) {
                try { final = JSON.parse(eventData.slice(first, last + 1)); } catch { /* skip */ }
              }
            }
            if (!final) {
              // Show accumulated tokens as fallback display
              const fallback = stream.rawTokens || eventData;
              const display = fallback.length > 500 ? "..." + fallback.slice(-500) : fallback;
              setStream((s) => ({ ...s, phase: "error", error: "解析结果格式异常，以下为原始内容", displayText: display }));
              return;
            }
            const result: AnalyzeResult = {
              evaluation: final.evaluation ?? {},
              performer_tags: final.performer_tags ?? [],
              premise: final.premise ?? "",
              theme_refined: final.theme_refined ?? "",
              comedy_type: final.comedy_type ?? "",
              structures: final.structures ?? "",
              techniques: Array.isArray(final.techniques) ? final.techniques : [],
              segments: (final.segments ?? []).map((s: any) => ({
                text: s.text ?? "",
                structure: s.structure ?? "unknown",
                attitude: s.attitude ?? "",
                theme: s.theme ?? "",
                premise: s.premise ?? "",
                techniques: Array.isArray(s.techniques) ? s.techniques : [],
                problem: s.problem ?? "",
              })),
              improved_script: final.improved_script ?? "",
              script_changes: (final.script_changes ?? []).map((c: any) => ({
                location: c.location ?? "",
                original: c.original ?? "",
                improved: c.improved ?? "",
                reason: c.reason ?? "",
                technique_added: c.technique_added ?? "",
              })),
              style_hints: final.style_hints ?? [],
              next_suggestion: final.next_suggestion ?? "",
            };

            // Normalize score to 0-100


            const histItem: HistoryItem = {
              id: Date.now().toString(),
              text: inputText.slice(0, 100),
              result,
              timestamp: Date.now(),
            };
            saveHistory(histItem);

            setStream((current): StreamingState => ({
              ...current,
              phase: "done",
              result,
            }));
          } else if (eventType === "error" && eventData) {
            let err: any = {};
            try { err = JSON.parse(eventData); } catch { err = { error: eventData }; }
            setStream((s) => ({
              ...s,
              phase: "error",
              error: err.error ?? "Unknown error",
              // Keep rawTokens so we can show the partial result
              displayText: s.rawTokens
                ? (s.rawTokens.length > 500 ? "..." + s.rawTokens.slice(-500) : s.rawTokens)
                : err.raw_text ?? "",
            }));
          }
        }
      }
    } catch (e: any) {
      setStream((s) => ({ ...s, phase: "error", error: e.message ?? String(e) }));
    }
  };

  const handleRestore = (item: HistoryItem) => {
    setInputText(item.text);
    setStream({
      phase: "done",
      rawTokens: "",
      displayText: "",
      result: item.result,
      error: null,
      sessionId: "",
      feedbackSent: null,
    });
  };

  const [contentWarning, setContentWarning] = useState<string | null>(null);

  function checkContentQuality(text: string): string | null {
    const cleaned = text.toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]/g, "");
    if (cleaned.length < 6) return null;
    const subs: Record<string, number> = {};
    for (let i = 0; i < cleaned.length - 1; i++) subs[cleaned.slice(i, i + 2)]++;
    for (let i = 0; i < cleaned.length - 2; i++) subs[cleaned.slice(i, i + 3)]++;
    if (Math.max(...Object.values(subs)) >= 5) return "内容重复度过高";
    return null;
  }

  const canAnalyze = inputText.trim().length >= 20;
  const isStreaming = stream.phase === "thinking";
  const hasResult = stream.phase === "done" && stream.result;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="#6366f1"/>
              <ellipse cx="16" cy="12" rx="6" ry="8" fill="white"/>
              <rect x="13" y="20" width="6" height="6" rx="1" fill="white"/>
              <rect x="14.5" y="26" width="3" height="2" rx="0.5" fill="white"/>
              <rect x="10" y="8" width="12" height="3" rx="1.5" fill="none" stroke="white" stroke-width="1.5"/>
            </svg>
            <div>
              <h1 className="text-xl font-bold text-gray-800">喜剧写稿台</h1>
              <p className="text-xs text-gray-500 mt-0.5">分析你的段子，发现提升空间</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
            >
              {historyOpen ? "收起历史" : `📋 历史(${history.length})`}
            </button>
            <button
              onClick={() => setCmdKOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600 transition-colors"
            >
              <span>⌘K</span>
              <span>素材库</span>
            </button>
          </div>
        </div>
      </header>

      {/* History Panel */}
      <HistoryPanel
        open={historyOpen}
        onToggle={() => setHistoryOpen(false)}
        items={history}
        onRestore={handleRestore}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Input */}
          <div className="space-y-3">
            {contentWarning ? (
              <div className="mb-2 text-xs text-orange-500 bg-orange-50 border border-orange-100 px-4 py-2 rounded-xl">
                ⚠️ {contentWarning}，仍可分析
              </div>
            ) : null}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <textarea
                value={inputText}
                onChange={(e) => { setInputText(e.target.value); setContentWarning(checkContentQuality(e.target.value)); }}
                placeholder="粘贴或输入你的段子，至少20字..."
                className="w-full px-5 py-4 text-sm text-gray-700 placeholder-gray-300 resize-none outline-none min-h-64"
                style={{ fontFamily: "inherit" }}
                disabled={isStreaming}
              />
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
                <span className={`text-xs ${charCount < 20 ? "text-gray-400" : "text-gray-500"}`}>
                  {charCount} 字
                  {charCount > 0 && charCount < 20 && <span className="ml-1 text-orange-400">（至少20字）</span>}
                </span>
              </div>
            </div>

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze || isStreaming}
              className={`w-full py-3.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                canAnalyze && !isStreaming
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {isStreaming ? (
                <>
                  <span className="animate-spin">⟳</span>
                  <span>分析中...</span>
                </>
              ) : (
                <>
                  <span>🔍</span>
                  <span>分析这段</span>
                </>
              )}
            </button>


          </div>

          {/* Right: Feedback */}
          <div className="space-y-3">
            <StreamingResultCard
              stream={stream}
              onFeedback={(rating, sessionId) => {
                fetch(`${BASE}/api/feedback`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ session_id: sessionId, rating }),
                }).catch(() => {});
                setStream((s) => ({ ...s, feedbackSent: rating }));
              }}
            />

            {/* Copy Result — only when done */}
            {hasResult && stream.result && (
              <button
                onClick={() => {
                  const r = stream.result!;
                  const lines = [
                    ...(r.comedy_type ? [`🎭 类型：${r.comedy_type}`] : []),
                    `✅ 结构：${r.structures}`,
                    `🎯 技巧：${r.techniques.join('、')}`,
                    r.premise ? `💡 前提：${r.premise}` : '',
                    r.theme_refined ? `🏷️ 主题：${r.theme_refined}` : '',
                    '',
                    '--- 段落拆解 ---',
                    ...r.segments.map((s) =>
                      `[${s.structure}]${s.attitude ? ` ${s.attitude}` : ''}${s.theme ? ` | 主题: ${s.theme}` : ''}${s.problem ? ` | 问题: ${s.problem}` : ''}
${s.text}`
                    ),
                    '',
                    ...(r.improved_script ? ['--- 优化版本 ---', r.improved_script] : []),
                    '',
                    ...(r.script_changes?.length ? ['--- 具体修改 ---', ...r.script_changes.map(c => `• ${c.original ? '❌ '+c.original : ''}${c.improved ? '\n✅ '+c.improved : ''}${(c.reason || c.technique_added) ? '\n  → '+(c.technique_added ? '['+c.technique_added+'] ' : '')+c.reason : ''}`)] : []),
                    ...(r.style_hints?.length ? ['', '--- 风格提示 ---', ...r.style_hints.map(h => '• '+h)] : []),
                    ...(r.next_suggestion ? ['', '--- 下一步 ---', r.next_suggestion] : []),
                  ].filter(Boolean);
                  const ta = document.createElement('textarea');
                  ta.value = lines.join('\n');
                  ta.style.position = 'fixed';
                  ta.style.opacity = '0';
                  document.body.appendChild(ta);
                  ta.select();
                  try { document.execCommand('copy'); setCopied(true); } catch { /* ignore */ }
                  document.body.removeChild(ta);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
                  copied
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {copied ? '✅ 已复制到剪贴板' : '📋 复制分析结果'}
              </button>
            )}

            {/* Similar materials — only when done */}
            {hasResult && <SimilarMaterials text={inputText} />}
          </div>
        </div>
      </main>

      {/* Cmd+K Modal */}
      <CmdKModal
        open={cmdKOpen}
        onClose={() => setCmdKOpen(false)}
        query={cmdKQuery}
        onQuery={setCmdKQuery}
      />
    </div>
  );
}
