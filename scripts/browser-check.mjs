import { chromium, webkit, firefox } from '@playwright/test';
import assert from 'node:assert/strict';
const engine = process.env.BROWSER || 'chromium';
const browser = await ({ chromium, webkit, firefox }[engine]).launch({ ...(engine === 'chromium' && process.env.CI !== 'true' ? { channel: 'chrome' } : {}), headless: true });
const errors = [];
async function check(width, height, touch = false) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch && engine !== 'firefox' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  await page.locator('#start-button').waitFor();
  assert.match(await page.title(), /Zer0 Lane/);
  assert.ok(await page.locator('.design-credit').isVisible());
  await page.screenshot({ path: `/tmp/zer0-lane-menu-${width}.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#practice-button').click();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#overlay').isVisible(), false);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(150); await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(250); await page.keyboard.up('ArrowUp');
  assert.ok(parseFloat(await page.locator('#boost-fill').evaluate(el => el.style.width)) < 100);
  if (touch) {
    await page.locator('[data-control="left"]').evaluate(button => {
      button.addEventListener('pointerdown', event => { window.testPointerId = event.pointerId; }, { once: true });
    });
    const box = await page.locator('[data-control="left"]').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.locator('[data-control="left"]').dispatchEvent('pointercancel', { pointerId: await page.evaluate(() => window.testPointerId), pointerType: 'mouse', bubbles: true });
    assert.ok(!(await page.locator('[data-control="left"]').getAttribute('class') || '').includes('pressed'));
    await page.mouse.up();
  }
  await page.screenshot({ path: `/tmp/zer0-lane-playing-${width}.png`, fullPage: true });
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#overlay').isVisible());
  const pausedScore = await page.locator('#score').textContent();
  await page.waitForTimeout(150); assert.equal(await page.locator('#score').textContent(), pausedScore);
  await page.locator('#start-button').click(); assert.equal(await page.locator('#overlay').isVisible(), false);
  await page.keyboard.press('Escape'); await page.locator('#practice-button').click();
  assert.equal(await page.locator('#game-status').textContent(), 'RUN COMPLETE');
  await page.locator('#start-button').click();
  await page.setViewportSize({ width: height, height: width });
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await context.close();
}
try { await check(1440, 1000); await check(390, 844, true); await check(320, 640, true); await check(768, 1024, true); await check(844, 390, true); await check(1920, 1080); assert.deepEqual(errors, []); console.log('Browser checks passed: desktop, mobile, tablet, landscape, narrow mobile, keyboard, boost, pause, retry, resize, no runtime errors.'); }
finally { await browser.close(); }
