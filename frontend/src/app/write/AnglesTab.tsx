"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/components/Toast";
import { useStreamingTask, StreamingMeta } from "@/hooks/useStreamingTask";

interface Angle {
  name: string;
  premise: string;
  expansion_idea: string;
  scene_direction: string;
  ending_direction: string;
}

interface AnglesResult {
  current_problem: { issues: string[]; summary: string };
  angles: Angle[];
  recommendation: { name: string; reason: string };
}

function esc(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const GUIDE_TEXT = "有一个前提，想看看有没有更新鲜的切入角度？";

function formatAnglesShare(result: AnglesResult) {
  const lines = [
    "# 找角度结果",
    "",
    result.current_problem?.summary ? `**当前问题：** ${result.current_problem.summary}` : "",
    "",
    ...(result.angles || []).map((a, i) =>
      `${i+1}. **${a.name}**\n   ${a.premise}\n   展开：${a.expansion_idea} | 场景：${a.scene_direction} | 结尾：${a.ending_direction}`
    ),
  ];
  if (result.recommendation?.name) {
    lines.push("", "## ⭐ 推荐角度", `**${result.recommendation.name}**`, result.recommendation.reason || "");
  }
  return lines.join("\n");
}

export default function AnglesTab({ onAction, initialData, sourcePath, onClearPending, onResultDone }: { onAction?: (action: string, data?: string, sourcePath?: string[]) => void; initialData?: string; sourcePath?: string[]; onClearPending?: () => void; onResultDone?: (content: string, rawData: unknown, sourcePath?: string[]) => void }) {
  const [inputText, setInputText] = useState(initialData ?? "");
  const [result, setResult] = useState<AnglesResult | null>(null);
  const [displayText, setDisplayText] = useState("");
  const [meta, setMeta] = useState<StreamingMeta | null>(null);
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [introDismissed, setIntroDismissed] = useState(() => {
    try { return localStorage.getItem("angles_intro_dismissed") === "1"; } catch { return false; }
  });

  const autoTriggered = useRef(false);
  const regenerateRef = useRef<() => void>(null);
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { state, start, abort } = useStreamingTask<AnglesResult>("/api/write/angles/stream", {
    timeoutMs: 120_000,
    slowWarningMs: 30_000,
    onProgress: (data) => {
      setDisplayText(data.message || "正在分析中…");
    },
    onMeta: (m) => setMeta(m),
    onDone: (r) => {
      setResult(r);
    },
  });

  // Auto-trigger analysis when initialData comes from cross-tab navigation
  useEffect(() => {
    if (initialData && !autoTriggered.current) {
      autoTriggered.current = true;
      setInputText(initialData);
      const timer = setTimeout(() => {
        const form = textareaRef.current?.closest("form");
        const formSubmit = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
        if (formSubmit && !formSubmit.disabled) {
          formSubmit.click();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [initialData]);

  const canAnalyze = inputText.trim().length >= 5;

  const handleRegenerate = useCallback(() => {
    if (canAnalyze && state.phase === "done") {
      start({ premise: inputTextRef.current.trim() });
    }
  }, [canAnalyze, state.phase, start]);

  regenerateRef.current = handleRegenerate;

  const handleAnalyze = useCallback(() => {
    if (!canAnalyze || state.phase === "thinking") return;
    setDisplayText("");
    setResult(null);
    setMeta(null);
    start({ premise: inputText.trim() });
  }, [canAnalyze, state.phase, start, inputText]);

  const isStreaming = state.phase === "thinking";
  const hasResult = state.phase === "done" && result;

  const cleaned = displayText.replace(/[{}\[\]"":\\]/g, "").replace(/\n/g, " ").replace(/,{2,}/g, " ").replace(/\s{2,}/g, " ").trim();
  const looksLikeProtocol = /[{}]|\\u[0-9a-fA-F]{4}|"[\w_]+"\s*:/.test(displayText);
  const previewText = !cleaned ? "正在为你找角度…" : looksLikeProtocol ? "正在为你找角度…" : cleaned;

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleAnalyze();
    }
  }, [handleAnalyze]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Input */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          {/* Guiding text */}
          <p className="text-sm text-gray-500 mb-3 leading-relaxed">
            💡 {GUIDE_TEXT}
          </p>

          {sourcePath && sourcePath.length > 0 && (
            <div className="mb-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-xs text-blue-600">来自：{sourcePath.join(" → ")}</p>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">找角度</h2>

          </div>



          <form
            onSubmit={(e) => { e.preventDefault(); handleAnalyze(); }}
          >
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={"输入一个已有的喜剧前提……\n\n例如：成年人的'都行'，其实是不想承担责任。\n或者：相亲像面试。"}
              className="w-full h-40 p-4 text-base border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isStreaming}
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {inputText.length > 0 ? `已输入 ${inputText.length} 字` : "请输入前提"}
                </span>
                {inputText.length > 0 && inputText.length < 5 && (
                  <span className="text-xs text-amber-500">至少 5 字可开始，建议 10–100 字</span>
                )}
                {inputText.length >= 5 && (
                  <span className="text-xs text-green-500">✓ 可以开始找角度</span>
                )}
              </div>
              <button
                type="submit"
                disabled={!canAnalyze || isStreaming}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isStreaming ? "分析中..." : "开始找角度"}
              </button>
            </div>
          </form>
          <p className="text-xs text-gray-300 mt-1.5">⌘ + Enter 快捷提交</p>
          <p className="text-xs text-gray-400 mt-2">生成后自动保存到右侧创作会话</p>
        </div>

        {/* Streaming */}
        {state.phase === "thinking" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-gray-700">AI 分析中</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 min-h-[80px]">
              {previewText ? (
                <div className="text-sm text-gray-500 leading-relaxed">{previewText}</div>
              ) : (
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-4/5" />
                </div>
              )}
            </div>
          </div>
        )}

        {state.phase === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">❌ {state.error}</p>
            <button onClick={() => start({ premise: inputTextRef.current.trim() })} className="mt-2 text-sm text-red-500 hover:text-red-700">
              重试
            </button>
          </div>
        )}

        {hasResult && result && (
          <AnglesResultView result={result} onAction={onAction} sourcePath={sourcePath} copiedId={copiedId} onCopy={(id) => { setCopiedId(id); setTimeout(() => setCopiedId(null), 1500); }} onRegenerate={handleRegenerate} onResultDone={onResultDone} />
        )}
      </div>

      {/* Right: Intro */}
      <div>
        {introDismissed ? (
          <button
            onClick={() => { setIntroDismissed(false); try { localStorage.removeItem("angles_intro_dismissed"); } catch {} }}
            className="w-full text-left text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            ℹ️ 显示工具说明
          </button>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-base font-bold text-gray-800">这个工具做什么？</p>
              <button
                onClick={() => { setIntroDismissed(true); try { localStorage.setItem("angles_intro_dismissed", "1"); } catch {} }}
                className="text-gray-400 hover:text-gray-600 text-xs"
                title="不再显示"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              针对一个<strong>已有前提</strong>，快速生成<strong>更新鲜、更有喜剧价值</strong>的切入角度。
            </p>
            <div className="space-y-2">
              {[
                "判断当前前提的问题",
                "生成 6 个不同维度角度",
                "反常识 / 人性 / 权力关系",
                "自嘲 / 类比 / 更狠",
                "推荐最优角度并说明理由",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                  <p className="text-sm text-gray-600">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnglesResultView({ result, onAction, sourcePath, copiedId, onCopy, onRegenerate, onResultDone }: { result: AnglesResult; onAction?: (action: string, data?: string) => void; sourcePath?: string[]; copiedId: string | null; onCopy: (id: string) => void; onRegenerate?: () => void; onResultDone?: (content: string, rawData: unknown, sourcePath?: string[]) => void }) {
  const [expandedAngle, setExpandedAngle] = useState<number | null>(null);

  // 结果生成后自动保存到 session（只调用一次）
  const hasCalledRef = useRef(false);
  useEffect(() => {
    if (result && !hasCalledRef.current) {
      hasCalledRef.current = true;
      const text = result.recommendation?.name || JSON.stringify(result);
      onResultDone?.(text, result, sourcePath || ["角度分析"]);
    }
  }, [result, sourcePath]);

  return (
    <div className="space-y-4">
      {/* Current problem */}
      {result.current_problem && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-2">当前前提的问题</p>
          <p className="text-sm text-gray-600 leading-relaxed mb-2">{esc(result.current_problem.summary)}</p>
          {(result.current_problem.issues ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.current_problem.issues.map((issue, i) => (
                <span key={i} className="text-xs px-2.5 py-1 bg-red-50 text-red-700 rounded-full font-medium">{esc(issue)}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Angles */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">新角度（6条）</p>
        </div>
        <div className="space-y-3">
          {(result.angles ?? []).map((angle, i) => (
            <div
              key={i}
              className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                expandedAngle === i ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-100 hover:border-blue-200"
              }`}
              onClick={() => setExpandedAngle(expandedAngle === i ? null : i)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-blue-600">{i + 1}</span>
                <span className="text-sm font-semibold text-gray-800">{esc(angle.name)}</span>
                {expandedAngle !== i && (
                  <span className="ml-auto text-xs text-gray-400">点击展开</span>
                )}
              </div>
              <p className="text-base font-medium text-gray-900">{esc(angle.premise)}</p>

              {expandedAngle === i && (
                <div className="mt-3 pt-3 border-t border-blue-100 grid grid-cols-3 gap-2 text-xs text-gray-500">
                  <div>
                    <span className="font-medium text-gray-400 block mb-0.5">展开方向</span>
                    <span>{esc(angle.expansion_idea)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-400 block mb-0.5">适合场景</span>
                    <span>{esc(angle.scene_direction)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-400 block mb-0.5">结尾方向</span>
                    <span>{esc(angle.ending_direction)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      {result.recommendation && result.recommendation.name && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold text-purple-700">⭐ 推荐角度</span>
            <span className="text-xs px-2 py-0.5 bg-purple-200 text-purple-800 rounded font-medium">{esc(result.recommendation.name)}</span>
          </div>
          <p className="text-sm text-gray-600 mb-3">{esc(result.recommendation.reason)}</p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const text = formatAnglesShare(result);
                navigator.clipboard.writeText(text).catch(() => {});
              }}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              📤 分享
            </button>
            <button
              onClick={() => {
                onCopy("rec");
                navigator.clipboard.writeText(result.recommendation.name).catch(() => {});
              }}
              className="px-3 py-1.5 bg-white border border-purple-200 text-purple-700 text-xs font-medium rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-1"
            >
              {copiedId === "rec" ? "✅ 已复制" : "📋 复制角度"}
            </button>
            <button
              onClick={() => onAction?.("go-rewrite", result.recommendation.name)}
              className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              ✏️ 用这个角度改稿
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
