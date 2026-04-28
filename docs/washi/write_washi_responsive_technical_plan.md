# `/write` 极简米纸风响应式创作工作台技术方案

> 项目：`standup-workspace`  
> 页面：`/write`  
> UI 定稿：`standup_minimal_washi_ui_demo.html`  
> 响应式原型：`standup_responsive_washi_demo.html`  
> 改造目标：将现有 Tab 工具页升级为 **ChatGPT 式创作流 + Notion 式作品沉淀 + 极简米纸风响应式工作台**

---

## 1. 背景与目标

当前 `/write` 页面已经具备多个脱口秀写作能力，包括：

- 提炼前提
- 找角度
- 梗写前提
- 改稿
- Guided Write
- Quick Tools

但目前整体体验仍然偏向“工具集合”：

```text
用户需要先理解功能模块
再选择 Tab
再输入内容
再判断下一步怎么继续
```

这对 C 端创作者不够友好，尤其在移动端使用时，Tab、按钮、历史和结果之间的关系不够清晰。

本次改造目标是：

```text
1. 保留现有写作能力。
2. 将 /write 改造成一个统一的创作工作台。
3. 交互模仿 ChatGPT：用户输入内容，AI 自动判断任务并返回结果。
4. 内容沉淀模仿 Notion：作品、素材、前提、角度、改稿形成结构化资产。
5. UI 使用极简米纸风：低饱和、留白、纸感、细线、朱红点缀。
6. 桌面和移动端只开发一套页面，通过响应式布局适配。
```

---

## 2. 核心结论

本次不要做两套页面。

错误方向：

```text
WriteDesktopPage.tsx
WriteMobilePage.tsx
```

正确方向：

```text
一套页面
一套组件
一套状态
一套接口逻辑
多种响应式布局容器
```

最终技术结论：

```text
桌面端 = 展开态
移动端 = 折叠态
不是两套系统
```

---

## 3. 最终页面形态

### 3.1 桌面端布局

桌面端采用三栏布局：

```text
┌──────────────┬────────────────────────────┬──────────────┐
│ 作品列表      │ ChatGPT 式创作对话流          │ 作品脉络       │
│              │                            │              │
│ 余白写作室    │ 用户输入                     │ 准备度         │
│ 今日写作      │ AI 回复                      │ 原始素材       │
│ 作品集        │ 前提卡 / 角度卡 / 改稿卡       │ 前提           │
│ 素材匣        │ 底部统一输入框                │ 角度           │
│ 演后记        │                            │ 草稿           │
└──────────────┴────────────────────────────┴──────────────┘
```

推荐断点：

```text
>= 1180px：三栏布局
768px - 1179px：两栏布局，隐藏右侧作品脉络
< 768px：单栏移动布局
```

---

### 3.2 平板端布局

```text
┌──────────────┬────────────────────────────┐
│ 作品列表      │ 创作对话流                   │
└──────────────┴────────────────────────────┘
```

右侧作品脉络改为按钮触发的 Sheet。

---

### 3.3 移动端布局

```text
┌────────────────────────────┐
│ 顶部：作品标题 + 作品/结构按钮 │
├────────────────────────────┤
│ ChatGPT 式创作流             │
│ 前提卡 / 角度卡 / 改稿卡       │
├────────────────────────────┤
│ 底部固定输入框                │
└────────────────────────────┘
```

移动端交互：

```text
作品列表：Drawer 抽屉
作品脉络：Bottom Sheet
输入框：sticky bottom
卡片按钮：单列展示
```

---

## 4. UI 视觉规范

### 4.1 风格关键词

```text
极简米纸风
低饱和
留白
纸张质感
细边框
少阴影
朱红点缀
重文本
轻装饰
```

### 4.2 推荐色板

```text
背景色：#F5EFE3
主面板：#FBF8F0
柔和纸色：#F0E7D8
正文墨色：#25231F
辅助文字：#8A8174
弱文字：#C5BAAA
线条：rgba(37, 35, 31, 0.10)
强调朱红：#A94737
状态苔绿：#68715F
```

### 4.3 视觉原则

```text
1. 不做强 SaaS 风。
2. 不做复杂渐变和强投影。
3. 不做过度海报化。
4. 卡片要像手稿，不像运营广告。
5. 按钮要降噪，只突出最自然的下一步。
6. 长时间写作不疲劳。
```

---

## 5. 交互设计原则

### 5.1 ChatGPT 式主入口

用户不再先选 Tab，而是直接输入：

```text
一个素材
一句梗
一个前提
一段草稿
一个演出反馈
```

系统自动识别意图并调用对应能力。

---

### 5.2 Notion 式作品沉淀

每次生成结果不是临时输出，而是沉淀为作品节点：

```text
素材卡
前提卡
角度卡
改稿卡
草稿卡
演后记卡
```

这些卡片共同构成一个作品。

---

### 5.3 下一步动作

每张 AI 卡片必须提供下一步操作：

```text
扩成 1 分钟
找更多角度
更毒舌一点
更克制一点
加入真实细节
保存为作品
记录演出反馈
```

用户不需要思考“下一步该点哪个工具”，系统直接引导。

---

## 6. 技术架构

### 6.1 页面架构

建议新增目录：

```text
frontend/src/app/write/washi/
  WashiWriteClient.tsx
  types.ts

  components/
    ResponsiveWashiShell.tsx
    WorkSidebar.tsx
    ChatCanvas.tsx
    ChatMessage.tsx
    CreationCard.tsx
    Composer.tsx
    WorkOutline.tsx
    MobileDrawer.tsx
    MobileSheet.tsx
    EmptyState.tsx
    ThinkingCard.tsx
    ErrorCard.tsx

  hooks/
    useWriteIntent.ts
    useWriteSession.ts
    useWriteGeneration.ts
    useLocalWriteStore.ts

  lib/
    endpointMap.ts
    requestAdapters.ts
    cardMappers.ts
    storage.ts
    copy.ts
```

---

### 6.2 页面组件关系

```text
WashiWriteClient
└── ResponsiveWashiShell
    ├── WorkSidebar
    ├── ChatMain
    │   ├── ChatCanvas
    │   │   ├── ChatMessage
    │   │   ├── CreationCard
    │   │   ├── ThinkingCard
    │   │   └── ErrorCard
    │   └── Composer
    ├── WorkOutline
    ├── MobileDrawer
    │   └── WorkSidebar
    └── MobileSheet
        └── WorkOutline
```

注意：

```text
WorkSidebar 在桌面端是左栏，在移动端是 Drawer 内容。
WorkOutline 在桌面端是右栏，在移动端是 Sheet 内容。
ChatCanvas 永远是主内容。
Composer 永远是底部输入框。
```

---

## 7. 响应式布局方案

### 7.1 核心原则

```text
不要写两套页面。
不要写 DesktopPage + MobilePage。
不要用 display:none 包两套完整 DOM。
```

推荐：

```text
一个 ResponsiveWashiShell
通过 CSS Grid / Flex / Tailwind 断点控制布局。
```

---

### 7.2 Tailwind 布局示例

```tsx
export function ResponsiveWashiShell({
  sidebar,
  main,
  outline,
}: {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  outline: React.ReactNode;
}) {
  return (
    <div className="min-h-[100svh] bg-[#F5EFE3] text-[#25231F] md:h-[100dvh] md:overflow-hidden">
      <div
        className="
          grid
          min-h-[100svh]
          grid-cols-1
          md:h-[100dvh]
          md:grid-cols-[248px_minmax(0,1fr)]
          xl:grid-cols-[248px_minmax(0,1fr)_288px]
          gap-3
          p-0
          md:p-4
        "
      >
        <aside className="hidden min-h-0 overflow-hidden rounded-[24px] border border-black/10 bg-[#FBF8F0]/85 md:flex md:flex-col">
          {sidebar}
        </aside>

        <main className="min-h-0 min-w-0 overflow-hidden bg-[#FBF8F0]/90 md:rounded-[24px] md:border md:border-black/10">
          {main}
        </main>

        <aside className="hidden min-h-0 overflow-hidden rounded-[24px] border border-black/10 bg-[#FBF8F0]/85 xl:flex xl:flex-col">
          {outline}
        </aside>
      </div>
    </div>
  );
}
```

---

### 7.3 移动端 Drawer / Sheet

移动端不是重新开发 Sidebar / Outline，而是复用组件：

```tsx
<MobileDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
  <WorkSidebar />
</MobileDrawer>

<MobileSheet open={outlineOpen} onClose={() => setOutlineOpen(false)}>
  <WorkOutline />
</MobileSheet>
```

---

### 7.4 移动端高度兼容

必须使用：

```css
min-height: 100svh;
height: 100dvh;
padding-bottom: env(safe-area-inset-bottom);
```

避免只使用：

```css
height: 100vh;
```

原因：

```text
iOS Safari 地址栏伸缩会导致 100vh 计算错误。
输入框可能被底部安全区遮挡。
```

---

## 8. 数据模型

### 8.1 WorkSession

```ts
export type WorkStatus =
  | "drafting"
  | "open_mic_ready"
  | "performed"
  | "archived";

export interface WorkSession {
  id: string;
  title: string;
  status: WorkStatus;
  activeCardId?: string;
  createdAt: number;
  updatedAt: number;
  cards: WorkCard[];
}
```

---

### 8.2 WorkCard

```ts
export type WorkCardType =
  | "material"
  | "premise"
  | "joke_to_premise"
  | "angle"
  | "rewrite"
  | "draft"
  | "feedback"
  | "error";

export interface WorkCard {
  id: string;
  sessionId: string;
  type: WorkCardType;
  role: "user" | "assistant" | "system";
  title: string;
  content: string;
  rawData?: unknown;
  sourceCardId?: string;
  sourcePath: string[];
  createdAt: number;
  updatedAt?: number;
  meta?: {
    endpoint?: string;
    model?: string;
    provider?: string;
    latencyMs?: number;
    requestId?: string;
    attemptCount?: number;
  };
  actions?: CardAction[];
}
```

---

### 8.3 CardAction

```ts
export type CardActionType =
  | "expand_to_draft"
  | "make_sharper"
  | "make_softer"
  | "find_angles"
  | "rewrite"
  | "save"
  | "copy"
  | "continue";

export interface CardAction {
  id: string;
  type: CardActionType;
  label: string;
  nextIntent?: WriteIntentType;
  payload?: Record<string, unknown>;
}
```

---

## 9. 本地存储方案

第一阶段先用 `localStorage`，不要立刻改后端数据库。

### 9.1 Storage Key

```ts
const STORAGE_KEY = "standup_write_sessions_v1";
const ACTIVE_SESSION_KEY = "standup_write_active_session_v1";
```

---

### 9.2 storage.ts

```ts
import type { WorkSession } from "../types";

const STORAGE_KEY = "standup_write_sessions_v1";
const ACTIVE_SESSION_KEY = "standup_write_active_session_v1";

export function loadSessions(): WorkSession[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: WorkSession[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function loadActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function saveActiveSessionId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_SESSION_KEY, id);
}
```

---

### 9.3 后续数据库迁移预留

后续可新增：

```sql
CREATE TABLE workflow_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drafting',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workflow_cards (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT,
  content TEXT,
  raw_data JSON,
  source_card_id TEXT,
  source_path JSON,
  meta JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 10. 意图识别方案

### 10.1 WriteIntent

```ts
export type WriteIntentType =
  | "premise"
  | "joke_to_premise"
  | "angles"
  | "rewrite"
  | "feedback"
  | "unknown";

export interface WriteIntent {
  type: WriteIntentType;
  endpoint: string;
  confidence: number;
  reason: string;
  mode?: string;
}
```

---

### 10.2 Endpoint Map

```ts
export const WRITE_ENDPOINT_MAP = {
  premise: "/api/write/premise/stream",
  joke_to_premise: "/api/write/joke-to-premise/stream",
  angles: "/api/write/angles/stream",
  rewrite: "/api/write/rewrite/stream",
} as const;
```

---

### 10.3 前端规则识别

第一阶段先用前端规则，不要新增 AI 分类接口。

```ts
import type { WriteIntent } from "../types";
import { WRITE_ENDPOINT_MAP } from "../lib/endpointMap";

export function detectWriteIntent(text: string): WriteIntent {
  const input = text.trim();
  const len = input.length;

  if (!input) {
    return {
      type: "unknown",
      endpoint: "",
      confidence: 0,
      reason: "empty input",
    };
  }

  if (
    input.includes("找角度") ||
    input.includes("角度") ||
    input.includes("还有什么方向")
  ) {
    return {
      type: "angles",
      endpoint: WRITE_ENDPOINT_MAP.angles,
      confidence: 0.9,
      reason: "user explicitly asks for angles",
    };
  }

  if (
    input.includes("改稿") ||
    input.includes("更好笑") ||
    input.includes("更毒舌") ||
    input.includes("润色") ||
    len > 160
  ) {
    return {
      type: "rewrite",
      endpoint: WRITE_ENDPOINT_MAP.rewrite,
      confidence: 0.86,
      reason: "long draft or rewrite intent",
    };
  }

  if (
    input.includes("反推前提") ||
    input.includes("梗写前提") ||
    input.includes("这句梗") ||
    len < 70
  ) {
    return {
      type: "joke_to_premise",
      endpoint: WRITE_ENDPOINT_MAP.joke_to_premise,
      confidence: 0.72,
      reason: "short punchline-like input",
    };
  }

  return {
    type: "premise",
    endpoint: WRITE_ENDPOINT_MAP.premise,
    confidence: 0.78,
    reason: "default material to premise",
  };
}
```

---

## 11. 流式生成方案

### 11.1 原则

项目中已有统一流式任务 Hook：

```text
useStreamingTask
```

新 UI 中：

```text
禁止手写 resp.body.getReader()
禁止在页面组件里解析 SSE
所有 /api/write/*/stream 必须走 useStreamingTask
```

---

### 11.2 useWriteGeneration

```ts
"use client";

import { useState } from "react";
import { useStreamingTask } from "@/hooks/useStreamingTask";
import { detectWriteIntent } from "./useWriteIntent";
import type { WorkCard, WriteIntent } from "../types";
import { mapResultToCard } from "../lib/cardMappers";
import { buildRequestBody } from "../lib/requestAdapters";

interface UseWriteGenerationOptions {
  sessionId: string;
  onCardCreated: (card: WorkCard) => void;
}

export function useWriteGeneration(options: UseWriteGenerationOptions) {
  const [intent, setIntent] = useState<WriteIntent | null>(null);
  const [draftTokens, setDraftTokens] = useState("");

  const endpoint = intent?.endpoint || "/api/write/premise/stream";

  const task = useStreamingTask(endpoint, {
    timeoutMs: 120_000,
    slowWarningMs: 25_000,

    onToken(token) {
      setDraftTokens((prev) => prev + token);
    },

    onDone(result, meta) {
      if (!intent) return;

      const card = mapResultToCard({
        sessionId: options.sessionId,
        intent,
        result,
        tokens: draftTokens,
        meta,
      });

      options.onCardCreated(card);
      setDraftTokens("");
    },

    onError(error, errorCode, meta) {
      const errorCard: WorkCard = {
        id: crypto.randomUUID(),
        sessionId: options.sessionId,
        type: "error",
        role: "system",
        title: "生成失败",
        content: mapErrorMessage(error, errorCode),
        sourcePath: ["error"],
        createdAt: Date.now(),
        meta: {
          endpoint,
          model: meta?.selected_model,
          provider: meta?.provider,
          latencyMs: meta?.total_latency_ms,
          requestId: meta?.request_id,
          attemptCount: meta?.attempt_count,
        },
      };

      options.onCardCreated(errorCard);
    },
  });

  function start(text: string, extra?: Record<string, unknown>) {
    const nextIntent = detectWriteIntent(text);
    setIntent(nextIntent);
    setDraftTokens("");

    const body = buildRequestBody(nextIntent, text, extra);
    task.start(body);
  }

  return {
    intent,
    state: task.state,
    draftTokens,
    start,
    abort: task.abort,
    retry: task.retry,
  };
}

function mapErrorMessage(error: string, errorCode?: string) {
  if (errorCode === "TIMEOUT") {
    return "这次生成超时了，但你的输入已保留。可以缩短文本后重试。";
  }

  if (errorCode === "NETWORK") {
    return "网络连接中断了。请检查网络后重试。";
  }

  if (errorCode === "INVALID_RESPONSE") {
    return "模型返回格式不完整。建议重试一次，或换一个更短的输入。";
  }

  return error || "生成失败，请重试。";
}
```

---

## 12. 请求适配层

不同接口 body 可能不同，统一放到 `requestAdapters.ts`。

```ts
import type { WriteIntent } from "../types";

export function buildRequestBody(
  intent: WriteIntent,
  text: string,
  extra?: Record<string, unknown>
) {
  const sessionId = crypto.randomUUID();

  if (intent.type === "rewrite") {
    return {
      text,
      mode: extra?.mode ?? "quick",
      session_id: sessionId,
    };
  }

  if (intent.type === "angles") {
    return {
      premise: text,
      count: 5,
      session_id: sessionId,
    };
  }

  if (intent.type === "joke_to_premise") {
    return {
      joke: text,
      session_id: sessionId,
    };
  }

  return {
    material: text,
    text,
    session_id: sessionId,
  };
}
```

后续如果后端字段有差异，只改这里，不改 UI 组件。

---

## 13. 结果映射层

不同接口返回结构不一致，统一映射成 `WorkCard`。

```ts
import type { WorkCard, WriteIntent } from "../types";
import type { StreamingMeta } from "@/hooks/useStreamingTask";

export function mapResultToCard(input: {
  sessionId: string;
  intent: WriteIntent;
  result: unknown;
  tokens?: string;
  meta?: StreamingMeta;
}): WorkCard {
  const { sessionId, intent, result, tokens, meta } = input;

  const base = {
    id: crypto.randomUUID(),
    sessionId,
    role: "assistant" as const,
    rawData: result,
    sourcePath: [intent.type],
    createdAt: Date.now(),
    meta: {
      endpoint: intent.endpoint,
      model: meta?.selected_model,
      provider: meta?.provider,
      latencyMs: meta?.total_latency_ms,
      requestId: meta?.request_id,
      attemptCount: meta?.attempt_count,
    },
  };

  if (intent.type === "premise") {
    return {
      ...base,
      type: "premise",
      title: "前提卡",
      content: extractPremiseContent(result, tokens),
      actions: [
        { id: "find_angles", type: "find_angles", label: "找角度", nextIntent: "angles" },
        { id: "rewrite", type: "rewrite", label: "扩成 1 分钟", nextIntent: "rewrite" },
      ],
    };
  }

  if (intent.type === "joke_to_premise") {
    return {
      ...base,
      type: "joke_to_premise",
      title: "梗反推前提",
      content: extractPremiseContent(result, tokens),
      actions: [
        { id: "find_angles", type: "find_angles", label: "继续找角度", nextIntent: "angles" },
        { id: "make_sharper", type: "make_sharper", label: "更毒舌一点", nextIntent: "rewrite" },
      ],
    };
  }

  if (intent.type === "angles") {
    return {
      ...base,
      type: "angle",
      title: "角度卡",
      content: extractAnglesContent(result, tokens),
      actions: [
        { id: "expand_to_draft", type: "expand_to_draft", label: "扩成草稿", nextIntent: "rewrite" },
        { id: "more_angles", type: "find_angles", label: "再找 5 个", nextIntent: "angles" },
      ],
    };
  }

  return {
    ...base,
    type: "rewrite",
    title: "改稿卡",
    content: extractRewriteContent(result, tokens),
    actions: [
      { id: "make_sharper", type: "make_sharper", label: "更毒舌", nextIntent: "rewrite" },
      { id: "make_softer", type: "make_softer", label: "更克制", nextIntent: "rewrite" },
    ],
  };
}

function extractPremiseContent(result: unknown, fallback?: string) {
  if (typeof result === "string") return result;
  const r = result as any;

  return (
    r?.premise ||
    r?.core_premise ||
    r?.result?.premise ||
    fallback ||
    JSON.stringify(result, null, 2)
  );
}

function extractAnglesContent(result: unknown, fallback?: string) {
  const r = result as any;
  const angles = r?.angles || r?.result?.angles;

  if (Array.isArray(angles)) {
    return angles
      .map((item, idx) => {
        if (typeof item === "string") return `${idx + 1}. ${item}`;
        return `${idx + 1}. ${item.title || item.content || JSON.stringify(item)}`;
      })
      .join("\n");
  }

  return fallback || JSON.stringify(result, null, 2);
}

function extractRewriteContent(result: unknown, fallback?: string) {
  const r = result as any;

  return (
    r?.improved_script ||
    r?.result?.improved_script ||
    r?.script ||
    fallback ||
    JSON.stringify(result, null, 2)
  );
}
```

---

## 14. 核心组件实现

### 14.1 WashiWriteClient

```tsx
"use client";

import { useState } from "react";
import { ResponsiveWashiShell } from "./components/ResponsiveWashiShell";
import { WorkSidebar } from "./components/WorkSidebar";
import { ChatCanvas } from "./components/ChatCanvas";
import { Composer } from "./components/Composer";
import { WorkOutline } from "./components/WorkOutline";
import { MobileDrawer } from "./components/MobileDrawer";
import { MobileSheet } from "./components/MobileSheet";
import { useWriteSession } from "./hooks/useWriteSession";
import { useWriteGeneration } from "./hooks/useWriteGeneration";

export function WashiWriteClient() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);

  const {
    sessions,
    activeSession,
    activeCards,
    createSessionIfNeeded,
    addCard,
    setActiveSessionId,
  } = useWriteSession();

  const session = createSessionIfNeeded();

  const generation = useWriteGeneration({
    sessionId: session.id,
    onCardCreated: addCard,
  });

  function handleSubmit(text: string) {
    const current = createSessionIfNeeded();

    addCard({
      id: crypto.randomUUID(),
      sessionId: current.id,
      type: "material",
      role: "user",
      title: "用户输入",
      content: text,
      sourcePath: ["用户输入"],
      createdAt: Date.now(),
    });

    generation.start(text);
  }

  const sidebar = (
    <WorkSidebar
      sessions={sessions}
      activeSessionId={activeSession?.id}
      onSelect={(id) => {
        setActiveSessionId(id);
        setSidebarOpen(false);
      }}
    />
  );

  const outline = <WorkOutline session={activeSession} cards={activeCards} />;

  return (
    <>
      <ResponsiveWashiShell
        sidebar={sidebar}
        outline={outline}
        main={
          <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto]">
            <header className="flex items-center justify-between border-b border-black/10 px-4 py-4 md:px-6">
              <button
                type="button"
                className="mr-3 rounded-full border border-black/10 px-3 py-2 text-sm text-[#8A8174] md:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                作品
              </button>

              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-semibold text-[#25231F]">
                  {activeSession?.title || "新的作品"}
                </h1>
                <p className="mt-1 truncate text-xs text-[#8A8174]">
                  自动保存 · 创作中
                </p>
              </div>

              <button
                type="button"
                className="ml-3 rounded-full border border-black/10 px-3 py-2 text-sm text-[#8A8174] xl:hidden"
                onClick={() => setOutlineOpen(true)}
              >
                结构
              </button>
            </header>

            <ChatCanvas
              cards={activeCards}
              isThinking={generation.state.phase === "thinking"}
              draftTokens={generation.draftTokens}
            />

            <Composer
              disabled={generation.state.phase === "thinking"}
              onSubmit={handleSubmit}
            />
          </div>
        }
      />

      <MobileDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        {sidebar}
      </MobileDrawer>

      <MobileSheet open={outlineOpen} onClose={() => setOutlineOpen(false)}>
        {outline}
      </MobileSheet>
    </>
  );
}
```

---

### 14.2 Composer

```tsx
"use client";

import { useState } from "react";

export function Composer({
  disabled,
  onSubmit,
}: {
  disabled?: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");

  function submit() {
    const value = text.trim();
    if (!value || disabled) return;

    onSubmit(value);
    setText("");
  }

  return (
    <footer className="sticky bottom-0 border-t border-black/10 bg-[#FBF8F0]/95 p-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:p-4">
      <div className="mb-2 flex gap-2 overflow-x-auto">
        {["输入素材", "提炼前提", "找角度", "开放麦口语", "记录反馈"].map((item) => (
          <button
            key={item}
            type="button"
            className="shrink-0 rounded-full border border-black/10 px-3 py-1.5 text-xs text-[#8A8174]"
            onClick={() => setText((prev) => (prev ? prev : `${item}：`))}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-[20px] border border-black/15 bg-white/30 px-4 py-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="写下一个素材、一个念头，或者一句还没成熟的梗。"
          className="max-h-32 min-h-11 resize-none bg-transparent py-2 text-sm leading-6 outline-none placeholder:text-[#C5BAAA]"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />

        <button
          type="button"
          disabled={disabled || !text.trim()}
          onClick={submit}
          className="rounded-[15px] bg-[#A94737] px-4 py-3 text-sm font-semibold text-[#FFFAF4] disabled:opacity-40"
        >
          写作
        </button>
      </div>
    </footer>
  );
}
```

---

## 15. 新旧页面迁移策略

### 15.1 Feature Flag

不建议一次性删除旧页面。

新增环境变量：

```text
NEXT_PUBLIC_USE_WASHI_WRITE=true
```

在 `/write` 入口处：

```tsx
import { WashiWriteClient } from "./washi/WashiWriteClient";
import QuickToolsClient from "./QuickToolsClient";

export default function WritePageContent() {
  if (process.env.NEXT_PUBLIC_USE_WASHI_WRITE === "true") {
    return <WashiWriteClient />;
  }

  return <QuickToolsClient />;
}
```

---

### 15.2 迁移阶段

```text
Phase 1：新 UI 静态壳上线，旧 UI 保留。
Phase 2：新 UI 接入 rewrite stream。
Phase 3：新 UI 接入 premise / angles / joke-to-premise。
Phase 4：新 UI 接入 localStorage 作品库。
Phase 5：移动端 Drawer / Sheet 完成。
Phase 6：灰度开启。
Phase 7：稳定后替换旧 Tab 入口。
```

---

## 16. 开发任务拆分

### P0：响应式 UI 壳

```text
1. 新增 washi 目录。
2. 实现 ResponsiveWashiShell。
3. 实现 WorkSidebar 静态版。
4. 实现 WorkOutline 静态版。
5. 实现 ChatCanvas / ChatMessage / CreationCard 静态版。
6. 实现 Composer 静态版。
7. 桌面端三栏、平板两栏、移动端单栏。
8. 移动端 Drawer / Sheet 原型。
```

验收：

```bash
cd frontend
npm run lint
npm run build
```

浏览器验收：

```text
桌面端无横向滚动
移动端 375px 无布局错乱
输入框固定底部
作品和结构按钮可打开抽屉/面板
```

---

### P1：流式改稿能力

```text
1. 新增 useWriteGeneration。
2. 使用 useStreamingTask 接入 /api/write/rewrite/stream。
3. 输入后生成 user card。
4. 生成中显示 ThinkingCard。
5. 成功后显示 rewrite CreationCard。
6. 失败后显示 ErrorCard。
7. 新 UI 中禁止手写 SSE 解析。
```

验收：

```text
输入长草稿
点击写作
出现生成中状态
生成完成后出现改稿卡
失败时输入不丢失
```

---

### P2：四类写作能力

```text
1. 新增 useWriteIntent。
2. 新增 endpointMap。
3. 新增 requestAdapters。
4. 新增 cardMappers。
5. 接入 premise / joke-to-premise / angles / rewrite。
6. 每种结果映射为不同 CreationCard。
```

验收：

```text
输入素材 → 前提卡
输入短梗 → 梗反推前提卡
输入前提 → 角度卡
输入长草稿 → 改稿卡
```

---

### P3：作品沉淀

```text
1. 新增 useWriteSession。
2. sessions 存 localStorage。
3. 左侧 WorkSidebar 读取 sessions。
4. 右侧 WorkOutline 读取 activeCards。
5. 生成结果自动添加 WorkCard。
6. 刷新页面后恢复作品。
7. 支持切换作品。
8. 支持重命名作品。
9. 支持删除作品。
```

验收：

```text
生成两个作品
刷新页面
左侧作品仍存在
点击作品可恢复对应卡片
```

---

### P4：移动端优化

```text
1. Drawer 支持点击遮罩关闭。
2. Sheet 支持点击遮罩关闭。
3. ESC 关闭浮层。
4. Composer 加 safe-area padding。
5. CreationCard 按钮移动端单列。
6. iOS Safari 测试 100svh / 100dvh。
```

验收：

```text
iPhone 375px 无横向滚动
输入框不被安全区遮挡
键盘弹起后输入框仍可用
作品抽屉可打开关闭
结构面板可打开关闭
```

---

## 17. 测试方案

### 17.1 单元测试

建议新增：

```text
useWriteIntent.test.ts
cardMappers.test.ts
storage.test.ts
requestAdapters.test.ts
```

测试点：

```text
短梗识别为 joke_to_premise
长文本识别为 rewrite
包含“找角度”识别为 angles
普通素材识别为 premise
localStorage 异常不崩溃
rawData 不完整时 fallback 到 tokens
不同 endpoint body 正确
```

---

### 17.2 E2E 测试

建议新增：

```text
tests/write-washi.spec.ts
```

用例：

```text
1. 打开 /write。
2. 输入素材。
3. 点击写作。
4. 出现 user card。
5. 出现 thinking card。
6. 最终出现 creation card 或 error card。
7. 刷新页面。
8. 作品仍存在。
```

---

### 17.3 手工测试矩阵

桌面端：

```text
Chrome 1440px
Safari 1440px
Edge 1440px
Mac Retina
Windows 125% 缩放
```

移动端：

```text
iPhone SE 375px
iPhone 15 390px
Android Chrome 390px
iOS Safari
横屏模式
```

重点检查：

```text
无横向滚动
输入框不遮挡
生成中不卡死
失败可重试
刷新不丢作品
卡片长文本可读
右侧结构不挤压主内容
```

---

## 18. 风险与解决方案

### 风险 1：接口 body 不一致

解决：

```text
所有请求参数统一在 requestAdapters.ts 适配。
UI 组件不直接拼接口参数。
```

---

### 风险 2：返回结构不一致

解决：

```text
所有返回值统一在 cardMappers.ts 转成 WorkCard。
CreationCard 只消费 WorkCard。
```

---

### 风险 3：localStorage 数据损坏

解决：

```text
loadSessions 必须 try/catch。
解析失败返回 []。
未来增加 version migration。
```

---

### 风险 4：新旧 UI 同时存在导致状态混乱

解决：

```text
Feature Flag 控制入口。
旧 UI 不使用新 store。
新 UI 不依赖旧 Tab 状态。
```

---

### 风险 5：移动端高度错位

解决：

```text
使用 100svh / 100dvh。
Composer sticky bottom。
使用 env(safe-area-inset-bottom)。
避免单纯 100vh。
```

---

### 风险 6：用户不知道系统选了哪个能力

解决：

```text
生成卡片顶部显示轻量说明：
“已识别为素材，正在提炼前提”
“已识别为短梗，正在反推前提”
“已识别为草稿，正在改稿”
```

---

## 19. 推荐提交顺序

```text
Commit 1:
feat(write): add washi responsive shell

Commit 2:
feat(write): add chat canvas composer and creation card

Commit 3:
feat(write): add mobile drawer and outline sheet

Commit 4:
feat(write): add write session local storage

Commit 5:
feat(write): integrate useStreamingTask for rewrite generation

Commit 6:
feat(write): add intent detection and endpoint adapters

Commit 7:
feat(write): map stream results to work cards

Commit 8:
test(write): add intent mapper storage and adapter tests

Commit 9:
chore(write): enable washi UI behind feature flag
```

---

## 20. 给 OpenClaw / Claude Code 的执行提示词

```text
请基于 Mywayking/standup-workspace 最新 master 分支，完成 /write 页面技术重构。

目标：
将 /write 从现有 Tab 工具集合，改造成极简米纸风的 ChatGPT + Notion 响应式创作工作台。

UI 参考：
standup_minimal_washi_ui_demo.html

响应式参考：
standup_responsive_washi_demo.html

核心要求：
1. 只开发一套页面，不要拆 WriteDesktopPage 和 WriteMobilePage。
2. 新增 frontend/src/app/write/washi 目录。
3. 实现 ResponsiveWashiShell：
   - 移动端：单栏
   - 平板端：左侧作品栏 + 中间创作区
   - 桌面端：左侧作品栏 + 中间创作区 + 右侧作品脉络
4. 移动端 WorkSidebar 用 Drawer 展示。
5. 移动端 WorkOutline 用 Bottom Sheet 展示。
6. 所有流式请求必须统一使用 frontend/src/hooks/useStreamingTask.ts。
7. 新 UI 中禁止手写 resp.body.getReader() SSE 解析。
8. 新增 WorkSession / WorkCard 类型。
9. 新增 localStorage 存储，刷新不丢失作品。
10. 新增 useWriteIntent，根据输入自动判断 endpoint。
11. 接入四个现有接口：
    - /api/write/premise/stream
    - /api/write/joke-to-premise/stream
    - /api/write/angles/stream
    - /api/write/rewrite/stream
12. 新增 requestAdapters.ts 适配不同接口 body。
13. 新增 cardMappers.ts 将不同接口返回统一映射为 WorkCard。
14. CreationCard 根据 WorkCard 展示前提卡、角度卡、改稿卡、错误卡。
15. Composer 支持 Cmd/Ctrl + Enter 发送。
16. 移动端使用 100svh / 100dvh 和 safe-area，避免 iOS Safari 错位。
17. 使用 Feature Flag 控制新旧 UI：
    NEXT_PUBLIC_USE_WASHI_WRITE=true 时启用新 UI。
18. npm run lint 和 npm run build 必须通过。

建议新增文件：
- frontend/src/app/write/washi/WashiWriteClient.tsx
- frontend/src/app/write/washi/types.ts
- frontend/src/app/write/washi/components/ResponsiveWashiShell.tsx
- frontend/src/app/write/washi/components/WorkSidebar.tsx
- frontend/src/app/write/washi/components/ChatCanvas.tsx
- frontend/src/app/write/washi/components/ChatMessage.tsx
- frontend/src/app/write/washi/components/CreationCard.tsx
- frontend/src/app/write/washi/components/Composer.tsx
- frontend/src/app/write/washi/components/WorkOutline.tsx
- frontend/src/app/write/washi/components/MobileDrawer.tsx
- frontend/src/app/write/washi/components/MobileSheet.tsx
- frontend/src/app/write/washi/components/ThinkingCard.tsx
- frontend/src/app/write/washi/components/ErrorCard.tsx
- frontend/src/app/write/washi/hooks/useWriteIntent.ts
- frontend/src/app/write/washi/hooks/useWriteSession.ts
- frontend/src/app/write/washi/hooks/useWriteGeneration.ts
- frontend/src/app/write/washi/lib/storage.ts
- frontend/src/app/write/washi/lib/cardMappers.ts
- frontend/src/app/write/washi/lib/endpointMap.ts
- frontend/src/app/write/washi/lib/requestAdapters.ts

验收标准：
1. 桌面端 /write 显示三栏极简米纸风 UI。
2. 平板端 /write 显示两栏布局。
3. 移动端 /write 显示单列创作流。
4. 移动端作品列表可通过 Drawer 打开。
5. 移动端作品脉络可通过 Bottom Sheet 打开。
6. 输入素材可生成前提卡。
7. 输入短梗可生成梗反推前提卡。
8. 输入“找角度”可生成角度卡。
9. 输入长草稿可生成改稿卡。
10. 生成失败时显示 ErrorCard，输入不丢失。
11. 刷新页面后作品列表和卡片仍存在。
12. 375px 宽度无横向滚动。
13. iOS Safari 输入框不被安全区遮挡。
```

---

## 21. 最终建议

这次改造不要定义为“UI 美化”，而应该定义为：

```text
/write 创作体验重构
```

核心价值是：

```text
从工具 Tab 页面
升级为创作工作台
```

最重要的技术原则是：

```text
一套响应式页面
一套状态模型
一套流式请求封装
一套作品数据结构
```

只要完成这四点，后面无论继续加：

```text
作品库
演出反馈
专场结构
多模型显示
版本管理
用户自定义 key
```

都可以自然扩展，而不会继续堆 Tab。
