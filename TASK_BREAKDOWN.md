# standup-washi 改造任务拆解

> 基于 `standup_washi_refactor_plan.md`
> 生成时间：2026-04-28
> 当前版本：Phase 0 ✅ 完成，Phase 1 大部分完成，Phase 2 进行中

---

## 一、现状评估

### ✅ 已完成

| 模块 | 文件 | 状态 |
|------|------|------|
| 页面入口 | `WritePageContent.tsx` + washi 动态加载 | ✅ |
| 三栏外壳 | `ResponsiveWashiShell.tsx` (248+1fr+288px) | ✅ |
| 主工作区 | `WashiMainFlow.tsx` | ✅ |
| 右侧工具栏 | `WashiRightPanel.tsx` | ✅ |
| 左侧历史栏 | `WorkSidebar.tsx` | ✅ |
| 移动端抽屉 | `MobileDrawer.tsx`, `MobileSheet.tsx` | ✅ |
| SSE 解析 | `lib/sse.ts` | ✅ 已修复 onDone + token 拼接 |
| 流式任务 | `useStreamingTask.ts` | ✅ |
| 写作生成 | `useWriteGeneration.ts` | ✅ 已修复 sessionId 闭包 |
| 会话管理 | `useWriteSession.ts` | ✅ 已修复 addCard fallback |
| 卡片映射 | `lib/cardMappers.ts` | ✅ |
| Intent 检测 | `hooks/useWriteIntent.ts` | ✅ |
| 请求适配 | `lib/requestAdapters.ts` | ✅ |
| 创作卡片 | `components/CreationCard.tsx` | ✅ |
| 输入框 | `components/Composer.tsx` | ✅ |
| 桌面端布局 | `100svh/100dvh + md:` 响应式 | ✅ |
| **Phase 0 bug** | sessionId 不匹配 + SSE onDone 不触发 | ✅ 刚修复 |

### 🔄 未完成 / 需要验证

| 模块 | 文件 | 状态 | 说明 |
|------|------|------|------|
| 移动端 safe-area | 全局 | 🔄 | 需要真机测试 iOS Safari |
| 调试日志清理 | 多个文件 | 🔄 | `console.log` 还在 |
| 后端统一协议 | `write_task_router.py` | 🔄 | 存在但未确认完整 |
| 多模型降级 | `model_router.py` | ❌ | 不存在 |
| 云端会话同步 | workflow_sessions 表 | ❌ | 未实现 |
| 稿件库 `/library` | 前端页面 | ❌ | 未实现 |
| 版本管理 | 改稿 v1/v2/v3 | ❌ | 未实现 |
| 演出反馈 | 复盘功能 | ❌ | 未实现 |

---

## 二、任务拆解（按优先级）

### 🔥 P0 — 必须完成（止血 + 核心链路）

#### P0-1: 清理调试日志
**文件**：
- `useWriteGeneration.ts` — `console.log("[DEBUG ...`"
- `WashiWriteClient.tsx` — `console.log("[DEBUG onCardCreated`
**操作**：删除所有 `[DEBUG` 日志

#### P0-2: 验证完整创作链路（E2E）
**测试素材**：`老板说我们要有主人翁精神，但公司裁员时发现我是外包主人翁`
**链路**：输入素材 → 出现素材卡 → 生成前提卡 → 找角度 → 生成角度卡 → 生成初稿 → 改稿
**验收**：
- [ ] 每个步骤卡片出现在主区域
- [ ] 刷新页面本地数据恢复
- [ ] 移动端不横向滚动

#### P0-3: 移动端 safe-area 真机测试
**问题**：`ResponsiveWashiShell` 用 `100svh/100dvh`，iOS Safari 可能被刘海/横条遮挡
**操作**：
- 检查 `Composer.tsx` 是否有 `pb: calc(X + env(safe-area-inset-bottom))`
- 检查 `@supports (height: 100dvh)` CSS 规则

---

### 🎯 P1 — 重要功能（提升体验）

#### P1-1: 右侧工具栏完善
**当前**：`WashiRightPanel.tsx` 存在，需要确认显示内容
**应显示**：当前步骤 / 模型 / 耗时 / 快捷工具
**文件**：`WashiRightPanel.tsx`

#### P1-2: 历史记录完善
**当前**：`WorkSidebar.tsx` 存在，需确认数据来源
**应显示**：本地 sessions 列表，支持切换
**文件**：`WorkSidebar.tsx`, `useWriteSession.ts`

#### P1-3: 取消生成功能
**检查**：`useStreamingTask.ts` 是否有 `cancel()` 和 `AbortController`
**应支持**：点击取消时中断 SSE 请求

#### P1-4: 错误重试 UI
**检查**：`WashiMainFlow.tsx` 是否显示错误状态
**应显示**：错误信息 + 重试按钮

---

### 🏗️ P2 — 架构升级（后端统一协议）

#### P2-1: 后端统一 API `/api/write/task/stream`
**检查**：`write_task_router.py` 是否完整实现
**接口**：统一 taskType + context + userStyle
**文件**：`backend/app/routers/write_task_router.py`

#### P2-2: `model_router` 多模型降级
**实现**：DeepSeek 失败 → GLM-5 兜底
**文件**：`backend/app/services/model_router.py`

#### P2-3: AI 调用日志
**表**：`ai_task_logs`
**字段**：model, provider, latency_ms, status, error_code

---

### 📦 P3 — 云端同步（数据持久化）

#### P3-1: workflow_sessions 云端表
#### P3-2: workflow_cards 云端表
#### P3-3: `/library` 稿件库页面
#### P3-4: 改稿版本管理
#### P3-5: 演出反馈记录

---

## 三、立即执行计划

### 第一步：清理 + 验证（今天）

1. **清理 DEBUG 日志** — 2 分钟
2. **Playwright E2E 测试** — 验证完整链路 — 10 分钟
3. **提交 clean commit** — 1 分钟

### 第二步：移动端测试（需要真机或 Playwright mobile）

4. **iPhone 模拟器测试** — 检查 safe-area
5. **修复发现的问题**

### 第三步：完善 P1 功能

6. 右侧工具栏内容检查
7. 历史记录数据源确认
8. 取消生成功能
9. 错误重试 UI

### 第四步：P2 后端（如需要）

10. 检查 `write_task_router.py` 完整性
11. 实现 `model_router.py`

---

## 四、执行提示

```bash
# 测试命令
cd /root/standup-workspace/frontend
E2E_BASE_URL=https://standup.alwayshaha.art npx playwright test tests/washi-write.spec.ts

# 构建
cd /root/standup-workspace/frontend && npm run build

# 后端测试
curl -si -X POST "https://standup.alwayshaha.art/api/write/premise/stream" \
  -H "Content-Type: application/json" \
  -d '{"text":"老板说要我们有主人翁精神"}'
```

---

## 五、当前阻塞项

无阻塞项。可以按顺序执行 P0-1 → P0-2 → P0-3。
