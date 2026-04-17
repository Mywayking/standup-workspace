import { chromium } from 'playwright';

const MATERIAL = '我知道老妈查出来乳腺癌，我特别难受，啊，我在公司的阳台哭了一个小时。我眼泪止不住我下流。啊。好，我不想失去他，我想20年以后我可能还会这样，但是我现在太早了，我接受不了。';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto('https://ai.alwayshaha.art/write', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // ─── Step 1: 提炼前提 ───────────────────────────────────────────
  console.log('【步骤1】提炼前提');
  await page.locator('textarea').first().fill(MATERIAL);
  await page.locator('button:has-text("开始提炼")').click();

  try {
    // Wait for either "⭐ 推荐前提" or "推荐前提" text to appear
    await page.waitForSelector('text="推荐前提"', { timeout: 120000 });
    const recEl = await page.locator('text="推荐前提"').first().locator('..').textContent().catch(() => '');
    console.log('✅ 提炼前提完成');
    console.log('  内容片段:', recEl.slice(0, 150).replace(/\s+/g, ' ').trim());

    await page.screenshot({ path: '/tmp/final_step1.png', fullPage: true });

    // Click "用这个前提找角度"
    await page.locator('button:has-text("用这个前提找角度")').click();
    await page.waitForTimeout(1500);

    // ─── Step 2: 找角度 ───────────────────────────────────────────
    console.log('\n【步骤2】找角度');
    await page.locator('button:has-text("开始找角度")').click();

    try {
      // Wait for "新角度" or any angle result
      await page.waitForSelector('text="新角度"', { timeout: 120000 });
      console.log('✅ 找角度完成');

      const anglesText = await page.locator('text="新角度"').locator('..').textContent().catch(() => '');
      console.log('  内容片段:', anglesText.slice(0, 150).replace(/\s+/g, ' ').trim());

      await page.screenshot({ path: '/tmp/final_step2.png', fullPage: true });

      // Click "用这个角度改稿"
      await page.locator('button:has-text("用这个角度改稿")').click();
      await page.waitForTimeout(1500);

      // ─── Step 3: 改稿 ───────────────────────────────────────────
      console.log('\n【步骤3】改稿');
      await page.locator('button:has-text("开始分析")').click();

      try {
        await page.waitForSelector('text="improved_script"', { timeout: 120000 });
        console.log('✅ 改稿完成');
        await page.screenshot({ path: '/tmp/final_step3.png', fullPage: true });
      } catch {
        // Check if any result text is visible
        const hasResult = await page.locator('text="分析"').or(page.locator('text="技巧"')).or(page.locator('text="结构"')).first().isVisible().catch(() => false);
        console.log(hasResult ? '✅ 改稿完成' : '⚠️ 改稿未识别');
        await page.screenshot({ path: '/tmp/final_step3.png', fullPage: true });
      }
    } catch {
      console.log('  找角度超时');
      await page.screenshot({ path: '/tmp/final_step2.png', fullPage: true });
    }
  } catch (e) {
    console.log('❌ 提炼前提失败:', e.message);
    await page.screenshot({ path: '/tmp/final_error.png', fullPage: true });
  }

  console.log('\n控制台错误:', errors.length > 0 ? errors.map(e => e.slice(0, 200)) : '无');
  await browser.close();
  console.log('🎉 全部完成');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
