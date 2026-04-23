# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend-e2e.spec.ts >> 🎤 Standup Frontend - Dashboard >> "My Stars" button opens modal
- Location: frontend-e2e.spec.ts:53:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('button').filter({ hasText: '我的收藏' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
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
          - textbox "输入一段素材： 一件事、一句抱怨、一个观察、一段情绪…… 📝 示例： • 我发现同事离职后，工位像被系统自动回收一样 • 我妈总觉得我写脱口秀不算正经工作 • 成年人最擅长的事，就是把委屈说成体面" [ref=e44]:
            - /placeholder: "输入一段素材：\n一件事、一句抱怨、一个观察、一段情绪……\n\n📝 示例：\n• 我发现同事离职后，工位像被系统自动回收一样\n• 我妈总觉得我写脱口秀不算正经工作\n• 成年人最擅长的事，就是把委屈说成体面"
          - generic [ref=e45]:
            - generic [ref=e47]: 请输入素材
            - button "开始提炼" [disabled] [ref=e48]
          - paragraph [ref=e49]: 生成后自动保存到右侧创作会话
        - generic [ref=e51]:
          - generic [ref=e52]:
            - paragraph [ref=e53]: 这个工具做什么？
            - button "✕" [ref=e54] [cursor=pointer]
          - paragraph [ref=e55]:
            - text: 把一段素材、情绪、观察，转化成
            - strong [ref=e56]: 可以上台说
            - text: 的喜剧前提。
          - generic [ref=e57]:
            - generic [ref=e58]:
              - generic [ref=e59]: ✓
              - paragraph [ref=e60]: 识别主题和态度
            - generic [ref=e61]:
              - generic [ref=e62]: ✓
              - paragraph [ref=e63]: 提炼核心矛盾
            - generic [ref=e64]:
              - generic [ref=e65]: ✓
              - paragraph [ref=e66]: 生成 5 个前提候选
            - generic [ref=e67]:
              - generic [ref=e68]: ✓
              - paragraph [ref=e69]: 推荐最优前提
            - generic [ref=e70]:
              - generic [ref=e71]: ✓
              - paragraph [ref=e72]: 给出场景建议
          - paragraph [ref=e74]: 输入素材越具体，提炼的前提越精准
  - alert [ref=e75]
```

# Test source

```ts
  1   | /**
  2   |  * Standup Frontend E2E Tests
  3   |  * Run: npx playwright test frontend-e2e.spec.ts
  4   |  */
  5   | 
  6   | import { test, expect, Page } from '@playwright/test';
  7   | 
  8   | const BASE = 'https://ai.alwayshaha.art';
  9   | 
  10  | test.describe('🎤 Standup Frontend - Dashboard', () => {
  11  |   test('Dashboard loads and shows main elements', async ({ page }: { page: Page }) => {
  12  |     await page.goto(BASE);
  13  |     await page.waitForLoadState('networkidle');
  14  | 
  15  |     const body = await page.textContent('body');
  16  |     expect(body?.length).toBeGreaterThan(10);
  17  |     expect(body).toContain('喜剧分析工作台');
  18  |     console.log('✅ Dashboard loads successfully');
  19  |   });
  20  | 
  21  |   test('No console errors on load', async ({ page }: { page: Page }) => {
  22  |     const errors: string[] = [];
  23  |     page.on('console', msg => {
  24  |       if (msg.type() === 'error') {
  25  |         errors.push(msg.text());
  26  |       }
  27  |     });
  28  | 
  29  |     await page.goto(BASE);
  30  |     await page.waitForLoadState('networkidle');
  31  |     await page.waitForTimeout(2000);
  32  | 
  33  |     const criticalErrors = errors.filter(e =>
  34  |       !e.includes('favicon') && !e.includes('font') && !e.includes('chrome-extension')
  35  |     );
  36  | 
  37  |     if (criticalErrors.length > 0) {
  38  |       console.log('Console errors:', criticalErrors);
  39  |     }
  40  |     expect(criticalErrors.length).toBe(0);
  41  |     console.log('✅ No critical console errors');
  42  |   });
  43  | 
  44  |   test('Navigation elements are present (4 quick entry buttons)', async ({ page }: { page: Page }) => {
  45  |     await page.goto(BASE);
  46  |     await page.waitForLoadState('networkidle');
  47  | 
  48  |     const buttons = await page.locator('button').count();
  49  |     expect(buttons).toBeGreaterThan(0);
  50  |     console.log(`✅ Buttons found: ${buttons}`);
  51  |   });
  52  | 
  53  |   test('"My Stars" button opens modal', async ({ page }: { page: Page }) => {
  54  |     await page.goto(BASE);
  55  |     await page.waitForLoadState('networkidle');
  56  | 
  57  |     // Click "我的收藏" button
  58  |     const starsBtn = page.locator('button', { hasText: '我的收藏' });
> 59  |     await starsBtn.click();
      |                    ^ Error: locator.click: Test timeout of 60000ms exceeded.
  60  |     await page.waitForTimeout(500);
  61  | 
  62  |     // Modal should appear
  63  |     const modal = page.locator('text=⭐ 我的收藏');
  64  |     await expect(modal.first()).toBeVisible();
  65  |     console.log('✅ My Stars modal opens');
  66  |   });
  67  | });
  68  | 
  69  | test.describe('🎤 Standup Frontend - API Integration', () => {
  70  |   test('API returns projects list', async () => {
  71  |     const response = await fetch(`${BASE}/api/projects`);
  72  |     expect(response.status).toBe(200);
  73  |     const data = await response.json();
  74  |     expect(Array.isArray(data)).toBe(true);
  75  |     console.log(`✅ API /projects returns ${data.length} projects`);
  76  |   });
  77  | 
  78  |   test('API accepts new project creation (201)', async () => {
  79  |     const response = await fetch(`${BASE}/api/projects`, {
  80  |       method: 'POST',
  81  |       headers: { 'Content-Type': 'application/json' },
  82  |       body: JSON.stringify({ name: 'Playwright Test', description: 'E2E test' }),
  83  |     });
  84  |     expect(response.status).toBe(201);
  85  |     const data = await response.json();
  86  |     expect(data.id).toBeDefined();
  87  |     console.log(`✅ Project created: ${data.id}`);
  88  | 
  89  |     await fetch(`${BASE}/api/projects/${data.id}`, { method: 'DELETE' });
  90  |     console.log('✅ Project cleaned up');
  91  |   });
  92  | 
  93  |   test('Swagger UI accessible at /docs', async () => {
  94  |     const response = await fetch(`${BASE}/docs`);
  95  |     expect(response.status).toBe(200);
  96  |     const text = await response.text();
  97  |     expect(text).toContain('swagger');
  98  |     console.log('✅ Swagger UI accessible');
  99  |   });
  100 | 
  101 |   test('CORS preflight handled', async () => {
  102 |     const response = await fetch(`${BASE}/api/projects`, {
  103 |       method: 'OPTIONS',
  104 |       headers: { 'Origin': BASE, 'Access-Control-Request-Method': 'GET' },
  105 |     });
  106 |     expect([200, 204, 400, 405]).toContain(response.status);
  107 |     console.log(`✅ CORS preflight handled (${response.status})`);
  108 |   });
  109 | });
  110 | 
  111 | test.describe('🎤 Standup Frontend - Full Analysis Workflow', () => {
  112 |   let projectId: number;
  113 |   let scriptId: number;
  114 | 
  115 |   test('create project → upload → analyze → get result', async ({ page }) => {
  116 |     test.setTimeout(180000); // Allow up to 3 min for analysis with retries
  117 |     // 1. Create project
  118 |     const projRes = await fetch(`${BASE}/api/projects`, {
  119 |       method: 'POST',
  120 |       headers: { 'Content-Type': 'application/json' },
  121 |       body: JSON.stringify({ name: '完整流程测试', description: '' }),
  122 |     });
  123 |     expect(projRes.status).toBe(201);
  124 |     const project = await projRes.json();
  125 |     projectId = project.id;
  126 |     console.log(`✅ Project: ${projectId}`);
  127 | 
  128 |     // 2. Upload script
  129 |     const formData = new FormData();
  130 |     const blob = new Blob(['何广智内卷段子\n这是一个关于内卷的段子。反复重复同样的事情。'], { type: 'text/plain' });
  131 |     formData.append('file', blob, '测试.txt');
  132 |     const uploadRes = await fetch(`${BASE}/api/scripts/upload?project_id=${projectId}`, {
  133 |       method: 'POST',
  134 |       body: formData,
  135 |     });
  136 |     expect(uploadRes.status).toBe(201);
  137 |     const script = await uploadRes.json();
  138 |     scriptId = script.id;
  139 |     console.log(`✅ Script uploaded: ${scriptId}`);
  140 | 
  141 |     // 3. Trigger analysis (should always be accessible now)
  142 |     const analyzeRes = await fetch(`${BASE}/api/scripts/${scriptId}/analyze`, {
  143 |       method: 'POST',
  144 |     });
  145 |     expect(analyzeRes.status).toBe(201);
  146 |     const job = await analyzeRes.json();
  147 |     expect(job.id).toBeDefined();
  148 |     console.log(`✅ Analysis triggered: job ${job.id}`);
  149 | 
  150 |     // 4. Poll job status (wait for completion or running)
  151 |     let jobStatus = job.status;
  152 |     let attempts = 0;
  153 |     while ((jobStatus === 'pending' || jobStatus === 'running') && attempts < 90) {
  154 |       await new Promise(r => setTimeout(r, 2000));
  155 |       const statusRes = await fetch(`${BASE}/api/jobs/${job.id}`);
  156 |       const statusData = await statusRes.json();
  157 |       jobStatus = statusData.status;
  158 |       console.log(`  Job status: ${jobStatus} (step ${statusData.step})`);
  159 |       attempts++;
```