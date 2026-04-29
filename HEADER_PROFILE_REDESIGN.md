# Header + 个人设置 米纸风改造任务

> 需求：去掉"喜剧分析工作台"，用户下拉菜单加"余白写作室"，个人设置页面融合米纸风
> 时间：2026-04-29 01:21

---

## 一、现状

### Header（`src/components/Header.tsx`）

问题：
1. Logo 文字"喜剧分析工作台"与 WorkSidebar 的"余白写作室"重复 → 删除
2. Header 背景白色 → 改为米纸风 bg-[#F5EFE3]
3. 用户下拉菜单缺少"余白写作室"（/write）入口
4. 用户菜单样式仍是灰色旧风格

### 个人设置页面（`src/app/settings/profile/page.tsx`）

问题：
- 白色背景 + 灰色样式，与米纸风不融合
- Tab 切换、按钮不统一

---

## 二、改造方案

### H-1：删除 Logo 文字
删除 `<span>喜剧分析工作台</span>`，只保留 SVG 图标。

### H-2：Header 背景米纸风化
- `bg-white` → `bg-[#F5EFE3]/95`
- `border-gray-200` → `border-black/8`
- 加 `backdrop-blur`

### H-3：用户下拉菜单加"余白写作室"入口 + 米纸风化
菜单顺序：
1. **余白写作室**（/write）← 新增高亮
2. 账号设置
3. 素材库
4. 段子库
5. ────
6. 退出登录

样式：
- 背景：`bg-[#FBF8F0] rounded-2xl border border-black/8`
- 菜单项：`text-[#25231F]` hover `bg-black/5`
- "余白写作室"用 `#A94737` 或左边加标记

### S-1：个人设置页面米纸风
- 背景：米纸风
- 容器：`bg-[#FBF8F0] rounded-3xl border border-black/10`
- Tab：`border-[#A94737]`
- 输入框：`border-black/15 bg-white/50`
- 主按钮：`bg-[#A94737]`
- 次要文字：`text-[#8A8174]`

---

## 三、验收标准

- [ ] Header 无"喜剧分析工作台"文字（只剩图标）
- [ ] Header 米纸色背景
- [ ] 用户下拉菜单第一项是"余白写作室"，点击跳转 /write
- [ ] 下拉菜单整体米纸风
- [ ] `/settings/profile` 米纸风融合
- [ ] `npm run build` 通过
- [ ] 0 console errors

---

## 四、关键文件

| 文件 | 路径 |
|------|------|
| Header | `frontend/src/components/Header.tsx` |
| 个人设置 | `frontend/src/app/settings/profile/page.tsx` |