export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function createRun(practice = false) {
  return { practice, x: 0.5, distance: 0, score: 0, elapsed: 0, speed: 0, energy: 100, boosting: false, obstacles: [], cells: [], spawnIn: 1.2, rows: 0, invincible: 0, ended: false, nearMisses: 0 };
}
// Coordinates use a fixed logical road. Rendering scales without changing physics.
export const ROAD_WIDTH = 400;
export const PLAYER_Y = 600;
export function updateRun(run, input, dt, random = Math.random) {
  if (run.ended) return [];
  const events = [];
  run.elapsed += dt;
  run.invincible = Math.max(0, run.invincible - dt);
  const steering = Number(input.right) - Number(input.left);
  run.x = clamp(run.x + steering * 0.92 * dt, 0.065, 0.935);
  run.boosting = input.boost && !input.brake && run.energy > 0;
  run.energy = clamp(run.energy + (run.boosting ? -34 : 12) * dt, 0, 100);
  const base = Math.min(420, 235 + run.distance * 0.08);
  const target = input.brake ? base * 0.52 : run.boosting ? base * 1.6 : base;
  run.speed += (target - run.speed) * (1 - Math.exp(-7 * dt));
  const travel = run.speed * dt;
  run.distance += travel * 0.075;
  run.score += travel * 0.3;
  run.spawnIn -= dt;
  if (run.spawnIn <= 0) {
    run.rows++;
    const freeLane = Math.floor(random() * 5);
    const candidates = [0, 1, 2, 3, 4].filter(lane => lane !== freeLane);
    const count = run.distance > 300 && random() > 0.5 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const index = Math.floor(random() * candidates.length);
      const lane = candidates.splice(index, 1)[0];
      run.obstacles.push({ x: (lane + 0.5) / 5, y: -50, passed: false });
    }
    if (run.rows % 3 === 0) run.cells.push({ x: (freeLane + 0.5) / 5, y: -50 });
    // Keep consecutive rows far enough apart to cross the road at top speed.
    run.spawnIn = Math.max(1.05, 1.65 - run.distance / 1800);
  }
  for (const obstacle of run.obstacles) {
    const previousY = obstacle.y;
    obstacle.y += travel;
    const dx = Math.abs(obstacle.x - run.x) * ROAD_WIDTH;
    if (!obstacle.passed && previousY < PLAYER_Y + 46 && obstacle.y >= PLAYER_Y - 46 && dx < 40 && run.invincible === 0) {
      obstacle.passed = true;
      events.push('hit');
      if (run.practice) { run.invincible = 1.3; run.score = Math.max(0, run.score - 100); }
      else { run.ended = true; return events; }
    }
    if (!obstacle.passed && obstacle.y > PLAYER_Y + 46) {
      obstacle.passed = true;
      if (dx >= 40 && dx < 73) { run.score += 100; run.nearMisses++; events.push('near'); }
    }
  }
  for (const cell of run.cells) {
    const previousY = cell.y;
    cell.y += travel;
    if (!cell.collected && previousY < PLAYER_Y + 42 && cell.y > PLAYER_Y - 42 && Math.abs(cell.x - run.x) * ROAD_WIDTH < 32) {
      cell.collected = true; run.energy = clamp(run.energy + 35, 0, 100); run.score += 50; events.push('charge');
    }
  }
  run.obstacles = run.obstacles.filter(o => o.y < 850);
  run.cells = run.cells.filter(c => c.y < 850 && !c.collected);
  return events;
}
