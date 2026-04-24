# 🎤 喜剧分析工作台 (Standup Analysis Workbench)

**定位**：脱口秀/单口喜剧拉片分析系统 — 核心是"原文—结构—态度—技巧—问题判断—启发"五联动分析。

## 功能模块

- **上传文稿**：支持 TXT/MD 格式，自动识别演员名/节目名/标题
- **自动切段**：按逻辑段落+停顿规则切分为分析单元
- **AI 分析**：7步流水线 — 预处理→切段→结构识别→标签抽取→问题判断→笔记生成→聚合输出
- **工作台**：左中右三栏 + 底部 Tabs，批注/对比/总结/方法论
- **导出**：支持 DOCX/MD/JSON 三种格式
- **SSE 实时推送**：分析进度实时可见

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Next.js 15 + TypeScript + Tailwind CSS + Zustand + TanStack Query |
| 后端 | FastAPI + Uvicorn + Redis + PostgreSQL + S3 |
| 分析 | TokenHub 多模型自动回退（DeepSeek / MiniMax / Kimi / GLM） |

## 快速启动（2026-04-15 完整版）

### 后端

```bash
cd backend

# 安装依赖
pip install -r requirements.txt --break-system-packages

# 配置环境变量
cp .env.example .env
# 填入 MINIMAX_API_KEY=your_key

# 启动服务（数据库自动初始化）
uvicorn app.main:app --reload --port 8000
```

API 文档: http://localhost:8000/docs
健康检查: http://localhost:8000/health

### 前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问: http://localhost:3000

**测试流程**：
1. 打开 http://localhost:3000
2. 点击「新建项目」创建一个项目
3. 点击「上传文稿」上传 TXT/MD 文件
4. 点击「开始分析」触发 7 步分析流水线
5. 查看工作台左中右三栏分析结果
6. 点击「导出」下载 JSON/MD/DOCX

### 前置依赖

```bash
# Python 3.12+
python3 --version
# Node.js 22+
node --version
# Playwright（用于 E2E 测试）
npx playwright --version
```

## API 核心接口

### /write 流式接口（推荐）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/write/premise/stream` | 提炼前提（流式） |
| POST | `/api/write/joke-to-premise/stream` | 梗写前提（流式） |
| POST | `/api/write/angles/stream` | 找角度（流式） |
| POST | `/api/write/rewrite/stream` | 改稿分析（流式） |

### 旧接口（已标记 deprecated，2026-07-01 移除）

| 方法 | 路径 | 迁移至 |
|------|------|--------|
| POST | `/api/extract-premise/stream` | `/api/write/premise/stream` |
| POST | `/api/joke-to-premise` | `/api/write/joke-to-premise/stream` |
| POST | `/api/find-angles/stream` | `/api/write/angles/stream` |
| POST | `/api/analyze/stream` | `/api/write/rewrite/stream` |

### 项目管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects` | 列出项目 |
| POST | `/api/scripts/upload` | 上传文稿 |
| POST | `/api/scripts/{id}/analyze` | 发起分析任务 |
| GET | `/api/jobs/{jobId}` | SSE 实时进度 |
| GET | `/api/scripts/{id}/analysis` | 整篇分析结果 |
| GET | `/api/segments/{id}/analysis` | 单段分析结果 |
| POST | `/api/search/filter` | 按标签/关键词筛选 |
| POST | `/api/scripts/{id}/export` | 导出 docx/md/json |

## 数据模型

```
projects → scripts → segments → segment_analysis
                          ↓
                    script_reports
                          ↓
                    analysis_jobs
```

- **projects**：项目信息（名称/描述）
- **scripts**：原始文稿 + 清洗后文本
- **segments**：切分段落（位置索引）
- **segment_analysis**：结构/态度/技巧/问题/笔记
- **script_reports**：整篇总结/强项/弱项/方法论
- **analysis_jobs**：任务状态 + SSE 进度

## 分析流水线

```
1. 文本预处理   → 清洗去噪、统一标点、识别演员/节目/标题
2. 段落切分     → 按逻辑+停顿切分为分析单元
3. 结构识别     → 开场/铺垫/举例/递进/callback/收尾
4. 标签抽取     → 态度对象/类型/洞察/前提/技巧
5. 问题判断     → 前提缺失/共鸣不足/只有趣事/依赖表演
6. 笔记生成     → 单段分析卡片 + 整篇总结
7. 聚合输出     → 可搜索/可导出报告
```

## 标签颜色语义

- 🔵 蓝色 = **结构**（开场、铺垫、callback、收尾）
- 🟣 紫色 = **态度**（奇怪、愚蠢、可怕、难过）
- 🟢 绿色 = **技巧**（类比、对比、结果假设、双关、修辞梗）
- 🟠 橙色 = **问题**（前提缺失、只有趣事、依赖表演、共鸣不足）
- ⚪ 灰色 = **备注**（可替换、可优化、可模仿）

## 工作台布局

```
┌─────────────────────────────────────────────────────┐
│  工具栏: [上传] [分析] [导出 ▾] [搜索]               │
├──────────┬──────────────────────┬───────────────────┤
│ 项目树    │   原文区 (按段落)     │  分析面板         │
│ 段落列表  │   高亮选中段落        │  结构/态度/技巧   │
│ 收藏/问题 │                      │  风险/启发        │
├──────────┴──────────────────────┴───────────────────┤
│  [批注] [版本对比] [整篇总结] [方法论归纳]           │
└─────────────────────────────────────────────────────┘
```

## 开发说明

### LLM 多模型回退

`/write` 页面调用 TokenHub 多模型自动回退网关（`backend/app/llm/`），支持：

- DeepSeek (`deepseek-chat`)
- MiniMax (`minimax-m2.7`)
- Kimi (`kimi-k2.6`)
- GLM (`glm-5`)

环境变量（通过 `backend/.env` 配置）：

```
TOKENHUB_API_KEY=your_key       # TokenHub 统一入口
DEEPSEEK_API_KEY=your_key       # 直接调用（可选）
MINIMAX_API_KEY=your_key        # 直接调用（可选）
```

流式 SSE 协议：所有 `/api/write/*/stream` 端点统一返回 JSON 事件，详见 `docs/API_CONTRACT.md`。

### Redis SSE

分析进度通过 Redis pub/sub + SSE 推送，前端实时显示进度条。

### 数据库

- 开发环境：SQLite（`./data/standup.db`）
- 生产环境：PostgreSQL

### 环境变量 (.env)

```bash
# Backend
DATABASE_URL=sqlite:///./data/standup.db
REDIS_URL=redis://localhost:6379/0
MINIMAX_API_KEY=your_key
MINIMAX_BASE_URL=https://api.minimax.chat
S3_BUCKET=standup-exports
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 项目结构

```
standup-workspace/
├── README.md
├── docs/
│   └── API_CONTRACT.md           # SSE 协议文档
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py
│       ├── config.py              # LLM 配置 + 验证
│       ├── database.py
│       ├── models.py
│       ├── schemas.py
│       ├── llm/
│       │   ├── __init__.py        # Gateway / StreamGateway 统一导出
│       │   ├── gateway.py         # 非流式多模型回退
│       │   └── stream_gateway.py  # 流式 SSE 多模型回退
│       ├── routers/
│       │   ├── projects.py
│       │   ├── scripts.py
│       │   ├── jobs.py
│       │   ├── extract_premise.py
│       │   ├── find_angles.py
│       │   ├── joke_to_premise.py
│       │   ├── analyze.py
│       │   └── write_stream.py     # /api/write/* 统一流式端点
│       └── utils/
│           ├── logging.py          # 结构化日志 + request_id
│           ├── errors.py          # 错误分类
│           └── json_repair.py      # 公共 JSON 解析
└── frontend/
    ├── package.json
    ├── next.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── app/layout.tsx
        ├── app/page.tsx
        ├── app/write/              # /write 页面（4个Tab）
        │   ├── WriteClient.tsx
        │   ├── PremiseTab.tsx
        │   ├── AnglesTab.tsx
        │   ├── JokeToPremiseTab.tsx
        │   └── RewriteTab.tsx
        ├── hooks/
        │   └── useStreamingTask.ts  # 统一流式状态机 Hook
        ├── lib/
        │   └── api.ts
        └── types/
            └── index.ts
```
