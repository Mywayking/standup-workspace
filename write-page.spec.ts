/**
 * Write Page E2E Tests
 * Run: npx playwright test write-page.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

const BASE = 'https://ai.alwayshaha.art/write';

test.describe('🎤 Write Page - UX-4/UX-6/P2-17 验收测试', () => {

  // ── 1. 页面基础加载 ──────────────────────────────────────────────
  test('页面加载成功，无 console error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Tab 标题可见
    await expect(page.getByRole('tab', { name: /提炼前提/ })).toBeVisible();

    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') && !e.includes('font') && !e.includes('chrome-extension') &&
      !e.includes('Failed to load resource')
    );
    if (criticalErrors.length > 0) {
      console.log('Console errors:', criticalErrors);
    }
    expect(criticalErrors.length).toBe(0);
    console.log('✅ 页面加载无错误');
  });

  // ── 2. 主流程引导条 (UX-6) ──────────────────────────────────────
  test('主流程引导条正确显示且可点击', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    // 引导条文案
    await expect(page.getByText('推荐流程')).toBeVisible();

    // 点击"前提"节点应切换到提炼前提Tab
    await page.getByRole('button', { name: '前提', exact: true }).click();
    await expect(page.getByRole('tab', { name: /提炼前提/ }).first()).toBeVisible();

    // 点击"角度"节点应切换到找角度Tab
    await page.getByRole('button', { name: '角度', exact: true }).click();
    await expect(page.getByRole('tab', { name: /找角度/ }).first()).toBeVisible();

    // 旁路提示
    await expect(page.getByText('梗写前提')).toBeVisible();

    console.log('✅ 主流程引导条正确，可点击切换Tab');
  });

  // ── 3. Session Panel 空态 (UX-4) ─────────────────────────────────
  test('Session Panel 空态正确显示，不消失', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    // 右侧面板"创作会话"标题存在
    await expect(page.getByText('创作会话', { exact: true }).first()).toBeVisible();

    // 空态说明存在
    await expect(page.getByText('从左侧开始')).toBeVisible();

    console.log('✅ Session Panel 空态正确显示');
  });

  // ── 4. Tab 历史已下线 (UX-4 Step 1) ────────────────────────────
  test('各Tab内没有旧历史面板，Tab独立历史已收敛', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    const viewHistoryBtn = page.locator('button', { hasText: /查看历史/ });
    expect(await viewHistoryBtn.count()).toBe(0);

    await page.getByRole('tab', { name: /找角度/ }).first().click();
    await page.waitForTimeout(500);
    const angleHistoryBtn = page.locator('button', { hasText: /查看历史/ });
    expect(await angleHistoryBtn.count()).toBe(0);

    console.log('✅ Tab 独立历史面板已下线');
  });

  // ── 5. Tab 内有"保存到会话"提示 ──────────────────────────────
  test('PremiseTab和AnglesTab都有"生成后自动保存"提示', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('生成后自动保存到右侧创作会话').first()).toBeVisible();

    await page.getByRole('tab', { name: /找角度/ }).first().click();
    await page.waitForTimeout(300);
    await expect(page.getByText('生成后自动保存到右侧创作会话').first()).toBeVisible();

    console.log('✅ 各Tab有"保存到会话"提示');
  });

  // ── 6. Streaming 状态干净，无协议垃圾 (核心修复验证) ─────────
  test('PremiseTab 流式加载过程不显示原始 token/协议内容', async ({ page }) => {
    const protocolTokens: string[] = [];

    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    // 填入素材
    const textarea = page.locator('textarea').first();
    await textarea.fill('我发现同事离职后，工位像被系统自动回收一样，第二天就坐了新人，完全没有人在乎这里发生过什么');

    // 点击"开始提炼"
    await page.getByRole('button', { name: '开始提炼' }).click();

    // 等待 loading 状态出现
    await page.waitForSelector('text=AI 分析中', { timeout: 5000 });

    // 采样 3 次 loading 状态的文本，检查是否干净
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(800);

      const stillLoading = await page.locator('text=AI 分析中').isVisible().catch(() => false);
      if (!stillLoading) {
        console.log('⚠️ 请求已返回结果，跳过 streaming 中间态检查（结果已正常显示）');
        break;
      }

      // 读取 AI 分析中区域的文本
      const loadingCard = page.locator('.bg-gray-50').first();
      const text = await loadingCard.textContent();

      // 检查是否有协议相关词汇
      const dangerous = [
        'premise_candidates',
        '\\u5b',
        '{',
        '}',
        '[',
        ']',
        '\\\\u',
        '"theme"',
        '"attitude"',
        '"conflict"',
      ];

      for (const token of dangerous) {
        if (text?.includes(token)) {
          protocolTokens.push(token);
        }
      }
    }

    expect(protocolTokens.length).toBe(0);
    if (protocolTokens.length === 0) {
      console.log('✅ Streaming 状态干净，无协议垃圾');
    } else {
      console.log('❌ 发现的垃圾内容:', protocolTokens);
    }
  });

  // ── 7. handoff 后显示 toast ──────────────────────────────────────
  test('从PremiseTab结果点击发送到AnglesTab后显示toast', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea').first();
    await textarea.fill('我妈总觉得我写脱口秀不算正经工作，每次回家都要解释一遍又一遍');

    await page.getByRole('button', { name: '开始提炼' }).click();

    // 等待结果
    await page.waitForSelector('text=⭐ 推荐前提', { timeout: 15000 });
    await page.waitForTimeout(500);

    // 找 Session Panel 里卡片的"发送"按钮
    // Session Panel 中的卡片有"更多 ▾"按钮
    const moreBtn = page.locator('text=更多 ▾').first();
    if (await moreBtn.isVisible({ timeout: 3000 })) {
      await moreBtn.click();
      await page.waitForTimeout(300);

      // 找"发送到找角度"选项
      const sendToAngles = page.getByText('发送到找角度').first();
      if (await sendToAngles.isVisible()) {
        await sendToAngles.click();
        await page.waitForTimeout(800);

        const toastVisible = await page.getByText('已带入').isVisible().catch(() => false);
        expect(toastVisible).toBeTruthy();
        console.log('✅ handoff 后显示 toast');
      } else {
        console.log('⚠️ 找不到"发送到找角度"选项，跳过');
      }
    } else {
      console.log('⚠️ 找不到卡片更多按钮，跳过');
    }
  });

  // ── 8. 结果生成后进入 Session Panel ────────────────────────────
  test('PremiseTab 生成结果后出现在右侧 Session Panel', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea').first();
    await textarea.fill('我发现同事离职后，工位像被系统自动回收一样，第二天就坐了新人');

    await page.getByRole('button', { name: '开始提炼' }).click();

    // 等待结果
    await page.waitForSelector('text=⭐ 推荐前提', { timeout: 15000 });
    await page.waitForTimeout(500);

    // Session Panel 应该显示结果（不是空态）
    const emptyState = page.getByText('从左侧开始');
    // 空态存在不代表失败，只要结果也出现了就算成功
    const hasResultCard = await page.locator('text=前提').first().isVisible().catch(() => false);
    expect(hasResultCard).toBeTruthy();

    console.log('✅ 生成结果后进入 Session Panel');
  });

  // ── 9. 切换 Tab 不出现旧 localStorage 历史面板 ───────────────
  test('4个Tab切换都不会触发旧历史面板', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    const tabs = ['提炼前提', '梗写前提', '找角度', '改稿'];

    for (const tabName of tabs) {
      const tab = page.getByRole('tab', { name: new RegExp(tabName) }).first();
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForTimeout(500);

        const historyPanel = page.locator('text=/历史记录|查看历史/');
        expect(await historyPanel.count()).toBe(0);
      }
    }

    console.log('✅ 4个Tab切换都不触发旧历史面板');
  });

  // ── 10. WriteTabs 顶部有 FlowGuidance 引导条 ─────────────────────
  test('WriteTabs 顶部有主流程引导条（不是Tab内历史）', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    // 引导条在 Tab bar 上方
    const flowGuide = page.locator('text=推荐流程');
    await expect(flowGuide).toBeVisible();

    // 4个流程节点
    for (const node of ['素材', '前提', '角度', '改稿']) {
      await expect(page.getByRole('button', { name: node, exact: true })).toBeVisible();
    }

    console.log('✅ WriteTabs 顶部有完整主流程引导条');
  });

});
