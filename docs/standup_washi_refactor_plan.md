# Standup Workspace `/write` Washi 改造方案

> 目标：参考 `standup_japanese_aesthetic_ui_demo.html` 的日式米纸审美，把当前 `/write` 从“左侧小聊天框 + 大面积空白”重构为真正可用的 **脱口秀创作工作台**。本方案包含前端、后端、数据结构、任务拆解、验收标准和必要代码。

---

## 0. 当前结论

当前开发版本不能验收。

从截图看，页面核心问题不是视觉细节，而是产品结构错误：

- 桌面端主工作区大面积空白。
- 输入框被挤在左下角，像聊天插件，不像写稿工作台。
- 用户输入后没有明确的卡片流承接。
- 「输入素材 / 提炼前提 / 找角度」按钮没有和当前创作上下文绑定。
- 移动端和桌面端的布局策略没有统一抽象。

代码层面也能解释这个问题：当前 `/write` 已经接入 `WritePageContent`，但 `WritePageContent` 默认动态加载 `./washi/WashiWriteClient`；如果 Washi 组件实现不完整，就会出现“有外壳、无主工作区”的状态。

---

## 1. 产品目标重新定义

### 1.1 产品定位

不要把 `/write` 做成聊天机器人。

应该定义为：

> 脱口秀创作者的结构化写稿工作台。

核心链路：

```txt
素材 → 前提 → 角度 → 初稿 → 改稿 → 成稿 → 保存 → 复盘
```

### 1.2 参考 demo 的视觉方向

`standup_japanese_aesthetic_ui_demo.html` 的方向应该保留：

- 米纸背景
- 低饱和暖白色
- 朱砂红作为主操作色
- 墨黑文字
- 极轻边框
- 大留白
- 卡片层级克制
- Notion / ChatGPT 式线性创作流

但视觉不能覆盖产品结构。先完成工作台，再做日式审美。

---

## 2. 目标页面架构

### 2.1 桌面端布局

桌面端必须使用工作台布局，不允许只显示左侧聊天栏。

```txt
┌──────────────────────────────────────────────────────────────┐
│ 顶部：Logo / 当前会话 / 保存状态 / 当前模型 / 用户             │
├───────────────┬────────────────────────────────┬─────────────┤
│ 左侧历史       │ 中间创作主流程                  │ 右侧工具     │
│ 260px         │ minmax(640px, 1fr)              │ 300px       │
│               │                                │             │
│ 今天           │ 素材卡                          │ 当前步骤     │
│ - 上班像坐牢   │ 前提卡                          │ 快捷工具     │
│ - 外公偏心     │ 角度卡                          │ 写作建议     │
│               │ 改稿卡                          │             │
├───────────────┴────────────────────────────────┴─────────────┤
│ 底部输入区：输入素材 / 当前推荐动作 / 快捷指令                  │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 移动端布局

移动端不压缩三栏，而是单栏卡片流：

```txt
┌────────────────────┐
│ 顶部：会话标题 / 菜单│
├────────────────────┤
│ 步骤条              │
├────────────────────┤
│ 创作卡片流          │
│ 素材卡              │
│ 前提卡              │
│ 角度卡              │
│ 改稿卡              │
├────────────────────┤
│ 底部输入框          │
└────────────────────┘
```

历史记录进入 Drawer，工具进入 Bottom Sheet。

---

## 3. 前端改造方案

### 3.1 目录结构

建议新增/重构为：

```txt
frontend/src/app/write/
├── page.tsx
├── WritePageContent.tsx
├── washi/
│   ├── WashiWriteClient.tsx
│   ├── WashiShell.tsx
│   ├── WashiHeader.tsx
│   ├── WashiSidebar.tsx
│   ├── WashiMainFlow.tsx
│   ├── WashiRightPanel.tsx
│   ├── WashiComposer.tsx
│   ├── WashiCard.tsx
│   ├── WashiMobileDrawer.tsx
│   ├── washiTheme.ts
│   └── types.ts
├── hooks/
│   ├── useWriteSession.ts
│   ├── useStreamingTask.ts
│   ├── useSafeArea.ts
│   └── useResponsiveLayout.ts
└── lib/
    ├── stepMap.ts
    ├── sse.ts
    └── sessionStore.ts
```

### 3.2 核心原则

- `WashiWriteClient` 只负责组合布局，不塞业务细节。
- `useWriteSession` 负责会话、卡片、保存状态。
- `useStreamingTask` 负责 SSE 请求、取消、错误、元信息。
- `WashiMainFlow` 只展示卡片流。
- `WashiComposer` 负责输入框和主操作。
- 所有 AI 结果必须进入 `cards[]`，不允许只显示在临时 `tokens` 文本里。

---

## 4. 必要代码：前端核心实现

### 4.1 修复 `WritePageContent.tsx`

当前默认动态加载 Washi 是对的，但建议加 fallback，避免 Washi 文件异常导致白屏。

```tsx
// frontend/src/app/write/WritePageContent.tsx
"use client";

import dynamic from "next/dynamic";
import GuidedWriteClient from "./GuidedWriteClient";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";

const USE_WASHI = process.env.NEXT_PUBLIC_USE_WASHI_WRITE !== "false";

const WashiWriteClient = dynamic(
  () => import("./washi/WashiWriteClient").then((m) => m.WashiWriteClient),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-dvh bg-[#f7f1e6] flex items-center justify-center text-[#3b3028]">
        正在打开喜剧写稿台…
      </div>
    ),
  }
);

export default function WritePageContent() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        {USE_WASHI ? <WashiWriteClient /> : <GuidedWriteClient />}
      </ErrorBoundary>
    </ToastProvider>
  );
}
```

### 4.2 新增 `washiTheme.ts`

```ts
// frontend/src/app/write/washi/washiTheme.ts
export const washi = {
  colors: {
    paper: "#F7F1E6",
    paperDeep: "#EFE4D2",
    ink: "#2F2924",
    muted: "#8B7D6F",
    line: "rgba(68, 54, 42, 0.12)",
    cinnabar: "#A84B3D",
    cinnabarDark: "#87392F",
    matcha: "#7C8B6A",
    card: "rgba(255, 252, 246, 0.82)",
  },
};
```

### 4.3 新增 `types.ts`

```ts
// frontend/src/app/write/washi/types.ts
import type { WorkflowStep, InputType } from "../types";

export type WashiCardKind =
  | "material"
  | "premise"
  | "joke_to_premise"
  | "angles"
  | "draft"
  | "rewrite"
  | "performance_review"
  | "system";

export interface WashiFlowCard {
  id: string;
  type: WorkflowStep | WashiCardKind;
  title: string;
  content: string;
  parentId?: string;
  model?: string;
  provider?: string;
  latencyMs?: number;
  createdAt: string;
}

export interface WashiSession {
  id: string;
  title: string;
  inputType: InputType | null;
  sourceInput: string;
  currentStep: WorkflowStep;
  cards: WashiFlowCard[];
  saveStatus: "idle" | "saving" | "saved_local" | "saved_cloud" | "failed";
  createdAt: string;
  updatedAt: string;
}
```

### 4.4 新增 SSE 工具 `sse.ts`

```ts
// frontend/src/app/write/lib/sse.ts
export interface StreamMeta {
  model?: string;
  provider?: string;
  requestId?: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onMeta?: (meta: StreamMeta) => void;
  onDone?: (raw?: string) => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
}

export async function streamSSE(
  endpoint: string,
  body: Record<string, unknown>,
  callbacks: StreamCallbacks
) {
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: callbacks.signal,
  });

  if (!resp.ok) {
    callbacks.onError?.(`HTTP ${resp.status}`);
    return;
  }

  if (!resp.body) {
    callbacks.onError?.("响应为空，请稍后重试");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    while (buffer.includes("\n\n")) {
      const index = buffer.indexOf("\n\n");
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);

      let event = "message";
      let data = "";

      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }

      if (event === "token") {
        try {
          const parsed = JSON.parse(data);
          callbacks.onToken(parsed.content ?? parsed.text ?? data);
        } catch {
          callbacks.onToken(data);
        }
      }

      if (event === "meta") {
        try {
          callbacks.onMeta?.(JSON.parse(data));
        } catch {
          callbacks.onMeta?.({});
        }
      }

      if (event === "done") callbacks.onDone?.(data);

      if (event === "error") {
        try {
          const parsed = JSON.parse(data);
          callbacks.onError?.(parsed.error ?? parsed.message ?? data);
        } catch {
          callbacks.onError?.(data);
        }
      }
    }
  }
}
```

### 4.5 新增 `useStreamingTask.ts`

```ts
// frontend/src/app/write/hooks/useStreamingTask.ts
"use client";

import { useRef, useState } from "react";
import { streamSSE, type StreamMeta } from "../lib/sse";

export function useStreamingTask() {
  const abortRef = useRef<AbortController | null>(null);
  const [generating, setGenerating] = useState(false);
  const [tokens, setTokens] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<StreamMeta>({});
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  async function run(endpoint: string, body: Record<string, unknown>) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setGenerating(true);
    setTokens("");
    setError(null);
    setMeta({});
    setLatencyMs(null);

    const start = Date.now();
    let full = "";

    await streamSSE(endpoint, body, {
      signal: controller.signal,
      onToken: (t) => {
        full += t;
        setTokens((prev) => prev + t);
      },
      onMeta: setMeta,
      onDone: () => {
        setLatencyMs(Date.now() - start);
      },
      onError: (msg) => {
        setError(msg || "生成失败，请稍后重试");
      },
    }).finally(() => {
      setGenerating(false);
    });

    return {
      content: full.trim(),
      meta,
      latencyMs: Date.now() - start,
    };
  }

  function cancel() {
    abortRef.current?.abort();
    setGenerating(false);
  }

  return { run, cancel, generating, tokens, error, meta, latencyMs };
}
```

### 4.6 新增 `WashiWriteClient.tsx`

```tsx
// frontend/src/app/write/washi/WashiWriteClient.tsx
"use client";

import { useMemo, useState } from "react";
import type { WorkflowStep } from "../types";
import { STEP_API_MAP } from "../lib/stepMap";
import { useStreamingTask } from "../hooks/useStreamingTask";
import { WashiShell } from "./WashiShell";
import type { WashiFlowCard, WashiSession } from "./types";

function createSession(input: string): WashiSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: input.trim().slice(0, 24) || "新的创作",
    inputType: "material",
    sourceInput: input,
    currentStep: "material",
    cards: [
      {
        id: crypto.randomUUID(),
        type: "material",
        title: "原始素材",
        content: input,
        createdAt: now,
      },
    ],
    saveStatus: "saved_local",
    createdAt: now,
    updatedAt: now,
  };
}

function nextStep(step: WorkflowStep): WorkflowStep {
  if (step === "material") return "premise";
  if (step === "premise") return "angles";
  if (step === "angles") return "draft";
  if (step === "draft") return "rewrite";
  return "save";
}

function buildBody(step: WorkflowStep, session: WashiSession): Record<string, unknown> {
  const last = session.cards[session.cards.length - 1];
  if (step === "angles") return { premise: last?.content || session.sourceInput };
  if (step === "draft") return { premise: session.sourceInput, angle: last?.content || "" };
  if (step === "rewrite") return { text: last?.content || session.sourceInput };
  return { text: session.sourceInput };
}

export function WashiWriteClient() {
  const [input, setInput] = useState("");
  const [session, setSession] = useState<WashiSession | null>(null);
  const stream = useStreamingTask();

  const currentStep = session?.currentStep ?? "material";
  const canSubmit = input.trim().length > 0 && !stream.generating;

  async function handleSubmit() {
    if (!input.trim()) return;
    const s = createSession(input.trim());
    setSession(s);
    setInput("");
    await runStep("premise", s);
  }

  async function runStep(step: WorkflowStep, baseSession = session) {
    if (!baseSession) return;
    const endpoint = STEP_API_MAP[step];
    if (!endpoint) return;

    const result = await stream.run(endpoint, buildBody(step, baseSession));
    if (!result.content) return;

    const now = new Date().toISOString();
    const card: WashiFlowCard = {
      id: crypto.randomUUID(),
      type: step,
      title: stepTitle(step),
      content: result.content,
      parentId: baseSession.cards[baseSession.cards.length - 1]?.id,
      model: result.meta.model,
      provider: result.meta.provider,
      latencyMs: result.latencyMs,
      createdAt: now,
    };

    setSession({
      ...baseSession,
      currentStep: step,
      cards: [...baseSession.cards, card],
      updatedAt: now,
      saveStatus: "saved_local",
    });
  }

  function handleNext() {
    if (!session || stream.generating) return;
    runStep(nextStep(session.currentStep));
  }

  return (
    <WashiShell
      session={session}
      input={input}
      onInputChange={setInput}
      onSubmit={handleSubmit}
      onNext={handleNext}
      canSubmit={canSubmit}
      generating={stream.generating}
      streamingText={stream.tokens}
      error={stream.error}
      currentStep={currentStep}
      model={stream.meta.model}
      latencyMs={stream.latencyMs}
    />
  );
}

function stepTitle(step: WorkflowStep) {
  const map: Partial<Record<WorkflowStep, string>> = {
    material: "素材提炼",
    premise: "可讲前提",
    angles: "喜剧角度",
    draft: "初稿",
    rewrite: "改稿版本",
    performance_review: "演后复盘",
  };
  return map[step] ?? step;
}
```

### 4.7 新增 `WashiShell.tsx`

```tsx
// frontend/src/app/write/washi/WashiShell.tsx
"use client";

import type { WorkflowStep } from "../types";
import type { WashiSession } from "./types";
import { WashiHeader } from "./WashiHeader";
import { WashiSidebar } from "./WashiSidebar";
import { WashiMainFlow } from "./WashiMainFlow";
import { WashiRightPanel } from "./WashiRightPanel";
import { WashiComposer } from "./WashiComposer";

interface Props {
  session: WashiSession | null;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onNext: () => void;
  canSubmit: boolean;
  generating: boolean;
  streamingText: string;
  error: string | null;
  currentStep: WorkflowStep;
  model?: string;
  latencyMs?: number | null;
}

export function WashiShell(props: Props) {
  return (
    <div className="min-h-dvh bg-[#F7F1E6] text-[#2F2924] washi-paper">
      <WashiHeader
        title={props.session?.title ?? "新的创作"}
        saveStatus={props.session?.saveStatus ?? "idle"}
        model={props.model}
      />

      <div className="mx-auto grid h-[calc(100dvh-56px)] max-w-[1480px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="hidden border-r border-[#44362a1f] lg:block">
          <WashiSidebar />
        </aside>

        <main className="relative flex min-w-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-40 pt-5 sm:px-8 lg:px-10">
            <WashiMainFlow
              session={props.session}
              generating={props.generating}
              streamingText={props.streamingText}
              error={props.error}
            />
          </div>

          <WashiComposer
            value={props.input}
            onChange={props.onInputChange}
            onSubmit={props.session ? props.onNext : props.onSubmit}
            disabled={props.session ? props.generating : !props.canSubmit}
            primaryLabel={props.session ? nextLabel(props.currentStep, props.generating) : "开始写稿"}
          />
        </main>

        <aside className="hidden border-l border-[#44362a1f] lg:block">
          <WashiRightPanel
            session={props.session}
            currentStep={props.currentStep}
            model={props.model}
            latencyMs={props.latencyMs}
          />
        </aside>
      </div>
    </div>
  );
}

function nextLabel(step: WorkflowStep, generating: boolean) {
  if (generating) return "生成中…";
  if (step === "premise") return "继续找角度";
  if (step === "angles") return "生成初稿";
  if (step === "draft") return "继续改稿";
  if (step === "rewrite") return "保存成稿";
  return "继续";
}
```

### 4.8 新增 `WashiMainFlow.tsx`

```tsx
// frontend/src/app/write/washi/WashiMainFlow.tsx
"use client";

import type { WashiSession } from "./types";
import { WashiCard } from "./WashiCard";

export function WashiMainFlow({
  session,
  generating,
  streamingText,
  error,
}: {
  session: WashiSession | null;
  generating: boolean;
  streamingText: string;
  error: string | null;
}) {
  if (!session) {
    return (
      <div className="mx-auto flex min-h-[58dvh] max-w-3xl flex-col justify-center">
        <p className="mb-3 text-sm tracking-[0.24em] text-[#A84B3D]">STANDUP WORKSPACE</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">把生活素材写成能上台的段子</h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-[#6f6258]">
          输入一段观察、吐槽、经历或一句梗。系统会按「素材 → 前提 → 角度 → 初稿 → 改稿」帮你推进。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="mb-6 rounded-3xl border border-[#44362a1f] bg-[#fffaf0b8] p-4 shadow-[0_20px_60px_rgba(69,48,29,0.05)]">
        <p className="text-xs text-[#8B7D6F]">当前链路</p>
        <p className="mt-1 text-sm font-medium text-[#2F2924]">素材 → 前提 → 角度 → 初稿 → 改稿</p>
      </div>

      {session.cards.map((card, index) => (
        <WashiCard key={card.id} card={card} index={index} />
      ))}

      {streamingText && (
        <div className="rounded-3xl border border-[#a84b3d33] bg-[#fffaf0] p-5">
          <p className="mb-2 text-xs text-[#A84B3D]">正在生成</p>
          <div className="whitespace-pre-wrap text-sm leading-7 text-[#2F2924]">{streamingText}</div>
        </div>
      )}

      {generating && !streamingText && (
        <div className="rounded-3xl border border-[#44362a1f] bg-[#fffaf0a8] p-5 text-sm text-[#8B7D6F]">
          AI 正在想包袱，不是冷场，是铺垫中…
        </div>
      )}

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
```

### 4.9 新增 `WashiCard.tsx`

```tsx
// frontend/src/app/write/washi/WashiCard.tsx
"use client";

import type { WashiFlowCard } from "./types";

export function WashiCard({ card, index }: { card: WashiFlowCard; index: number }) {
  return (
    <article className="group rounded-3xl border border-[#44362a1f] bg-[#fffaf0d9] p-5 shadow-[0_18px_50px_rgba(69,48,29,0.05)] backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-[#8B7D6F]">#{index + 1}</p>
          <h2 className="text-base font-semibold text-[#2F2924]">{card.title}</h2>
        </div>
        <span className="rounded-full bg-[#A84B3D14] px-3 py-1 text-xs text-[#A84B3D]">
          {String(card.type)}
        </span>
      </div>

      <div className="whitespace-pre-wrap text-sm leading-7 text-[#3b3028]">{card.content}</div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#8B7D6F]">
        {card.model && <span>模型：{card.model}</span>}
        {card.latencyMs && <span>耗时：{card.latencyMs}ms</span>}
      </div>
    </article>
  );
}
```

### 4.10 新增 `WashiComposer.tsx`

```tsx
// frontend/src/app/write/washi/WashiComposer.tsx
"use client";

export function WashiComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  primaryLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  primaryLabel: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#44362a1f] bg-[#F7F1E6d9] px-4 py-3 backdrop-blur-md lg:absolute lg:px-10 safe-bottom">
      <div className="mx-auto flex max-w-3xl items-end gap-3 rounded-3xl border border-[#44362a1f] bg-[#fffaf0] p-2 shadow-[0_16px_50px_rgba(69,48,29,0.08)]">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          rows={3}
          placeholder="写一段生活素材，比如：老板说我们要有主人翁意识，但公司裁员时我发现我是外包主人翁…"
          className="max-h-36 min-h-16 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-[#2F2924] outline-none placeholder:text-[#b2a69b]"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="shrink-0 rounded-2xl bg-[#A84B3D] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#87392F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
```

### 4.11 新增全局样式

放到 `frontend/src/app/globals.css` 或当前 write 页面样式中。

```css
.washi-paper {
  background-image:
    radial-gradient(circle at 1px 1px, rgba(72, 56, 42, 0.06) 1px, transparent 0),
    linear-gradient(135deg, rgba(255, 255, 255, 0.36), rgba(236, 222, 200, 0.2));
  background-size: 16px 16px, 100% 100%;
}

.safe-bottom {
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}

@supports (height: 100dvh) {
  .min-h-dvh {
    min-height: 100dvh;
  }
}
```

---

## 5. 后端改造方案

当前后端已经有多个写作路由：`extract_premise`、`find_angles`、`joke_to_premise`、`write`、`write_stream`、`detect_input`、`workflow`、`profile` 等。问题不是没有 API，而是缺少统一任务协议。

### 5.1 后端目标

建立统一 AI Task 协议：

```txt
/api/write/task/stream
```

请求格式统一：

```json
{
  "taskType": "premise",
  "sessionId": "xxx",
  "input": "原始素材",
  "context": {
    "sourceInput": "原始素材",
    "selectedPremise": "选择的前提",
    "selectedAngle": "选择的角度",
    "previousDraft": "上一版草稿"
  },
  "userStyle": {
    "stageName": "大会长",
    "tone": "冷幽默、讽刺、自嘲"
  }
}
```

SSE 输出格式统一：

```txt
event: meta
data: {"taskId":"...","model":"glm-5","provider":"zhipu","requestId":"..."}

event: token
data: {"text":"..."}

event: done
data: {"latencyMs":3200,"tokenUsage":{"totalTokens":1000}}
```

### 5.2 新增后端文件结构

```txt
backend/app/
├── routers/
│   └── write_task.py
├── services/
│   ├── ai_task_service.py
│   ├── prompt_builder.py
│   ├── session_service.py
│   └── model_router.py
└── models/
    └── workflow.py
```

### 5.3 新增 `write_task.py`

```py
# backend/app/routers/write_task.py
import json
import time
import uuid
from typing import Any, Dict, Optional
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.prompt_builder import build_prompt
from app.services.model_router import stream_model

router = APIRouter(prefix="/api/write", tags=["write-task"])

class WriteTaskRequest(BaseModel):
    taskType: str
    sessionId: Optional[str] = None
    input: str
    context: Dict[str, Any] = {}
    userStyle: Dict[str, Any] = {}
    options: Dict[str, Any] = {}


def sse(event: str, data: Dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/task/stream")
async def write_task_stream(req: WriteTaskRequest):
    async def generate():
        task_id = str(uuid.uuid4())
        start = time.time()
        model_name = "auto"
        provider = "auto"

        try:
            prompt = build_prompt(
                task_type=req.taskType,
                user_input=req.input,
                context=req.context,
                user_style=req.userStyle,
                options=req.options,
            )

            yield sse("meta", {
                "taskId": task_id,
                "model": model_name,
                "provider": provider,
            })

            async for chunk in stream_model(prompt):
                if chunk.meta:
                    model_name = chunk.meta.get("model", model_name)
                    provider = chunk.meta.get("provider", provider)
                    yield sse("meta", {
                        "taskId": task_id,
                        "model": model_name,
                        "provider": provider,
                    })
                if chunk.text:
                    yield sse("token", {"text": chunk.text})

            yield sse("done", {
                "taskId": task_id,
                "latencyMs": int((time.time() - start) * 1000),
            })
        except Exception as e:
            yield sse("error", {
                "taskId": task_id,
                "message": str(e),
            })

    return StreamingResponse(generate(), media_type="text/event-stream")
```

### 5.4 新增 `prompt_builder.py`

```py
# backend/app/services/prompt_builder.py
from typing import Any, Dict

TASK_INSTRUCTIONS = {
    "premise": "从用户素材中提炼 3 个可讲的脱口秀前提。每个前提要包含判断、情绪和可笑点。",
    "joke_to_premise": "用户给的是一句梗，请反推这个梗成立的生活前提，并扩展出可讲场景。",
    "angles": "围绕前提找 5 个喜剧角度，要求角度彼此不同，包含反差、自嘲、类比、荒谬升级。",
    "draft": "根据前提和角度写一版 1-2 分钟脱口秀初稿，结构为铺垫、递进、反转、收尾。",
    "rewrite": "优化用户草稿，让表达更口语、更好笑、更适合上台。保留原意，增加 punchline。",
    "performance_review": "根据演出反馈分析哪里有效、哪里冷场，并给下一版修改建议。",
}


def build_prompt(
    task_type: str,
    user_input: str,
    context: Dict[str, Any],
    user_style: Dict[str, Any],
    options: Dict[str, Any],
) -> str:
    instruction = TASK_INSTRUCTIONS.get(task_type, "帮助用户完成脱口秀写作任务。")
    style = user_style or {}

    return f"""
你是一个专业中文脱口秀编剧，擅长从生活观察里提炼前提、寻找角度、制造预期违背，并把文本改成适合上台表达的口语稿。

任务：{instruction}

用户输入：
{user_input}

上下文：
{context}

用户风格：
{style}

输出要求：
1. 使用中文。
2. 口语化，适合脱口秀演员上台。
3. 不要输出空泛建议，要给具体文本。
4. 每条结果要可继续加工。
5. 避免政治、低俗、人身攻击和不可控冒犯。
""".strip()
```

### 5.5 后端注册路由

修改 `backend/app/main.py`：

```py
from .routers import write_task

app.include_router(write_task.router)
```

---

## 6. 数据库改造方案

当前 `schema.sql` 主要有分析反馈、分析结果、Prompt 版本表。为了创作工作台，需要新增 Workflow 表。

```sql
-- 创作会话
CREATE TABLE IF NOT EXISTS workflow_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  source_input TEXT,
  input_type TEXT,
  current_step TEXT,
  script_status TEXT DEFAULT 'idea',
  save_status TEXT DEFAULT 'saved_local',
  sync_status TEXT DEFAULT 'local_only',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创作卡片
CREATE TABLE IF NOT EXISTS workflow_cards (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  parent_id TEXT,
  type TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  structured_data TEXT,
  source_path TEXT,
  is_selected INTEGER DEFAULT 0,
  is_mainline INTEGER DEFAULT 1,
  version INTEGER DEFAULT 1,
  model TEXT,
  provider TEXT,
  latency_ms INTEGER,
  token_usage TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(session_id) REFERENCES workflow_sessions(id)
);

-- AI 调用日志
CREATE TABLE IF NOT EXISTS ai_task_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  user_id TEXT,
  task_type TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  input_length INTEGER,
  output_length INTEGER,
  error_code TEXT,
  error_message TEXT,
  request_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 7. 任务拆解

### Phase 0：止血修复，1 天

| 优先级 | 任务 | 说明 | 验收 |
|---|---|---|---|
| P0 | 修复 Washi 页面结构 | 中间主工作区必须展示卡片流 | 不再出现右侧大面积空白 |
| P0 | 保证 `/write` 可打开 | `WritePageContent` 加 fallback | 不白屏、不崩溃 |
| P0 | 统一域名 | canonical、测试、环境变量改为 `standup.alwayshaha.art` | SEO 和 E2E 不再指向旧域名 |
| P0 | 移动端底部输入安全区 | 使用 `100dvh` 和 `env(safe-area-inset-bottom)` | Safari 不遮挡输入框 |

### Phase 1：前端工作台骨架，2-3 天

| 优先级 | 任务 | 说明 | 验收 |
|---|---|---|---|
| P0 | `WashiShell` | 桌面三栏、移动单栏 | 桌面/移动布局稳定 |
| P0 | `WashiMainFlow` | 展示素材、前提、角度、改稿卡 | 输入后卡片进入主区域 |
| P0 | `WashiComposer` | 底部输入 + 主动作 | Enter 发送，Shift+Enter 换行 |
| P1 | `WashiSidebar` | 历史记录占位 | 可显示本地 sessions |
| P1 | `WashiRightPanel` | 当前步骤、模型、快捷工具 | 状态清晰 |

### Phase 2：前端业务链路，3-5 天

| 优先级 | 任务 | 说明 | 验收 |
|---|---|---|---|
| P0 | 统一 SSE hook | 替换手写解析 | token/meta/done/error 正常 |
| P0 | 卡片入库 | AI 输出必须写入 cards[] | 刷新前本地可恢复 |
| P0 | 下一步逻辑 | premise → angles → draft → rewrite | 主按钮始终知道下一步 |
| P1 | 错误重试 | 显示失败原因 | 可重试当前步骤 |
| P1 | 取消生成 | AbortController | 可中断慢模型 |

### Phase 3：后端统一协议，3-5 天

| 优先级 | 任务 | 说明 | 验收 |
|---|---|---|---|
| P0 | `/api/write/task/stream` | 统一 AI 写作入口 | 前端只接一个协议 |
| P0 | `prompt_builder` | 按 taskType 构建 prompt | 输出稳定 |
| P1 | `model_router` | 多模型降级 | 失败自动 fallback |
| P1 | AI 调用日志 | 记录模型、耗时、错误 | 后台可排查 |
| P2 | 用户 API Key | 用户 Key 优先，系统 Key 兜底 | 设置页可切换 |

### Phase 4：会话和稿件库，5-7 天

| 优先级 | 任务 | 说明 | 验收 |
|---|---|---|---|
| P0 | workflow_sessions | 云端保存会话 | 登录后跨设备可恢复 |
| P0 | workflow_cards | 保存卡片树 | 卡片上下游关系完整 |
| P1 | 稿件库 `/library` | 素材、前提、草稿、成熟稿 | 可检索、可编辑 |
| P1 | 版本管理 | 改稿 v1/v2/v3 | 可比较版本 |
| P2 | 演出反馈 | 记录开放麦反馈 | 支持下一版复盘 |

---

## 8. 验收标准

### 8.1 桌面端验收

- `/write` 打开后不是左侧小聊天框。
- 中间区域必须是创作卡片流。
- 用户输入后，素材卡立即出现在主区域。
- AI 结果必须出现在主区域，不允许只显示在左侧或临时区域。
- 右侧有当前步骤、模型、耗时、快捷工具。
- 无大面积无意义空白。

### 8.2 移动端验收

- iPhone Safari 不横向滚动。
- 底部输入框不被系统安全区遮挡。
- 软键盘弹出后仍能看到输入内容。
- 历史记录从抽屉打开。
- 工具从 Bottom Sheet 打开。
- 卡片流单栏展示。

### 8.3 功能验收

使用以下素材测试：

```txt
老板说我们要有主人翁意识，但公司裁员的时候我发现我是外包主人翁。
```

必须跑通：

```txt
输入素材 → 出现素材卡 → 生成前提卡 → 继续找角度 → 生成角度卡 → 生成初稿 → 改稿 → 保存
```

### 8.4 E2E 测试建议

新增 `washi-write.spec.ts`：

```ts
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "https://standup.alwayshaha.art";

test("Washi write flow basic layout", async ({ page }) => {
  await page.goto(`${BASE}/write`);
  await expect(page.getByText("把生活素材写成能上台的段子")).toBeVisible();
  await expect(page.locator("textarea")).toBeVisible();
});

test("no horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/write`);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});
```

---

## 9. 上线顺序

不要一次性全量替换。建议：

1. 保留 `GuidedWriteClient` 作为 fallback。
2. `NEXT_PUBLIC_USE_WASHI_WRITE=true` 在测试环境开启。
3. 修完 P0 后，在生产灰度。
4. 出现异常时设置 `NEXT_PUBLIC_USE_WASHI_WRITE=false` 快速回滚。

---

## 10. 给开发的执行提示词

可以直接发给开发或 OpenClaw / Claude Code：

```txt
你现在接手 standup-workspace 项目，请参考 standup_japanese_aesthetic_ui_demo.html，把 /write 页面重构为日式米纸风的脱口秀创作工作台。

不要继续做左侧小聊天框。桌面端必须是：左侧历史记录 + 中间创作卡片流 + 右侧工具面板 + 底部输入框。移动端必须是单栏卡片流 + 底部输入 + 历史抽屉。

优先完成 P0：
1. 新增 frontend/src/app/write/washi/WashiWriteClient.tsx
2. 新增 WashiShell、WashiMainFlow、WashiCard、WashiComposer、WashiHeader、WashiSidebar、WashiRightPanel
3. 所有 AI 输出必须进入 cards[] 并展示在中间主工作区
4. 修复 Safari/mobile safe-area 和 100dvh
5. 不允许右侧出现大面积空白
6. 保留 GuidedWriteClient fallback
7. 统一 E2E 测试域名为 E2E_BASE_URL，默认 standup.alwayshaha.art

完成后运行：
cd frontend && npm run typecheck && npm run build
E2E_BASE_URL=https://standup.alwayshaha.art npx playwright test --project=chromium
E2E_BASE_URL=https://standup.alwayshaha.art npx playwright test --project=webkit
```

---

## 11. 最终判断

这次改造的核心不是“换皮肤”，而是把页面模型从：

```txt
左侧聊天窗口
```

升级为：

```txt
结构化创作工作台
```

真正的验收标准只有一个：

> 用户输入一个素材后，可以清楚地看到它如何一步步变成前提、角度、初稿和改稿，并且每一步都被保存成卡片。

