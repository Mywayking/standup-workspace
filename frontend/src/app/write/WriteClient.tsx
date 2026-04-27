"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "@/components/LoginModal";

const BASE = "";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  duration?: number;   // P1-3: elapsed seconds
  model?: string;      // P1-3: model name from API
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
  result: AnalyzeResult | null;
  timestamp: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(s: unknown): string {
  if (s == null) return '';
  return String(s)
    // Decode existing HTML entities first to avoid double-escaping
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Handle backslash-escaped quotes from JSON strings (e.g., \" → ")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    // Then encode for HTML display
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

function structureLabel(s: unknown): string {
  if (typeof s !== 'string') return '未知';
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
      className="fixed inset-0 bg-black/40 flex items-start justify-center pt-16 sm:pt-24 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[700px] max-h-[70vh] flex flex-col overflow-hidden"
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
            className="flex-1 text-base sm:text-base text-gray-800 placeholder-gray-300 outline-none bg-transparent"
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
  onRetry,
  setCmdKQuery,
  setCmdKOpen,
  inputText,
  setInputText,
  sourcePath,
}: {
  stream: StreamingState;
  onFeedback: (rating: 1 | 0, sessionId: string) => void;
  onRetry: () => void;
  setCmdKQuery: (q: string) => void;
  setCmdKOpen: (open: boolean) => void;
  inputText: string;
  setInputText: (text: string | ((prev: string) => string)) => void;
  sourcePath?: string[];  // P1-3: where this content came from
}) {
  if (stream.phase === "error") {
    let msg = stream.error ?? "";
    let detail = stream.displayText;
    // Try to parse JSON error {error: "...", request_id: "..."}
    try {
      const parsed = JSON.parse(msg);
      if (parsed.error) msg = parsed.error;
    } catch { /* not JSON, use raw */ }
    // Truncate super-long raw JSON displays
    const display = detail
      ? (detail.length > 300 ? "..." + detail.slice(-300) : detail)
      : (msg.length > 200 ? msg.slice(0, 200) + "…" : msg);
    return (
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5">
        <p className="text-sm text-red-500 mb-3 font-medium">⚠️ {esc(msg)}</p>
        {display && (
          <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-wrap">{display}</p>
        )}
        <div className="mt-4 flex gap-3">
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg font-medium transition-colors"
          >
            重新分析
          </button>
          <button
            onClick={() => {
              const ta = document.createElement("textarea");
              ta.value = msg + (detail ? "\n\n" + detail : "");
              ta.style.position = "fixed";
              ta.style.opacity = "0";
              document.body.appendChild(ta);
              ta.select();
              try { document.execCommand("copy"); } catch {}
              document.body.removeChild(ta);
            }}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-lg font-medium transition-colors"
          >
            复制错误信息
          </button>
        </div>
      </div>
    );
  }

  // P1-3: Dynamic status card
  const sourceLabel = sourcePath && sourcePath.length > 0
    ? sourcePath[sourcePath.length - 1]
    : "改稿";
  const isDone = stream.phase === "done";
  const durationSec = stream.duration;
  const modelName = stream.model;
  const nextSuggestion = isDone && stream.result?.next_suggestion
    ? stream.result.next_suggestion
    : null;

  if (stream.phase === "idle" || (!stream.displayText && stream.phase === "thinking")) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        {/* P1-3: Status rows */}
        <div className="space-y-2 mb-4">
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-400 shrink-0 w-14">当前来源</span>
            <span className="text-xs text-gray-600">
              {sourceLabel}
              {sourcePath && sourcePath.length > 1 && (
                <span className="text-gray-300 ml-1">· {sourcePath.join(" → ")}</span>
              )}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-400 shrink-0 w-14">保存状态</span>
            <span className="text-xs text-gray-400">等待输入段子后开始分析</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">分析完成后将获得：</p>
          <div className="space-y-2">
            {[
              "一句话总诊断",
              "最该优先修改的3个问题",
              "已经有效的笑点",
              "可直接替换的改写建议",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                <p className="text-sm text-gray-600">{item}</p>
              </div>
            ))}
          </div>
        </div>
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

  // P1 衍生数据计算
  const topProblems = (r.segments ?? [])
    .filter((s) => s.problem)
    .slice(0, 3)
    .map((s) => s.problem);
  const effectiveSegments = (r.segments ?? []).filter((s) => !s.problem && s.text.trim().length > 10);
  const effectiveJokes = effectiveSegments.slice(0, 3).map((s) => s.text.trim());
  const getVerdict = () => {
    const ct = typeof r.comedy_type === 'string' ? r.comedy_type : '';
    const prem = typeof r.premise === 'string' ? r.premise : '';
    const tr = typeof r.theme_refined === 'string' ? r.theme_refined : '';
    if (ct && prem) {
      const p = prem.length > 30 ? prem.slice(0, 30) + "…" : prem;
      return `这段属于「${ct}」，核心前提是：${p}。`;
    }
    if (ct) return `这段属于「${ct}」`;
    if (prem) {
      const p = prem.length > 40 ? prem.slice(0, 40) + "…" : prem;
      return `核心前提：${p}`;
    }
    if (tr) return `主题：${tr}`;
    return "已完成分析，请查看以下详情";
  };

  return (
    <>
      {/* P1-3: Dynamic status card at top of done state */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-3">
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-400 shrink-0 w-14">当前来源</span>
            <span className="text-xs text-gray-700 font-medium">
              {sourceLabel}
              {sourcePath && sourcePath.length > 1 && (
                <span className="text-gray-400 ml-1">· {sourcePath.join(" → ")}</span>
              )}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-400 shrink-0 w-14">保存状态</span>
            <span className="text-xs text-green-600 font-medium">已自动保存 · 刚刚</span>
          </div>
          {(modelName || durationSec) && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-400 shrink-0 w-14">模型</span>
              <span className="text-xs text-gray-600">
                {modelName || "deepseek-v4-pro"}{durationSec ? ` · ${durationSec}s` : ""}
              </span>
            </div>
          )}
          {nextSuggestion && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-400 shrink-0 w-14">建议</span>
              <span className="text-xs text-blue-600 leading-relaxed">{esc(nextSuggestion)}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2.1 总诊断 */}
      <div className="bg-indigo-50 border-l-4 border-indigo-500 rounded-r-2xl p-4">
        <div className="flex items-start gap-2">
          <span className="text-indigo-500 mt-0.5 shrink-0">📌</span>
          <div>
            <p className="text-xs font-semibold text-indigo-600 mb-1">总诊断</p>
            <p className="text-sm text-gray-800 leading-relaxed font-medium">{getVerdict()}</p>
          </div>
        </div>
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
          {(r.techniques ?? []).length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">🎯</span>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">技巧</p>
                <div className="flex flex-wrap gap-1.5">
                  {(r.techniques ?? []).map((t) => (
                    <span key={t} className="text-sm px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">{esc(t)}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {r.performer_tags && r.performer_tags.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-purple-500 mt-0.5">🎭</span>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">人设</p>
                <div className="flex flex-wrap gap-1.5">
                  {(r.performer_tags ?? []).map((tag) => (
                    <span key={"performer:" + tag} className="text-sm px-2.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">{esc(tag)}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2.2 优先3个问题 */}
      {topProblems.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5">
          <p className="text-sm font-bold text-gray-800 mb-3">🔥 优先改这{topProblems.length}个</p>
          <div className="space-y-2">
            {topProblems.map((p, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-red-500 font-bold shrink-0 mt-0.5">{i + 1}.</span>
                <p className="text-sm text-gray-700 leading-relaxed">{esc(p)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2.3 有效笑点 */}
      {effectiveJokes.length > 0 && (
        <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-5">
          <p className="text-sm font-bold text-gray-800 mb-3">✅ 已经有效的笑点</p>
          <div className="space-y-2">
            {effectiveJokes.map((j, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{esc(j)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Segments */}
      {(r.segments ?? []).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">段落拆解</p>
          <div className="space-y-3">
            {(r.segments ?? []).map((seg, i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-sm px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg font-bold">{structureLabel(seg.structure)}</span>
                  {seg.attitude && <span className="text-sm px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg font-medium">态度: {esc(seg.attitude)}</span>}
                  {(seg.techniques ?? []).map((t) => (
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

      {/* 2.4 改写建议（升级版）*/}
      {(r.script_changes ?? []).length > 0 && (
        <div className="bg-white rounded-2xl border border-orange-200 shadow-sm p-5">
          <p className="text-sm font-bold text-gray-800 mb-3">✏️ 直接替换建议</p>
          <div className="space-y-4">
            {r.script_changes.map((c, i) => (
              <div key={i} className="space-y-2">
                {c.location && (
                  <p className="text-xs text-gray-400 font-medium">{esc(c.location)}</p>
                )}
                {c.original && c.improved && (
                  <div className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-sm text-gray-500 line-through flex-1">{esc(c.original)}</p>
                    <span className="text-gray-300 shrink-0 mx-1">→</span>
                    <p className="text-sm text-gray-800 font-medium flex-1">{esc(c.improved)}</p>
                  </div>
                )}
                {c.technique_added && (
                  <p className="text-xs text-orange-600 font-medium">技巧：{esc(c.technique_added)}</p>
                )}
                {c.reason && (
                  <p className="text-xs text-gray-500 leading-relaxed">{esc(c.reason)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Style Hints */}
      {(r.style_hints ?? []).length > 0 && (
        <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-2">💅 风格提示</p>
          <div className="flex flex-wrap gap-1.5">
            {r.style_hints.map((hint, i) => (
              <span key={i} className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded-lg">{esc(hint)}</span>
            ))}
          </div>
        </div>
      )}

      {/* 2.5 下一步动作按钮组 */}
      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-sm font-semibold text-gray-700">继续创作</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 主推荐操作 */}
          <button
            onClick={() => {
              setInputText((t) => t + '\n\n---\n[改编提示：强化结尾，让爆点更炸]');
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
          >
            ←笑点 强化结尾
          </button>

          {/* 更多操作 */}
          <div className="relative inline-block">
            <button
              onClick={(e) => {
                const dropdown = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (dropdown) dropdown.classList.toggle("hidden");
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              更多操作 ▾
            </button>
            <div className="absolute left-0 mt-1 w-44 bg-white border rounded-xl shadow-lg py-1 z-10 hidden">
              {[
                {label: "增加包袱", hint: "[改编提示：增加2-3个转折和笑点]", action: "more_punchlines" },
                {label: "转综艺版", hint: "\n\n---\n[改编：综艺风格版本]", action: "variety_style" },
                {label: "保存素材", hint: null, action: "save_kb" },
                {label: "保存会话", hint: null, action: "save_session" },
              ].map((action) => (
                <button
                  key={action.action}
                  onClick={() => {
                    if (action.action === "save_kb") {
                      setCmdKQuery(inputText.slice(0, 50));
                      setCmdKOpen(true);
                    } else if (action.hint) {
                      setInputText((t) => t + action.hint!);
                    }
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {r.next_suggestion && (
          <p className="text-xs text-gray-400 mt-3 leading-relaxed">💡 {esc(r.next_suggestion)}</p>
        )}
      </div>

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

export default function WritePage({ initialText, sourcePath, onClearPending, onResultDone }: { initialText?: string; sourcePath?: string[]; onClearPending?: () => void; onResultDone?: (content: string, rawData: unknown, sourcePath?: string[]) => void }) {
  const { loggedIn } = useAuth();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [inputText, setInputText] = useState(initialText ?? "");
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

  const [cmdKOpen, setCmdKOpen] = useState(false);
  const [cmdKQuery, setCmdKQuery] = useState("");
  const charCount = inputText.length;
  const streamRef = useRef<StreamingState>(stream);
  streamRef.current = stream;
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);  // P1-3: track request start time

  const autoTriggered = useRef(false);
  const analyzeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Auto-trigger analysis when initialText comes from cross-tab navigation
  useEffect(() => {
    if (initialText && !autoTriggered.current) {
      autoTriggered.current = true;
      const timer = setTimeout(() => {
        if (inputText.trim().length >= 20) {
          analyzeBtnRef.current?.click();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialText, inputText]);

  // P1-3 + P1-4: onResultDone called once when result is ready
  const hasCalledResultRef = useRef(false);
  useEffect(() => {
    if (stream.phase === "done" && stream.result && !hasCalledResultRef.current) {
      hasCalledResultRef.current = true;
      const text = typeof stream.result === 'string' ? stream.result : JSON.stringify(stream.result);
      onResultDone?.(text, stream.result, sourcePath || ["改稿"]);
    }
  }, [stream.phase, stream.result]);

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



  const handleAnalyze = async () => {
    if (inputText.trim().length < 20) return;
    if (!loggedIn) {
      setLoginModalOpen(true);
      return;
    }

    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort();

    const sid = crypto.randomUUID();
    startTimeRef.current = Date.now();  // P1-3: mark request start
    setStream((s) => ({ ...s, phase: "thinking", rawTokens: "", displayText: "", result: null, error: null, sessionId: sid, feedbackSent: null, duration: undefined, model: undefined }));

    // Timeout fallback: abort request after 90s
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 90_000);

    try {
      const resp = await fetch(`${BASE}/api/write/rewrite/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, mode: "quick", session_id: sid }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        abortRef.current = null;
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
            // New format: {"type":"token","content":"..."} OR old raw string
            let tokenContent = eventData;
            try {
              const parsed = JSON.parse(eventData);
              if (parsed && parsed.type === "token" && typeof parsed.content === "string") {
                tokenContent = parsed.content;
              }
            } catch {
              // Not JSON — treat as raw token string (backward compat)
            }
            // Unescape SSE data: the server sends JSON with \\n (escaped backslash-n)
            const unescaped = tokenContent
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
            // New format: {"type":"done","result":{...},"_meta":{...}}
            let raw: any = null;
            try {
              raw = JSON.parse(eventData);
            } catch {
              // Try extracting last complete JSON object
              const first = eventData.indexOf("{");
              const last = eventData.lastIndexOf("}");
              if (first >= 0 && last > first) {
                try { raw = JSON.parse(eventData.slice(first, last + 1)); } catch { /* skip */ }
              }
            }
            // Support both new format (final.result) and old format (final directly)
            const final = raw?.result ?? raw;
            if (!final) {
              // Show accumulated tokens as fallback display
              const fallback = stream.rawTokens || eventData;
              const display = fallback.length > 500 ? "..." + fallback.slice(-500) : fallback;
              setStream((s) => ({ ...s, phase: "error", error: "解析结果格式异常，以下为原始内容", displayText: display }));
              return;
            }
            // Validate: check _raw flag or essential fields completeness
            const finalRec = final as Record<string, unknown>;
            const hasRaw = finalRec._raw === true;
            const segments: unknown[] = Array.isArray(finalRec.segments) ? finalRec.segments : [];
            const improvedScript = finalRec.improved_script;
            const scriptChanges: unknown[] = Array.isArray(finalRec.script_changes) ? finalRec.script_changes : [];
            if (hasRaw || (segments.length === 0 && !improvedScript && scriptChanges.length === 0)) {
              const fallback = stream.rawTokens || eventData;
              const display = fallback.length > 500 ? "..." + fallback.slice(-500) : fallback;
              setStream((s) => ({ ...s, phase: "error", error: "模型返回格式不完整，请重试", displayText: display }));
              return;
            }
            const result: AnalyzeResult = {
              evaluation: final.evaluation ?? {},
              performer_tags: final.performer_tags ?? [],
              premise: typeof final.premise === 'string' ? final.premise : String(final.premise ?? ''),
              theme_refined: typeof final.theme_refined === 'string' ? final.theme_refined : '',
              comedy_type: final.comedy_type ?? "",
              structures: typeof final.structures === 'string' ? final.structures : (Array.isArray(final.structures) ? final.structures.join('、') : ''),
              techniques: Array.isArray(final.techniques) ? final.techniques : [],
              segments: (Array.isArray(final.segments) ? final.segments.map((s: any) => ({
                text: s.text ?? "",
                structure: s.structure ?? "unknown",
                attitude: s.attitude ?? "",
                theme: s.theme ?? "",
                premise: s.premise ?? "",
                techniques: Array.isArray(s.techniques) ? s.techniques : [],
                problem: s.problem ?? "",
              })) : []),
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


            // P1-3: calculate duration and extract model name
            const elapsedSec = startTimeRef.current
              ? Math.round((Date.now() - startTimeRef.current) / 1000)
              : undefined;
            const modelName = typeof raw === 'object' && raw !== null && (raw as any)._meta?.model
              ? (raw as any)._meta.model
              : undefined;

            const histItem: HistoryItem = {
              id: crypto.randomUUID(),
              text: inputText.slice(0, 100),
              result,
              timestamp: Date.now(),
            };
            void histItem; // suppress unused warning
            abortRef.current = null;

            setStream((current): StreamingState => ({
              ...current,
              phase: "done",
              result,
              duration: elapsedSec,
              model: modelName,
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
      clearTimeout(timeoutId);
      abortRef.current = null;
      if (e.name === "AbortError" || e.message?.includes("abort")) {
        // Timeout — show warm message + keep the input so user can retry
        const partial = streamRef.current.rawTokens;
        setStream((s) => ({
          ...s,
          phase: "error",
          error: "分析耗时较长，服务器还在思考。建议：缩短段子字数，或稍后重试。",
          displayText: partial
            ? (partial.length > 500 ? "..." + partial.slice(-500) : partial)
            : "",
        }));
      } else {
        setStream((s) => ({ ...s, phase: "error", error: e.message ?? String(e) }));
      }
    }
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

  const EXAMPLE_SCRIPTS = [
    "我上次去相亲，对面姑娘问我做什么的，我说程序员。她眼睛一亮：那你加班的时候，是不是算在约会啊？我说不是，她说那你加班的时候在想什么，我说我在想为什么这个bug老是报错。她说你这个人真的很无聊，连约会的时候都在想代码。我说不是，我在想为什么bug老是报错，她说那你想出来了吗，我说我把那个bug修好了，她说那你现在还约会吗，我说不了，我今天要加班修另一个bug。",
    "我最近时间管理出了大问题，每天早上起床都要想今天几点出门才不会迟到。结果我发现一个问题：只要我提前5分钟起床，这5分钟就会莫名其妙消失。后来我想明白了，原来这5分钟被用来看手机了。所以我现在出门时间根本没变，只是早起看了会儿手机而已。",
    "地铁上我偷听旁边两个人聊天，一个人说我上周去体检，医生说我睡眠不足，我说我也睡眠不足，他说那你睡几个小时，我说四个小时，他说那不行，要睡够八个小时，我说我也知道，但问题是我每天晚上都舍不得睡，因为我觉得睡着了这一天就真的结束了。",
  ];

  const fillExample = () => {
    const idx = Math.floor(Math.random() * EXAMPLE_SCRIPTS.length);
    setInputText(EXAMPLE_SCRIPTS[idx]);
    setContentWarning(null);
    // Scroll to analyze button
    document.querySelector("button[disabled]")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <rect width="32" height="32" rx="8" fill="#6366f1"/>
              <ellipse cx="16" cy="12" rx="6" ry="8" fill="white"/>
              <rect x="13" y="20" width="6" height="6" rx="1" fill="white"/>
              <rect x="14.5" y="26" width="3" height="2" rx="0.5" fill="white"/>
              <rect x="10" y="8" width="12" height="3" rx="1.5" fill="none" stroke="white" stroke-width="1.5"/>
            </svg>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-800">喜剧写稿台</h1>
              <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">分析你的段子，发现提升空间</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setCmdKOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs sm:text-sm text-gray-600 transition-colors"
            >
              <span>⌘K</span>
              <span className="hidden sm:inline">素材库</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Left: Input */}
          <div className="space-y-4">
            {/* 1.1 标题与副标题 */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 leading-snug">
                把段子贴进来，看看它到底卡在哪
              </h1>
              <p className="text-sm text-gray-500 mt-2">
                从结构、笑点、节奏、情绪推进、结尾几个角度帮你定位问题
              </p>
            </div>

            {contentWarning ? (
              <div className="text-xs text-orange-500 bg-orange-50 border border-orange-100 px-4 py-2 rounded-xl">
                ⚠️ {contentWarning}，仍可分析
              </div>
            ) : null}

            {/* 1.4 引导文案 */}
            <p className="text-sm text-gray-500">
              把你最不确定的段子贴进来，我们先找出最该改的地方
            </p>

            {/* 1.5 示例段子 */}
            <button
              onClick={fillExample}
              disabled={isStreaming}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <span>🔍</span>
              <span>试试示例段子</span>
            </button>

            {/* Save status bar + input */}
            <div className="input-area">
              {/* Save status indicator */}
              {hasResult && stream.result && (
                <div className="save-status-bar">
                  <span className="save-status-source">
                    当前来源：<strong>{sourcePath && sourcePath.length > 0 ? sourcePath[sourcePath.length - 1] : '改稿'}</strong>
                  </span>
                  <span className="save-status-time">✓ 已自动保存 · 刚刚</span>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <textarea
                value={inputText}
                onChange={(e) => { setInputText(e.target.value); setContentWarning(checkContentQuality(e.target.value)); }}
                placeholder="把你不确定好不好笑的段子贴进来"
                className="input-area-textarea"
                style={{ fontFamily: "inherit" }}
                disabled={isStreaming}
              />
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
                <span className={`char-count-hint ${charCount < 20 ? (charCount > 0 ? 'low' : 'empty') : 'ok'}`}>
                  {charCount} 字
                  {charCount > 0 && charCount < 20 && <span>（还差 {20 - charCount} 个字，随便写一句生活观察也可以开始）</span>}
                  {charCount >= 20 && <span>✓ 可以开始</span>}
                </span>
              </div>
            </div>
            </div>

            {/* CTA 按钮 */}
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze || isStreaming}
              className={`cta-button ${canAnalyze && !isStreaming ? 'primary' : ''}`}
            >
              {isStreaming ? (
                <>
                  <span className="animate-spin">⟳</span>
                  <span>分析中...</span>
                </>
              ) : (
                <>
                  <span>🔍</span>
                  <span>开始诊断</span>
                </>
              )}
            </button>
            <p className="text-xs text-gray-400 text-center -mt-1">输入至少20字即可开始</p>
            <p className="text-xs text-gray-400 text-center">生成后自动保存到右侧创作会话</p>
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
              onRetry={() => {
                handleAnalyze();
              }}
              setCmdKQuery={setCmdKQuery}
              setCmdKOpen={setCmdKOpen}
              inputText={inputText}
              setInputText={setInputText}
              sourcePath={sourcePath}
            />

            {/* Copy Result — only when done */}
            {hasResult && stream.result && (
              <button
                onClick={() => {
                  const r = stream.result!;
                  const lines = [
                    ...(r.comedy_type ? [`🎭 类型：${r.comedy_type}`] : []),
                    `✅ 结构：${typeof r.structures === 'string' ? r.structures : ''}`,
                    `🎯 技巧：${Array.isArray(r.techniques) ? r.techniques.join('、') : ''}`,
                    typeof r.premise === 'string' && r.premise ? `💡 前提：${r.premise}` : '',
                    r.theme_refined ? `🏷️ 主题：${r.theme_refined}` : '',
                    '',
                    '--- 段落拆解 ---',
                    ...(r.segments ?? []).map((s) =>
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
      <LoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        defaultTab="register"
      />
    </div>
  );
}
