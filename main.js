import { GameAudio } from './audio.js';
import { createRun, updateRun, PLAYER_Y } from './engine.js';

const $ = id => document.getElementById(id);
const canvas = $('game-canvas');
const ctx = canvas.getContext('2d');
const keys = new Set();
const pointers = new Map();
const mapping = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'boost', KeyW: 'boost', Space: 'boost', ArrowDown: 'brake', KeyS: 'brake' };
const sprites = {};
const spriteURLs = {
  car: new URL('./assets/car.svg', import.meta.url).href,
  barrier: new URL('./assets/barrier.svg', import.meta.url).href,
  charge: new URL('./assets/charge.svg', import.meta.url).href
};
for (const name of ['car', 'barrier', 'charge']) {
  sprites[name] = new Image();
  sprites[name].src = spriteURLs[name];
  sprites[name].onload = () => render();
}
let state = 'menu';
let run = createRun();
let best = 0;
try { best = Math.max(0, Math.floor(Number(localStorage.getItem('zer0lane_highscore')) || 0)); } catch { /* Play remains available when storage is blocked. */ }
let width = 0, height = 0, lastTime = 0, accumulator = 0, messageUntil = 0;
const audio = new GameAudio();
const particles = [];
let impact = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function clearInput() {
  keys.clear(); pointers.clear();
  document.querySelectorAll('[data-control]').forEach(b => b.classList.remove('pressed'));
}
function inputState() {
  const actions = new Set([...keys].map(key => mapping[key]));
  for (const action of pointers.values()) actions.add(action);
  return Object.fromEntries(['left', 'right', 'boost', 'brake'].map(action => [action, actions.has(action)]));
}
function updateSoundButton() {
  $('sound-label').textContent = audio.enabled ? 'ON' : 'OFF';
  $('sound-toggle').setAttribute('aria-pressed', String(audio.enabled));
  $('sound-toggle').setAttribute('aria-label', audio.enabled ? 'Mute sound' : 'Enable sound');
}
async function unlockAudio() { await audio.unlock(); updateSoundButton(); }
$('sound-toggle').addEventListener('click', async () => {
  await audio.toggle(); updateSoundButton();
  if (state === 'playing') canvas.focus({ preventScroll: true });
});
function feedback(kind) {
  audio.effect(kind);
  if (reducedMotion) return;
  if (kind === 'hit') impact = 0.32;
  const count = kind === 'hit' ? 18 : kind === 'charge' ? 12 : 6;
  for (let i = 0; i < count && particles.length < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 100;
    particles.push({ x: run.x, y: PLAYER_Y, vx: Math.cos(angle) * speed / 400,
      vy: Math.sin(angle) * speed, life: 0.45, color: kind === 'hit' ? '#f47e70' : '#8ceee0' });
  }
}
function start(practice = false) {
  audio.stop(); particles.length = 0; impact = 0;
  clearInput(); run = createRun(practice); state = 'playing'; accumulator = 0;
  $('overlay').hidden = true; $('pause-button').disabled = false;
  $('mode-label').textContent = practice ? 'PRACTICE RUN' : 'NIGHT RUN';
  $('game-status').textContent = practice ? 'PRACTICE / SCORES ARE NOT SAVED' : 'FIND YOUR LINE';
  $('pause-button').setAttribute('aria-label', 'Pause game');
  $('run-message').textContent = '';
  document.body.classList.add('playing');
  resize(); canvas.focus({ preventScroll: true });
  unlockAudio();
}
function showOverlay(kicker, title, copy, primary, secondary) {
  $('overlay-kicker').textContent = kicker;
  const [firstLine, secondLine] = title.replace('</em>', '').split('<br><em>');
  const emphasis = document.createElement('em');
  emphasis.textContent = secondLine || '';
  $('overlay-title').replaceChildren(document.createTextNode(firstLine), document.createElement('br'), emphasis);
  $('overlay-copy').textContent = copy;
  $('start-button').firstChild.textContent = primary + ' ';
  $('practice-button').textContent = secondary;
  $('start-hint').textContent = state === 'paused' ? 'ESC TO RESUME' : 'A FRESH ROAD. ANOTHER SHOT.';
  $('overlay').hidden = false;
  $('start-button').focus({ preventScroll: true });
}
function pause() {
  if (state !== 'playing' && state !== 'paused') return;
  clearInput(); accumulator = 0;
  if (state === 'paused') {
    unlockAudio();
    state = 'playing'; $('overlay').hidden = true; $('game-status').textContent = run.practice ? 'PRACTICE / SCORES ARE NOT SAVED' : 'FIND YOUR LINE'; canvas.focus({ preventScroll: true });
  } else {
    audio.stop();
    state = 'paused'; $('game-status').textContent = 'RUN PAUSED';
    showOverlay('TAKE YOUR TIME', 'Road can<br><em>wait.</em>', 'Your run is right where you left it.', 'KEEP DRIVING', 'End run');
  }
  $('pause-button').setAttribute('aria-label', state === 'paused' ? 'Resume game' : 'Pause game');
}
function finish(abandoned = false) {
  audio.stop(abandoned);
  state = 'over'; clearInput(); $('pause-button').disabled = true;
  const score = Math.floor(run.score), newBest = !run.practice && score > best;
  if (newBest) {
    best = score;
    try { localStorage.setItem('zer0lane_highscore', String(best)); } catch { /* The best score remains available for this session. */ }
  }
  $('game-status').textContent = 'RUN COMPLETE';
  showOverlay(newBest ? 'A NEW PERSONAL BEST' : run.practice ? 'PRACTICE COMPLETE' : 'THAT’S YOUR RUN', abandoned ? 'Clocking<br><em>out.</em>' : 'End of<br><em>the road.</em>', `${score.toLocaleString()} points · ${Math.floor(run.distance)} m · ${run.nearMisses} near misses`, 'GO AGAIN', run.practice ? 'Back to night run' : 'Warm up in practice');
  updateHUD();
}
$('start-button').addEventListener('click', () => state === 'paused' ? pause() : start(state === 'over' && run.practice));
$('practice-button').addEventListener('click', () => state === 'paused' ? finish(true) : start(state === 'over' ? !run.practice : true));
$('pause-button').addEventListener('click', pause);
window.addEventListener('keydown', event => {
  if (event.code === 'Escape' || event.code === 'KeyP') { if (!event.repeat) pause(); return; }
  if (!mapping[event.code] || state !== 'playing') return;
  if (event.code === 'Space' && event.target instanceof HTMLButtonElement) return;
  event.preventDefault(); keys.add(event.code);
}, { passive: false });
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { clearInput(); if (state === 'playing') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (state === 'playing') pause(); } });
for (const button of document.querySelectorAll('[data-control]')) {
  button.addEventListener('pointerdown', event => {
    if (state !== 'playing') return;
    event.preventDefault(); button.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, button.dataset.control); button.classList.add('pressed');
  });
  const release = event => {
    pointers.delete(event.pointerId);
    if (![...pointers.values()].includes(button.dataset.control)) button.classList.remove('pressed');
  };
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
}
function resize() {
  const box = canvas.getBoundingClientRect(); width = box.width; height = box.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); render();
}
new ResizeObserver(resize).observe($('track'));
function updateHUD() {
  $('score').textContent = String(Math.floor(run.score)).padStart(6, '0');
  $('distance').textContent = Math.floor(run.distance).toLocaleString();
  $('speed').textContent = state === 'menu' ? '0' : Math.round(run.speed * .48);
  $('boost-fill').style.width = run.energy + '%';
  $('best').textContent = String(best).padStart(6, '0');
}
function sprite(name, x, y, w, h) {
  const image = sprites[name];
  if (image?.complete && image.naturalWidth) ctx.drawImage(image, x - w / 2, y - h / 2, w, h);
}
function render() {
  if (!width || !height) return;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0e171a'; ctx.fillRect(0, 0, width, height);
  const roadWidth = Math.min(width * .75, 430), left = (width - roadWidth) / 2;
  const scale = height / 800, carScale = Math.min(roadWidth / 400, scale * 1.3);
  const offset = (run.distance / .075 * scale) % 65;
  ctx.fillStyle = '#151e21'; ctx.fillRect(left, 0, roadWidth, height);
  ctx.lineWidth = 1;
  for (let side = 0; side < 2; side++) {
    const edge = side ? left + roadWidth : left;
    ctx.strokeStyle = '#507d75'; ctx.beginPath(); ctx.moveTo(edge, 0); ctx.lineTo(edge, height); ctx.stroke();
    ctx.strokeStyle = '#243c39'; ctx.beginPath(); ctx.moveTo(edge + (side ? 7 : -7), 0); ctx.lineTo(edge + (side ? 7 : -7), height); ctx.stroke();
    for (let y = offset - 65; y < height; y += 65) {
      ctx.fillStyle = '#233833'; ctx.fillRect(edge + (side ? 17 : -21), y, 4, 18);
    }
  }
  ctx.strokeStyle = '#2c3b3d'; ctx.setLineDash([22, 43]); ctx.lineDashOffset = -offset;
  for (let lane = 1; lane < 5; lane++) {
    const x = left + lane * roadWidth / 5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  ctx.setLineDash([]);
  if (state === 'menu') {
    sprite('barrier', left + roadWidth * .3, height * .23, 58 * carScale, 29 * carScale);
    sprite('barrier', left + roadWidth * .9, height * .65, 58 * carScale, 29 * carScale);
    sprite('charge', left + roadWidth * .7, height * .39, 30 * carScale, 30 * carScale);
  } else {
    for (const obstacle of run.obstacles) sprite('barrier', left + obstacle.x * roadWidth, obstacle.y * scale, 58 * carScale, 29 * carScale);
    for (const cell of run.cells) sprite('charge', left + cell.x * roadWidth, cell.y * scale, 30 * carScale, 30 * carScale);
  }
  const x = left + run.x * roadWidth, y = PLAYER_Y * scale;
  if (state !== 'menu') {
    if (run.boosting && state === 'playing' && !reducedMotion) {
      const gradient = ctx.createLinearGradient(0, y + 25 * carScale, 0, y + 115 * carScale);
      gradient.addColorStop(0, '#8ceee080'); gradient.addColorStop(1, '#8ceee000');
      ctx.fillStyle = gradient; ctx.fillRect(x - 12 * carScale, y + 25 * carScale, 24 * carScale, 90 * carScale);
    }
    ctx.save(); ctx.translate(x, y);
    if (!reducedMotion) { const input = inputState(); ctx.rotate((Number(input.right) - Number(input.left)) * .09); }
    ctx.shadowColor = '#8ceee050'; ctx.shadowBlur = 16;
    if (run.invincible > 0 && Math.floor(run.elapsed * 8) % 2) ctx.globalAlpha = .4;
    sprite('car', 0, 0, 40 * carScale, 73 * carScale); ctx.restore();
  }
  for (const p of particles) {
    ctx.globalAlpha = p.life / 0.45; ctx.fillStyle = p.color;
    ctx.fillRect(left + p.x * roadWidth, p.y * scale, 2, 3);
  }
  ctx.globalAlpha = 1;
  if (impact > 0) {
    ctx.strokeStyle = `rgba(244,126,112,${impact / 0.32 * 0.65})`;
    ctx.lineWidth = 4; ctx.strokeRect(2, 2, width - 4, height - 4);
  }
  const shade = ctx.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, '#09111490'); shade.addColorStop(.25, '#09111400'); shade.addColorStop(1, '#09111430');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, width, height);
}
function frame(time) {
  const dt = Math.min((time - (lastTime || time)) / 1000, .05); lastTime = time;
  if (state === 'playing') {
    accumulator += dt;
    while (accumulator >= 1 / 120 && state === 'playing') {
      const events = updateRun(run, inputState(), 1 / 120); accumulator -= 1 / 120;
      for (const event of events) {
        feedback(event);
        $('run-message').textContent = event === 'near' ? 'CLOSE CALL +100' : event === 'charge' ? 'BOOST REFILLED +50' : 'HIT / KEEP PRACTISING';
        messageUntil = time + 1300;
      }
      if (run.ended) finish();
    }
    if (state === 'playing') audio.update(run, inputState());
    updateHUD();
  }
  if (state !== 'paused') {
    impact = Math.max(0, impact - dt);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  if (time > messageUntil) $('run-message').textContent = '';
  render(); requestAnimationFrame(frame);
}
updateSoundButton(); updateHUD(); resize(); requestAnimationFrame(frame);
