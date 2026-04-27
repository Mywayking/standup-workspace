"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/components/Toast";
import { useStreamingTask, StreamingMeta } from "@/hooks/useStreamingTask";
import { detectInputApi, type DetectInputResult } from "@/lib/api";

interface PremiseCandidate {
  text: string;
  type: string;
  description: string;
}

interface PremiseResult {
  theme: string;
  attitude: string;
  conflict: string;
  premise_candidates: PremiseCandidate[];
  recommendation: { text: string; reason: string; best_type: string };
  scene_suggestions: string[];
  expansion_directions: string[];
  ending_direction: string;
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

const GUIDE_TEXT = "讲一件事、一个经历、一个观察，AI 帮你提炼出可以上台说的喜剧前提。";

function formatPremiseShare(result: PremiseResult) {
  const lines = [
    "# 喜剧前提提炼结果",
    "",
    `**主题：** ${result.theme}`,
    `**态度：** ${result.attitude}`,
    `**核心矛盾：** ${result.conflict}`,
    "",
    "## 前提候选",
    ...(result.premise_candidates || []).map((c, i) =>
      `${i+1}. **${c.text}**\n   ${c.description || ''}`
    ),
  ];
  if (result.recommendation?.text) {
    lines.push("", "## ⭐ 推荐前提", `**${result.recommendation.text}**`, result.recommendation.reason || "");
  }
  return lines.join("\n");
}

export default function PremiseTab({
  onAction,
  initialData,
  sourcePath,
  onClearPending,
  onResultDone,
}: {
  onAction?: (action: string, data?: string, sourcePath?: string[]) => void;
  initialData?: string;
  sourcePath?: string[];
  onClearPending?: () => void;
  onResultDone?: (content: string, rawData: unknown, sourcePath?: string[]) => void;
}) {
  const [inputText, setInputText] = useState(initialData ?? "");
  const [result, setResult] = useState<PremiseResult | null>(null);
  const [displayText, setDisplayText] = useState("");
  const [meta, setMeta] = useState<StreamingMeta | null>(null);
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;

  // Input type detection state
  const [detectedType, setDetectedType] = useState<string>("");
  const [recommendedStep, setRecommendedStep] = useState<string>("");
  const [detecting, setDetecting] = useState(false);
  const detectDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [copiedRec, setCopiedRec] = useState(false);
  const regenerateRef = useRef<() => void>(null);

  const [introDismissed, setIntroDismissed] = useState(() => {
    try { return localStorage.getItem("premise_intro_dismissed") === "1"; } catch { return false; }
  });

  // Debounced input type detection
  useEffect(() => {
    if (inputText.length < 10) {
      setDetectedType("");
      setRecommendedStep("");
      return;
    }
    if (detectDebounceRef.current) clearTimeout(detectDebounceRef.current);
    detectDebounceRef.current = setTimeout(async () => {
      setDetecting(true);
      try {
        const res = await detectInputApi.detect(inputText);
        if (res.confidence >= 0.6) {
          setDetectedType(res.input_type);
          setRecommendedStep(res.recommended_next_step);
        }
      } catch { /* silent fail */ }
      finally { setDetecting(false); }
    }, 800);
    return () => { if (detectDebounceRef.current) clearTimeout(detectDebounceRef.current); };
  }, [inputText]);

  const { state, start, abort, setError } = useStreamingTask<PremiseResult>("/api/write/premise/stream", {
    timeoutMs: 60_000,
    slowWarningMs: 15_000,
    onToken: () => { /* tokens not displayed */ },
    onProgress: (data) => {
      setDisplayText(data.message || "正在分析中…");
    },
    onMeta: (m) => setMeta(m),
    onDone: (r) => {
      // Validate: must have premise_candidates with items or a recommendation
      const rRec = r as unknown as Record<string, unknown>;
      const candidates = rRec.premise_candidates;
      const rec = rRec.recommendation as Record<string, unknown> | undefined;
      if ((!candidates || !Array.isArray(candidates) || candidates.length === 0) && (!rec || !rec.text)) {
        setError("模型返回格式不完整，请重试");
        return;
      }
      setResult(r);
    },
    onError: () => { /* handled by state.phase */ },
  });

  const canAnalyze = inputText.trim().length >= 5;

  const handleRegenerate = useCallback(() => {
    if (canAnalyze && state.phase === "done") {
      start({ text: inputTextRef.current.trim() });
    }
  }, [canAnalyze, state.phase, start]);

  regenerateRef.current = handleRegenerate;

  const handleAnalyze = useCallback(() => {
    if (!canAnalyze || state.phase === "thinking") return;
    setDisplayText("");
    setResult(null);
    setMeta(null);
    start({ text: inputText.trim() });
  }, [canAnalyze, state.phase, start, inputText]);

  const isStreaming = state.phase === "thinking";
  const hasResult = state.phase === "done" && result;
  const raw = displayText;
  const cleaned = raw.replace(/[{}\[\]"":\\]/g, "").replace(/\n/g, " ").replace(/,{2,}/g, " ").replace(/\s{2,}/g, " ").trim();
  const looksLikeProtocol = /[{}]|\\u[0-9a-fA-F]{4}|"[\w_]+"\s*:/.test(raw);
  const previewText = !cleaned ? "正在分析素材，马上给你前提候选…" : looksLikeProtocol ? "正在分析素材，马上给你前提候选…" : cleaned;

  const introItems = [
    "识别主题和态度",
    "提炼核心矛盾",
    "生成 5 个前提候选",
    "推荐最优前提",
    "给出场景建议",
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column */}
      <div className="lg:col-span-2 space-y-4">
        {/* Input card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">提炼前提</h2>
          </div>
          {sourcePath && sourcePath.length > 0 && (
            <div className="mb-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-xs text-blue-600">来自：{sourcePath?.join(" → ")}</p>
            </div>
          )}
          <p className="text-sm text-gray-500 mb-3 leading-relaxed">💡 {GUIDE_TEXT}</p>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const kw = prompt('输入素材库搜索关键词（可留空查看全部素材）：');
                  if (kw !== null) {
                    const openUrl = kw ? '/kb?q=' + encodeURIComponent(kw) : '/kb';
                    window.open(openUrl, '_blank');
                  }
                }}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                📚 素材库
              </button>
            </div>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={"输入一段素材：\n一件事、一句抱怨、一个观察、一段情绪……\n\n📝 示例：\n• 我发现同事离职后，工位像被系统自动回收一样\n• 我妈总觉得我写脱口秀不算正经工作\n• 成年人最擅长的事，就是把委屈说成体面"}
            className="w-full h-48 p-4 text-base border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isStreaming}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleAnalyze();
              }
            }}
          />
          {/* Input Type Detection */}
          {inputText.length >= 10 && (
            <div className="mt-2 text-sm text-gray-500 animate-fade-in">
              {detecting ? (
                <span>正在分析...</span>
              ) : detectedType && detectedType !== "material" ? (
                <span>
                  我判断你现在卡在 <span className="font-medium text-blue-600">{detectedType}</span>，
                  建议先 <button
                    onClick={() => {
                      if (recommendedStep === "找角度") onAction?.("go-angles", inputText);
                      else if (recommendedStep === "改稿") onAction?.("go-rewrite", inputText);
                    }}
                    className="text-blue-600 underline"
                  >{recommendedStep}</button>
                </span>
              ) : null}
            </div>
          )}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{inputText.length > 0 ? `已输入 ${inputText.length} 字` : '请输入素材'}</span>
              {inputText.length > 0 && inputText.length < 20 && (
                <span className="text-xs text-amber-500">至少 20 字可开始，建议 50–200 字</span>
              )}
              {inputText.length >= 20 && (
                <span className="text-xs text-green-500">✓ 可以开始提炼</span>
              )}
            </div>
            {isStreaming ? (
              <button
                onClick={abort}
                className="px-5 py-2 bg-gray-400 text-white text-sm font-semibold rounded-lg hover:bg-gray-500 transition-colors"
              >
                取消
              </button>
            ) : (
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                开始提炼
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">生成后自动保存到右侧创作会话</p>
        </div>

        {/* Streaming state */}
        {(state.phase === "thinking" || state.phase === "cancelled") && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-gray-700">
                {state.phase === "cancelled" ? "已取消" : "AI 分析中"}
              </span>
              {state.phase === "cancelled" && (
                <span className="text-xs text-gray-400">已取消本次分析</span>
              )}
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

        {/* Error state */}
        {state.phase === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">❌ {state.error}</p>
            <button
              onClick={() => {/* reset by starting new */ start({ text: inputText.trim() }) }}
              className="mt-2 text-sm text-red-500 hover:text-red-700 font-medium"
            >
              重新分析
            </button>
          </div>
        )}

        {/* Done: show result */}
        {hasResult && result ? (
          <PremiseResultView
            result={result}
            onAction={onAction}
            onRegenerate={handleRegenerate}
            onResultDone={onResultDone}
            sourcePath={sourcePath}
          />
        ) : null}
      </div>

      {/* Right column: intro */}
      <div>
        {introDismissed ? (
          <button
            onClick={() => { setIntroDismissed(false); try { localStorage.removeItem("premise_intro_dismissed"); } catch {} }}
            className="w-full text-left text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            ℹ️ 显示工具说明
          </button>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-base font-bold text-gray-800">这个工具做什么？</p>
              <button
                onClick={() => { setIntroDismissed(true); try { localStorage.setItem("premise_intro_dismissed", "1"); } catch {} }}
                className="text-gray-400 hover:text-gray-600 text-xs"
                title="不再显示"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              把一段素材、情绪、观察，转化成<strong>可以上台说</strong>的喜剧前提。
            </p>
            <div className="space-y-2">
              {introItems.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                  <p className="text-sm text-gray-600">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">输入素材越具体，提炼的前提越精准</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Result sub-component ────────────────────────────────────────────────────

function PremiseResultView({
  result,
  onAction,
  onRegenerate,
  onResultDone,
  sourcePath,
}: {
  result: PremiseResult;
  onAction?: (action: string, data?: string) => void;
  onRegenerate?: () => void;
  onResultDone?: (content: string, rawData: unknown, sourcePath?: string[]) => void;
  sourcePath?: string[];
}) {
  const themeItem = { label: "主题", value: result.theme, icon: "📋" };
  const attitudeItem = { label: "态度", value: result.attitude, icon: "💢" };
  const conflictItem = { label: "核心矛盾", value: result.conflict, icon: "⚡" };
  const basicItems = [themeItem, attitudeItem, conflictItem];

  return (
    <div className="space-y-4">
      {/* Regenerate button */}
      <div className="flex justify-center">
        <button
          onClick={onRegenerate}
          className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center gap-1.5"
        >
          🔄 换个方向重新提炼
        </button>
      </div>

      {/* Theme / Attitude / Conflict */}
      <div className="grid grid-cols-3 gap-3">
        {basicItems.map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span>{item.icon}</span>
              <span className="text-xs font-semibold text-gray-500">{item.label}</span>
            </div>
            <p className="text-sm font-medium text-gray-800 leading-snug">{esc(item.value)}</p>
          </div>
        ))}
      </div>

      {/* Premise Candidates */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">前提候选（5条）</p>
        <div className="space-y-2">
          {(result.premise_candidates ?? []).map((c, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-blue-600">{i + 1}</span>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">{esc(c.type)}</span>
              </div>
              <p className="text-sm font-medium text-gray-800">{esc(c.text)}</p>
              {c.description ? <p className="text-xs text-gray-400 mt-1">{esc(c.description)}</p> : null}
            </div>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      {result.recommendation && result.recommendation.text ? (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold text-blue-700">⭐ 推荐前提</span>
            <span className="text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded font-medium">{esc(result.recommendation.best_type)}</span>
          </div>
          <p className="text-base font-semibold text-gray-900 mb-2">{esc(result.recommendation.text)}</p>
          <p className="text-sm text-gray-600">{esc(result.recommendation.reason)}</p>
        </div>
      ) : null}

      {/* Action buttons */}
      {result.recommendation && result.recommendation.text ? (
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => {
                const text = formatPremiseShare(result);
                navigator.clipboard.writeText(text).catch(() => {});
              }}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              📤 分享
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(result.recommendation.text).catch(() => {})}
              className="px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-50 transition-colors"
            >
              📋 复制前提
            </button>
            <button
              onClick={() => onAction?.("go-angles", result.recommendation.text)}
              className="px-4 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              🔍 用这个前提找角度
            </button>
            <button
              onClick={() => {
                onResultDone?.(result.recommendation.text, result, sourcePath || ["前提提炼"]);
              }}
              className="px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-medium rounded-lg hover:bg-orange-100 transition-colors"
            >
              💾 保存到会话
            </button>
          </div>
        </div>
      ) : null}

      {/* Follow-up suggestions */}
      {(result.scene_suggestions?.length > 0 || result.expansion_directions?.length > 0 || result.ending_direction) ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">后续展开建议</p>
          <div className="space-y-3">
            {result.scene_suggestions?.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">可写场景</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.scene_suggestions.map((s, i) => (
                    <span key={i} className="text-sm px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg">{esc(s)}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {result.expansion_directions?.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">延展方向</p>
                <div className="space-y-1">
                  {result.expansion_directions.map((d, i) => (
                    <div key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5 shrink-0">→</span>
                      <span>{esc(d)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {result.ending_direction ? (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">结尾方向</p>
                <p className="text-sm text-gray-700">{esc(result.ending_direction)}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
