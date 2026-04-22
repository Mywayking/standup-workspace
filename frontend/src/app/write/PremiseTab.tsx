"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/components/Toast";

interface StreamingState {
  phase: "idle" | "thinking" | "done" | "error";
  displayText: string;
  result: PremiseResult | null;
  error: string | null;
}

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
  sourceStep,
  onClearPending,
  onResultDone,
}: {
  onAction?: (action: string, data?: string, sourceStep?: string) => void;
  initialData?: string;
  sourceStep?: string;
  onClearPending?: () => void;
  onResultDone?: (content: string, rawData: unknown, sourceStep?: string) => void;
}) {
  const [inputText, setInputText] = useState(initialData ?? "");
  const [stream, setStream] = useState<StreamingState>({
    phase: "idle",
    displayText: "",
    result: null,
    error: null,
  });
  const { toast } = useToast();
  const abortRef = useRef<AbortController | null>(null);
  const streamRef = useRef(stream);
  streamRef.current = stream;

  const [copiedRec, setCopiedRec] = useState(false);
  const regenerateRef = useRef<() => void>(null);

  const [introDismissed, setIntroDismissed] = useState(() => {
    try { return localStorage.getItem("premise_intro_dismissed") === "1"; } catch { return false; }
  });

  const canAnalyze = inputText.trim().length >= 5;

  const handleRegenerate = useCallback(() => {
    if (canAnalyze && stream.phase === "done") {
      setStream({ phase: "idle", displayText: "", result: null, error: null });
      setTimeout(() => handleAnalyze(), 50);
    }
  }, [canAnalyze, stream.phase]);

  // Expose regenerate for result view buttons
  regenerateRef.current = handleRegenerate;

  const handleAnalyze = useCallback(async () => {
    if (!canAnalyze || stream.phase === "thinking") return;

    const sid = Math.random().toString(36).slice(2, 10);
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    setStream({ phase: "thinking", displayText: "", result: null, error: null });

    try {
      const resp = await fetch(`/api/extract-premise/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText.trim() }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        const body = await resp.text();
        setStream((s) => ({ ...s, phase: "error", error: `HTTP ${resp.status}: ${body}` }));
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let pendingEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        while (buffer.includes("\n")) {
          const nl = buffer.indexOf("\n");
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);

          if (line.startsWith("event: ")) {
            pendingEvent = line.slice(7).trim();
            continue;
          }

          if (!line.startsWith("data: ")) {
            if (line === "") {
              pendingEvent = "";
            }
            continue;
          }

          const dataStr = line.slice(6);
          const evt = pendingEvent;

          if (evt === "token") {
            // 不在 UI 展示原始 token，避免协议内容泄露
            continue;
          } else if (evt === "progress") {
            try {
              const data = JSON.parse(dataStr);
              // 阶段提示用覆盖而非追加，避免累积混乱
              setStream((s) => ({
                ...s,
                displayText: data.message || "正在分析素材…",
              }));
            } catch {
              setStream((s) => ({ ...s, displayText: "正在分析素材…" }));
            }
          } else if (evt === "analysis") {
            try {
              const data = JSON.parse(dataStr);
              setStream((s) => ({
                ...s,
                displayText:
                  "已识别：「" +
                  (data.theme || "—") +
                  "」｜态度：「" +
                  (data.attitude || "—") +
                  "」｜核心矛盾：「" +
                  (data.conflict || data.core_conflict || "提炼中") +
                  "」",
              }));
            } catch {}
          } else if (evt === "done") {
            try {
              const data = JSON.parse(dataStr);
              setStream({ phase: "done", displayText: "", result: data, error: null });


            } catch {
              setStream((s) => ({ ...s, phase: "error", error: "解析返回数据失败" }));
            }
          } else if (evt === "error") {
            try {
              const data = JSON.parse(dataStr);
              setStream((s) => ({ ...s, phase: "error", error: data.error || "未知错误" }));
            } catch {
              setStream((s) => ({ ...s, phase: "error", error: "未知错误" }));
            }
          }
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const msg = String(err);
      let userMsg = "生成失败，请重试";
      if (err.name === "AbortError") {
        userMsg = "请求超时（120秒），请稍后重试";
      } else if (msg.includes("network") || msg.includes("Failed to fetch")) {
        userMsg = "网络连接异常，请检查网络后重试";
      } else if (msg.includes("HTTP")) {
        userMsg = msg;
      }
      setStream((s) => ({ ...s, phase: "error", error: userMsg }));
    } finally {
      abortRef.current = null;
    }
  }, [inputText, canAnalyze, stream.phase]);

  const isStreaming = stream.phase === "thinking";
  const hasResult = stream.phase === "done" && stream.result;
  const raw = stream.displayText ?? "";
  const cleaned = raw.replace(/[{}\[\]"":\\]/g, "").replace(/\n/g, " ").replace(/,{2,}/g, " ").replace(/\s{2,}/g, " ").trim();

  // 安全兜底：检测协议垃圾数据，只在确认安全时展示
  // 只拦截真正的协议残留：JSON 对象、Unicode 转义、字段引用语法
  const looksLikeProtocol = /[{}]|\\u[0-9a-fA-F]{4}|"[\w_]+"\s*:/.test(raw);
  const previewText = !cleaned ? "正在分析素材，马上给你前提候选…" : looksLikeProtocol ? "正在分析素材，马上给你前提候选…" : cleaned;

  // Derive simple parts for display
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
          {sourceStep && (
            <div className="mb-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-xs text-blue-600">来自：{sourceStep}</p>
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
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze || isStreaming}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isStreaming ? "分析中..." : "开始提炼"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">生成后自动保存到右侧创作会话</p>
        </div>

        {/* Streaming state */}
        {stream.phase === "thinking" && (
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

        {/* Error state */}
        {stream.phase === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">❌ {stream.error}</p>
            <button onClick={() => setStream((s) => ({ ...s, phase: "idle" }))} className="mt-2 text-sm text-red-500 hover:text-red-700">
              重试
            </button>
          </div>
        )}

        {/* Done: show result */}
        {hasResult && stream.result ? (
          <PremiseResultView
            result={stream.result}
            onAction={onAction}
            onRegenerate={handleRegenerate}
            onResultDone={onResultDone}
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

// ─── Result sub-component (defined before use) ────────────────────────────────

function PremiseResultView({
  result,
  onAction,
  onRegenerate,
  onResultDone,
}: {
  result: PremiseResult;
  onAction?: (action: string, data?: string) => void;
  onRegenerate?: () => void;
  onResultDone?: (content: string, rawData: unknown, sourceStep?: string) => void;
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
              onClick={() => {
                navigator.clipboard.writeText(result.recommendation.text).catch(() => {});
              }}
              className="px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-50 transition-colors"
            >
              📋 复制前提
            </button>
            <button
              onClick={() => onAction?.("go-angles", result.recommendation.text)}
              className="px-4 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              🔍 用这个前提找角度
            <button
              onClick={() => {
                onResultDone?.(result.recommendation.text, result, "前提提炼");
              }}
              className="px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-medium rounded-lg hover:bg-orange-100 transition-colors"
            >
              💾 保存到会话
            </button>
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
