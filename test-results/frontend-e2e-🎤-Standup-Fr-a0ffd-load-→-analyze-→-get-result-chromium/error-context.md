# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend-e2e.spec.ts >> 🎤 Standup Frontend - Full Analysis Workflow >> create project → upload → analyze → get result
- Location: frontend-e2e.spec.ts:115:7

# Error details

```
TypeError: fetch failed
```

# Test source

```ts
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
> 170 |     await fetch(`${BASE}/api/projects/${projectId}`, { method: 'DELETE' });
      |     ^ TypeError: fetch failed
  171 |     console.log('✅ Cleanup done');
  172 |   });
  173 | 
  174 |   test('Segment star toggle works', async () => {
  175 |     // Create project + script
  176 |     const projRes = await fetch(`${BASE}/api/projects`, {
  177 |       method: 'POST',
  178 |       headers: { 'Content-Type': 'application/json' },
  179 |       body: JSON.stringify({ name: 'Star Toggle Test' }),
  180 |     });
  181 |     const project = await projRes.json();
  182 | 
  183 |     const formData = new FormData();
  184 |     const blob = new Blob(['测试段子内容。'], { type: 'text/plain' });
  185 |     formData.append('file', blob, 'star.txt');
  186 |     const uploadRes = await fetch(`${BASE}/api/scripts/upload?project_id=${project.id}`, {
  187 |       method: 'POST',
  188 |       body: formData,
  189 |     });
  190 |     const script = await uploadRes.json();
  191 | 
  192 |     // Trigger analysis first
  193 |     await fetch(`${BASE}/api/scripts/${script.id}/analyze`, { method: 'POST' });
  194 |     await new Promise(r => setTimeout(r, 5000));
  195 | 
  196 |     // Get segments
  197 |     const analysisRes = await fetch(`${BASE}/api/scripts/${script.id}/analysis`);
  198 |     const analysis = await analysisRes.json();
  199 |     if (analysis.segments?.length > 0) {
  200 |       const segId = analysis.segments[0].id;
  201 | 
  202 |       // Toggle star
  203 |       const starRes = await fetch(`${BASE}/api/segments/${segId}/star?starred=true`, {
  204 |         method: 'PATCH',
  205 |       });
  206 |       expect(starRes.status).toBe(200);
  207 | 
  208 |       // Verify
  209 |       const afterRes = await fetch(`${BASE}/api/scripts/${script.id}/analysis`);
  210 |       const after = await afterRes.json();
  211 |       const starredSegs = after.segments.filter((s: any) => s.starred);
  212 |       expect(starredSegs.length).toBeGreaterThan(0);
  213 |       console.log(`✅ Star toggle works (${starredSegs.length} starred)`);
  214 |     } else {
  215 |       console.log('⚠️ No segments yet, skip star test');
  216 |     }
  217 | 
  218 |     await fetch(`${BASE}/api/projects/${project.id}`, { method: 'DELETE' });
  219 |   });
  220 | 
  221 |   test('Delete script works', async () => {
  222 |     const projRes = await fetch(`${BASE}/api/projects`, {
  223 |       method: 'POST',
  224 |       headers: { 'Content-Type': 'application/json' },
  225 |       body: JSON.stringify({ name: 'Delete Test' }),
  226 |     });
  227 |     const project = await projRes.json();
  228 | 
  229 |     const formData = new FormData();
  230 |     const blob = new Blob(['删除测试'], { type: 'text/plain' });
  231 |     formData.append('file', blob, 'delete.txt');
  232 |     const uploadRes = await fetch(`${BASE}/api/scripts/upload?project_id=${project.id}`, {
  233 |       method: 'POST',
  234 |       body: formData,
  235 |     });
  236 |     const script = await uploadRes.json();
  237 | 
  238 |     // Delete
  239 |     const delRes = await fetch(`${BASE}/api/scripts/${script.id}`, { method: 'DELETE' });
  240 |     expect(delRes.status).toBe(204);
  241 |     console.log('✅ Delete script works');
  242 | 
  243 |     await fetch(`${BASE}/api/projects/${project.id}`, { method: 'DELETE' });
  244 |   });
  245 | });
  246 | 
  247 | test.describe('🎤 Standup Frontend - Export', () => {
  248 |   test('Export JSON works', async () => {
  249 |     const projRes = await fetch(`${BASE}/api/projects`, {
  250 |       method: 'POST',
  251 |       headers: { 'Content-Type': 'application/json' },
  252 |       body: JSON.stringify({ name: 'Export JSON Test' }),
  253 |     });
  254 |     const project = await projRes.json();
  255 | 
  256 |     const formData = new FormData();
  257 |     const blob = new Blob(['段子A\n内容A'], { type: 'text/plain' });
  258 |     formData.append('file', blob, 'a.txt');
  259 |     const uploadRes = await fetch(`${BASE}/api/scripts/upload?project_id=${project.id}`, {
  260 |       method: 'POST',
  261 |       body: formData,
  262 |     });
  263 |     const script = await uploadRes.json();
  264 | 
  265 |     const exportRes = await fetch(`${BASE}/api/scripts/${script.id}/export`, {
  266 |       method: 'POST',
  267 |       headers: { 'Content-Type': 'application/json' },
  268 |       body: JSON.stringify({ format: 'json', script_id: script.id }),
  269 |     });
  270 |     expect(exportRes.status).toBe(200);
```