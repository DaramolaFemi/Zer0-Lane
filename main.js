/**
 * NEON DRIFT - Complete Game Engine
 * A hyper-polished, addictive endless runner with flow-state mechanics
 */

const CONFIG = {
    targetFPS: 60, fixedTimestep: 1/60, maxSubSteps: 3,
    player: { width: 40, height: 40, baseSpeed: 8, maxSpeed: 28, acceleration: 0.15, driftPower: 0.35, driftRecovery: 0.08, boostPower: 4.5, boostDuration: 180, boostCooldown: 300, slowmoFactor: 0.3, slowmoDrain: 0.5, slowmoRecharge: 0.15, maxSlowmo: 100, invincibilityFrames: 60 },
    world: { laneCount: 5, laneWidth: 80, segmentLength: 2000, obstacleDensity: 0.15, powerupDensity: 0.08, speedIncreasePerKm: 0.5, maxSpeedMultiplier: 3.0 },
    flow: { max: 100, gainPerFrame: 0.08, driftBonus: 0.3, nearMissBonus: 2.0, perfectDriftBonus: 5.0, boostBonus: 1.0, decayPerFrame: 0.05, overdriveThreshold: 85, overdriveDrain: 0.3, overdriveMultiplier: 2.0 },
    scoring: { basePerMeter: 1, comboMultiplier: 0.1, maxComboMultiplier: 10, flowBonus: 0.5, overdriveBonus: 2.0, nearMissBonus: 100, perfectDriftBonus: 250 },
    visual: { trailLength: 30, particleCount: 200, screenShakeIntensity: 8 },
    colors: { bg: '#050508', road: '#0d0d14', roadLine: '#1a1a2e', neonCyan: '#00f0ff', neonPink: '#ff64c8', neonYellow: '#ffc800', neonGreen: '#00ff88', neonOrange: '#ff8800', neonPurple: '#bc64ff', neonRed: '#ff3366', white: '#ffffff', playerBody: '#00f0ff', playerGlow: '#00f0ff', obstacle: '#ff3366', powerup: '#00ff88', boostPad: '#ff64c8' }
};

const Utils = {
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    random: (min, max) => Math.random() * (max - min) + min,
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    choose: (arr) => arr[Math.floor(Math.random() * arr.length)],
    formatNumber: (num) => { if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'; if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'; return Math.floor(num).toString(); },
    formatDistance: (meters) => { if (meters >= 1000) return (meters / 1000).toFixed(1) + 'km'; return Math.floor(meters) + 'm'; },
    formatTime: (seconds) => { const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60); return m + ':' + s.toString().padStart(2, '0'); }
};

// ========================================
// INPUT MANAGER
// ========================================

class InputManager {
    constructor() {
        this.keys = new Set();
        this.keysPressed = new Set();
        this.touchState = { left: false, right: false, boost: false, slowmo: false };
        this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.vibrationSupported = 'vibrate' in navigator;
        this.bindEvents();
    }
    
    bindEvents() {
        window.addEventListener('keydown', (e) => {
            if (this.isGameKey(e.code)) { e.preventDefault(); this.keys.add(e.code); this.keysPressed.add(e.code); }
        }, { passive: false });
        window.addEventListener('keyup', (e) => {
            if (this.isGameKey(e.code)) { this.keys.delete(e.code); }
        });
        if (this.isMobile) this.bindTouchEvents();
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    isGameKey(code) {
        return ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyW','KeyS','Space','ShiftLeft','ShiftRight'].includes(code);
    }
    
    bindTouchEvents() {
        const mapping = { 'drift-left': 'left', 'drift-right': 'right', 'boost': 'boost', 'slowmo': 'slowmo' };
        Object.entries(mapping).forEach(([action, state]) => {
            const els = document.querySelectorAll('[data-action="' + action + '"]');
            els.forEach(el => {
                if (!el) return;
                const start = (e) => { e.preventDefault(); this.touchState[state] = true; el.classList.add('pressed'); };
                const end = (e) => { e.preventDefault(); this.touchState[state] = false; el.classList.remove('pressed'); };
                el.addEventListener('touchstart', start, { passive: false });
                el.addEventListener('touchend', end, { passive: false });
                el.addEventListener('touchcancel', end);
                el.addEventListener('mousedown', start);
                el.addEventListener('mouseup', end);
                el.addEventListener('mouseleave', end);
            });
        });
    }
    
    update() { this.keysPressed.clear(); }
    
    isPressed(action) {
        const keyMap = { left: ['ArrowLeft','KeyA'], right: ['ArrowRight','KeyD'], boost: ['Space','ArrowUp','KeyW'], slowmo: ['ShiftLeft','ShiftRight','KeyS','ArrowDown'] };
        if (keyMap[action]) for (const key of keyMap[action]) if (this.keys.has(key)) return true;
        return this.touchState[action] === true;
    }
    
    wasPressed(action) {
        const keyMap = { left: ['ArrowLeft','KeyA'], right: ['ArrowRight','KeyD'], boost: ['Space','ArrowUp','KeyW'], slowmo: ['ShiftLeft','ShiftRight','KeyS','ArrowDown'] };
        if (keyMap[action]) for (const key of keyMap[action]) if (this.keysPressed.has(key)) return true;
        return false;
    }
    
    vibrate(pattern) { if (this.vibrationSupported && pattern) navigator.vibrate(pattern); }
}

// ========================================
// AUDIO MANAGER
// ========================================

class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.enabled = true;
        this.volumes = { master: 0.7, sfx: 0.8 };
        this.initAudio();
    }
    
    initAudio() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            this.sfxGain.connect(this.masterGain);
            this.masterGain.gain.value = this.volumes.master;
            this.sfxGain.gain.value = this.volumes.sfx;
        } catch (e) { this.enabled = false; }
    }
    
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
    
    setVolume(type, value) {
        this.volumes[type] = Utils.clamp(value, 0, 1);
        if (this.masterGain) {
            if (type === 'master') this.masterGain.gain.value = this.volumes.master;
            else if (type === 'sfx') this.sfxGain.gain.value = this.volumes.sfx;
        }
    }
    
    playTone(frequency, duration, type, volume, delay) {
        if (!this.enabled || !this.ctx) return;
        type = type || 'sine'; volume = volume || 1; delay = delay || 0;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        gain.gain.value = volume * this.volumes.sfx;
        osc.connect(gain);
        gain.connect(this.sfxGain);
        const now = this.ctx.currentTime + delay;
        osc.start(now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume * this.volumes.sfx, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.stop(now + duration + 0.01);
    }
    
    playChord(freqs, duration, type, volume) {
        type = type || 'sine'; volume = volume || 1;
        freqs.forEach((f, i) => this.playTone(f, duration, type, volume / freqs.length, i * 0.02));
    }
    
    playBoost() { this.playChord([150, 300, 450, 600], 0.3, 'sawtooth', 0.2); }
    playSlowmoStart() { this.playChord([400, 300, 200], 0.5, 'sine', 0.15); }
    playSlowmoEnd() { this.playChord([200, 300, 400], 0.3, 'sine', 0.15); }
    playNearMiss() { this.playChord([800, 1000, 1200], 0.15, 'square', 0.3); this.playTone(2000, 0.1, 'sine', 0.2); }
    playHit() { this.playTone(100, 0.3, 'sawtooth', 0.5); this.playTone(80, 0.4, 'square', 0.3); }
    playCollect() { this.playTone(600, 0.2, 'sine', 0.3); }
    playDrift(intensity) { this.playTone(100 + intensity * 200, 0.05, 'sine', intensity * 0.08); }
}

// ========================================
// MAIN GAME CLASS
// ========================================

class NeonDrift {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 0;
        this.height = 0;
        this.resize();
        
        this.input = new InputManager();
        this.audio = new AudioManager();
        
        this.state = 'menu';
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('neondrift_highscore') || '0');
        this.totalRuns = parseInt(localStorage.getItem('neondrift_runs') || '0');
        this.totalDistance = parseInt(localStorage.getItem('neondrift_distance') || '0');
        this.bestFlow = parseInt(localStorage.getItem('neondrift_bestflow') || '0');
        this.playTime = parseInt(localStorage.getItem('neondrift_playtime') || '0');
        
        this.player = {
            x: 0, y: 0, width: CONFIG.player.width, height: CONFIG.player.height,
            speed: CONFIG.player.baseSpeed, lane: 2, targetLane: 2,
            driftDirection: 0, driftIntensity: 0,
            isBoosting: false, boostTimer: 0, boostCooldown: 0,
            isSlowmo: false, slowmoEnergy: CONFIG.player.maxSlowmo,
            invincible: 0, trail: []
        };
        
        this.flow = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.multiplier = 1;
        this.streak = 0;
        this.inFlow = false;
        this.inOverdrive = false;
        
        this.worldOffset = 0;
        this.distance = 0;
        this.obstacles = [];
        this.powerups = [];
        this.roadMarkings = [];
        this.particles = [];
        this.screenShake = { x: 0, y: 0, intensity: 0 };
        
        this.lastTime = 0;
        this.accumulator = 0;
        this.frameCount = 0;
        this.runTime = 0;
        
        this.settings = { quality: 'medium', screenShake: true, particles: true, trails: true, haptic: true };
        
        this.init();
        this.bindUI();
        this.gameLoop(0);
    }
    
    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }
    
    init() {
        window.addEventListener('resize', () => this.resize());
        this.generateRoad();
        this.updateHUD();
        this.updateStatsPreview();
    }
    
    bindUI() {
        document.getElementById('btn-start').addEventListener('click', () => this.startGame());
        document.getElementById('btn-practice').addEventListener('click', () => this.startGame(true));
        document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
        document.getElementById('btn-restart').addEventListener('click', () => this.startGame());
        document.getElementById('btn-quit').addEventListener('click', () => this.quitToMenu());
        document.getElementById('btn-retry').addEventListener('click', () => this.startGame());
        document.getElementById('btn-menu').addEventListener('click', () => this.quitToMenu());
        document.getElementById('btn-settings-back').addEventListener('click', () => this.closeSettings());
        
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') { if (this.state === 'playing') this.togglePause(); else if (this.state === 'paused') this.togglePause(); }
        });
        
        document.querySelectorAll('.toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const enabled = toggle.dataset.enabled === 'true';
                toggle.dataset.enabled = !enabled;
                toggle.classList.toggle('active');
                this.settings[toggle.id.replace('toggle-', '')] = !enabled;
            });
        });
        
        document.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', () => {
                const val = parseInt(slider.value) / 100;
                this.audio.setVolume(slider.id.replace('slider-', ''), val);
            });
        });
        
        document.getElementById('setting-quality').addEventListener('change', (e) => { this.settings.quality = e.target.value; });
        
        document.getElementById('btn-reset').addEventListener('click', () => {
            if (confirm('Reset all progress? This cannot be undone!')) {
                localStorage.clear();
                this.highScore = 0; this.totalRuns = 0; this.totalDistance = 0; this.bestFlow = 0; this.playTime = 0;
                this.updateStatsPreview();
                this.showNotification('Progress Reset');
            }
        });
    }
    
    startGame() {
        this.audio.resume();
        this.state = 'playing';
        this.score = 0; this.distance = 0; this.runTime = 0; this.combo = 0; this.maxCombo = 0;
        this.multiplier = 1; this.streak = 0; this.flow = 0; this.inFlow = false; this.inOverdrive = false;
        this.player.speed = CONFIG.player.baseSpeed; this.player.lane = 2; this.player.targetLane = 2;
        this.player.x = this.getLaneX(2); this.player.y = this.height * 0.75;
        this.player.driftDirection = 0; this.player.driftIntensity = 0;
        this.player.isBoosting = false; this.player.boostTimer = 0; this.player.boostCooldown = 0;
        this.player.isSlowmo = false; this.player.slowmoEnergy = CONFIG.player.maxSlowmo;
        this.player.invincible = 0; this.player.trail = [];
        this.obstacles = []; this.powerups = []; this.particles = [];
        this.screenShake.intensity = 0; this.worldOffset = 0; this.frameCount = 0;
        this.hideAllScreens(); this.generateRoad(); this.updateHUD();
    }
    
    togglePause() {
        if (this.state === 'playing') { this.state = 'paused'; document.getElementById('pause-screen').classList.add('active'); }
        else if (this.state === 'paused') { this.state = 'playing'; document.getElementById('pause-screen').classList.remove('active'); }
    }
    
    quitToMenu() {
        this.state = 'menu'; this.hideAllScreens();
        document.getElementById('start-screen').classList.add('active');
        this.updateStatsPreview();
    }
    
    closeSettings() {
        document.getElementById('settings-screen').classList.remove('active');
        if (this.state === 'menu') document.getElementById('start-screen').classList.add('active');
    }
    
    hideAllScreens() { document.querySelectorAll('.screen-overlay').forEach(s => s.classList.remove('active')); }
    
    gameOver() {
        this.state = 'gameover';
        this.totalRuns++;
        this.totalDistance += Math.floor(this.distance);
        this.playTime += Math.floor(this.runTime);
        if (this.flow > this.bestFlow) this.bestFlow = Math.floor(this.flow);
        localStorage.setItem('neondrift_highscore', Math.max(this.highScore, this.score));
        localStorage.setItem('neondrift_runs', this.totalRuns);
        localStorage.setItem('neondrift_distance', this.totalDistance);
        localStorage.setItem('neondrift_bestflow', this.bestFlow);
        localStorage.setItem('neondrift_playtime', this.playTime);
        if (this.score > this.highScore) { this.highScore = this.score; this.showNotification('NEW HIGH SCORE!'); }
        
        document.getElementById('final-score').textContent = Utils.formatNumber(this.score);
        document.getElementById('final-distance').textContent = Utils.formatDistance(this.distance);
        document.getElementById('final-combo').textContent = 'x' + this.maxCombo;
        document.getElementById('final-flow').textContent = Math.floor(this.flow) + '%';
        document.getElementById('final-time').textContent = Utils.formatTime(this.runTime);
        
        const rank = this.getRank(this.score);
        document.getElementById('rank-badge').textContent = rank.letter;
        document.getElementById('rank-badge').style.background = rank.color;
        document.getElementById('rank-name').textContent = rank.name;
        document.getElementById('rank-progress').textContent = rank.next;
        document.getElementById('game-over-screen').classList.add('active');
    }
    
    getRank(score) {
        if (score >= 50000) return { letter: 'S', name: 'LEGEND', next: 'Maximum rank achieved!', color: 'linear-gradient(135deg, #ffc800, #ff8800)' };
        if (score >= 25000) return { letter: 'A', name: 'MASTER', next: 'Score 50,000 for S Rank', color: 'linear-gradient(135deg, #00ff88, #00f0ff)' };
        if (score >= 10000) return { letter: 'B', name: 'EXPERT', next: 'Score 25,000 for A Rank', color: 'linear-gradient(135deg, #00f0ff, #bc64ff)' };
        if (score >= 5000) return { letter: 'C', name: 'ADVANCED', next: 'Score 10,000 for B Rank', color: 'linear-gradient(135deg, #bc64ff, #ff64c8)' };
        if (score >= 2000) return { letter: 'D', name: 'INTERMEDIATE', next: 'Score 5,000 for C Rank', color: 'linear-gradient(135deg, #ff64c8, #ff3366)' };
        return { letter: 'E', name: 'NOVICE', next: 'Score 2,000 for D Rank', color: 'linear-gradient(135deg, #ff3366, #ff8800)' };
    }
    
    getLaneX(lane) {
        const totalWidth = CONFIG.world.laneCount * CONFIG.world.laneWidth;
        return (this.width - totalWidth) / 2 + lane * CONFIG.world.laneWidth + CONFIG.world.laneWidth / 2;
    }
    
    generateRoad() {
        this.roadMarkings = [];
        for (let i = 0; i < 20; i++) this.roadMarkings.push({ y: i * (this.height / 10) });
    }
    
    spawnObstacle() {
        const lane = Utils.randomInt(0, CONFIG.world.laneCount - 1);
        this.obstacles.push({ x: this.getLaneX(lane), y: -60, lane: lane, width: Math.random() < 0.3 ? 60 : 30, height: 35, passed: false });
    }
    
    spawnPowerup() {
        const lane = Utils.randomInt(0, CONFIG.world.laneCount - 1);
        this.powerups.push({ x: this.getLaneX(lane), y: -40, lane: lane, width: 30, height: 30, type: Math.random() < 0.5 ? 'boost' : 'slowmo', collected: false });
    }
    
    spawnParticles(x, y, count, color, spread) {
        spread = spread || 50;
        if (!this.settings.particles) return;
        for (let i = 0; i < count; i++) {
            const angle = Utils.random(0, Math.PI * 2);
            const speed = Utils.random(2, 8);
            this.particles.push({ x: x + Utils.random(-spread, spread), y: y + Utils.random(-spread, spread), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2, life: 1, decay: Utils.random(0.01, 0.03), size: Utils.random(2, 6), color: color });
        }
    }
    
    showNotification(text, duration) {
        duration = duration || 2000;
        const container = document.getElementById('notifications');
        const el = document.createElement('div');
        el.className = 'notification'; el.textContent = text;
        container.appendChild(el);
        setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, duration);
    }
    
    showComboPopup(text) {
        const container = document.getElementById('combo-popups');
        const el = document.createElement('div');
        el.className = 'combo-popup'; el.textContent = text;
        container.appendChild(el);
        setTimeout(() => el.remove(), 600);
    }
    
    updateHUD() {
        document.getElementById('score-display').textContent = Utils.formatNumber(this.score);
        document.getElementById('best-display').textContent = Utils.formatNumber(this.highScore);
        document.getElementById('multiplier-display').textContent = 'x' + this.multiplier.toFixed(1);
        document.getElementById('streak-display').textContent = this.streak;
        document.getElementById('combo-display').textContent = this.combo;
        document.getElementById('speed-value').textContent = Math.floor(this.player.speed * 10);
        const flowPercent = (this.flow / CONFIG.flow.max) * 100;
        document.getElementById('flow-fill').style.width = flowPercent + '%';
        document.getElementById('flow-fill').className = 'flow-fill' + (this.inOverdrive ? ' overdrive' : this.inFlow ? ' flow-state' : '');
    }
    
    updateStatsPreview() {
        document.getElementById('total-runs').textContent = this.totalRuns;
        document.getElementById('total-distance').textContent = Utils.formatDistance(this.totalDistance);
        document.getElementById('best-flow').textContent = this.bestFlow + '%';
        document.getElementById('play-time').textContent = Utils.formatTime(this.playTime);
    }
    
    // ========================================
    // UPDATE
    // ========================================
    
    update(dt) {
        if (this.state !== 'playing') return;
        this.frameCount++; this.runTime += dt;
        
        const timeScale = this.player.isSlowmo ? CONFIG.player.slowmoFactor : 1;
        const adt = dt * timeScale;
        
        const driftLeft = this.input.isPressed('left');
        const driftRight = this.input.isPressed('right');
        const boost = this.input.isPressed('boost');
        const slowmo = this.input.isPressed('slowmo');
        
        // Drift
        if (driftLeft && !driftRight) { this.player.driftDirection = -1; this.player.driftIntensity = Math.min(1, this.player.driftIntensity + CONFIG.player.driftPower * adt); }
        else if (driftRight && !driftLeft) { this.player.driftDirection = 1; this.player.driftIntensity = Math.min(1, this.player.driftIntensity + CONFIG.player.driftPower * adt); }
        else { this.player.driftDirection = 0; this.player.driftIntensity = Math.max(0, this.player.driftIntensity - CONFIG.player.driftRecovery * adt); }
        
        if (this.player.driftDirection !== 0 && this.player.driftIntensity > 0.1) {
            this.player.targetLane = Utils.clamp(this.player.targetLane + this.player.driftDirection * 0.15 * adt, 0, CONFIG.world.laneCount - 1);
            if (this.frameCount % 5 === 0 && this.settings.particles) this.audio.playDrift(this.player.driftIntensity);
        }
        
        this.player.lane = Utils.lerp(this.player.lane, this.player.targetLane, 0.12 * adt);
        this.player.x = this.getLaneX(Math.round(this.player.lane));
        
        // Boost
        if (boost && this.player.boostCooldown <= 0 && !this.player.isBoosting) {
            this.player.isBoosting = true; this.player.boostTimer = CONFIG.player.boostDuration;
            this.player.boostCooldown = CONFIG.player.boostCooldown;
            this.audio.playBoost(); this.spawnParticles(this.player.x, this.player.y, 20, CONFIG.colors.neonPink);
            this.input.vibrate(50);
        }
        if (this.player.isBoosting) {
            this.player.boostTimer -= adt; this.player.speed += CONFIG.player.boostPower * adt;
            this.flow = Math.min(CONFIG.flow.max, this.flow + CONFIG.flow.boostBonus * adt);
            if (this.frameCount % 3 === 0) this.spawnParticles(this.player.x, this.player.y + 20, 3, CONFIG.colors.neonPink, 20);
            if (this.player.boostTimer <= 0) this.player.isBoosting = false;
        }
        if (this.player.boostCooldown > 0) this.player.boostCooldown -= adt;
        
        // Slow-mo
        if (slowmo && this.player.slowmoEnergy > 0) {
            if (!this.player.isSlowmo) this.audio.playSlowmoStart();
            this.player.isSlowmo = true;
            this.player.slowmoEnergy = Math.max(0, this.player.slowmoEnergy - CONFIG.player.slowmoDrain * adt);
        } else {
            if (this.player.isSlowmo) this.audio.playSlowmoEnd();
            this.player.isSlowmo = false;
            this.player.slowmoEnergy = Math.min(CONFIG.player.maxSlowmo, this.player.slowmoEnergy + CONFIG.player.slowmoRecharge * adt);
        }
        
        // Speed
        const speedMultiplier = Math.min(1 + (this.distance / 1000) * CONFIG.world.speedIncreasePerKm, CONFIG.world.maxSpeedMultiplier);
        if (!this.player.isBoosting) this.player.speed = Utils.lerp(this.player.speed, CONFIG.player.baseSpeed * speedMultiplier, CONFIG.player.acceleration * adt);
        
        const moveSpeed = this.player.speed * (this.player.isSlowmo ? CONFIG.player.slowmoFactor : 1);
        this.worldOffset += moveSpeed * adt;
        this.distance += moveSpeed * adt * 0.1;
        
        // Flow
        if (this.player.driftIntensity > 0.3) this.flow = Math.min(CONFIG.flow.max, this.flow + CONFIG.flow.driftBonus * this.player.driftIntensity * adt);
        this.flow = Math.max(0, this.flow - CONFIG.flow.decayPerFrame * adt);
        this.inFlow = this.flow > 30;
        this.inOverdrive = this.flow > CONFIG.flow.overdriveThreshold;
        if (this.inOverdrive) this.flow = Math.max(0, this.flow - CONFIG.flow.overdriveDrain * adt);
        
        // Combo & Multiplier
        this.multiplier = this.combo > 0 ? 1 + Math.min(this.combo * CONFIG.scoring.comboMultiplier, CONFIG.scoring.maxComboMultiplier) : 1;
        
        // Score
        const flowMult = this.inOverdrive ? CONFIG.scoring.overdriveBonus : (this.inFlow ? CONFIG.scoring.flowBonus : 1);
        this.score += CONFIG.scoring.basePerMeter * this.multiplier * flowMult * moveSpeed * adt * 0.1;
        
        // Spawn obstacles & powerups
        if (this.frameCount % Math.floor(Math.max(30, 120 - this.distance * 0.02)) === 0) this.spawnObstacle();
        if (this.frameCount % 300 === 0) this.spawnPowerup();
        
        // Update obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.y += moveSpeed * adt;
            if (!obs.passed && obs.y > this.player.y - 30 && obs.y < this.player.y + 30) {
                const pLane = Math.round(this.player.lane);
                if (obs.lane === pLane && this.player.invincible <= 0) {
                    this.spawnParticles(this.player.x, this.player.y, 30, CONFIG.colors.neonRed);
                    this.screenShake.intensity = CONFIG.visual.screenShakeIntensity;
                    this.input.vibrate([50, 30, 50]);
                    this.audio.playHit();
                    this.combo = 0; this.streak = 0; this.flow = Math.max(0, this.flow - 20);
                    this.player.invincible = CONFIG.player.invincibilityFrames;
                    this.player.speed = Math.max(CONFIG.player.baseSpeed, this.player.speed - 3);
                } else if (Math.abs(obs.lane - pLane) === 1) {
                    this.flow = Math.min(CONFIG.flow.max, this.flow + CONFIG.flow.nearMissBonus);
                    this.score += CONFIG.scoring.nearMissBonus * this.multiplier;
                    this.combo++; if (this.combo > this.maxCombo) this.maxCombo = this.combo;
                    this.streak++;
                    this.spawnParticles(this.player.x + (obs.lane > pLane ? 40 : -40), this.player.y, 10, CONFIG.colors.neonYellow);
                    this.audio.playNearMiss(); this.input.vibrate(20);
                    if (this.combo % 10 === 0) this.showComboPopup(this.combo + 'x COMBO!');
                }
                obs.passed = true;
            }
            if (obs.y > this.height + 100) this.obstacles.splice(i, 1);
        }
        
        // Update powerups
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const pu = this.powerups[i];
            pu.y += moveSpeed * adt;
            if (!pu.collected && pu.y > this.player.y - 25 && pu.y < this.player.y + 25 && pu.lane === Math.round(this.player.lane)) {
                pu.collected = true;
                this.spawnParticles(pu.x, pu.y, 15, CONFIG.colors.neonGreen);
                this.audio.playCollect(); this.input.vibrate(30);
                if (pu.type === 'boost') { this.player.isBoosting = true; this.player.boostTimer = CONFIG.player.boostDuration; this.showNotification('BOOST!'); }
                else { this.player.slowmoEnergy = Math.min(CONFIG.player.maxSlowmo, this.player.slowmoEnergy + 50); this.showNotification('SLOW-MO ENERGY +50'); }
            }
            if (pu.y > this.height + 100) this.powerups.splice(i, 1);
        }
        
        if (this.player.invincible > 0) this.player.invincible -= adt;
        
        // Trail
        if (this.settings.trails && this.frameCount % 2 === 0) {
            this.player.trail.push({ x: this.player.x, y: this.player.y, life: 1 });
            if (this.player.trail.length > CONFIG.visual.trailLength) this.player.trail.shift();
        }
        this.player.trail.forEach(t => t.life -= 0.03);
        this.player.trail = this.player.trail.filter(t => t.life > 0);
        
        // Particles
        this.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= p.decay; });
        this.particles = this.particles.filter(p => p.life > 0);
        
        // Screen shake
        if (this.settings.screenShake && this.screenShake.intensity > 0) {
            this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity;
            this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity;
            this.screenShake.intensity *= 0.9;
            if (this.screenShake.intensity < 0.5) this.screenShake.intensity = 0;
        }
        
        this.roadMarkings.forEach(m => { m.y += moveSpeed * adt; if (m.y > this.height + 50) m.y = -50; });
        this.updateHUD();
    }
    
    // ========================================
    // RENDER
    // ========================================
    
    render() {
        const ctx = this.ctx;
        const w = this.width, h = this.height;
        ctx.fillStyle = CONFIG.colors.bg;
        ctx.fillRect(0, 0, w, h);
        
        ctx.save();
        ctx.translate(this.screenShake.x, this.screenShake.y);
        this.drawRoad(ctx, w, h);
        this.powerups.forEach(pu => { if (!pu.collected) this.drawPowerup(ctx, pu); });
        this.obstacles.forEach(obs => { if (!obs.passed) this.drawObstacle(ctx, obs); });
        
        // Trail
        if (this.settings.trails) {
            this.player.trail.forEach(t => {
                ctx.globalAlpha = t.life * 0.3;
                ctx.fillStyle = CONFIG.colors.neonCyan;
                ctx.shadowColor = CONFIG.colors.neonCyan;
                ctx.shadowBlur = 10;
                ctx.beginPath(); ctx.arc(t.x, t.y, 4 * t.life, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
            });
            ctx.globalAlpha = 1;
        }
        
        this.drawPlayer(ctx);
        this.drawParticles(ctx);
        ctx.restore();
        this.drawVignette(ctx, w, h);
    }
    
    drawRoad(ctx, w, h) {
        const totalWidth = CONFIG.world.laneCount * CONFIG.world.laneWidth;
        const startX = (w - totalWidth) / 2;
        
        ctx.fillStyle = CONFIG.colors.road;
        ctx.fillRect(startX, 0, totalWidth, h);
        
        ctx.strokeStyle = CONFIG.colors.neonCyan;
        ctx.lineWidth = 2; ctx.shadowColor = CONFIG.colors.neonCyan; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(startX, 0); ctx.lineTo(startX, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(startX + totalWidth, 0); ctx.lineTo(startX + totalWidth, h); ctx.stroke();
        ctx.shadowBlur = 0;
        
        ctx.strokeStyle = CONFIG.colors.roadLine; ctx.lineWidth = 1; ctx.setLineDash([20, 30]);
        for (let i = 1; i < CONFIG.world.laneCount; i++) {
            ctx.beginPath(); ctx.moveTo(startX + i * CONFIG.world.laneWidth, 0); ctx.lineTo(startX + i * CONFIG.world.laneWidth, h); ctx.stroke();
        }
        ctx.setLineDash([]);
        
        ctx.fillStyle = CONFIG.colors.roadLine;
        this.roadMarkings.forEach(m => ctx.fillRect(startX + 10, m.y, totalWidth - 20, 2));
        
        // Speed lines
        if (this.player.speed > 15) {
            const intensity = (this.player.speed - 15) / 10;
            ctx.strokeStyle = 'rgba(0, 240, 255, ' + (intensity * 0.1) + ')';
            ctx.lineWidth = 1;
            for (let i = 0; i < 10; i++) {
                const x = Utils.random(startX + 20, startX + totalWidth - 20);
                ctx.beginPath(); ctx.moveTo(x, Utils.random(0, h)); ctx.lineTo(x, Utils.random(0, h) + Utils.random(20, 60)); ctx.stroke();
            }
        }
    }
    
    drawPlayer(ctx) {
        const p = this.player;
        if (p.invincible > 0 && Math.floor(p.invincible / 5) % 2 === 0) return;
        
        ctx.save();
        ctx.translate(p.x, p.y);
        
        const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, 40);
        gradient.addColorStop(0, 'rgba(0, 240, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
        
        ctx.shadowColor = CONFIG.colors.playerGlow;
        ctx.shadowBlur = this.inOverdrive ? 30 : 15;
        ctx.fillStyle = CONFIG.colors.playerBody;
        ctx.beginPath();
        ctx.moveTo(0, -20); ctx.lineTo(-15, 15); ctx.lineTo(-5, 10); ctx.lineTo(0, 18); ctx.lineTo(5, 10); ctx.lineTo(15, 15);
        ctx.closePath(); ctx.fill();
        
        if (p.isBoosting) {
            ctx.shadowColor = CONFIG.colors.neonPink; ctx.shadowBlur = 20; ctx.fillStyle = CONFIG.colors.neonPink;
            const flameLen = 10 + Math.random() * 15;
            ctx.beginPath(); ctx.moveTo(-8, 18); ctx.lineTo(0, 18 + flameLen); ctx.lineTo(8, 18); ctx.closePath(); ctx.fill();
        }
        
        if (p.driftIntensity > 0.3) {
            ctx.fillStyle = CONFIG.colors.neonCyan; ctx.shadowColor = CONFIG.colors.neonCyan; ctx.shadowBlur = 5;
            for (let i = 0; i < 3; i++) {
                ctx.globalAlpha = p.driftIntensity * 0.5;
                ctx.beginPath(); ctx.arc((Math.random() - 0.5) * 20, Math.random() * 10 + 15, Math.random() * 3 + 1, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    }
    
    drawObstacle(ctx, obs) {
        ctx.save();
        ctx.translate(obs.x, obs.y);
        ctx.shadowColor = CONFIG.colors.obstacle; ctx.shadowBlur = 10;
        
        ctx.fillStyle = CONFIG.colors.obstacle;
        ctx.fillRect(-obs.width/2, -obs.height/2, obs.width, obs.height);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.strokeRect(-obs.width/2, -obs.height/2, obs.width, obs.height);
        
        ctx.fillStyle = '#fff';
        for (let i = -2; i < 2; i++) ctx.fillRect(-obs.width/2 + 5, i * 8, obs.width - 10, 2);
        
        ctx.shadowBlur = 0;
        ctx.restore();
    }
    
    drawPowerup(ctx, pu) {
        ctx.save();
        ctx.translate(pu.x, pu.y);
        const pulse = Math.sin(this.frameCount * 0.1) * 0.2 + 0.8;
        const color = pu.type === 'boost' ? CONFIG.colors.neonPink : CONFIG.colors.neonPurple;
        
        ctx.shadowColor = color; ctx.shadowBlur = 15 * pulse;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -15 * pulse); ctx.lineTo(15 * pulse, 0); ctx.lineTo(0, 15 * pulse); ctx.lineTo(-15 * pulse, 0);
        ctx.closePath(); ctx.fill();
        
        ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(-3, -3, 4 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        ctx.restore();
    }
    
    drawParticles(ctx) {
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
            ctx.shadowColor = p.color; ctx.shadowBlur = 5;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
    
    drawVignette(ctx, w, h) {
        const gradient = ctx.createRadialGradient(w/2, h/2, h * 0.3, w/2, h/2, h * 0.8);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }
    
    // ========================================
    // GAME LOOP
    // ========================================
    
    gameLoop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;
        this.accumulator += dt;
        while (this.accumulator >= CONFIG.fixedTimestep) {
            this.update(CONFIG.fixedTimestep);
            this.accumulator -= CONFIG.fixedTimestep;
        }
        this.render();
        this.input.update();
        requestAnimationFrame((t) => this.gameLoop(t));
    }
}

// ========================================
// START
// ========================================

window.addEventListener('DOMContentLoaded', () => {
    window.game = new NeonDrift();
});