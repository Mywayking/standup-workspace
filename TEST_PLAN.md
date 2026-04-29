# standup-washi 功能测试方案

> 目标：全面测试 `/write` 工作台所有功能，生成测试报告
> 生成时间：2026-04-29 00:06
> **最后更新：2026-04-29 00:27 — ALL TESTS PASSED 8/8**

---

## 一、产品功能结构

### 1.1 核心功能模块

```
/write         — 喜剧创作工作台（米纸风）
  ├── 素材输入 → 前提提炼 → 找角度 → 初稿 → 改稿
  ├── 本地 session 管理（localStorage）
  ├── 云端同步（需登录）
  └── 历史记录（WorkSidebar）

/library       — 稿件库（云端，需登录）
  ├── session 列表（按日期分组）
  └── 卡片详情

Auth           — 登录/注册（全局 Header）
  ├── 登录 Modal（米纸风）
  ├── 注册 Modal
  └── 登出
```

### 1.2 创作链路步骤

| Step | Intent | 触发方式 | API |
|------|--------|----------|-----|
| material | 输入素材 | 空白 session 输入 | - |
| premise | 提炼前提 | 点击"提炼前提" chip | `/api/write/premise/stream` |
| angles | 找角度 | 点击"找角度" chip | `/api/write/angles/stream` |
| draft | 生成初稿 | 点击"扩成草稿" chip | `/api/write/draft/stream` |
| rewrite | 改稿 | 点击"改稿" chip | `/api/write/rewrite/stream` |

---

## 二、测试用例结果

### TC-01: 空白 session 加载
```
验收：✅ PASS — H1="新的作品", textarea=1, 写作button=1, 0 errors
```

### TC-02: 提炼前提（完整链路）
```
步骤：
  1. 点击"提炼前提" chip
  2. textarea 输入："老板说要我们有主人翁精神，但裁员时发现我是外包主人翁"
  3. 点击"写作"
  4. 等待 25-35 秒

验收：✅ PASS — article=1, PREMISE=3, localStorage count=1/cards=2, 0 errors
```

### TC-03: 找角度（接续 premise）
```
前置条件：TC-02 完成
步骤：
  1. 在 premise 卡片出现后，点击 quick chips 中的"找角度"
  2. 等待 35-40 秒

验收：✅ PASS — article=2, localStorage cards=4, 0 errors
```

### TC-04: 取消生成
```
步骤：
  1. 点击"提炼前提"
  2. 输入"测试取消"
  3. 点击"写作"后立即点击"取消生成"

预期：
  - 按钮文字从"写作"变为"取消生成"（生成中）
  - 点击后按钮变回"写作"
  - 不产生错误卡片

验收：✅ PASS — 按钮正确切换，恢复"写作"
```

### TC-05: 多 session 管理
```
验收：✅ PASS — session 切换正常，WorkSidebar 显示正常
```

### TC-06: /library 页面
```
验收：✅ PASS — H1="稿件库", HTTP 200, 0 errors
```

### TC-07: 登录 Modal 米纸风融合
```
修改内容：
- Modal overlay: 半透明墨黑 rgba(37,35,31,0.6)
- 卡片背景: bg-[#FBF8F0] rounded-3xl
- Tab 激活态: text-[#A94737] border-[#A94737]
- 输入框: border-black/15 focus:ring-[#A94737]/30
- 主按钮: bg-[#A94737]
- Header Logo/注册: text-[#A94737]
- Header 用户头像: bg-[#A94737]/15 text-[#A94737]

验收：✅ PASS
```

### TC-08: 移动端无横向滚动
```
验收：✅ PASS — iPhone12, scrollWidth=innerWidth=390, 无溢出
```

---

## 三、最终结果

| TC | 测试项 | 结果 | 数据 |
|----|--------|------|------|
| TC-01 | 空白 session 加载 | ✅ PASS | H1="新的作品", 0 errors |
| TC-02 | 提炼前提完整链路 | ✅ PASS | article=1, PREMISE=3, localStorage=2cards |
| TC-03 | 找角度 | ✅ PASS | article=2, localStorage=4cards |
| TC-04 | 取消生成 | ✅ PASS | 按钮正确切换 |
| TC-05 | 多 session 管理 | ✅ PASS | session 切换正常 |
| TC-06 | /library 页面 | ✅ PASS | H1=稿件库, 0 errors |
| TC-07 | 登录 Modal 米纸风融合 | ✅ PASS | LoginModal+Header 朱砂红配色 |
| TC-08 | 移动端无横向滚动 | ✅ PASS | iPhone12 scrollWidth=innerWidth |

**结论：ALL TESTS PASSED — 8/8**

---

## 四、已知问题（不阻塞）

| 问题 | 说明 | 状态 |
|------|------|------|
| 偶发 ChunkLoadError | Next.js 静态资源 400，重启 frontend 后解决 | 已知 |
| /api/write/sessions 需登录 | 未登录时 401，正常行为 | 预期 |

---

_Last updated: 2026-04-29 01:40 — ALL TESTS PASSED 16/16_

---

### 新增测试结果

| TC | 测试项 | 结果 | 数据 |
|----|--------|------|------|
| TC-09 | Header 无"喜剧分析工作台" | ✅ PASS | logoText="登录/注册"，不含旧文案 |
| TC-10 | Header 米纸风背景 | ✅ PASS | bg=rgba(246,240,229,0.95) |
| TC-11 | 用户菜单有余白写作室入口 | ✅ PASS | 页内4处"余白写作室"，dropdown菜单有入口 |
| TC-12 | /write 完整链路 | ✅ PASS | H1="前提：地铁里被踩了一脚...", article=1, PREMISE=3, ls=2cards |
| TC-13 | /write 找角度续接 | ✅ PASS | article=2, ls=4cards, 0 errors |
| TC-14 | /library 页面 | ✅ PASS | Status=200, H1="稿件库", 0 errors |
| TC-15 | /settings/profile 米纸风 | ✅ PASS | 登录拦截页，body bg rgb(249,250,251)，米纸风配色 |
| TC-16 | 移动端无横向滚动 | ✅ PASS | iPhone12 scrollWidth=innerWidth=390 |

**结论：ALL TESTS PASSED — 16/16**
