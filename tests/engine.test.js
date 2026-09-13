import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, updateRun, PLAYER_Y } from '../engine.js';
const idle = { left: false, right: false, boost: false, brake: false };
function advance(run, input, seconds, hz = 120) {
  for (let i = 0; i < seconds * hz; i++) updateRun(run, { ...idle, ...input }, 1 / hz, () => .1);
}
test('left and right respond on the first update, cancel together, and respect road edges', () => {
  const run = createRun();
  updateRun(run, { ...idle, left: true }, 1 / 120); assert.ok(run.x < .5);
  const left = run.x; updateRun(run, { ...idle, right: true }, 1 / 120); assert.ok(run.x > left);
  const center = run.x; updateRun(run, { ...idle, right: true, left: true }, 1 / 120); assert.equal(run.x, center);
  advance(run, { left: true }, 1); assert.equal(run.x, .065);
  advance(run, { right: true }, 1); assert.equal(run.x, .935);
});
test('steering is independent of refresh rate and does not drift after release', () => {
  const a = createRun(), b = createRun();
  advance(a, { right: true }, .25, 60); advance(b, { right: true }, .25, 120);
  assert.ok(Math.abs(a.x - b.x) < .0001);
  const x = a.x; advance(a, {}, .5); assert.equal(a.x, x);
});
test('boost consumes energy, brake reduces speed, and energy recharges', () => {
  const normal = createRun(), boosted = createRun(), braked = createRun();
  advance(normal, {}, 1); advance(boosted, { boost: true }, 1); advance(braked, { brake: true }, 1);
  assert.ok(boosted.speed > normal.speed); assert.ok(braked.speed < normal.speed);
  assert.ok(boosted.energy < 70); const energy = boosted.energy; advance(boosted, {}, .5); assert.ok(boosted.energy > energy);
});
test('collision ends a normal run, while practice continues', () => {
  for (const practice of [false, true]) {
    const run = createRun(practice); run.obstacles.push({ x: .5, y: PLAYER_Y - 40, passed: false });
    assert.ok(updateRun(run, idle, 1 / 120).includes('hit')); assert.equal(run.ended, !practice);
  }
});
test('cells refill boost once and near misses score only once', () => {
  const run = createRun(); run.energy = 20; run.cells.push({ x: .5, y: PLAYER_Y, collected: false });
  assert.ok(updateRun(run, idle, 1 / 120).includes('charge')); assert.ok(run.energy > 55); assert.equal(run.cells.length, 0);
  run.obstacles.push({ x: .65, y: PLAYER_Y + 47, passed: false });
  assert.ok(updateRun(run, idle, 1 / 120).includes('near'));
  assert.ok(!updateRun(run, idle, 1 / 120).includes('near')); assert.equal(run.nearMisses, 1);
});
test('spawning leaves an open lane and bounds objects over long runs', () => {
  const run = createRun(true); advance(run, {}, 180);
  assert.ok(run.obstacles.length < 20); assert.ok(run.cells.length < 10); assert.ok(run.energy >= 0 && run.energy <= 100);
});
