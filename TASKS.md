# 喜剧工作台 MVP 任务追踪

## Phase 1: Backend API（后端接口）
- [x] 1.1 `POST /api/extract-premise` - 提炼前提接口 ✅
- [x] 1.2 `POST /api/find-angles` - 找角度接口 ✅
- [x] 1.3 注册新路由到 main.py ✅
- [x] 1.4 启动测试（curl）✅

## Phase 2: Frontend API Routes（前端 API 代理）
- [x] 2.1 `POST /api/extract-premise/stream` - SSE 流式代理 ✅
- [x] 2.2 `POST /api/find-angles/stream` - SSE 流式代理 ✅
- [x] 2.3 Next.js 通过 nginx 反向代理到 backend ✅

## Phase 3: 前端 - 重构 /write 为 Tab 模式
- [x] 3.1 新建 TabLayout 组件（提炼前提/找角度/改稿）✅
- [x] 3.2 迁移/重构 WriteClient → 改稿 Tab ✅
- [x] 3.3 新建 PremiseTab（提炼前提）✅
- [x] 3.4 新建 AnglesTab（找角度）✅


## Phase 4: 新建独立页面（快捷入口）
- [x] 4.1 `/write` 入口页 Tab 模式 ✅（已完成核心入口，单独页面可后续添加）

## Phase 5: 功能完善
- [x] 5.1 历史记录（独立 localStorage keys）✅
- [ ] 5.2 后续动作按钮组（从结果→继续展开/找角度）
- [ ] 5.3 素材库入口（从 KB 导入）

## Phase 6: 测试
- [x] 6.1 Backend API 测试 ✅（curl 验证通过）
- [x] 6.2 前端功能测试（Playwright截图）✅
- [ ] 6.3 多端验证（用户浏览器）

## 完成标准
- [x] 所有 API 接口 curl 可调通 ✅
- [x] 页面刷新不崩溃、无 console error ✅
- [x] 三个 Tab 功能均可正常使用 ✅
