import { chromium } from 'playwright';
const MATERIAL = '我知道老妈查出来乳腺癌，我特别难受，啊，我在公司的阳台哭了一个小时。我眼泪止不住我下流。啊。好，我不想失去他，我想20年以后我可能还会这样，但是我现在太早了，我接受不了。';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(120000);
await page.goto('https://ai.alwayshaha.art/write', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// Step 1: Fill and submit
await page.locator('textarea').first().fill(MATERIAL);
await page.locator('button:has-text("开始提炼")').click();

// Wait up to 2 min for results
try {
  await page.waitForSelector('text="推荐前提"', { timeout: 120000 });
  await page.screenshot({ path: '/tmp/s1_done.png', fullPage: true });
  console.log('Step1 done, screenshot saved');
} catch {
  // Take whatever screenshot we have
  await page.screenshot({ path: '/tmp/s1_state.png', fullPage: true });
  const body = await page.locator('body').innerText();
  console.log('Step1 timeout. Body:', body.slice(0, 300));
}

// Step 2: navigate to angles if button exists
try {
  await page.locator('button:has-text("用这个前提找角度")').click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("开始找角度")').click();
  await page.waitForSelector('text="新角度"', { timeout: 120000 });
  await page.screenshot({ path: '/tmp/s2_done.png', fullPage: true });
  console.log('Step2 done');
} catch {
  await page.screenshot({ path: '/tmp/s2_state.png', fullPage: true });
  const body = await page.locator('body').innerText();
  console.log('Step2 state:', body.slice(0, 200));
}

// Step 3: navigate to rewrite
try {
  await page.locator('button:has-text("用这个角度改稿")').click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("开始分析")').click();
  await page.waitForSelector('text="improved_script"', { timeout: 120000 });
  await page.screenshot({ path: '/tmp/s3_done.png', fullPage: true });
  console.log('Step3 done');
} catch {
  await page.screenshot({ path: '/tmp/s3_state.png', fullPage: true });
  const body = await page.locator('body').innerText();
  console.log('Step3 state:', body.slice(0, 200));
}

await browser.close();
console.log('Done');
