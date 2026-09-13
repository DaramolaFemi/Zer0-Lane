import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    window.audioContexts = [];
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.audioContexts.push(this); }
    };
  });
  await page.goto('http://127.0.0.1:5173');
  assert.match(await page.locator('footer').textContent(), /Designed by Daramola Femi/);
  assert.equal(await page.locator('#sound-label').textContent(), 'ON');
  await page.locator('#practice-button').click();
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.audioContexts[0].state), 'running');
  await page.locator('#sound-toggle').click();
  assert.equal(await page.locator('#sound-label').textContent(), 'OFF');
  await page.locator('#sound-toggle').click();
  assert.equal(await page.evaluate(() => window.audioContexts.length), 1);
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#overlay').isVisible());
  // Exercise real Web Audio rendering, cleanup, and bounded allocation independently.
  const result = await page.evaluate(async () => {
    const { GameAudio } = await import('/audio.js');
    const audio = new GameAudio(); await audio.unlock();
    const analyser = audio.ctx.createAnalyser(); analyser.fftSize = 256; audio.master.connect(analyser);
    const samples = new Float32Array(256);
    const level = () => { analyser.getFloatTimeDomainData(samples); return Math.max(...samples.map(Math.abs)); };
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const run = { speed: 300, boosting: false };
    audio.update(run, { left: true, right: false, brake: false }); await sleep(160);
    const driving = level();
    const motor = audio.motor;
    for (let i = 0; i < 5000; i++) audio.update(run, { left: false, right: true, brake: false });
    const reused = audio.motor === motor;
    audio.stop(); await sleep(200); const paused = level();
    const levels = {};
    for (const kind of ['hit', 'charge', 'near']) {
      audio.effect(kind); await sleep(45); levels[kind] = level(); await sleep(500);
    }
    for (let i = 0; i < 100; i++) audio.effect('charge');
    const capped = audio.voices.size;
    await sleep(650); const remaining = audio.voices.size;
    audio.effect('charge'); await audio.toggle(); await sleep(100);
    const muted = level();
    await audio.ctx.close();
    return { driving, reused, paused, levels, capped, remaining, muted };
  });
  assert.ok(result.driving > .001);
  assert.ok(result.paused < .0001);
  assert.ok(result.muted < .0001);
  assert.ok(result.reused);
  assert.ok(Object.values(result.levels).every(level => level > .001));
  assert.ok(result.capped <= 10);
  assert.equal(result.remaining, 0);
  assert.deepEqual(errors, []);
  console.log('Audio checks passed: audible driving/crash/bonuses, pause/mute silence, reusable engine, capped voices, automatic cleanup, footer credit.');
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
