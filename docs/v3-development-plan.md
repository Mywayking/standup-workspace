# v3 全量开发拆分方案

> 版本：v3.0 开发执行计划
> 目标：把 /write 从"AI 工具集合"升级为"移动端优先的脱口秀创作系统"

## 总目标

```
移动端优先的脱口秀创作系统
= Guided 手把手流程
+ Quick Tools 专业工具
+ 段子库
+ 创作版本管理
+ AI Task 层
+ 用户风格
+ 演后复盘
+ 长期成长系统
```

## 阶段总览

```
Phase 0：技术准备与代码清理
Phase 1：GuidedWriteClient 骨架 + 移动端布局
Phase 2：接入现有 AI 能力，跑通单主干流程
Phase 3：WorkflowSession / WorkflowCard 数据模型
Phase 4：本地保存 + SQLite 云端保存
Phase 5：段子库 MVP
Phase 6：AI Task Layer 统一模型调用
Phase 7：补齐新创作能力：前提体检 / 写第一版
Phase 8：卡片树与版本管理
Phase 9：用户风格 Profile + 自定义模型 Key
Phase 10：演后复盘
Phase 11：成熟段子库 / 专场结构 / 长期成长系统
Phase 12：观测、测试、性能和移动端打磨
```

映射关系：

```
v3.0 = Phase 0 - Phase 5
v3.1 = Phase 6 - Phase 8
v3.2 = Phase 9 - Phase 11
v3.x 持续优化 = Phase 12
```

---

## Phase 0：技术准备与代码清理

**目标**：为 v3 改造做准备，不改变用户主体验。

**开发内容**：

1. 梳理现有 /write 组件
2. 把现有 Tab 包装成 QuickToolsClient
3. 梳理现有接口：detect-input / premise / joke-to-premise / angles / rewrite
4. 检查 useStreamingTask 现状
5. 清理重复 SSE 解析逻辑
6. 建立 v3 类型文件

**输出**：
- `frontend/src/app/write/QuickToolsClient.tsx`
- `frontend/src/app/write/types.ts`
- `frontend/src/app/write/lib/stepMap.ts`

**验收**：现有功能不受影响，旧 Tab 可以正常使用。

---

## Phase 1：GuidedWriteClient 骨架 + 移动端布局

**目标**：先让用户进入 /write 后看到新的手把手入口。

**开发内容**：

1. 新增 GuidedWriteClient
2. /write 默认进入 Guided
3. 保留"专业工具"入口
4. 移动端单列布局
5. 首页输入框
6. 四个快捷入口：我有素材 / 我有一句梗 / 我有草稿 / 我刚演完
7. 底部主按钮
8. 最近创作占位
9. Mock WorkflowCard

**验收**：
- /write 首屏不再直接展示 4 个 Tab
- 360 / 390 / 430px 无横向滚动
- 点击"专业工具"能进入旧 Tab
- 输入内容后点击"开始创作"有反馈
- Safari 移动端布局正常

---

## Phase 2：接入现有 AI 能力，跑通单主干流程

**目标**：不新增复杂后端，先用现有接口完成完整创作链路。

**主流程**：

```
输入 → detect-input → premise / joke-to-premise / rewrite → angles → draft → rewrite → 保存
```

**开发内容**：

1. 接入 detect-input
2. 根据输入类型决定初始步骤
3. 接入 premise stream
4. 接入 joke-to-premise stream
5. 接入 angles stream
6. 接入 rewrite stream
7. draft 暂时用 rewrite prompt 或 mock draft task
8. 每一步只展示一个主按钮
9. 失败支持重试
10. 生成中展示骨架屏

**验收**：用户可以从一句素材完成：素材 → 前提 → 角度 → 初稿 → 改稿，每一步都有明确主按钮，失败不会卡死。

---

## Phase 3：WorkflowSession / WorkflowCard 数据模型

**目标**：把页面状态升级为创作会话状态。

**数据模型**：

```typescript
export type WorkflowStep =
  | "input" | "detect" | "material" | "premise"
  | "joke_to_premise" | "premise_check" | "angles"
  | "draft" | "rewrite" | "performance_review" | "save";

export type ScriptStatus =
  | "idea" | "premise" | "draft" | "performable" | "performed" | "mature";

export interface WorkflowSession {
  id: string;
  userId?: string;
  title: string;
  sourceInput: string;
  inputType: string;
  currentStep: WorkflowStep;
  scriptStatus: ScriptStatus;
  mode: "guided" | "quick";
  saveStatus: "idle" | "saving" | "saved_local" | "saved_cloud" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowCard {
  id: string;
  sessionId: string;
  parentId?: string;
  type: WorkflowStep;
  title: string;
  content: string;
  structuredData?: unknown;
  isMainline: boolean;
  version: number;
  model?: string;
  provider?: string;
  latencyMs?: number;
  createdAt: string;
  updatedAt: string;
}
```

**验收**：
- 所有生成结果都落成 WorkflowCard
- 当前流程由 WorkflowSession.currentStep 管理
- 卡片能记录来源 parentId，后续可以扩展成树

---

## Phase 4：本地保存 + SQLite 云端保存

**目标**：解决"内容丢失"和"历史无感知"。

### 4.1 前端本地保存

优先使用 IndexedDB：

```
IndexedDB: standup_workspace_v3
├── workflow_sessions
├── workflow_cards
├── draft_snapshots
└── sync_queue
```

### 4.2 后端 SQLite 保存

v3.0 继续 SQLite，不迁移 PostgreSQL，不加 Redis。

```sql
CREATE TABLE IF NOT EXISTS workflow_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  source_input TEXT,
  input_type TEXT,
  current_step TEXT,
  script_status TEXT,
  mode TEXT DEFAULT 'guided',
  save_status TEXT DEFAULT 'saved_local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_cards (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  parent_id TEXT,
  type TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  structured_data TEXT,
  is_mainline INTEGER DEFAULT 1,
  version INTEGER DEFAULT 1,
  model TEXT,
  provider TEXT,
  latency_ms INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES workflow_sessions(id)
);
```

### API

```
GET    /api/write/sessions
POST   /api/write/sessions
GET    /api/write/sessions/{id}
PATCH  /api/write/sessions/{id}
DELETE /api/write/sessions/{id}

POST   /api/write/cards
PATCH  /api/write/cards/{id}
DELETE /api/write/cards/{id}
```

**验收**：
- 未登录用户刷新后内容不丢
- 登录用户可以云端保存
- AI 生成中断时保留已生成内容
- 保存失败时提示"已保存到本地"

---

## Phase 5：段子库 MVP

**目标**：把历史记录升级为"段子库"。

**功能**：
1. 段子库入口
2. 状态筛选：灵感 / 前提 / 草稿 / 可演
3. 卡片展示：标题 / 摘要 / 状态 / 更新时间 / 下一步建议 / 保存状态
4. 点击继续创作
5. 最近创作展示 3 条

**状态映射**：

| Status      | 下一步建议 |
|-------------|-----------|
| idea        | 找到好笑点 |
| premise     | 换几个讲法 |
| draft       | 改成上台版 |
| performable | 记录演出反馈 |
| performed   | 演后复盘 |
| mature      | 加入专场 |

**验收**：用户能明显感知内容保存了、内容在哪个阶段、下一步该干什么。

---

## Phase 6：AI Task Layer 统一模型调用

**目标**：把 AI 调用从页面和具体接口中抽出来。

**前端调用方式**：

```typescript
aiTask.run("premise", payload);
aiTask.run("angles", payload);
aiTask.run("draft", payload);
aiTask.run("rewrite", payload);
```

**后端统一接口**：

```
POST /api/write/tasks/{taskType}/stream
```

任务类型：detect_input / premise / joke_to_premise / angles / draft / rewrite / premise_check / performance_review

**统一 SSE 事件**：

```
event: meta        → {"taskId", "model", "provider", "requestId"}
event: token       → {"text": "..."}
event: structured  → {"nextStep", "cards": [...]}
event: done        → {"latencyMs", "tokenUsage": {"total": 1200}}
event: error       → {"code", "message"}
```

**验收**：
- Guided 不再直接写死具体接口
- 所有 AI 任务统一 loading/error/retry/abort
- 可以展示 model/provider/latency
- 旧接口仍兼容

---

## Phase 7：补齐新创作能力

**目标**：补齐 PRD 中最关键的新能力。

### 7.1 前提体检

```
POST /api/write/tasks/premise-check/stream
```

输出：态度清晰度 / 反差强度 / 场景具体度 / 个人表达 / 可展开空间 / 结论：可写 / 需要修改 / 暂不建议写

### 7.2 写第一版

```
POST /api/write/tasks/draft/stream
```

输出：开场 / 铺垫 / 第一包袱 / 展开 / 第二包袱 / 结尾 / 上台提示

**验收**：用户不再停在"前提和角度"，可以真正生成一版能上台试的稿子。

---

## Phase 8：卡片树与版本管理

**目标**：从单主干升级为多分支版本管理。

**功能**：
1. 一个素材下多个前提
2. 一个前提下多个角度
3. 一个角度下多个改稿版本
4. 用户可以设为主线
5. 用户可以查看来源链路
6. 支持版本对比

**UI**：v3.1 不建议做复杂树图，建议先做轻量版本抽屉：当前版本 / 来源链路 / 其他前提 / 其他角度 / 历史改稿 / 设为当前主线

**验收**：用户知道这版稿子来自哪个前提、哪个角度、哪个版本。

---

## Phase 9：用户风格 Profile + 自定义模型 Key

**目标**：让 AI 输出更像用户本人。

**用户风格字段**：艺名 / 舞台人设 / 常写主题 / 禁区 / 语言风格 / 常用技巧 / 演出场景

**用户模型 Key**：

原则：1. 用户填 Key，优先用用户 Key；2. 用户 Key 失败后提示是否切回系统 Key；3. 不静默消耗系统 Key；4. Key 加密保存

**验收**：
- 用户可以设置自己的风格
- 改稿时能带入用户风格
- 用户可以填写自己的模型 Key
- 页面能显示当前使用模型

---

## Phase 10：演后复盘

**目标**：让产品从写稿工具变成演员成长工具。

```
POST /api/write/tasks/performance-review/stream
```

输入：演出场景 / 哪里笑了 / 哪里没笑 / 哪里冷场 / 哪里忘词 / 演员主观感受

输出：保留内容 / 删除内容 / 加强内容 / 冷场原因 / 下一版改稿建议 / 新版本草稿

**状态流转**：performable → performed → performance_review → mature

**验收**：用户演完后可以回到段子库，记录反馈，并生成下一版。

---

## Phase 11：成熟段子库 / 专场结构 / 长期成长系统

**目标**：把产品从单次写稿升级为长期创作系统。

**功能**：
1. 成熟段子归档
2. 多次演出记录
3. 笑点表现记录
4. 专场结构管理
5. 主题分组
6. 5 分钟 / 15 分钟 / 60 分钟内容编排
7. 短视频版改写
8. 商演安全版

**专场结构**：开场 / 人物介绍 / 核心主题 / 段子 A / 段子 B / 段子 C / 情绪转折 / 结尾

**验收**：用户可以把零散段子组织成一组可演内容。

---

## Phase 12：观测、测试、性能和移动端打磨

这个阶段贯穿全过程，但可以最后系统补齐。

### AI Task Logs

```sql
CREATE TABLE IF NOT EXISTS ai_task_logs (
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
  created_at TEXT
);
```

### 测试覆盖

1. 移动端 360 / 390 / 430 / 768px
2. Safari / Chrome
3. 输入框键盘遮挡
4. 流式输出中断
5. 模型超时
6. 保存失败
7. 登录 / 未登录
8. 代入改稿
9. 段子库继续创作

### 性能目标

```
首屏加载 < 2s
点击按钮 300ms 内有反馈
生成超过 5s 显示提示
移动端无横向滚动
长文本不卡顿
```

---

## 最终优先级表

| 阶段 | 内容 | 版本 |
|------|------|------|
| Phase 0 | 技术准备 | v3.0 P0 |
| Phase 1 | Guided 骨架 + 移动端布局 | v3.0 P0 |
| Phase 2 | 接入现有 AI 主流程 | v3.0 P0 |
| Phase 3 | Workflow 数据模型 | v3.0 P0 |
| Phase 4 | 本地保存 + SQLite 保存 | v3.0 P0 |
| Phase 5 | 段子库 MVP | v3.0 P0 |
| Phase 6 | AI Task Layer | v3.1 P1 |
| Phase 7 | 前提体检 + 写第一版 | v3.1 P1 |
| Phase 8 | 卡片树 + 版本管理 | v3.1 P1 |
| Phase 9 | 用户风格 + 自定义 Key | v3.1 P1 |
| Phase 10 | 演后复盘 | v3.2 P2 |
| Phase 11 | 成熟段子库 + 专场结构 | v3.2 P2 |
| Phase 12 | 观测、测试、性能 | 持续 |

---

## 推荐开发顺序

**第一周**：Phase 0 + Phase 1 — 把 Guided 壳搭出来，移动端体验先变好

**第二周**：Phase 2 + Phase 3 — 把现有 AI 能力串成单主干流程

**第三周**：Phase 4 + Phase 5 — 解决内容保存和段子库感知

**第四周**：Phase 6 + Phase 7 — 统一 AI Task，补齐前提体检和写第一版

**第五周**：Phase 8 + Phase 9 — 做版本管理、用户风格、自定义 Key

**第六周**：Phase 10 + Phase 11 + Phase 12 — 做演后复盘、成熟段子库、专场结构和全链路测试

---

## 一句话决策

v3 全部都要做，但不是同时做。正确拆法是：

```
先体验闭环，再技术底座
先单主干，再版本树
先 SQLite，再考虑更复杂架构
先 Guided 默认入口，再保留专业工具
先保证内容不丢，再做长期成长系统
```

最终交付目标不是一个"新版页面"，而是一个完整的脱口秀创作工作流系统。它能让用户从一句素材开始，经过前提、角度、初稿、改稿、复盘，最后沉淀为成熟段子和专场内容。
