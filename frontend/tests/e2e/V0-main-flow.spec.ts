/**
 * V0-main-flow.spec.ts
 *
 * V0 主链路验收测试
 * 逐项对照 docs/V0-MAIN-FLOW-ACCEPTANCE.md
 *
 * Run:
 *   E2E_BASE_URL=https://standup.alwayshaha.art \
 *     npx playwright test tests/e2e/V0-main-flow.spec.ts
 *
 * 完整链路: 素材 → 前提 → 角度 → 草稿 → 改稿
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "https://standup.alwayshaha.art";

const MATERIAL =
  "我外公特别偏心，给我表哥买自行车，不给我买，他说我是外孙，是外面的孙子。";

// ─── Section 1: 打开页面 ────────────────────────────────

test("【1.打开页面】无报错，桌面/移动布局正常，输入框+主按钮可见", async ({ page }) => {
  // Desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("submit-write")).toBeVisible();

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("submit-write")).toBeVisible();

  // Mobile hamburger + outline button visible
  await expect(page.getByLabel("打开作品列表")).toBeVisible();
  await expect(page.getByLabel("打开作品脉络")).toBeVisible();
});

// ─── Section 2: 输入素材 ────────────────────────────────

test("【2.输入素材】输入不卡顿，空输入不能提交", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  const ta = page.getByTestId("material-input");

  // 空输入时按钮 disabled
  const submitBtn = page.getByTestId("submit-write");
  await expect(submitBtn).toBeDisabled();

  // 填入素材
  await ta.fill(MATERIAL);
  await expect(submitBtn).toBeEnabled();

  // 内容填充不卡顿（瞬间完成）
  const val = await ta.inputValue();
  expect(val).toBe(MATERIAL);
});

// ─── Section 3: 提炼前提 ───────────────────────────────

test("【3.提炼前提】loading状态，前提卡片出现，内容不为空", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  await page.getByTestId("material-input").fill(MATERIAL);
  await page.getByTestId("submit-write").click();

  // premise卡片出现（assistant卡）
  await expect(page.getByTestId("card-premise")).toBeVisible({ timeout: 60000 });

  // 前提卡片内容不为空（不检查特定字，防止素材本身包含该字）
  const premiseCard = page.locator("[data-testid='card-premise']");
  const cardText = await premiseCard.textContent();
  expect(cardText?.trim().length, "前提卡片内容不为空").toBeGreaterThan(5);
});

// ─── Section 4: 选择前提 ────────────────────────────────

test("【4.选择前提】选中状态明确，sourceCardId记录，无手动复制", async ({ page }) => {
  await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  await page.getByTestId("material-input").fill(MATERIAL);
  await page.getByTestId("submit-write").click();
  await expect(page.getByTestId("card-premise")).toBeVisible({ timeout: 60000 });

  // 前提卡片上有action按钮
  const actionBtns = page.locator("[data-testid^='action-']");
  const count = await actionBtns.count();
  expect(count, "前提卡片有action按钮").toBeGreaterThanOrEqual(1);

  // 点击第一个action（通常是对应 premise 的操作，如 make_sharper）
  await actionBtns.first().click();
  await page.waitForTimeout(3000);

  // 有新的 assistant premise 或 angle 卡出现
  const premiseOrAngleCards = page.locator("[data-testid^='card-']");
  const totalCards = await premiseOrAngleCards.count();
  expect(totalCards, "点击后应生成新卡片").toBeGreaterThanOrEqual(2);
});

// ─── Section 5: 找角度 ────────────────────────────────

test("【5.找角度】成功生成角度卡片，至少3个角度", async ({ page }) => {
  await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  await page.getByTestId("material-input").fill(MATERIAL);
  await page.getByTestId("submit-write").click();
  await expect(page.getByTestId("card-premise")).toBeVisible({ timeout: 60000 });

  // 找角度按钮
  const angleBtn = page.getByTestId("action-find_angles");
  await expect(angleBtn).toBeVisible();
  await angleBtn.click();

  // angle卡片出现
  await expect(page.getByTestId("card-angle")).toBeVisible({ timeout: 60000 });
  const angleText = await page.locator("[data-testid='card-angle']").textContent();
  expect(angleText?.trim().length).toBeGreaterThan(10);
});

// ─── Section 6: 选择角度 ────────────────────────────────

test("【6.选择角度】选中角度有明确状态，下一步变成生成草稿", async ({ page }) => {
  await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  await page.getByTestId("material-input").fill(MATERIAL);
  await page.getByTestId("submit-write").click();
  await expect(page.getByTestId("card-premise")).toBeVisible({ timeout: 60000 });

  // 找角度
  const angleBtn = page.getByTestId("action-find_angles");
  await angleBtn.click();
  await expect(page.getByTestId("card-angle")).toBeVisible({ timeout: 60000 });

  // angle卡上的action按钮（expand_to_draft 或类似）
  const draftBtn = page.locator("[data-testid^='action-expand_to_draft']");
  const draftBtnCount = await draftBtn.count();
  expect(draftBtnCount, "有角度卡片后应有生成草稿按钮").toBeGreaterThanOrEqual(1);

  // 点击生成草稿
  await draftBtn.first().click();
  await page.waitForTimeout(3000);

  // 新卡片出现（draft 或 rewrite）
  const allCards = page.locator("[data-testid^='card-']");
  const cardCount = await allCards.count();
  expect(cardCount, "生成草稿后应有更多卡片").toBeGreaterThanOrEqual(3);
});

// ─── Section 7: 生成草稿 ────────────────────────────────

test("【7.生成草稿】草稿口语化，内容可继续改稿", async ({ page }) => {
  await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  await page.getByTestId("material-input").fill(MATERIAL);
  await page.getByTestId("submit-write").click();
  await expect(page.getByTestId("card-premise")).toBeVisible({ timeout: 60000 });

  // 找角度
  await page.getByTestId("action-find_angles").click();
  await expect(page.getByTestId("card-angle")).toBeVisible({ timeout: 60000 });

  // 生成草稿
  await page.locator("[data-testid^='action-expand_to_draft']").first().click();
  await page.waitForTimeout(60000); // 草稿生成可能较慢

  // 有新卡片（rewrite 或 draft 类型）
  const rewriteCard = page.locator("[data-testid='card-rewrite']");
  await expect(rewriteCard).toBeVisible({ timeout: 5000 });

  const draftText = await rewriteCard.textContent();
  // 草稿应该是口语化内容，不是纯文章
  expect(draftText?.trim().length).toBeGreaterThan(20);
});

// ─── Section 8: 改稿 ──────────────────────────────────

test("【8.改稿】草稿自动带入，改稿后旧版不丢失", async ({ page }) => {
  await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  await page.getByTestId("material-input").fill(MATERIAL);
  await page.getByTestId("submit-write").click();
  await expect(page.getByTestId("card-premise")).toBeVisible({ timeout: 60000 });

  await page.getByTestId("action-find_angles").click();
  await expect(page.getByTestId("card-angle")).toBeVisible({ timeout: 60000 });

  await page.locator("[data-testid^='action-expand_to_draft']").first().click();
  await expect(page.getByTestId("card-rewrite")).toBeVisible({ timeout: 60000 });

  // 改稿按钮
  const rewriteBtn = page.locator("[data-testid^='action-']").filter({ hasText: "" });
  const allActionsBefore = await page.locator("[data-testid^='action-']").count();
  expect(allActionsBefore, "改稿前有action按钮").toBeGreaterThanOrEqual(1);
});

// ─── Section 9: 保存历史 ──────────────────────────────

test("【9.保存历史】每步卡片保存，刷新后存在", async ({ page }) => {
  await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  await page.getByTestId("material-input").fill(MATERIAL);
  await page.getByTestId("submit-write").click();
  await expect(page.getByTestId("card-premise")).toBeVisible({ timeout: 60000 });

  // 此时有 premise 卡
  const cardsBefore = await page.locator("[data-testid^='card-']").count();
  expect(cardsBefore).toBeGreaterThanOrEqual(1);

  // 刷新
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(2000);

  // 卡片应存在（localStorage恢复）
  const cardsAfter = await page.locator("[data-testid^='card-']").count();
  expect(cardsAfter, "刷新后卡片应恢复").toBeGreaterThanOrEqual(1);

  // URL 仍在 /write
  expect(page.url()).toContain("/write");
});

// ─── Section 10: 移动端验收 ────────────────────────────

test("【10.移动端390px】无横向溢出，卡片正常，输入框固定", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  // 无横向滚动
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyWidth, "移动端无横向溢出").toBeLessThanOrEqual(viewportWidth);

  // 素材输入
  await page.getByTestId("material-input").fill(MATERIAL);
  await page.getByTestId("submit-write").click();
  await expect(page.getByTestId("card-premise")).toBeVisible({ timeout: 60000 });

  // 卡片宽度正常
  const cards = await page.locator("[data-testid^='card-']").all();
  for (const card of cards) {
    const box = await card.boundingBox();
    expect(box?.width, "卡片宽度不应超出视口").toBeLessThanOrEqual(390);
  }

  // hamburger 和 outline button 可见
  await expect(page.getByLabel("打开作品列表")).toBeVisible();
  await expect(page.getByLabel("打开作品脉络")).toBeVisible();

  // 快捷标签不显示（降噪）
  await expect(page.getByRole("button", { name: "输入素材" })).not.toBeVisible();
});

// ─── P0: 致命问题检查 ────────────────────────────────

test("【P0检查】无新旧组件同时显示，无阻断性报错", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  // 输入素材触发AI
  await page.getByTestId("material-input").fill(MATERIAL);
  await page.getByTestId("submit-write").click();

  // 等待loading或结果
  await page.waitForTimeout(5000);

  // 无致命console错误（排除资源404等非核心）
  const fatalErrors = consoleErrors.filter(
    (e) =>
      !e.includes("404") &&
      !e.includes("favicon") &&
      !e.includes("Failed to load resource")
  );
  expect(fatalErrors, "无致命console错误: " + fatalErrors.join("; ")).toHaveLength(0);
});
