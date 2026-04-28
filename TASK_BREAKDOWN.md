# standup-washi 改造任务拆解

> 基于 `standup_washi_refactor_plan.md`
> 生成时间：2026-04-28
> **最后更新：2026-04-29 00:01 — 全部完成**

---

## 一、最终状态

| Phase | 任务 | 状态 | 说明 |
|-------|------|------|------|
| **P0** | 止血修复 | ✅ | SSE onDone + sessionId 闭包 + DEBUG 清理 |
| **P0** | E2E 链路验证 | ✅ | articles≥1, PREMISE≥3, 0 errors |
| **P0** | iOS safe-area | ✅ | 100svh/100dvh + @supports 兜底 |
| **P1** | 右侧工具栏 | ✅ | 步骤链 + 模型 + 耗时 |
| **P1** | 历史记录 | ✅ | WorkSidebar ← useWriteSession |
| **P1** | 取消生成 | ✅ | 生成中按钮显示"取消生成" |
| **P1** | 错误重试 | ✅ | StandaloneError + ErrorCard |
| **P2** | 后端统一 API | ✅ | `/api/write/task/stream` + write_task_router |
| **P2** | 多模型降级 | ✅ | model_router.py（DeepSeek→GLM-5） |
| **P2** | AI 调用日志 | ✅ | ai_task_logs 表 + 写入 |
| **P3** | workflow_sessions 表+API | ✅ | write_sessions.py CRUD |
| **P3** | workflow_cards 表+API | ✅ | write_cards.py CRUD |
| **P3** | 前端云端同步 | ✅ | useWriteSession.ts 静默同步 |
| **P3** | /library 稿件库 | ✅ | HTTP 200，米纸风 |

---

## 二、未完成 / 未来任务

以下为非阻塞项，暂不实施：

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 改稿版本管理 | v1/v2/v3 版本比较 | P3+ |
| 演出反馈记录 | 演后复盘功能 | P3+ |
| 用户 API Key | 自定义模型 Key | P2+ |
| 多语言支持 | i18n | 未来 |

---

## 三、Git 提交记录（本次改造）

```
e459298 enhance(write): add cancel button + iOS safe-area CSS fixes
2f698a5 fix(write): clean up DEBUG logs and verify full premise flow
e5428f5 fix(write): pass sessionId to generation.start() to fix premise card not appearing
06322e2 docs: add standup washi refactor plan
（另含 P2/P3 subagent 创建的文件，未单独 commit）
```

**涉及文件**：22 个，+1972/-118 行

---

## 四、验收测试结果

### P2 验收（后端）
- [x] `POST /api/write/task/stream` 正常返回 SSE tokens
- [x] DeepSeek 失败时自动降级到 GLM-5（via model_router）
- [x] `ai_task_logs` 表写入成功
- [x] 前端接收 meta 事件显示模型名称

### P3 验收（云端同步）
- [x] workflow_sessions 表 + CRUD API
- [x] workflow_cards 表 + CRUD API
- [x] 前端 useWriteSession.ts 云端同步
- [x] /library 页面 HTTP 200

---

## 五、关键文件路径

| 用途 | 路径 |
|------|------|
| 前端根目录 | `/root/standup-workspace/frontend` |
| 后端根目录 | `/root/standup-workspace/backend` |
| 统一任务路由 | `backend/app/routers/write_task_router.py` |
| 模型路由 | `backend/app/services/model_router.py` |
| 云端会话 API | `backend/app/routers/write_sessions.py` |
| 云端卡片 API | `backend/app/routers/write_cards.py` |
| Workflow ORM | `backend/app/models/workflow.py` |
| 稿件库页面 | `frontend/src/app/library/page.tsx` |
| 测试域名 | `https://standup.alwayshaha.art` |

---

_Last updated: 2026-04-29 00:01 — ALL TASKS COMPLETED_
