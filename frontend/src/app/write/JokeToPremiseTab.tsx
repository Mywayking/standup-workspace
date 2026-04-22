"use client";
import { useState, useRef, useCallback } from "react";

interface JTPState {
  phase: "idle" | "thinking" | "done" | "error";
  analysisPhase: "" | "analyzing" | "generating";
  displayText: string;
  analysis: JokeAnalysis | null;
  premises: PremiseCandidate[];
  error: string | null;
}

interface JokeAnalysis {
  input_type: string;
  joke_type: string;
  core_topic: string;
  core_conflict: string;
  comparison_target?: string;
  emotion: string[];
  persona_candidates: string[];
  humor_mechanism: string;
  suggestion?: string;
}

interface PremiseCandidate {
  id: string;
  title: string;
  why_it_works: string;
  setup_direction: string;
  persona: string;
  emotion: string;
  opening_line: string;
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

const TOPICS = ["职场", "亲密关系", "原生家庭", "社交", "互联网", "AI", "日常生活", "消费主义"];

function formatJTPShare(premises: PremiseCandidate[]) {
  const lines = [
    "# 梗写前提结果",
    "",
    ...premises.map((p, i) =>
      `${i+1}. **${p.title}**\n   为什么成立：${p.why_it_works}\n   怎么铺垫：${p.setup_direction}\n   适合谁说：${p.persona}${p.emotion ? '（' + p.emotion + '）' : ''}\n   起手句：${p.opening_line}`
    ),
  ];
  return lines.join("\n");
}
const STYLES = ["真实观察", "自嘲", "毒舌", "冷幽默", "夸张"];

export default function JokeToPremiseTab({ onAction, onResultDone }: { onAction?: (action: string, data?: string, sourceStep?: string) => void; onResultDone?: (content: string, rawData: unknown) => void }) {
  const [inputText, setInputText] = useState("");
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("");
  const regenerateRef = useRef<() => void>(null);

  const [introDismissed, setIntroDismissed] = useState(() => {
    try { return localStorage.getItem("jtp_intro_dismissed") === "1"; } catch { return false; }
  });

  const [stream, setStream] = useState<JTPState>({
    phase: "idle",
    analysisPhase: "",
    displayText: "",
    analysis: null,
    premises: [],
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const canGenerate = inputText.trim().length >= 3;

  const handleRegenerate = useCallback(() => {
    if (canGenerate && stream.phase === "done") {
      setStream({ phase: "idle", analysisPhase: "", displayText: "", analysis: null, premises: [], error: null });
      setTimeout(() => handleGenerate(), 50);
    }
  }, [canGenerate, stream.phase]);

  regenerateRef.current = handleRegenerate;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || stream.phase === "thinking") return;

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 180_000);

    setStream({ phase: "thinking", analysisPhase: "analyzing", displayText: "", analysis: null, premises: [], error: null });

    try {
      const body: Record<string, string> = { text: inputText.trim() };
      if (topic) body.topic = topic;
      if (style) body.style = style;

      const resp = await fetch(`/api/joke-to-premise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const text = await resp.text();
        setStream((s) => ({ ...s, phase: "error", error: `HTTP ${resp.status}: ${text}` }));
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

          if (line === "") {
            pendingEvent = "";
            continue;
          }

          if (line.startsWith("event: ")) {
            pendingEvent = line.slice(7).trim();
            continue;
          }

          if (!line.startsWith("data: ")) continue;

          const dataStr = line.slice(6);
          const evt = pendingEvent;

          if (evt === "progress") {
            try {
              const data = JSON.parse(dataStr);
              const phase = data.phase === "analyzing" ? "analyzing" : "generating";
              const msg = esc(data.message) || (phase === "analyzing" ? "正在拆解梗..." : "正在生成前提候选...");
              setStream((s) => ({ ...s, analysisPhase: phase, displayText: msg }));
            } catch {}
          } else if (evt === "analysis") {
            try {
              const data: JokeAnalysis = JSON.parse(dataStr);
              setStream((s) => ({ ...s, analysis: data, analysisPhase: "generating" }));
            } catch {}
          } else if (evt === "done") {
            try {
              const data = JSON.parse(dataStr);
              const premises: PremiseCandidate[] = (data.premises ?? []).map((p: any) => ({
                id: p.id || "p1",
                title: p.title || "",
                why_it_works: p.why_it_works || "",
                setup_direction: p.setup_direction || "",
                persona: p.persona || "",
                emotion: p.emotion || "",
                opening_line: p.opening_line || "",
              }));
              setStream({ phase: "done", analysisPhase: "", displayText: "", analysis: null, premises, error: null });
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
      if (err.name === "AbortError") {
        setStream((s) => ({ ...s, phase: "error", error: "请求超时（180秒）" }));
      } else {
        setStream((s) => ({ ...s, phase: "error", error: String(err) }));
      }
    } finally {
      abortRef.current = null;
    }
  }, [inputText, canGenerate, stream.phase, topic, style]);

  const isStreaming = stream.phase === "thinking";
  const hasResult = stream.phase === "done" && stream.premises.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column */}
      <div className="lg:col-span-2 space-y-4">
        {/* Input card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-1">梗写前提</h2>
          <p className="text-sm text-gray-500 mb-4">
            你负责想到一句好笑的话，AI 帮你把前面的铺垫找出来。
          </p>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={"输入一句你觉得好笑的梗……\n\n📝 示例：\n• 成年人的崩溃都很懂事，连死机都先点保存\n• 我不是自律，我只是穷得没有试错空间\n• 恋爱像产品经理开需求会，流程完整，结果都不满意"}
            className="w-full h-36 p-4 text-base border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isStreaming}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />

          {/* Options row */}
          <div className="flex flex-wrap gap-3 mt-3 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 shrink-0">主题</span>
              <div className="flex flex-wrap gap-1">
                {TOPICS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTopic(topic === t ? "" : t)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      topic === t
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 shrink-0">风格</span>
              <div className="flex flex-wrap gap-1">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(style === s ? "" : s)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      style === s
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-purple-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {inputText.length > 0 ? `已输入 ${inputText.length} 字` : "请输入一句梗"}
              </span>
              {inputText.length > 0 && inputText.length < 10 && (
                <span className="text-xs text-amber-500">建议 10–80 字</span>
              )}
              {inputText.length >= 10 && (
                <span className="text-xs text-green-500">✓ 可以开始反推</span>
              )}
            </div>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || isStreaming}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isStreaming ? "分析中..." : "开始反推"}
            </button>
          </div>
        </div>

        {/* Streaming state */}
        {stream.phase === "thinking" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-gray-700">
                {stream.analysisPhase === "analyzing" ? "正在拆解梗..." : "正在生成前提候选..."}
              </span>
            </div>
            {/* Analysis preview */}
            {stream.analysis && (
              <div className="bg-gray-50 rounded-xl p-4 mb-3">
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                    {esc(stream.analysis.joke_type)}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                    {esc(stream.analysis.input_type)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium text-gray-800">核心冲突：</span>{esc(stream.analysis.core_conflict)}
                </p>
                <p className="text-sm text-gray-500 text-xs">
                  情绪：{stream.analysis.emotion?.join("、")}
                </p>
              </div>
            )}
            <div className="bg-gray-50 rounded-xl p-4 min-h-[60px]">
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
                <div className="h-3 bg-gray-200 rounded animate-pulse w-4/5" />
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {stream.phase === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">❌ {stream.error}</p>
            <button
              onClick={() => setStream((s) => ({ ...s, phase: "idle" }))}
              className="mt-2 text-sm text-red-500 hover:text-red-700"
            >
              重试
            </button>
          </div>
        )}

        {/* Done: show premise cards */}
        {hasResult && (
          <JTPResultView premises={stream.premises} onAction={onAction} onRegenerate={handleRegenerate} onResultDone={onResultDone} />
        )}
      </div>

      {/* Right column: intro */}
      <div>
        {introDismissed ? (
          <button
            onClick={() => { setIntroDismissed(false); try { localStorage.removeItem("jtp_intro_dismissed"); } catch {} }}
            className="w-full text-left text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            ℹ️ 显示工具说明
          </button>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-base font-bold text-gray-800">什么时候用这个？</p>
              <button
                onClick={() => { setIntroDismissed(true); try { localStorage.setItem("jtp_intro_dismissed", "1"); } catch {} }}
                className="text-gray-400 hover:text-gray-600 text-xs"
                title="不再显示"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              你已经想到一句好笑的梗，但不知道怎么往前铺垫。
            </p>
            <div className="space-y-2">
              {[
                "一句结尾金句",
                "一个有趣的比喻",
                "一句吐槽或观察",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                  <p className="text-sm text-gray-600">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">与「提炼前提」互补：一个是素材出发，一个是梗出发</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Result View ────────────────────────────────────────────────────────────────

function JTPResultView({ premises, onAction, onRegenerate, onResultDone }: { premises: PremiseCandidate[]; onAction?: (action: string, data?: string) => void; onRegenerate?: () => void; onResultDone?: (content: string, rawData: unknown) => void }) {
  return (
    <div className="space-y-4">
      {/* Regenerate button */}
      <div className="flex justify-center">
        <button
          onClick={onRegenerate}
          className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center gap-1.5"
        >
          🔄 换个方向重新反推
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">前提候选（{premises.length}条）</p>
        <div className="space-y-3">
          {premises.map((p, i) => (
            <div key={p.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-blue-600">{i + 1}</span>
                <span className="text-sm font-semibold text-gray-800">{esc(p.title)}</span>
              </div>
              <div className="space-y-1 mb-3">
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-600">为什么成立：</span>{esc(p.why_it_works)}
                </p>
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-600">怎么铺垫：</span>{esc(p.setup_direction)}
                </p>
                {p.persona && (
                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-gray-600">适合谁说：</span>{esc(p.persona)}
                    {p.emotion && <span className="text-gray-400">（{esc(p.emotion)}）</span>}
                  </p>
                )}
              </div>
              {p.opening_line && (
                <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-700 font-medium">起手句</p>
                  <p className="text-sm text-blue-800 mt-0.5">{esc(p.opening_line)}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => {
                    const text = formatJTPShare(premises);
                    navigator.clipboard.writeText(text).catch(() => {});
                  }}
                  className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  📤 分享全部
                </button>
                <button
                  onClick={() => {
                    const premiseText = `${esc(p.title)}：${esc(p.setup_direction)}`;
                    onAction?.("go-angles", premiseText);
                  }}
                  className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
                >
                  🔍 用这个前提找角度
                </button>
                <button
                  onClick={() => {
                    const text = p.opening_line ? `${p.setup_direction}\n\n起手句：${p.opening_line}` : p.setup_direction;
                    navigator.clipboard.writeText(text).catch(() => {});
                  }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  📋 复制
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
