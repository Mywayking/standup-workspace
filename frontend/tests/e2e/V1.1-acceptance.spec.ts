/**
 * V1.1-acceptance.spec.ts
 *
 * V1.1 Phase 4.4 线上验收测试
 *
 * Run against V1.1 live:
 *   E2E_BASE_URL=https://970j9b2sw062.space.minimaxi.com npx playwright test tests/e2e/V1.1-acceptance.spec.ts
 *
 * Covers:
 * - 落地页 → 创作页
 * - 素材输入 → AI诊断
 * - 前提选择
 * - 项目列表
 * - 404 / ErrorBoundary
 * - 刷新恢复
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "https://970j9b2sw062.space.minimaxi.com";

async function landAt(page: any) {
  await page.goto(BASE, { waitUntil: "load", timeout: 15000 });
}

// ─── Tests ──────────────────────────────────────────────────

test("落地页 → 开始创作 → 素材输入", async ({ page }) => {
  await landAt(page);

  // 落地页验证
  await expect(page.locator("button", { hasText: "开始创作" })).toBeVisible();
  await expect(page.locator("button", { hasText: "我的段子" })).toBeVisible();

  // 点击开始创作
  await page.locator("button", { hasText: "开始创作" }).click();
  await page.waitForTimeout(2000);

  // 到达素材输入页
  await expect(page).toHaveURL(/\/create\/material/);
  await expect(page.locator("h1", { hasText: "素材输入" })).toBeVisible();
  await expect(page.locator("textarea")).toBeVisible();

  // 输入素材
  const MATERIAL = "今天早上闹钟没响，我迟到了半小时被罚款，心情很差。";
  await page.locator("textarea").fill(MATERIAL);

  // AI诊断按钮出现
  const aiBtn = page.locator("button", { hasText: "AI 诊断" });
  await expect(aiBtn).toBeVisible();

  // 点击AI诊断
  await aiBtn.click();
  await page.waitForTimeout(4000);

  // 诊断后出现继续按钮（提示前提选择）
  await expect(page.locator("button", { hasText: "前提选择" })).toBeVisible({ timeout: 8000 });
});

test("前提选择 → 角度选择", async ({ page }) => {
  // 从落地页导航
  await landAt(page);
  await page.locator("button", { hasText: "开始创作" }).click();
  await page.waitForTimeout(2000);

  // 输入素材
  const MATERIAL = "今天早上闹钟没响，我迟到了半小时被罚款，心情很差。";
  await page.locator("textarea").fill(MATERIAL);
  await page.locator("button", { hasText: "AI 诊断" }).click();

  // 等待AI诊断完成（出现继续按钮）
  await expect(page.locator("button", { hasText: "前提选择" }), "AI诊断完成").toBeVisible({ timeout: 60000 });

  // 进入前提选择
  await page.locator("button", { hasText: "继续" }).click();
  await page.waitForTimeout(3000);

  await expect(page).toHaveURL(/\/create\/premise/);
  await expect(page.locator("h1", { hasText: "前提选择" })).toBeVisible();

  // 选择第一个前提
  const premiseOpts = page.locator("button", { hasText: "☆" });
  const count = await premiseOpts.count();
  expect(count, "至少有1个前提选项").toBeGreaterThanOrEqual(1);
  await premiseOpts.first().click();
  await page.waitForTimeout(1000);

  // 前提被选中（变成星标）
  await expect(page.locator("button", { hasText: "⭐" })).toBeVisible();

  // 继续进入角度（如果UI允许）
  // V1.1目前选择前提后需手动进入下一步，此处验证前提选择可用
});

test("项目列表 → 我的段子", async ({ page }) => {
  await landAt(page);
  await page.locator("button", { hasText: "我的段子" }).click();
  await page.waitForTimeout(3000);

  await expect(page).toHaveURL(/\/projects/);
  await expect(page.locator("h1", { hasText: "我的段子" })).toBeVisible();
  await expect(page.locator("button", { hasText: "← 返回" })).toBeVisible();
});

test("404 页面显示落地页（SPA fallback）", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m: any) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(`${BASE}/not-exist-page-xyz`, { waitUntil: "load", timeout: 10000 });
  await page.waitForTimeout(1000);

  // SPA fallback：未定义路由应显示落地页而非白屏
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 100));
  expect(bodyText).toContain("手把手教你玩脱口秀");
  // 不应崩溃显示空白页
  expect(bodyText.length).toBeGreaterThan(50);
});

test("ErrorBoundary 不崩溃", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m: any) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(`${BASE}/create/nonexistent-step-xyz`, { waitUntil: "load", timeout: 10000 });
  await page.waitForTimeout(1000);

  // 应显示落地页而非崩溃
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 100));
  expect(bodyText).toContain("手把手教你玩脱口秀");
  expect(bodyText.length).toBeGreaterThan(50);
});

test("刷新恢复", async ({ page }) => {
  await landAt(page);
  await page.locator("button", { hasText: "开始创作" }).click();
  await page.waitForTimeout(2000);

  const MATERIAL = "测试刷新恢复：今天迟到了。";
  await page.locator("textarea").fill(MATERIAL);
  await page.locator("button", { hasText: "AI 诊断" }).click();

  // 等诊断完成
  await expect(page.locator("button", { hasText: "前提选择" }), "AI诊断完成").toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(1000);

  // 刷新页面
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(2000);

  // 应该恢复到之前的状态
  const url = page.url();
  // 页面应该还在创作流程中
  expect(url).toMatch(/\/create\/(material|premise|angles|punches|draft)/);
});
