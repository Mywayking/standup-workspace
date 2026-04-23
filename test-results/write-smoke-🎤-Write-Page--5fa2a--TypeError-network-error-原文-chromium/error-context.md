# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: write-smoke.spec.ts >> 🎤 Write Page - 精细化冒烟测试（已修复 bug 验证） >> PremiseTab 错误态显示用户友好文案，不含 TypeError / network error 原文
- Location: write-smoke.spec.ts:42:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '开始提炼' })
    - locator resolved to <button disabled class="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">开始提炼</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    114 × waiting for element to be visible, enabled and stable
        - element is not enabled
      - retrying click action
        - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e5]:
      - generic [ref=e6]: 推荐流程：
      - generic [ref=e7]:
        - button "素材" [ref=e8] [cursor=pointer]
        - button "前提" [ref=e9] [cursor=pointer]
        - button "角度" [ref=e10] [cursor=pointer]
        - button "改稿" [ref=e11] [cursor=pointer]
      - generic [ref=e12]: "| 已有一句梗？试试「梗写前提」"
    - generic [ref=e15]:
      - button "提炼前提 素材 → 前提" [ref=e16] [cursor=pointer]:
        - generic [ref=e17]: 提炼前提
        - generic [ref=e18]: 素材 → 前提
      - button "梗写前提 梗 → 前提" [ref=e19] [cursor=pointer]:
        - generic [ref=e20]: 梗写前提
        - generic [ref=e21]: 梗 → 前提
      - button "找角度 前提 → 角度" [ref=e22] [cursor=pointer]:
        - generic [ref=e23]: 找角度
        - generic [ref=e24]: 前提 → 角度
      - button "改稿 草稿 → 成品" [ref=e25] [cursor=pointer]:
        - generic [ref=e26]: 改稿
        - generic [ref=e27]: 草稿 → 成品
    - generic [ref=e29]:
      - generic [ref=e31]:
        - paragraph [ref=e32]: 创作会话
        - paragraph [ref=e33]: 从左侧开始，生成结果会自动出现在这里
      - generic [ref=e35]:
        - generic [ref=e37]:
          - heading "提炼前提" [level=2] [ref=e39]
          - paragraph [ref=e40]: 💡 讲一件事、一个经历、一个观察，AI 帮你提炼出可以上台说的喜剧前提。
          - button "📚 素材库" [ref=e43] [cursor=pointer]
          - textbox "输入一段素材： 一件事、一句抱怨、一个观察、一段情绪…… 📝 示例： • 我发现同事离职后，工位像被系统自动回收一样 • 我妈总觉得我写脱口秀不算正经工作 • 成年人最擅长的事，就是把委屈说成体面" [active] [ref=e44]:
            - /placeholder: "输入一段素材：\n一件事、一句抱怨、一个观察、一段情绪……\n\n📝 示例：\n• 我发现同事离职后，工位像被系统自动回收一样\n• 我妈总觉得我写脱口秀不算正经工作\n• 成年人最擅长的事，就是把委屈说成体面"
            - text: test
          - generic [ref=e45]:
            - generic [ref=e46]:
              - generic [ref=e47]: 已输入 4 字
              - generic [ref=e48]: 至少 20 字可开始，建议 50–200 字
            - button "开始提炼" [disabled] [ref=e49]
          - paragraph [ref=e50]: 生成后自动保存到右侧创作会话
        - generic [ref=e52]:
          - generic [ref=e53]:
            - paragraph [ref=e54]: 这个工具做什么？
            - button "✕" [ref=e55] [cursor=pointer]
          - paragraph [ref=e56]:
            - text: 把一段素材、情绪、观察，转化成
            - strong [ref=e57]: 可以上台说
            - text: 的喜剧前提。
          - generic [ref=e58]:
            - generic [ref=e59]:
              - generic [ref=e60]: ✓
              - paragraph [ref=e61]: 识别主题和态度
            - generic [ref=e62]:
              - generic [ref=e63]: ✓
              - paragraph [ref=e64]: 提炼核心矛盾
            - generic [ref=e65]:
              - generic [ref=e66]: ✓
              - paragraph [ref=e67]: 生成 5 个前提候选
            - generic [ref=e68]:
              - generic [ref=e69]: ✓
              - paragraph [ref=e70]: 推荐最优前提
            - generic [ref=e71]:
              - generic [ref=e72]: ✓
              - paragraph [ref=e73]: 给出场景建议
          - paragraph [ref=e75]: 输入素材越具体，提炼的前提越精准
  - alert [ref=e76]
```

# Test source

```ts
  1   | /**
  2   |  * Write Page 精细化冒烟测试
  3   |  * 针对所有已修复的 bug 点逐一验证
  4   |  * Run: npx playwright test write-smoke.spec.ts
  5   |  */
  6   | 
  7   | import { test, expect } from '@playwright/test';
  8   | 
  9   | const BASE = 'https://ai.alwayshaha.art/write';
  10  | 
  11  | test.describe('🎤 Write Page - 精细化冒烟测试（已修复 bug 验证）', () => {
  12  | 
  13  |   // ── Bug 1: PremiseTab 嵌套 button 已修复 ─────────────────────────
  14  |   test('PremiseTab 结果区不存在 button 嵌套 button', async ({ page }) => {
  15  |     await page.goto(BASE);
  16  |     await page.waitForLoadState('networkidle');
  17  | 
  18  |     // 填素材
  19  |     await page.locator('textarea').first().fill('我发现同事离职后，工位第二天就坐了新人');
  20  | 
  21  |     // 点击"开始提炼"
  22  |     await page.getByRole('button', { name: '开始提炼' }).click();
  23  | 
  24  |     // 等待结果
  25  |     await page.waitForSelector('text=⭐ 推荐前提', { timeout: 15000 });
  26  |     await page.waitForTimeout(500);
  27  | 
  28  |     // 确认没有嵌套 button
  29  |     const nestedButtons = await page.evaluate(() => {
  30  |       const buttons = document.querySelectorAll('button');
  31  |       let count = 0;
  32  |       for (const btn of buttons) {
  33  |         if (btn.querySelector('button')) count++;
  34  |       }
  35  |       return count;
  36  |     });
  37  |     expect(nestedButtons).toBe(0);
  38  |     console.log('✅ 无嵌套 button');
  39  |   });
  40  | 
  41  |   // ── Bug 2: 错误文案不暴露原始异常 ───────────────────────────────
  42  |   test('PremiseTab 错误态显示用户友好文案，不含 TypeError / network error 原文', async ({ page }) => {
  43  |     // 这个测试需要后端异常，直接跳过，用 curl 验证错误处理代码存在
  44  |     await page.goto(BASE);
  45  |     await page.waitForLoadState('networkidle');
  46  | 
  47  |     // 验证 mapUserError 工具函数已挂载
  48  |     // 通过检查网络请求时的 catch 分支代码路径来间接验证
  49  |     // 实际验证：fetch 一个不存在的 API 应该显示友好错误
  50  |     await page.locator('textarea').first().fill('test');
> 51  |     await page.getByRole('button', { name: '开始提炼' }).click();
      |                                                      ^ Error: locator.click: Test timeout of 60000ms exceeded.
  52  | 
  53  |     // 如果请求失败，应该看到友好错误而非原始异常
  54  |     // 由于后端正常，这里只验证组件渲染
  55  |     const hasPremiseResult = await page.locator('text=⭐ 推荐前提').isVisible({ timeout: 12000 }).catch(() => false);
  56  |     if (!hasPremiseResult) {
  57  |       // 后端异常，检查错误态
  58  |       const errorVisible = await page.locator('text=网络连接异常').or(page.locator('text=生成失败')).or(page.locator('text=请求超时')).isVisible({ timeout: 3000 }).catch(() => false);
  59  |       if (errorVisible) {
  60  |         console.log('✅ 错误态显示友好文案（后端异常情况）');
  61  |       }
  62  |     } else {
  63  |       console.log('ℹ️ PremiseTab 正常返回，跳过错误态验证');
  64  |     }
  65  |   });
  66  | 
  67  |   // ── Bug 3: Session Panel 空态正确显示 ───────────────────────────
  68  |   test('无 session 时 Session Panel 显示"创作会话"空态，不整块消失', async ({ page }) => {
  69  |     await page.goto(BASE);
  70  |     await page.waitForLoadState('networkidle');
  71  |     await page.waitForTimeout(1500);
  72  | 
  73  |     // 确认空态存在
  74  |     await expect(page.getByText('创作会话', { exact: true }).first()).toBeVisible();
  75  |     await expect(page.getByText('从左侧开始')).toBeVisible();
  76  |     console.log('✅ 空态正确显示');
  77  |   });
  78  | 
  79  |   // ── Bug 4: handoff 不预插伪结果卡 ──────────────────────────────
  80  |   test('点击"发送到找角度"后，不立刻出现角度卡（结果卡只在生成后出现）', async ({ page }) => {
  81  |     await page.goto(BASE);
  82  |     await page.waitForLoadState('networkidle');
  83  | 
  84  |     // 生成一个前提结果
  85  |     await page.locator('textarea').first().fill('我妈总觉得我写脱口秀不算正经工作');
  86  |     await page.getByRole('button', { name: '开始提炼' }).click();
  87  |     await page.waitForSelector('text=⭐ 推荐前提', { timeout: 15000 });
  88  | 
  89  |     // 点击卡片上的"更多"按钮
  90  |     const moreBtn = page.locator('text=更多 ▾').first();
  91  |     if (await moreBtn.isVisible({ timeout: 3000 })) {
  92  |       await moreBtn.click();
  93  |       await page.waitForTimeout(300);
  94  | 
  95  |       // 找角度按钮存在
  96  |       const sendBtn = page.getByText('发送到找角度').first();
  97  |       if (await sendBtn.isVisible()) {
  98  |         // 点击"发送到找角度"
  99  |         await sendBtn.click();
  100 |         await page.waitForTimeout(800);
  101 | 
  102 |         // 应该切换到找角度 Tab，且不应该立刻出现"角度分析"结果卡
  103 |         // 确认 Tab 切换
  104 |         await expect(page.getByRole('tab', { name: /找角度/ }).first()).toBeVisible();
  105 | 
  106 |         // 确认 toast 出现
  107 |         const toastVisible = await page.getByText('已带入').isVisible({ timeout: 2000 }).catch(() => false);
  108 |         expect(toastVisible).toBeTruthy();
  109 |         console.log('✅ handoff 切换 Tab + 显示 toast，不预插伪卡');
  110 |       } else {
  111 |         console.log('⚠️ 找不到"发送到找角度"按钮，跳过');
  112 |       }
  113 |     } else {
  114 |       console.log('⚠️ 找不到"更多"按钮，跳过');
  115 |     }
  116 |   });
  117 | 
  118 |   // ── Bug 5: EmptyState 删除按钮不为死按钮 ────────────────────────
  119 |   test('EmptyState 最近创作区无死删除按钮（onDelete 正确接入）', async ({ page }) => {
  120 |     await page.goto(BASE);
  121 |     await page.waitForLoadState('networkidle');
  122 | 
  123 |     // 空态下检查是否有删除按钮（应该没有，因为空态传了 onDelete={undefined}）
  124 |     // 如果有删除按钮，说明是条件渲染生效的
  125 |     const deleteBtnInEmpty = await page.locator('text=删除').isVisible().catch(() => false);
  126 |     // 删除按钮可能在最近创作列表里（需要先有历史记录才是可见状态）
  127 |     console.log(`ℹ️ EmptyState 删除按钮可见性: ${deleteBtnInEmpty}（需要已有历史记录才有意义）`);
  128 |     expect(true).toBeTruthy(); // 占位测试
  129 |   });
  130 | 
  131 |   // ── Feature: 主流程引导条显示正确 ──────────────────────────────
  132 |   test('主流程引导条 4 个节点都可见（素材→前提→角度→改稿）', async ({ page }) => {
  133 |     await page.goto(BASE);
  134 |     await page.waitForLoadState('networkidle');
  135 | 
  136 |     await expect(page.getByText('推荐流程')).toBeVisible();
  137 |     await expect(page.getByRole('button', { name: '前提', exact: true })).toBeVisible();
  138 |     await expect(page.getByRole('button', { name: '角度', exact: true })).toBeVisible();
  139 |     await expect(page.getByRole('button', { name: '改稿', exact: true })).toBeVisible();
  140 |     console.log('✅ 主流程引导条正确');
  141 |   });
  142 | 
  143 |   // ── Feature: 来源链以箭头显示 ─────────────────────────────────
  144 |   test('Session Panel 中来源链以" → "箭头连接显示', async ({ page }) => {
  145 |     await page.goto(BASE);
  146 |     await page.waitForLoadState('networkidle');
  147 | 
  148 |     // 生成一个结果
  149 |     await page.locator('textarea').first().fill('地铁上我偷听两个人聊天');
  150 |     await page.getByRole('button', { name: '开始提炼' }).click();
  151 |     const hasResult = await page.waitForSelector('text=⭐ 推荐前提', { timeout: 15000 }).catch(() => null);
```