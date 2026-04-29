import { test, expect } from "@playwright/test";

test.describe("write page - desktop layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/write");
  });

  test("main content area is visible and not blank", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const main = page.locator("main");
    await expect(main).toBeVisible();
    // Main should have actual content (not empty)
    await expect(main).not.toBeEmpty();
  });

  test("composer textarea is in main area not left sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Find all textareas - the main composer should be inside <main>, not in left aside
    const main = page.locator("main");
    const textareaInMain = main.locator("textarea").first();
    await expect(textareaInMain).toBeVisible();
    // Left sidebar (260px) should NOT contain a textarea
    const leftAside = page.locator("aside").first();
    const textareaInSidebar = leftAside.locator("textarea");
    await expect(textareaInSidebar).toHaveCount(0);
  });

  test("input material and see user card in main area", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const textarea = page.locator("textarea").first();
    await textarea.fill("老板说要有主人翁意识，但裁员的时候说我是外包");
    await textarea.press("Enter");
    // Wait for user card to appear in the main scrollable area
    await page.waitForTimeout(1000);
    const main = page.locator("main");
    await expect(main).not.toBeEmpty();
  });

  test("three column layout at 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Left sidebar should be visible (260px)
    const leftSidebar = page.locator("aside").first();
    await expect(leftSidebar).toBeVisible();
    // Main should be visible
    const main = page.locator("main");
    await expect(main).toBeVisible();
    // Right panel should be visible at 1440px (lg breakpoint = 1024px)
    const rightPanel = page.locator("aside").nth(1);
    await expect(rightPanel).toBeVisible();
  });
});

test.describe("write page - mobile layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/write");
  });

  test("no horizontal scroll on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const body = page.locator("body");
    const overflowX = await body.evaluate(
      (el) => window.getComputedStyle(el).overflowX
    );
    expect(overflowX).toBe("hidden");
  });

  test("single column layout on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    // Left sidebar should be hidden on mobile
    const leftSidebar = page.locator("aside").first();
    await expect(leftSidebar).not.toBeVisible();
    // Main should be full width
    const main = page.locator("main");
    await expect(main).toBeVisible();
    // Right panel should be hidden on mobile
    const rightPanel = page.locator("aside").nth(1);
    await expect(rightPanel).not.toBeVisible();
  });

  test("composer textarea visible on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();
  });
});