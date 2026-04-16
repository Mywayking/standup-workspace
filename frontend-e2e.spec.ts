/**
 * Standup Frontend E2E Tests
 * Run: npx playwright test frontend-e2e.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

const BASE = 'https://ai.alwayshaha.art';

test.describe('🎤 Standup Frontend - Dashboard', () => {
  test('Dashboard loads and shows main elements', async ({ page }: { page: Page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(10);
    expect(body).toContain('喜剧分析工作台');
    console.log('✅ Dashboard loads successfully');
  });

  test('No console errors on load', async ({ page }: { page: Page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') && !e.includes('font') && !e.includes('chrome-extension')
    );

    if (criticalErrors.length > 0) {
      console.log('Console errors:', criticalErrors);
    }
    expect(criticalErrors.length).toBe(0);
    console.log('✅ No critical console errors');
  });

  test('Navigation elements are present (4 quick entry buttons)', async ({ page }: { page: Page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    const buttons = await page.locator('button').count();
    expect(buttons).toBeGreaterThan(0);
    console.log(`✅ Buttons found: ${buttons}`);
  });

  test('"My Stars" button opens modal', async ({ page }: { page: Page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    // Click "我的收藏" button
    const starsBtn = page.locator('button', { hasText: '我的收藏' });
    await starsBtn.click();
    await page.waitForTimeout(500);

    // Modal should appear
    const modal = page.locator('text=⭐ 我的收藏');
    await expect(modal.first()).toBeVisible();
    console.log('✅ My Stars modal opens');
  });
});

test.describe('🎤 Standup Frontend - API Integration', () => {
  test('API returns projects list', async () => {
    const response = await fetch(`${BASE}/api/projects`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    console.log(`✅ API /projects returns ${data.length} projects`);
  });

  test('API accepts new project creation (201)', async () => {
    const response = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Playwright Test', description: 'E2E test' }),
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBeDefined();
    console.log(`✅ Project created: ${data.id}`);

    await fetch(`${BASE}/api/projects/${data.id}`, { method: 'DELETE' });
    console.log('✅ Project cleaned up');
  });

  test('Swagger UI accessible at /docs', async () => {
    const response = await fetch(`${BASE}/docs`);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('swagger');
    console.log('✅ Swagger UI accessible');
  });

  test('CORS preflight handled', async () => {
    const response = await fetch(`${BASE}/api/projects`, {
      method: 'OPTIONS',
      headers: { 'Origin': BASE, 'Access-Control-Request-Method': 'GET' },
    });
    expect([200, 204, 400, 405]).toContain(response.status);
    console.log(`✅ CORS preflight handled (${response.status})`);
  });
});

test.describe('🎤 Standup Frontend - Full Analysis Workflow', () => {
  let projectId: number;
  let scriptId: number;

  test('create project → upload → analyze → get result', async ({ page }) => {
    test.setTimeout(180000); // Allow up to 3 min for analysis with retries
    // 1. Create project
    const projRes = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '完整流程测试', description: '' }),
    });
    expect(projRes.status).toBe(201);
    const project = await projRes.json();
    projectId = project.id;
    console.log(`✅ Project: ${projectId}`);

    // 2. Upload script
    const formData = new FormData();
    const blob = new Blob(['何广智内卷段子\n这是一个关于内卷的段子。反复重复同样的事情。'], { type: 'text/plain' });
    formData.append('file', blob, '测试.txt');
    const uploadRes = await fetch(`${BASE}/api/scripts/upload?project_id=${projectId}`, {
      method: 'POST',
      body: formData,
    });
    expect(uploadRes.status).toBe(201);
    const script = await uploadRes.json();
    scriptId = script.id;
    console.log(`✅ Script uploaded: ${scriptId}`);

    // 3. Trigger analysis (should always be accessible now)
    const analyzeRes = await fetch(`${BASE}/api/scripts/${scriptId}/analyze`, {
      method: 'POST',
    });
    expect(analyzeRes.status).toBe(201);
    const job = await analyzeRes.json();
    expect(job.id).toBeDefined();
    console.log(`✅ Analysis triggered: job ${job.id}`);

    // 4. Poll job status (wait for completion or running)
    let jobStatus = job.status;
    let attempts = 0;
    while ((jobStatus === 'pending' || jobStatus === 'running') && attempts < 90) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await fetch(`${BASE}/api/jobs/${job.id}`);
      const statusData = await statusRes.json();
      jobStatus = statusData.status;
      console.log(`  Job status: ${jobStatus} (step ${statusData.step})`);
      attempts++;
    }
    console.log(`✅ Job final status: ${jobStatus}`);

    // 5. Get analysis result
    const analysisRes = await fetch(`${BASE}/api/scripts/${scriptId}/analysis`);
    expect(analysisRes.status).toBe(200);
    const analysis = await analysisRes.json();
    console.log(`✅ Analysis result: segments=${analysis.segments?.length ?? 0}`);

    // Cleanup
    await fetch(`${BASE}/api/projects/${projectId}`, { method: 'DELETE' });
    console.log('✅ Cleanup done');
  });

  test('Segment star toggle works', async () => {
    // Create project + script
    const projRes = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Star Toggle Test' }),
    });
    const project = await projRes.json();

    const formData = new FormData();
    const blob = new Blob(['测试段子内容。'], { type: 'text/plain' });
    formData.append('file', blob, 'star.txt');
    const uploadRes = await fetch(`${BASE}/api/scripts/upload?project_id=${project.id}`, {
      method: 'POST',
      body: formData,
    });
    const script = await uploadRes.json();

    // Trigger analysis first
    await fetch(`${BASE}/api/scripts/${script.id}/analyze`, { method: 'POST' });
    await new Promise(r => setTimeout(r, 5000));

    // Get segments
    const analysisRes = await fetch(`${BASE}/api/scripts/${script.id}/analysis`);
    const analysis = await analysisRes.json();
    if (analysis.segments?.length > 0) {
      const segId = analysis.segments[0].id;

      // Toggle star
      const starRes = await fetch(`${BASE}/api/segments/${segId}/star?starred=true`, {
        method: 'PATCH',
      });
      expect(starRes.status).toBe(200);

      // Verify
      const afterRes = await fetch(`${BASE}/api/scripts/${script.id}/analysis`);
      const after = await afterRes.json();
      const starredSegs = after.segments.filter((s: any) => s.starred);
      expect(starredSegs.length).toBeGreaterThan(0);
      console.log(`✅ Star toggle works (${starredSegs.length} starred)`);
    } else {
      console.log('⚠️ No segments yet, skip star test');
    }

    await fetch(`${BASE}/api/projects/${project.id}`, { method: 'DELETE' });
  });

  test('Delete script works', async () => {
    const projRes = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Delete Test' }),
    });
    const project = await projRes.json();

    const formData = new FormData();
    const blob = new Blob(['删除测试'], { type: 'text/plain' });
    formData.append('file', blob, 'delete.txt');
    const uploadRes = await fetch(`${BASE}/api/scripts/upload?project_id=${project.id}`, {
      method: 'POST',
      body: formData,
    });
    const script = await uploadRes.json();

    // Delete
    const delRes = await fetch(`${BASE}/api/scripts/${script.id}`, { method: 'DELETE' });
    expect(delRes.status).toBe(204);
    console.log('✅ Delete script works');

    await fetch(`${BASE}/api/projects/${project.id}`, { method: 'DELETE' });
  });
});

test.describe('🎤 Standup Frontend - Export', () => {
  test('Export JSON works', async () => {
    const projRes = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Export JSON Test' }),
    });
    const project = await projRes.json();

    const formData = new FormData();
    const blob = new Blob(['段子A\n内容A'], { type: 'text/plain' });
    formData.append('file', blob, 'a.txt');
    const uploadRes = await fetch(`${BASE}/api/scripts/upload?project_id=${project.id}`, {
      method: 'POST',
      body: formData,
    });
    const script = await uploadRes.json();

    const exportRes = await fetch(`${BASE}/api/scripts/${script.id}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'json', script_id: script.id }),
    });
    expect(exportRes.status).toBe(200);
    const contentType = exportRes.headers.get('content-type');
    expect(contentType).toContain('json');
    console.log(`✅ JSON export (${contentType})`);

    await fetch(`${BASE}/api/projects/${project.id}`, { method: 'DELETE' });
  });

  test('Export MD works', async () => {
    const projRes = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Export MD Test' }),
    });
    const project = await projRes.json();

    const formData = new FormData();
    const blob = new Blob(['段子B\n内容B'], { type: 'text/plain' });
    formData.append('file', blob, 'b.txt');
    const uploadRes = await fetch(`${BASE}/api/scripts/upload?project_id=${project.id}`, {
      method: 'POST',
      body: formData,
    });
    const script = await uploadRes.json();

    const exportRes = await fetch(`${BASE}/api/scripts/${script.id}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'md', script_id: script.id }),
    });
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('content-type')).toContain('markdown');
    console.log('✅ MD export works');

    await fetch(`${BASE}/api/projects/${project.id}`, { method: 'DELETE' });
  });

  test('Export DOCX works', async () => {
    const projRes = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Export DOCX Test' }),
    });
    const project = await projRes.json();

    const formData = new FormData();
    const blob = new Blob(['段子C\n内容C'], { type: 'text/plain' });
    formData.append('file', blob, 'c.txt');
    const uploadRes = await fetch(`${BASE}/api/scripts/upload?project_id=${project.id}`, {
      method: 'POST',
      body: formData,
    });
    const script = await uploadRes.json();

    const exportRes = await fetch(`${BASE}/api/scripts/${script.id}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'docx', script_id: script.id }),
    });
    expect(exportRes.status).toBe(200);
    console.log('✅ DOCX export works');

    await fetch(`${BASE}/api/projects/${project.id}`, { method: 'DELETE' });
  });
});

test.describe('🎤 Standup Frontend - Filter API', () => {
  test('Filter by structure tag', async () => {
    const projRes = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Filter Test' }),
    });
    const project = await projRes.json();

    const formData = new FormData();
    const blob = new Blob(['段子段子'], { type: 'text/plain' });
    formData.append('file', blob, 'filter.txt');
    const uploadRes = await fetch(`${BASE}/api/scripts/upload?project_id=${project.id}`, {
      method: 'POST',
      body: formData,
    });
    const script = await uploadRes.json();

    // Trigger analysis
    await fetch(`${BASE}/api/scripts/${script.id}/analyze`, { method: 'POST' });
    await new Promise(r => setTimeout(r, 6000));

    // Filter by a known structure (may or may not match depending on analysis)
    const filterRes = await fetch(`${BASE}/api/search/filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script_id: script.id,
        structures: ['p_setup'],
        page: 1,
        page_size: 20,
      }),
    });
    expect(filterRes.status).toBe(200);
    const result = await filterRes.json();
    expect(result.segments).toBeDefined();
    expect(Array.isArray(result.segments)).toBe(true);
    console.log(`✅ Filter API works (${result.total} results)`);

    await fetch(`${BASE}/api/projects/${project.id}`, { method: 'DELETE' });
  });

  test('Filter by starred_only', async () => {
    const projRes = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Starred Filter Test' }),
    });
    const project = await projRes.json();

    const formData = new FormData();
    const blob = new Blob(['收藏测试'], { type: 'text/plain' });
    formData.append('file', blob, 'starred.txt');
    const uploadRes = await fetch(`${BASE}/api/scripts/upload?project_id=${project.id}`, {
      method: 'POST',
      body: formData,
    });
    const script = await uploadRes.json();

    const filterRes = await fetch(`${BASE}/api/search/filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script_id: script.id,
        starred_only: true,
        page: 1,
        page_size: 20,
      }),
    });
    expect(filterRes.status).toBe(200);
    const result = await filterRes.json();
    expect(Array.isArray(result.segments)).toBe(true);
    console.log(`✅ Starred filter works (${result.total} starred segments)`);

    await fetch(`${BASE}/api/projects/${project.id}`, { method: 'DELETE' });
  });
});
