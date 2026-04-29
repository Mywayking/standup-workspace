/**
 * V0-real-user-materials.spec.ts
 *
 * V0 真实用户体验探查 — 3条脱口秀素材
 *
 * Run:
 *   E2E_BASE_URL=https://standup.alwayshaha.art \
 *     npx playwright test tests/e2e/V0-real-user-materials.spec.ts
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "https://standup.alwayshaha.art";

const MATERIALS = [
  {
    id: "亲情偏心",
    text: "我外公特别偏心，给我表哥买自行车，不给我买。他说我是外孙，是外面的孙子。",
  },
  {
    id: "职场吐槽",
    text: "公司天天说拥抱变化，但每次变化都是让员工拥抱，老板负责变化。",
  },
  {
    id: "AI程序员",
    text: "现在 AI 写代码越来越快，我感觉程序员不是被淘汰，是被升级成 AI 的产品经理。",
  },
];

for (const mat of MATERIALS) {
  test(`[${mat.id}] 完整链路探查`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });

    await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
    await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

    // Step 1: 填入素材
    await page.getByTestId("material-input").fill(mat.text);
    const submitEnabled = await page.getByTestId("submit-write").isEnabled();
    expect(submitEnabled, "提交按钮可点击").toBe(true);

    // Step 2: 提炼前提
    await page.getByTestId("submit-write").click();
    await expect(page.getByTestId("card-premise")).toBeVisible({ timeout: 60000 });

    // Step 3: 找角度
    const angleBtn = page.getByTestId("action-find_angles");
    await expect(angleBtn, "有找角度按钮").toBeVisible();
    await angleBtn.click();
    await expect(page.getByTestId("card-angle")).toBeVisible({ timeout: 60000 });

    // Step 4: 生成草稿
    const draftBtn = page.locator("[data-testid^='action-expand_to_draft']").first();
    await expect(draftBtn, "有生成草稿按钮").toBeVisible();
    await draftBtn.click();

    // 草稿出现
    await expect(page.getByTestId("card-rewrite")).toBeVisible({ timeout: 60000 });
    const draftText = await page.locator("[data-testid='card-rewrite']").textContent();

    // Step 5: 改稿
    const rewriteActions = page.locator("[data-testid^='action-']");
    const actionCount = await rewriteActions.count();
    // eslint-disable-next-line no-console
    console.log(`[${mat.id}] 改稿前action按钮数量: ${actionCount}`);

    // 记录卡片总数
    const cards = page.locator("[data-testid^='card-']");
    const cardCount = await cards.count();
    // eslint-disable-next-line no-console
    console.log(`[${mat.id}] 最终卡片数量: ${cardCount}`);

    // 检查无致命错误
    const fatalErrors = consoleErrors.filter(
      (e) => !e.includes("404") && !e.includes("favicon") && !e.includes("Failed to load")
    );
    expect(fatalErrors, `${mat.id} 无致命错误`).toHaveLength(0);
  });
}

// ─── 移动端 390px 探查 ────────────────────────────────

test("【移动端390px】亲情素材 — 键盘弹起后输入框状态", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  // 输入素材
  await page.getByTestId("material-input").fill(MATERIALS[0].text);

  // 聚焦输入框（模拟键盘弹起）
  await page.getByTestId("material-input").focus();
  await page.waitForTimeout(500);

  // 提交按钮仍可点击
  await expect(page.getByTestId("submit-write")).toBeEnabled();

  // 提交后 premise 生成
  await page.getByTestId("submit-write").click();
  await expect(page.getByTestId("card-premise")).toBeVisible({ timeout: 60000 });

  // 找角度
  await page.getByTestId("action-find_angles").click();
  await expect(page.getByTestId("card-angle")).toBeVisible({ timeout: 60000 });

  // 生成草稿
  await page.locator("[data-testid^='action-expand_to_draft']").first().click();
  await expect(page.getByTestId("card-rewrite")).toBeVisible({ timeout: 60000 });

  // 无横向溢出
  const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyScrollWidth, "移动端无横向溢出").toBeLessThanOrEqual(viewportWidth);
});

// ─── 来源关系感知探查 ─────────────────────────────────

test("【来源感知】desktop侧边栏显示作品脉络", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  await page.getByTestId("material-input").fill(MATERIALS[0].text);
  await page.getByTestId("submit-write").click();
  await expect(page.getByTestId("card-premise")).toBeVisible({ timeout: 60000 });

  await page.getByTestId("action-find_angles").click();
  await expect(page.getByTestId("card-angle")).toBeVisible({ timeout: 60000 });

  // 右侧面板应该可见（lg+）
  // 检查"创作进度"面板存在（可能匹配多个元素，取第一个可见的）
  const outlinePanel = page.locator("text=创作进度").first();
  await expect(outlinePanel, "右侧有创作进度面板").toBeVisible();

  // 左侧面板（作品列表）
  const sidebar = page.locator("text=作品列表").or(page.locator("text=新的作品"));
  // 有则好，无则记录（session未创建时可不显示）
});

// ─── 文案困惑探查 ────────────────────────────────────

test("【文案困惑】检查按钮文案是否清晰", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/write`, { waitUntil: "load", timeout: 15000 });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  // 空白状态下检查 placeholder 文案
  const placeholder = await page.getByTestId("material-input").getAttribute("placeholder");
  // eslint-disable-next-line no-console
  console.log("Input placeholder:", placeholder);

  // 填写后检查按钮文案
  await page.getByTestId("material-input").fill(MATERIALS[0].text);
  const submitText = await page.getByTestId("submit-write").textContent();
  // eslint-disable-next-line no-console
  console.log("Submit button text:", submitText);

  await page.getByTestId("submit-write").click();
  await expect(page.getByTestId("card-premise")).toBeVisible({ timeout: 60000 });

  // premise 卡上的 action 文案
  const actionBtns = page.locator("[data-testid^='action-']");
  const count = await actionBtns.count();
  for (let i = 0; i < count; i++) {
    const txt = await actionBtns.nth(i).textContent();
    // eslint-disable-next-line no-console
    console.log(`Action button ${i}:`, txt);
  }
});
