# Standup Workspace v3 技术方案文档

> 版本：v3.0 技术方案
> 目标页面：/write
> 升级方向：移动端优先 · 手把手创作工作流 · 段子库 · 创作流程引擎
> 依据：v3 PRD 附件、当前仓库 README、现有 /write 技术结构。v3 PRD 的核心目标是把《手把手教你玩脱口秀》迁移为默认创作路径，并将产品从"AI 工具集合"升级为"移动端优先的脱口秀创作陪练"。

## 1. 当前技术现状判断

当前项目定位仍偏"喜剧分析工作台"，README 中描述为"脱口秀/单口喜剧拉片分析系统"，核心是"原文—结构—态度—技巧—问题判断—启发"的五联动分析。现有技术栈为 Next.js 15 + TypeScript + Tailwind CSS + Zustand + TanStack Query，后端为 FastAPI + Redis + PostgreSQL + S3。

当前 /write 已有流式接口，包括：

```
POST /api/write/premise/stream
POST /api/write/joke-to-premise/stream
POST /api/write/angles/stream
POST /api/write/rewrite/stream
```

旧接口也已经标记迁移到 /api/write/*/stream 体系。

仓库 README 里 /write 页面仍是 4 个 Tab 结构：WriteClient.tsx、PremiseTab.tsx、AnglesTab.tsx、JokeToPremiseTab.tsx、RewriteTab.tsx，这说明当前产品技术形态仍是"工具集合"，不是"手把手流程"。

当前 useStreamingTask.ts 已经存在，并且包含 token、progress、warning、meta、done、error、timeout、abort、retry 等统一流式任务能力，但它仍需要进一步成为 v3 的 AI Task 基础设施，而不是只作为单个 Hook 使用。

## 2. v3 技术目标

v3 不只是 UI 改版，而是一次底层产品架构升级。

### 2.1 核心目标

```
从：多个 AI 工具 Tab
升级为：移动端优先的脱口秀创作工作流系统
```

### 2.2 技术目标

1. 建立统一的 Workflow Engine，管理创作流程。
2. 建立 WorkflowCard Tree，管理内容版本和来源链路。
3. 建立 AI Task Layer，统一模型调用、流式输出、错误、重试和埋点。
4. 建立 Offline-first Store，保证用户素材和稿子不丢。
5. 保留现有快捷工具模式，避免一次性重构风险。
6. 新增段子库，将历史记录升级为有状态的创作资产。

## 3. 总体架构设计

### 3.1 架构原则

v3 应采用"双模式 + 同一底座"：

```
/write
├── Guided Mode：默认模式，手把手创作流程
└── Quick Tools Mode：专业工具模式，保留现有 Tab
```

移动端默认进入 Guided Mode。桌面端可以展示更完整的三栏创作台，但底层仍使用同一套 Workflow 数据结构。

### 3.2 总体架构图

```
Frontend
├── /write
│   ├── GuidedWriteClient
│   ├── QuickToolsClient
│   ├── MobileGuidedLayout
│   ├── DesktopGuidedLayout
│   └── JokeLibrary
│
├── Workflow Engine
│   ├── workflowStateMachine
│   ├── nextStepResolver
│   ├── cardTreeManager
│   └── scriptStatusResolver
│
├── AI Task Layer
│   ├── aiTaskClient
│   ├── useStreamingTask
│   ├── streamEventParser
│   └── retry/abort/timeout
│
├── Local Store
│   ├── IndexedDB sessions
│   ├── IndexedDB cards
│   ├── syncQueue
│   └── draftSnapshots
│
└── UI Components
    ├── WorkflowCard
    ├── StepInputPanel
    ├── StickyPrimaryAction
    ├── SaveStatusBadge
    ├── MoreActionMenu
    └── MobileBottomNav


Backend
├── write_task_router
│   ├── /api/write/tasks/{taskType}/stream
│   ├── /api/write/detect-input
│   └── /api/write/next-step
│
├── Prompt Registry
│   ├── premise
│   ├── joke_to_premise
│   ├── angles
│   ├── draft
│   ├── rewrite
│   ├── premise_check
│   └── performance_review
│
├── Model Router
│   ├── TokenHub
│   ├── GLM
│   ├── MiniMax
│   ├── Kimi
│   └── fallback / timeout / circuit breaker
│
├── Persistence
│   ├── workflow_sessions
│   ├── workflow_cards
│   ├── ai_task_logs
│   └── user_style_profiles
│
└── Observability
    ├── request_id
    ├── latency
    ├── model
    ├── provider
    ├── error_code
    └── retry_count
```

## 4. 前端技术方案

### 4.1 推荐目录结构

```
frontend/src/app/write/
├── page.tsx
├── GuidedWriteClient.tsx
├── QuickToolsClient.tsx
├── components/
│   ├── WorkflowCard.tsx
│   ├── StepHeader.tsx
│   ├── StepInputPanel.tsx
│   ├── StickyPrimaryAction.tsx
│   ├── MoreActionMenu.tsx
│   ├── SaveStatusBadge.tsx
│   ├── ScriptStatusPill.tsx
│   ├── JokeLibraryDrawer.tsx
│   └── MobileBottomNav.tsx
├── hooks/
│   ├── useWorkflowSession.ts
│   ├── useWorkflowMachine.ts
│   ├── useStreamingTask.ts
│   ├── useAiTask.ts
│   ├── useAutoSaveSession.ts
│   └── useKeyboardSafeArea.ts
├── lib/
│   ├── workflowMachine.ts
│   ├── nextStep.ts
│   ├── cardTree.ts
│   ├── scriptStatus.ts
│   ├── aiTaskClient.ts
│   ├── indexedDbStore.ts
│   └── syncQueue.ts
└── types.ts
```

### 4.2 /write 页面改造

当前 /write 不建议直接删除原 Tab。v3 应该新增 Guided 模式，同时保留现有工具模式。

```tsx
export default function WritePage() {
  return <GuidedWriteClient />;
}
```

在 Guided 页面中提供入口：

```
切换到专业工具
```

专业工具中保留：

```
提炼前提
梗写前提
找角度
改稿
```

### 4.3 移动端布局

移动端采用单列卡片流：

```
顶部：当前步骤 + 进度 + 保存状态
中间：输入框 + 当前 AI 输出卡片
底部：固定主按钮
底部导航：创作 / 段子库 / 我的
```

CSS 强制要求：

```css
.write-shell {
  min-width: 0;
  max-width: 100vw;
  overflow-x: hidden;
}

.workflow-card {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.mobile-primary-action {
  position: sticky;
  bottom: env(safe-area-inset-bottom);
}
```

重点解决之前移动端混乱问题：

```
1. 禁止固定宽度组件。
2. 所有 flex/grid 子项加 min-w-0。
3. 长文本必须 overflow-wrap:anywhere。
4. 输入框自动增高，但限制最大高度。
5. 键盘弹起时主输入框必须滚动到可视区域。
```

## 5. Workflow Engine 设计

v3 的核心不是页面，而是流程引擎。

### 5.1 WorkflowStep

```typescript
export type WorkflowStep =
  | "input"
  | "detect"
  | "material"
  | "premise"
  | "joke_to_premise"
  | "premise_check"
  | "angles"
  | "draft"
  | "rewrite"
  | "performance_review"
  | "save";
```

### 5.2 WorkflowEvent

```typescript
export type WorkflowEvent =
  | { type: "SUBMIT_INPUT"; input: string }
  | { type: "DETECT_DONE"; inputType: InputType }
  | { type: "TASK_START"; taskType: AITaskType }
  | { type: "TASK_DONE"; card: WorkflowCard }
  | { type: "TASK_ERROR"; error: string }
  | { type: "CHOOSE_CARD"; cardId: string }
  | { type: "NEXT_STEP" }
  | { type: "BACK" }
  | { type: "RETRY" }
  | { type: "SAVE" }
  | { type: "RESTORE_SESSION"; session: WorkflowSession };
```

### 5.3 状态流转

```typescript
export function transition(
  session: WorkflowSession,
  event: WorkflowEvent
): WorkflowSession {
  switch (event.type) {
    case "SUBMIT_INPUT":
      return {
        ...session,
        sourceInput: event.input,
        currentStep: "detect",
      };

    case "DETECT_DONE":
      return {
        ...session,
        inputType: event.inputType,
        currentStep: resolveInitialStep(event.inputType),
      };

    case "TASK_DONE":
      return appendCardAndMoveNext(session, event.card);

    case "CHOOSE_CARD":
      return markSelectedCard(session, event.cardId);

    case "NEXT_STEP":
      return {
        ...session,
        currentStep: resolveNextStep(session),
      };

    default:
      return session;
  }
}
```

## 6. 创作版本树设计

脱口秀创作不是线性的，一个素材会产生多个前提、多个角度、多个改稿版本。因此 v3 不建议只用数组保存 cards，而要用树形结构。

### 6.1 WorkflowSession

```typescript
export interface WorkflowSession {
  id: string;
  userId?: string;
  title: string;
  sourceInput: string;
  inputType: InputType;
  currentStep: WorkflowStep;
  mode: "guided" | "quick";
  scriptStatus: ScriptStatus;
  saveStatus: SaveStatus;
  syncStatus: SyncStatus;
  rootCardIds: string[];
  mainlineCardId?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 6.2 WorkflowCard

```typescript
export interface WorkflowCard {
  id: string;
  sessionId: string;
  parentId?: string;
  childrenIds: string[];

  type: WorkflowStep;
  title: string;
  content: string;
  structuredData?: unknown;

  sourcePath: string[];
  isSelected: boolean;
  isMainline: boolean;
  version: number;

  model?: string;
  provider?: string;
  latencyMs?: number;
  tokenUsage?: TokenUsage;

  createdAt: string;
  updatedAt: string;
}
```

### 6.3 示例

```
素材：外公偏心
├── 前提 A：血缘平等，但待遇不平等
│   ├── 角度 A1：家族制度
│   │   └── 初稿 v1
│   │       └── 改稿 v1
│   └── 角度 A2：算法分级
│       └── 初稿 v2
└── 前提 B：外孙是外面的孙子
    └── 角度 B1：语言荒谬
        └── 改稿 v3
```

## 7. AI Task Layer 设计

当前已有 /api/write/*/stream 接口和 useStreamingTask，v3 应该继续复用，但抽象更高一层。

### 7.1 AITaskType

```typescript
export type AITaskType =
  | "detect_input"
  | "premise"
  | "joke_to_premise"
  | "angles"
  | "draft"
  | "rewrite"
  | "premise_check"
  | "performance_review";
```

### 7.2 前端调用方式

不要让页面直接写：

```
fetch("/api/write/rewrite/stream")
```

改成：

```
aiTask.run("rewrite", payload);
```

### 7.3 统一请求结构

```typescript
export interface AITaskRequest {
  taskType: AITaskType;
  sessionId: string;
  input: string;
  context?: {
    sourceInput?: string;
    selectedPremise?: string;
    selectedAngle?: string;
    previousDraft?: string;
    sourcePath?: string[];
  };
  userStyle?: UserStyleProfile;
  options?: {
    scene?: "open_mic" | "commercial" | "short_video" | "company_show";
    length?: "short" | "1-3min" | "3-5min";
    variant?: string;
  };
}
```

### 7.4 统一响应结构

SSE 协议建议统一为：

```
event: meta
data: {"taskId":"xxx","model":"glm-5","provider":"zhipu","requestId":"xxx"}

event: token
data: {"text":"..."}

event: structured
data: {"nextStep":"angles","cards":[...]}

event: done
data: {"latencyMs":8300,"tokenUsage":{"total":1200}}

event: error
data: {"code":"MODEL_TIMEOUT","message":"模型超时，请重试"}
```

## 8. 后端 API 设计

### 8.1 P0 保留现有接口

短期继续保留：

```
POST /api/write/premise/stream
POST /api/write/joke-to-premise/stream
POST /api/write/angles/stream
POST /api/write/rewrite/stream
POST /api/write/detect-input
```

### 8.2 P1 统一任务接口

新增统一入口：

```
POST /api/write/tasks/{taskType}/stream
```

### 8.3 新增接口优先级

**P0**
```
POST /api/write/detect-input
POST /api/write/next-step
```

**P1**
```
POST /api/write/tasks/draft/stream
POST /api/write/tasks/premise-check/stream
GET /api/write/sessions
POST /api/write/sessions
PATCH /api/write/sessions/{id}
```

**P2**
```
POST /api/write/tasks/performance-review/stream
POST /api/write/sync
GET /api/write/sessions/{id}/versions
```

## 9. Prompt Registry 设计

不要把 prompt 写死在 router 里。建议新增：

```
backend/app/prompts/
├── registry.py
├── premise.py
├── joke_to_premise.py
├── angles.py
├── draft.py
├── rewrite.py
├── premise_check.py
└── performance_review.py
```

### 9.1 Prompt 输出原则

所有 AI Task 输出都采用：

```
displayText + structuredData
```

## 10. 离线优先保存方案

v3 不建议只用 localStorage。创作文本可能很长，而且需要版本树。建议使用 IndexedDB。

### 10.1 本地库

```
IndexedDB: standup_workspace_v3
├── sessions
├── cards
├── sync_queue
├── draft_snapshots
└── user_profile_cache
```

### 10.2 保存策略

```
用户输入中：每 2 秒自动保存草稿快照
AI 生成中：实时保存 tokens
AI 生成完成：保存 WorkflowCard
用户选择主线：更新 isMainline
用户登录后：进入 sync_queue
```

### 10.3 SyncStatus

```typescript
export type SyncStatus =
  | "local_only"
  | "pending_sync"
  | "syncing"
  | "synced"
  | "conflict"
  | "failed";
```

### 10.4 冲突策略

P0/P1 不做复杂合并。

```
同一 session 多端修改：
1. 不覆盖。
2. 保留两个版本。
3. 命名为：改稿 v3 - 手机版本 / 改稿 v3 - 桌面版本
```

## 11. 段子库技术方案

### 11.1 ScriptStatus

```typescript
export type ScriptStatus =
  | "idea"
  | "premise"
  | "draft"
  | "performable"
  | "performed"
  | "mature";
```

### 11.2 状态映射

| Status       | 标签     |
|--------------|----------|
| idea         | 灵感     |
| premise      | 前提     |
| draft        | 草稿     |
| performable  | 可演     |
| performed    | 已演     |
| mature       | 成熟段子 |

### 11.3 段子库卡片字段

```typescript
export interface JokeLibraryItem {
  sessionId: string;
  title: string;
  summary: string;
  scriptStatus: ScriptStatus;
  tags: string[];
  nextAction: string;
  syncStatus: SyncStatus;
  updatedAt: string;
}
```

### 11.4 下一步建议

```typescript
const NEXT_ACTION_BY_STATUS = {
  idea: "找到好笑点",
  premise: "换几个讲法",
  draft: "改成上台版",
  performable: "记录演出反馈",
  performed: "演后复盘",
  mature: "加入专场",
};
```

## 12. 数据库设计

### 12.1 workflow_sessions

```sql
CREATE TABLE workflow_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  source_input TEXT,
  input_type TEXT,
  current_step TEXT,
  script_status TEXT,
  mode TEXT,
  sync_status TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 12.2 workflow_cards

```sql
CREATE TABLE workflow_cards (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  parent_id TEXT,
  type TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  structured_data JSONB,
  source_path JSONB,
  is_mainline BOOLEAN DEFAULT FALSE,
  is_selected BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  model TEXT,
  provider TEXT,
  latency_ms INTEGER,
  token_usage JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 12.3 ai_task_logs

```sql
CREATE TABLE ai_task_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  user_id TEXT,
  task_type TEXT,
  provider TEXT,
  model TEXT,
  status TEXT,
  latency_ms INTEGER,
  retry_count INTEGER,
  input_length INTEGER,
  output_length INTEGER,
  error_code TEXT,
  error_message TEXT,
  request_id TEXT,
  created_at TIMESTAMP
);
```

### 12.4 user_style_profiles

```sql
CREATE TABLE user_style_profiles (
  user_id TEXT PRIMARY KEY,
  stage_name TEXT,
  persona TEXT,
  common_topics JSONB,
  forbidden_topics JSONB,
  tone TEXT,
  preferred_techniques JSONB,
  updated_at TIMESTAMP
);
```

## 13. UI 组件设计

### 13.1 WorkflowCard

统一所有 AI 输出卡片。

```tsx
<WorkflowCard
  card={card}
  primaryAction={primaryAction}
  secondaryAction={secondaryAction}
  moreActions={moreActions}
  onPrimaryClick={handlePrimaryClick}
/>
```

卡片必须包含：标题、内容、结构化标签、来源链路、模型信息、耗时、保存状态、一个主按钮、一个次按钮、更多菜单。

### 13.2 StickyPrimaryAction

移动端底部主按钮。

```tsx
<StickyPrimaryAction
  label="继续：换几个讲法"
  loading={isGenerating}
  disabled={!canContinue}
  onClick={handleNext}
/>
```

要求：高度 44-48px，不遮挡输入框，兼容 safe-area，点击后 300ms 内进入 loading，生成失败后按钮变为"重试"。

### 13.3 StepInputPanel

统一输入面板。代入改稿时必须执行 scrollIntoView + highlight + toast。

## 14. 模型与多模型回退

### 14.1 模型策略

| 任务类型          | 优先模型特性                   |
|-------------------|--------------------------------|
| premise           | 创造力强、中文表达好           |
| angles            | 发散能力强                     |
| draft             | 长文本结构稳定                 |
| rewrite           | 中文口语化和改写能力           |
| premise_check     | 结构化判断稳定                 |
| performance_review| 分析能力强                     |

### 14.2 用户自定义 Key

优先使用用户 Key，失败后询问是否切回系统 Key，不直接静默消耗系统 Key。

## 15. 可观测性方案

每次 AI 任务都记录：taskId, sessionId, userId, taskType, provider, model, status, latencyMs, retryCount, inputLength, outputLength, errorCode, errorMessage, requestId, createdAt。

前端展示给用户：`由 GLM-5 生成 · 8.2s`

后台记录完整排查信息。

## 16. 测试方案

### 16.1 移动端 E2E

覆盖宽度：360px, 390px, 430px, 768px

### 16.2 关键 Bug 回归

1. 点击继续按钮无反应
2. 修改资料报错
3. 更多按钮无反应
4. 查看历史仍显示旧内容
5. 代入改稿后输入框没有显示内容
6. 移动端横向溢出
7. Safari 下布局错乱
8. 流式输出中断无提示

### 16.3 单元测试

workflowMachine.test.ts, nextStep.test.ts, cardTree.test.ts, scriptStatus.test.ts, aiTaskClient.test.ts, indexedDbStore.test.ts

## 17. 分期实施计划

### v3.0：移动端手把手流程版

目标：用户可以在手机上完成一次完整创作链路。

范围：

```
1. GuidedWriteClient
2. WorkflowSession / WorkflowCard
3. Workflow Engine
4. Mobile 单列卡片流
5. Sticky 主按钮
6. AI Task Client
7. useStreamingTask 接入 Guided 流程
8. detect-input 接入
9. premise / joke-to-premise / angles / rewrite 接入
10. IndexedDB 本地保存
11. 段子库 MVP
12. 代入改稿修复
13. 移动端布局修复
```

暂不做：复杂云同步、演后复盘、专场结构、复杂版本对比

### v3.1：创作闭环版

目标：补齐"写第一版"和"前提体检"。

范围：

```
1. /api/write/tasks/draft/stream
2. /api/write/tasks/premise-check/stream
3. 段子库状态筛选
4. 用户风格 Profile
5. 云端 sessions/cards
6. 模型信息展示
7. AI Task Logs
```

### v3.2：长期成长版

目标：从写稿工具升级为演员成长系统。

范围：performance-review、演出反馈记录、已演/成熟段子状态、版本对比、专场结构、短视频版改写、成熟段子归档

## 18. 开发执行清单

### 前端

```
[ ] 新增 GuidedWriteClient
[ ] 保留 QuickToolsClient
[ ] 新增 Workflow 类型定义
[ ] 新增 workflowMachine
[ ] 新增 cardTreeManager
[ ] 新增 aiTaskClient
[ ] 改造 useStreamingTask 为 AI Task 基础能力
[ ] 新增 IndexedDB Store
[ ] 新增 MobileBottomNav
[ ] 新增 StickyPrimaryAction
[ ] 新增 WorkflowCard
[ ] 新增 JokeLibraryDrawer
[ ] 修复移动端 overflow
[ ] 修复代入改稿输入框不可见
[ ] 增加移动端 E2E
```

### 后端

```
[ ] 新增 write_task_router
[ ] 新增 /api/write/next-step
[ ] 新增 Prompt Registry
[ ] 统一 Task Request / Task Response
[ ] 新增 draft prompt
[ ] 新增 premise_check prompt
[ ] 新增 ai_task_logs
[ ] 新增 workflow_sessions 表
[ ] 新增 workflow_cards 表
[ ] 接入模型耗时、provider、request_id
```

### 产品验收

```
[ ] 新用户 5 秒内知道从哪里开始
[ ] 每张卡片只有一个主按钮
[ ] 用户可以完成 素材 → 前提 → 角度 → 初稿 → 改稿
[ ] 刷新后内容不丢
[ ] 移动端 360px 无横向滚动
[ ] Safari 正常显示
[ ] 失败时有重试和保存草稿
[ ] 段子库能看到状态和下一步建议
```

## 19. 最终结论

v3 最重要的技术升级不是多加几个接口，而是建立四个底座：

```
1. Workflow Engine：管理创作流程
2. WorkflowCard Tree：管理内容版本
3. AI Task Layer：统一模型调用
4. Offline-first Store：保证内容不丢
```

推荐路线：

```
v3.0：先把 /write 从工具集合升级为移动端手把手创作流程
v3.1：补齐写第一版、前提体检、段子库状态
v3.2：增加演后复盘、成熟段子、专场结构
```

核心原则：不要直接推倒重来，也不要继续堆按钮。先把创作流程底座搭好，再把《手把手教你玩脱口秀》的方法论沉淀成可持续迭代的产品系统。
