# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend-e2e.spec.ts >> 🎤 Standup Frontend - API Integration >> API returns projects list
- Location: frontend-e2e.spec.ts:70:7

# Error details

```
TypeError: fetch failed
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
  59  |     await starsBtn.click();
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
> 71  |     const response = await fetch(`${BASE}/api/projects`);
      |                      ^ TypeError: fetch failed
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
  160 |     }
  161 |     console.log(`✅ Job final status: ${jobStatus}`);
  162 | 
  163 |     // 5. Get analysis result
  164 |     const analysisRes = await fetch(`${BASE}/api/scripts/${scriptId}/analysis`);
  165 |     expect(analysisRes.status).toBe(200);
  166 |     const analysis = await analysisRes.json();
  167 |     console.log(`✅ Analysis result: segments=${analysis.segments?.length ?? 0}`);
  168 | 
  169 |     // Cleanup
  170 |     await fetch(`${BASE}/api/projects/${projectId}`, { method: 'DELETE' });
  171 |     console.log('✅ Cleanup done');
```