# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: write-page.spec.ts >> 🎤 Write Page - UX-4/UX-6/P2-17 验收测试 >> 主流程引导条正确显示且可点击
- Location: write-page.spec.ts:38:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('tab', { name: /提炼前提/ }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('tab', { name: /提炼前提/ }).first()

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - link "喜剧分析工作台" [ref=e4] [cursor=pointer]:
        - /url: /
        - img [ref=e5]
        - generic [ref=e7]: 喜剧分析工作台
      - generic [ref=e9]:
        - button "登录" [ref=e10] [cursor=pointer]
        - button "注册" [ref=e11] [cursor=pointer]
  - generic [ref=e12]:
    - generic [ref=e15]:
      - generic [ref=e16]: 推荐流程：
      - generic [ref=e17]:
        - button "素材" [ref=e18] [cursor=pointer]
        - button "前提" [active] [ref=e19] [cursor=pointer]
        - button "角度" [ref=e20] [cursor=pointer]
        - button "改稿" [ref=e21] [cursor=pointer]
      - generic [ref=e22]: "| 已有一句梗？试试「梗写前提」"
    - generic [ref=e25]:
      - button "提炼前提 素材 → 前提" [ref=e26] [cursor=pointer]:
        - generic [ref=e27]: 提炼前提
        - generic [ref=e28]: 素材 → 前提
      - button "梗写前提 梗 → 前提" [ref=e29] [cursor=pointer]:
        - generic [ref=e30]: 梗写前提
        - generic [ref=e31]: 梗 → 前提
      - button "找角度 前提 → 角度" [ref=e32] [cursor=pointer]:
        - generic [ref=e33]: 找角度
        - generic [ref=e34]: 前提 → 角度
      - button "改稿 草稿 → 成品" [ref=e35] [cursor=pointer]:
        - generic [ref=e36]: 改稿
        - generic [ref=e37]: 草稿 → 成品
    - generic [ref=e39]:
      - generic [ref=e41]:
        - paragraph [ref=e42]: 创作会话
        - paragraph [ref=e43]: 从左侧开始，生成结果会自动出现在这里
      - generic [ref=e45]:
        - generic [ref=e47]:
          - heading "提炼前提" [level=2] [ref=e49]
          - paragraph [ref=e50]: 💡 讲一件事、一个经历、一个观察，AI 帮你提炼出可以上台说的喜剧前提。
          - button "📚 素材库" [ref=e53] [cursor=pointer]
          - textbox "输入一段素材： 一件事、一句抱怨、一个观察、一段情绪…… 📝 示例： • 我发现同事离职后，工位像被系统自动回收一样 • 我妈总觉得我写脱口秀不算正经工作 • 成年人最擅长的事，就是把委屈说成体面" [ref=e54]:
            - /placeholder: "输入一段素材：\n一件事、一句抱怨、一个观察、一段情绪……\n\n📝 示例：\n• 我发现同事离职后，工位像被系统自动回收一样\n• 我妈总觉得我写脱口秀不算正经工作\n• 成年人最擅长的事，就是把委屈说成体面"
          - generic [ref=e55]:
            - generic [ref=e57]: 请输入素材
            - button "开始提炼" [disabled] [ref=e58]
          - paragraph [ref=e59]: 生成后自动保存到右侧创作会话
        - generic [ref=e61]:
          - generic [ref=e62]:
            - paragraph [ref=e63]: 这个工具做什么？
            - button "✕" [ref=e64] [cursor=pointer]
          - paragraph [ref=e65]:
            - text: 把一段素材、情绪、观察，转化成
            - strong [ref=e66]: 可以上台说
            - text: 的喜剧前提。
          - generic [ref=e67]:
            - generic [ref=e68]:
              - generic [ref=e69]: ✓
              - paragraph [ref=e70]: 识别主题和态度
            - generic [ref=e71]:
              - generic [ref=e72]: ✓
              - paragraph [ref=e73]: 提炼核心矛盾
            - generic [ref=e74]:
              - generic [ref=e75]: ✓
              - paragraph [ref=e76]: 生成 5 个前提候选
            - generic [ref=e77]:
              - generic [ref=e78]: ✓
              - paragraph [ref=e79]: 推荐最优前提
            - generic [ref=e80]:
              - generic [ref=e81]: ✓
              - paragraph [ref=e82]: 给出场景建议
          - paragraph [ref=e84]: 输入素材越具体，提炼的前提越精准
  - alert [ref=e85]
```

# Test source

```ts
  1   | /**
  2   |  * Write Page E2E Tests
  3   |  * Run: npx playwright test write-page.spec.ts
  4   |  */
  5   | 
  6   | import { test, expect, Page } from '@playwright/test';
  7   | 
  8   | const BASE = 'https://ai.alwayshaha.art/write';
  9   | 
  10  | test.describe('🎤 Write Page - UX-4/UX-6/P2-17 验收测试', () => {
  11  | 
  12  |   // ── 1. 页面基础加载 ──────────────────────────────────────────────
  13  |   test('页面加载成功，无 console error', async ({ page }) => {
  14  |     const errors: string[] = [];
  15  |     page.on('console', msg => {
  16  |       if (msg.type() === 'error') errors.push(msg.text());
  17  |     });
  18  | 
  19  |     await page.goto(BASE);
  20  |     await page.waitForLoadState('networkidle');
  21  |     await page.waitForTimeout(1000);
  22  | 
  23  |     // Tab 标题可见
  24  |     await expect(page.getByRole('tab', { name: /提炼前提/ }).first()).toBeVisible();
  25  | 
  26  |     const criticalErrors = errors.filter(e =>
  27  |       !e.includes('favicon') && !e.includes('font') && !e.includes('chrome-extension') &&
  28  |       !e.includes('Failed to load resource')
  29  |     );
  30  |     if (criticalErrors.length > 0) {
  31  |       console.log('Console errors:', criticalErrors);
  32  |     }
  33  |     expect(criticalErrors.length).toBe(0);
  34  |     console.log('✅ 页面加载无错误');
  35  |   });
  36  | 
  37  |   // ── 2. 主流程引导条 (UX-6) ──────────────────────────────────────
  38  |   test('主流程引导条正确显示且可点击', async ({ page }) => {
  39  |     await page.goto(BASE);
  40  |     await page.waitForLoadState('networkidle');
  41  | 
  42  |     // 引导条文案
  43  |     await expect(page.getByText('推荐流程')).toBeVisible();
  44  | 
  45  |     // 点击"前提"节点应切换到提炼前提Tab
  46  |     await page.getByRole('button', { name: '前提', exact: true }).click();
> 47  |     await expect(page.getByRole('tab', { name: /提炼前提/ }).first()).toBeVisible();
      |                                                                   ^ Error: expect(locator).toBeVisible() failed
  48  | 
  49  |     // 点击"角度"节点应切换到找角度Tab
  50  |     await page.getByRole('button', { name: '角度', exact: true }).click();
  51  |     await expect(page.getByRole('tab', { name: /找角度/ }).first()).toBeVisible();
  52  | 
  53  |     // 旁路提示
  54  |     await expect(page.getByText('梗写前提')).toBeVisible();
  55  | 
  56  |     console.log('✅ 主流程引导条正确，可点击切换Tab');
  57  |   });
  58  | 
  59  |   // ── 3. Session Panel 空态 (UX-4) ─────────────────────────────────
  60  |   test('Session Panel 空态正确显示，不消失', async ({ page }) => {
  61  |     await page.goto(BASE);
  62  |     await page.waitForLoadState('networkidle');
  63  | 
  64  |     // 右侧面板"创作会话"标题存在
  65  |     await expect(page.getByText('创作会话', { exact: true }).first()).toBeVisible();
  66  | 
  67  |     // 空态说明存在
  68  |     await expect(page.getByText('从左侧开始')).toBeVisible();
  69  | 
  70  |     console.log('✅ Session Panel 空态正确显示');
  71  |   });
  72  | 
  73  |   // ── 4. Tab 历史已下线 (UX-4 Step 1) ────────────────────────────
  74  |   test('各Tab内没有旧历史面板，Tab独立历史已收敛', async ({ page }) => {
  75  |     await page.goto(BASE);
  76  |     await page.waitForLoadState('networkidle');
  77  | 
  78  |     const viewHistoryBtn = page.locator('button', { hasText: /查看历史/ });
  79  |     expect(await viewHistoryBtn.count()).toBe(0);
  80  | 
  81  |     await page.getByRole('tab', { name: /找角度/ }).first().click();
  82  |     await page.waitForTimeout(500);
  83  |     const angleHistoryBtn = page.locator('button', { hasText: /查看历史/ });
  84  |     expect(await angleHistoryBtn.count()).toBe(0);
  85  | 
  86  |     console.log('✅ Tab 独立历史面板已下线');
  87  |   });
  88  | 
  89  |   // ── 5. Tab 内有"保存到会话"提示 ──────────────────────────────
  90  |   test('PremiseTab和AnglesTab都有"生成后自动保存"提示', async ({ page }) => {
  91  |     await page.goto(BASE);
  92  |     await page.waitForLoadState('networkidle');
  93  | 
  94  |     await expect(page.getByText('生成后自动保存到右侧创作会话').first()).toBeVisible();
  95  | 
  96  |     await page.getByRole('tab', { name: /找角度/ }).first().click();
  97  |     await page.waitForTimeout(300);
  98  |     await expect(page.getByText('生成后自动保存到右侧创作会话').first()).toBeVisible();
  99  | 
  100 |     console.log('✅ 各Tab有"保存到会话"提示');
  101 |   });
  102 | 
  103 |   // ── 6. Streaming 状态干净，无协议垃圾 (核心修复验证) ─────────
  104 |   test('PremiseTab 流式加载过程不显示原始 token/协议内容', async ({ page }) => {
  105 |     const protocolTokens: string[] = [];
  106 | 
  107 |     await page.goto(BASE);
  108 |     await page.waitForLoadState('networkidle');
  109 | 
  110 |     // 填入素材
  111 |     const textarea = page.locator('textarea').first();
  112 |     await textarea.fill('我发现同事离职后，工位像被系统自动回收一样，第二天就坐了新人，完全没有人在乎这里发生过什么');
  113 | 
  114 |     // 点击"开始提炼"
  115 |     await page.getByRole('button', { name: '开始提炼' }).click();
  116 | 
  117 |     // 等待 loading 状态出现
  118 |     await page.waitForSelector('text=AI 分析中', { timeout: 5000 });
  119 | 
  120 |     // 采样 3 次 loading 状态的文本，检查是否干净
  121 |     for (let i = 0; i < 3; i++) {
  122 |       await page.waitForTimeout(800);
  123 | 
  124 |       const stillLoading = await page.locator('text=AI 分析中').isVisible().catch(() => false);
  125 |       if (!stillLoading) {
  126 |         console.log('⚠️ 请求已返回结果，跳过 streaming 中间态检查（结果已正常显示）');
  127 |         break;
  128 |       }
  129 | 
  130 |       // 读取 AI 分析中区域的文本
  131 |       const loadingCard = page.locator('.bg-gray-50').first();
  132 |       const text = await loadingCard.textContent();
  133 | 
  134 |       // 检查是否有协议相关词汇
  135 |       const dangerous = [
  136 |         'premise_candidates',
  137 |         '\\u5b',
  138 |         '{',
  139 |         '}',
  140 |         '[',
  141 |         ']',
  142 |         '\\\\u',
  143 |         '"theme"',
  144 |         '"attitude"',
  145 |         '"conflict"',
  146 |       ];
  147 | 
```