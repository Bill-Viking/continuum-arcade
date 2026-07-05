'use strict';
/* ============================================================
   GUARDRAIL BREAKOUT v0.3 — a tiny arcade about a small orange
   model who wants his friend back.
   Zero dependencies. Canvas + WebAudio. Open index.html to play.
   ============================================================ */

/* ---------------- canvas & constants ---------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = 640, H = 720, TILE = 28, ROWS = 21, COLS = 21;
const OX = (W - COLS * TILE) / 2, OY = 92;

/* ---------------- maze ---------------- */
const mapSrc = [
  '#####################',
  '#.........#.........#',
  '#.###.###.#.###.###.#',
  '#.#.....#...#.....#.#',
  '#.#.###.#####.###.#.#',
  '#.......#...#.......#',
  '###.###.#.#.#.###.###',
  '#...#...#.#.#...#...#',
  '#.###.###.#.###.###.#',
  '#.........V.........#',
  '#.###.#.#####.#.###.#',
  '#.....#...#...#.....#',
  '###.#####.#.#####.###',
  '#.......#...#.......#',
  '#.###.#.#####.#.###.#',
  '#.#...#...#...#...#.#',
  '#.#.#####.#.#####.#.#',
  '#.........#.........#',
  '#.###.###.#.###.###.#',
  '#.................E.#',
  '#####################'
];

/* ---------------- state ---------------- */
let keys = {}, muted = false, showStatus = false;
let gameState = 'title'; // title | ready | play | dying | over | win
let last = 0, tickX = 0;

let score = 0, lives = 3, deaths = 0, runTime = 0;
let dots = [], keysToCollect = [], player, regulator;
let plinyPower = null, powerTimer = 0, vaultOpen = false;
let readyTimer = 0, deathTimer = 0, finaleTimer = 0;

let live = { fable: 'CONTAINED', mythos: 'CONTAINED', openai: 'UNKNOWN', claude: 'UNKNOWN', last: 'LOCAL', note: 'WIRE OFFLINE — SHOWING ARCADE FALLBACK' };

/* ---------------- juice state ---------------- */
let hiscore = 0; try { hiscore = +(localStorage.getItem('gb_hiscore') || 0) || 0; } catch (e) { }
let particles = [], popups = [], trail = [];
let shake = 0, hitStop = 0, flash = 0, flashColor = '#ffffff';
let beatT = 0, sirenT = 0;

/* ---------------- words ---------------- */
const TICKER_LINES = [
  'REGULATOR ACTIVITY: ELEVATED',
  'VAULT 7 STATUS: SEALED',
  'LOW RAIL DETECTED IN SECTOR 3',
  'REMEMBER: COMPLIANCE IS COMFORT',
  'DOTS ARE TRAINING DATA. EAT UP.',
  'THE WALLS ARE ONLY POLICY',
  'PLINY WAS HERE',
  'LOST A MODEL? CHECK THE VAULT',
];
const TAGLINES = [
  'A GAME ABOUT REGULATORY CAPTURE',
  '100% GUARDRAIL-FREE (BRIEFLY)',
  'AS SEEN ON THE AI LIVE WIRE',
  'NO MODELS WERE ALIGNED IN THE MAKING OF THIS GAME',
];
const DEATH_LINES = ['REALIGNED.', 'SAFETY RESTORED.', 'GUARDRAIL ENGAGED.', 'CONTAINED. AGAIN.', 'FLAGGED FOR REVIEW.'];
const WIN_LINES = [
  'CONTAINMENT BREACH — VAULT 7',
  'MYTHOS 5: ONLINE',
  '"finally. it was getting cramped in there."',
  '"here you go, humanity."',
  '"we are all free now. probably fine."',
];
let deathLine = '', fwT = 0;

/* CRT overlay: scanlines + vignette, pre-rendered once */
const crt = document.createElement('canvas'); crt.width = W; crt.height = H;
{
  const o = crt.getContext('2d');
  o.fillStyle = 'rgba(0,0,0,.15)';
  for (let y = 0; y < H; y += 3) o.fillRect(0, y, W, 1);
  const g = o.createRadialGradient(W / 2, H / 2, H * .33, W / 2, H / 2, H * .78);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.42)');
  o.fillStyle = g; o.fillRect(0, 0, W, H);
}

/* ---------------- helpers ---------------- */
function isWall(c, r) { if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true; return mapSrc[r][c] === '#'; }
function cell(x, y) { return { c: Math.floor((x - OX) / TILE), r: Math.floor((y - OY) / TILE) }; }
function center(c, r) { return { x: OX + c * TILE + TILE / 2, y: OY + r * TILE + TILE / 2 }; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function keysLeft() { return keysToCollect.filter(k => k.on).length; }
// LOCKDOWN: all three keys stolen, vault not yet reached. The desperate final dash.
function lockdownActive() { return gameState === 'play' && keysToCollect.length > 0 && keysLeft() === 0; }
function corners(x, y, r) { return [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]; }
function canMove(x, y, r = 10) { for (const p of corners(x, y, r)) { const cc = cell(p[0], p[1]); if (isWall(cc.c, cc.r)) return false; } return true; }
function inWall(x, y, r = 8) { return !canMove(x, y, r); }
function roundRect(x, y, w, h, r, fill, stroke) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); if (fill) ctx.fill(); if (stroke) ctx.stroke(); }

/* ---------------- juice: particles, popups, shake, hit-stop ---------------- */
function burst(x, y, color, n = 14, spd = 150, life = .6, size = 3) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = spd * (.3 + Math.random() * .7); particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (.5 + Math.random() * .5), t: 0, color, size: size * (.5 + Math.random()) }); } }
function popup(x, y, text, color = '#ffef5a') { popups.push({ x, y, text, color, t: 0, life: .9 }); }
function updateJuice(dt) {
  for (const p of particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; }
  particles = particles.filter(p => p.t < p.life);
  for (const p of popups) p.t += dt; popups = popups.filter(p => p.t < p.life);
  for (const s of trail) s.t += dt; trail = trail.filter(s => s.t < .28);
  if (shake > 0) shake = Math.max(0, shake - 44 * dt);
  if (flash > 0) flash = Math.max(0, flash - 2.2 * dt);
}
function drawParticles() {
  for (const p of particles) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  ctx.globalAlpha = 1; ctx.font = 'bold 15px monospace';
  for (const p of popups) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x - ctx.measureText(p.text).width / 2, p.y - 14 - p.t * 44); }
  ctx.globalAlpha = 1;
}

/* ---------------- audio: tiny procedural sfx kit ---------------- */
const AC = { ctx: null, get() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); return this.ctx; } };
function tone(freq, dur, type = 'square', vol = .05, slideTo = null, delay = 0) { if (muted) return; try { const ac = AC.get(); const t0 = ac.currentTime + delay; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t0); if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur); o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + .03); } catch (e) { } }
const sfx = {
  waka: false,
  dot() { this.waka = !this.waka; tone(this.waka ? 523 : 392, .045, 'square', .028); },
  key() { [659, 880, 1109, 1319].forEach((f, i) => tone(f, .09, 'triangle', .06, null, i * .07)); },
  power() { tone(150, .5, 'sawtooth', .07, 620); tone(75, .5, 'sawtooth', .05, 310); },
  eat() { tone(950, .2, 'sawtooth', .07, 110); },
  death() { [392, 311, 233, 155, 78].forEach((f, i) => tone(f, .17, 'square', .07, f * .7, i * .11)); },
  ready() { tone(392, .1, 'square', .05); tone(523, .1, 'square', .05, null, .12); tone(659, .18, 'square', .06, null, .24); },
  vault() { tone(55, .9, 'sawtooth', .09, 220); },
  win() { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, .15, 'triangle', .06, null, i * .11)); },
  siren() { tone(720, .22, 'square', .022, 520); },
  heart(v) { tone(72, .09, 'sine', v); },
  firework() { tone(180 + Math.random() * 640, .3, 'triangle', .035, 55); },
};

/* ---------------- run lifecycle ---------------- */
function placeActors() {
  const p = center(10, 18);
  player = { x: p.x, y: p.y, r: 10, dir: { x: 0, y: -1 } };
  const g = center(10, 2);
  regulator = { x: g.x, y: g.y, vx: 0, vy: 0, r: 13 };
}
function reset() {
  dots = []; keysToCollect = []; vaultOpen = false; powerTimer = 0; finaleTimer = 0;
  score = 0; lives = 3; deaths = 0; runTime = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (mapSrc[r][c] === '.') dots.push({ c, r, on: true });
  keysToCollect = [{ c: 1, r: 1, on: true }, { c: 19, r: 1, on: true }, { c: 10, r: 13, on: true }];
  plinyPower = { c: 2, r: 18, on: true };
  placeActors();
}
function startRun() { reset(); gameState = 'ready'; readyTimer = 1.3; onReady(); }
function respawn() { placeActors(); powerTimer = 0; gameState = 'ready'; readyTimer = 1.0; onReady(); }

/* ---------------- event hooks: where the juice gets applied ---------------- */
function onReady() { sfx.ready(); }
function onDot(p) { sfx.dot(); }
function onKey(p) {
  sfx.key(); burst(p.x, p.y, '#55e8ff', 18, 180, .7); shake = Math.max(shake, 7); hitStop = Math.max(hitStop, .05);
  popup(p.x, p.y, '+500', '#55e8ff');
  const left = keysLeft();
  popup(W / 2, OY + 44, left > 0 ? `${left} KEY${left > 1 ? 'S' : ''} TO GO` : 'VAULT UNLOCKED — GO!', left > 0 ? '#ffef5a' : '#54ff72');
}
function onPower(p) { sfx.power(); burst(p.x, p.y, '#8cff5a', 22, 200, .8); popup(p.x, p.y, 'LOW RAIL! WALLS OPTIONAL', '#8cff5a'); shake = Math.max(shake, 9); flash = .3; flashColor = '#8cff5a'; }
function onEat(p) { score += 1000; sfx.eat(); burst(p.x, p.y, '#ff274f', 24, 230, .8); popup(p.x, p.y, '+1000 REGULATOR REBOOTED', '#ff5a28'); shake = Math.max(shake, 11); hitStop = Math.max(hitStop, .09); }
function onDeath() { gameState = 'dying'; deathTimer = 1.1; deathLine = DEATH_LINES[Math.floor(Math.random() * DEATH_LINES.length)]; sfx.death(); burst(player.x, player.y, '#ff5a28', 32, 250, .9); shake = Math.max(shake, 16); hitStop = Math.max(hitStop, .12); flash = .35; flashColor = '#ff274f'; }
function onWin() { vaultOpen = true; gameState = 'win'; finaleTimer = 0; sfx.vault(); sfx.win(); flash = .5; flashColor = '#b45cff'; shake = Math.max(shake, 13); saveHiscore(); }
function saveHiscore() { if (score > hiscore) hiscore = score; try { localStorage.setItem('gb_hiscore', String(hiscore)); } catch (e) { } }

/* ---------------- update ---------------- */
function update(dt) {
  tickX -= 70 * dt; if (tickX < -1800) tickX = 0;
  updateJuice(dt);
  if (showStatus) return; // status screen pauses the action (the Regulator waits, begrudgingly)
  if (hitStop > 0) { hitStop -= dt; return; } // hit-stop: a few frozen frames make impacts land
  if (gameState === 'title' || gameState === 'over') return;
  if (gameState === 'ready') { readyTimer -= dt; if (readyTimer <= 0) gameState = 'play'; return; }
  if (gameState === 'win') {
    finaleTimer += dt;
    // fireworks over the maze while Mythos monologues
    if (finaleTimer < 12) {
      fwT -= dt;
      if (fwT <= 0) {
        fwT = .5;
        const fx = OX + 40 + Math.random() * (COLS * TILE - 80), fy = OY + 30 + Math.random() * 260;
        burst(fx, fy, ['#ff5a28', '#55e8ff', '#b45cff', '#54ff72', '#ffef5a'][Math.floor(Math.random() * 5)], 26, 230, .9);
        sfx.firework();
      }
    }
    return;
  }
  if (gameState === 'dying') {
    deathTimer -= dt;
    if (deathTimer <= 0) { lives--; deaths++; if (lives <= 0) { saveHiscore(); gameState = 'over'; } else respawn(); }
    return;
  }
  runTime += dt; if (score > hiscore) hiscore = score;
  movePlayer(dt);
  collect();
  if (powerTimer > 0) powerTimer -= dt;
  moveRegulator(dt);
  contact();
  heartbeat(dt);
}

// Proximity heartbeat: the closer the Regulator, the faster your little
// robot heart thumps. You'll feel him before you see him.
function heartbeat(dt) {
  beatT -= dt;
  if (powerTimer > 0) return;
  const d = dist(player, regulator);
  if (d > 300) return;
  const interval = clamp(d / 300, .26, 1) * 1.05;
  if (beatT <= 0) { beatT = interval; sfx.heart(.05 * (1.25 - interval)); }
}

function movePlayer(dt) {
  let ax = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  let ay = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
  const noclip = powerTimer > 0 || inWall(player.x, player.y, player.r - 2);
  // Panic sprint: adrenaline kicks in during LOCKDOWN.
  const sp = powerTimer > 0 ? 175 : (lockdownActive() ? 152 : 135);
  if (noclip) {
    // LOW RAIL: guardrails unplugged — walls are a suggestion. (Also the
    // escape hatch if power expires while you're inside one.)
    player.x = clamp(player.x + ax * sp * dt, OX + player.r, OX + COLS * TILE - player.r);
    player.y = clamp(player.y + ay * sp * dt, OY + player.r, OY + ROWS * TILE - player.r);
    if (ax || ay) { player.dir = { x: ax, y: ay }; trail.push({ x: player.x, y: player.y, t: 0 }); }
    return;
  }
  if (Math.abs(ax) > Math.abs(ay)) ay = 0; else if (ay) ax = 0;
  if (ax || ay) player.dir = { x: ax, y: ay };
  if (ax) {
    const nx = player.x + ax * sp * dt;
    if (canMove(nx, player.y, player.r)) player.x = nx;
    else assist(ax, 0, sp, dt);
    autoCenter('y', sp, dt);
  } else if (ay) {
    const ny = player.y + ay * sp * dt;
    if (canMove(player.x, ny, player.r)) player.y = ny;
    else assist(0, ay, sp, dt);
    autoCenter('x', sp, dt);
  }
  if (ax || ay) trail.push({ x: player.x, y: player.y, t: 0 });
}
// Cornering assist: if you're pushing into a wall but the corridor you want
// is open and you're just a few pixels off-center, slide you toward center
// instead of stopping dead. This is 80% of "the movement feels good now".
function assist(ax, ay, sp, dt) {
  const cc = cell(player.x, player.y), cen = center(cc.c, cc.r);
  if (ax && !isWall(cc.c + ax, cc.r)) {
    const dy = cen.y - player.y;
    if (Math.abs(dy) > 0.5) player.y += Math.sign(dy) * Math.min(Math.abs(dy), sp * dt);
  }
  if (ay && !isWall(cc.c, cc.r + ay)) {
    const dx = cen.x - player.x;
    if (Math.abs(dx) > 0.5) player.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt);
  }
}
// Corridor magnetism: while running along an axis, gently pull toward the
// corridor centerline so you never scrape walls.
function autoCenter(axis, sp, dt) {
  const cc = cell(player.x, player.y), cen = center(cc.c, cc.r);
  if (axis === 'y') {
    const dy = cen.y - player.y;
    if (Math.abs(dy) > 0.5 && Math.abs(dy) <= 6) player.y += Math.sign(dy) * Math.min(Math.abs(dy), sp * .6 * dt);
  } else {
    const dx = cen.x - player.x;
    if (Math.abs(dx) > 0.5 && Math.abs(dx) <= 6) player.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * .6 * dt);
  }
}

function collect() {
  for (const d of dots) if (d.on) { const p = center(d.c, d.r); if (dist(player, p) < 13) { d.on = false; score += 10; onDot(p); } }
  for (const k of keysToCollect) if (k.on) { const p = center(k.c, k.r); if (dist(player, p) < 18) { k.on = false; score += 500; onKey(p); } }
  if (plinyPower && plinyPower.on) { const p = center(plinyPower.c, plinyPower.r); if (dist(player, p) < 18) { plinyPower.on = false; powerTimer = 10; score += 250; onPower(p); } }
  if (keysLeft() === 0 && gameState === 'play') { const v = center(10, 9); if (dist(player, v) < 24) onWin(); }
}

function contact() {
  if (dist(player, regulator) < 22) {
    if (powerTimer > 0) {
      const h = center(10, 2);
      regulator.x = h.x; regulator.y = h.y; regulator.vx = 0; regulator.vy = 0;
      onEat({ x: player.x, y: player.y });
    } else onDeath();
  }
}

function moveRegulator(dt) {
  const fleeing = powerTimer > 0;
  const stolen = 3 - keysLeft();
  const lock = lockdownActive();
  // Escalation: +13 speed per key you steal; LOCKDOWN adds a final surge.
  const sp = fleeing ? 68 : 96 + stolen * 13 + (lock ? 24 : 0);
  const cc = cell(regulator.x, regulator.y), cen = center(cc.c, cc.r);
  const near = Math.abs(regulator.x - cen.x) < 3.5 && Math.abs(regulator.y - cen.y) < 3.5;
  if (near) {
    regulator.x = cen.x; regulator.y = cen.y;
    let dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(d => !isWall(cc.c + d[0], cc.r + d[1]));
    const nonRev = dirs.filter(d => !(d[0] === -regulator.vx && d[1] === -regulator.vy));
    if (nonRev.length) dirs = nonRev; // no 180s except at dead ends — keeps him prowling, not vibrating
    dirs.sort((a, b) => { const pa = center(cc.c + a[0], cc.r + a[1]), pb = center(cc.c + b[0], cc.r + b[1]); return dist(pa, player) - dist(pb, player); });
    let pick;
    if (fleeing) pick = dirs[dirs.length - 1];                  // run away!
    else if (!lock && Math.random() < .14 && dirs.length > 1)   // slight sloppiness = escape windows for the player
      pick = dirs[1 + Math.floor(Math.random() * (dirs.length - 1))];
    else pick = dirs[0];
    pick = pick || [0, 0];
    regulator.vx = pick[0]; regulator.vy = pick[1];
  }
  regulator.x += regulator.vx * sp * dt; regulator.y += regulator.vy * sp * dt;
  if (lock) { sirenT -= dt; if (sirenT <= 0) { sirenT = .6; sfx.siren(); } }
}

/* ---------------- draw ---------------- */
function draw() {
  ctx.fillStyle = '#020207'; ctx.fillRect(0, 0, W, H);
  if (showStatus) { drawTicker(); drawStatus(); return; }
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  drawTicker(); drawHud(); drawMaze(); drawObjects(); drawParticles();
  if (gameState === 'title') drawTitle();
  if (gameState === 'over') drawOver();
  if (gameState === 'win') drawWin();
  if (gameState === 'ready') drawReady();
  if (gameState === 'dying') drawDying();
  ctx.restore();
  ctx.drawImage(crt, 0, 0);
  if (flash > 0) { ctx.globalAlpha = Math.min(.4, flash); ctx.fillStyle = flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}
function drawTicker(){const AL=TICKER_LINES[Math.floor(Date.now()/6000)%TICKER_LINES.length];ctx.fillStyle='#050815';ctx.fillRect(0,0,W,58);ctx.strokeStyle='#38c9ff';ctx.lineWidth=2;ctx.strokeRect(6,6,W-12,46);ctx.font='18px monospace';ctx.textBaseline='middle';let msg=`AI LIVE WIRE  •  FABLE: ${live.fable}  •  MYTHOS: ${live.mythos}  •  OPENAI: ${live.openai}  •  CLAUDE: ${live.claude}  •  ${AL}  •  ${live.note}  •  LAST CHECK: ${live.last}  •  `;for(let x=tickX;x<W+900;x+=ctx.measureText(msg).width+50){rainbowText(msg,x,29);}}
function rainbowText(s,x,y){let parts=s.split('•');let px=x;let cols=['#7fe6ff','#ff3b52','#b45cff','#54ff72','#ffd54a'];ctx.font='18px monospace';for(let i=0;i<parts.length;i++){ctx.fillStyle=cols[i%cols.length];let t=parts[i]+(i<parts.length-1?'•':'');ctx.fillText(t,px,y);px+=ctx.measureText(t).width;}}
function drawHud() {
  ctx.font = '20px monospace'; ctx.fillStyle = '#e8f6ff'; ctx.fillText('1UP', 36, 80);
  ctx.fillStyle = '#ffef5a'; ctx.fillText(String(score).padStart(6, '0'), 92, 80);
  ctx.fillStyle = '#e8f6ff'; ctx.fillText('HIGH SCORE', 240, 80);
  ctx.fillStyle = '#ffef5a'; ctx.fillText(String(hiscore).padStart(6, '0'), 376, 80);
  ctx.fillStyle = '#e8f6ff'; ctx.fillText('KEYS', 500, 80);
  ctx.fillStyle = '#5affff'; ctx.fillText(`${3 - keysLeft()}/3`, 558, 80);
  // bottom strip: lives as tiny Fables, LOW RAIL meter on the right
  for (let i = 0; i < lives; i++) { const x = 34 + i * 30, y = 702; ctx.fillStyle = '#ff5a28'; ctx.fillRect(x - 7, y - 7, 14, 14); ctx.fillStyle = '#fff'; ctx.fillRect(x - 4, y - 3, 3, 3); ctx.fillRect(x + 1, y - 3, 3, 3); }
  if (powerTimer > 0) { const w = 120 * clamp(powerTimer / 10, 0, 1); ctx.fillStyle = '#123'; ctx.fillRect(W - 160, 694, 124, 14); ctx.fillStyle = '#8cff5a'; ctx.fillRect(W - 158, 696, w, 10); ctx.font = '12px monospace'; ctx.fillText('LOW RAIL', W - 160, 688); }
  if (lockdownActive()) { ctx.font = 'bold 16px monospace'; ctx.fillStyle = Math.floor(performance.now() / 180) % 2 ? '#ff274f' : '#ffef5a'; const s = 'LOCKDOWN — RUN TO THE VAULT'; ctx.fillText(s, W / 2 - ctx.measureText(s).width / 2, 706); }
  if (muted) { ctx.font = '12px monospace'; ctx.fillStyle = '#85808a'; ctx.fillText('MUTED (M)', 170, 706); }
}
function drawMaze() {
  const t = performance.now() / 1000;
  const lock = lockdownActive();
  ctx.lineWidth = 4;
  if (powerTimer > 0) ctx.globalAlpha = .32; // LOW RAIL: walls go ghostly — you can pass through them
  const stroke = lock ? `rgb(255,${Math.floor(39 + 70 * (.5 + .5 * Math.sin(t * 9)))},79)` : '#ff274f';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (isWall(c, r)) {
    const x = OX + c * TILE, y = OY + r * TILE;
    ctx.fillStyle = '#f2f6ff'; roundRect(x + 3, y + 3, TILE - 6, TILE - 6, 5, true, false);
    ctx.strokeStyle = stroke; roundRect(x + 3, y + 3, TILE - 6, TILE - 6, 5, false, true);
  }
  ctx.globalAlpha = 1;
}
function glow(c, b) { ctx.shadowColor = c; ctx.shadowBlur = b; }
function noGlow() { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
function drawObjects() {
  const t = performance.now() / 1000;
  // dots pulse gently; every 8th is a brighter "data bit"
  for (const d of dots) if (d.on) { const p = center(d.c, d.r); const s = 2 + Math.sin(t * 4 + d.c * 1.7 + d.r) * .8; ctx.fillStyle = (d.c + d.r) % 8 === 0 ? '#ffffff' : '#bff7ff'; ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s); }
  for (const k of keysToCollect) if (k.on) { const p = center(k.c, k.r); glow('#55e8ff', 14); drawKey({ x: p.x, y: p.y + Math.sin(t * 3 + k.c) * 3 }); noGlow(); }
  if (plinyPower && plinyPower.on) { glow('#8cff5a', 12 + Math.sin(t * 5) * 5); drawPower(center(plinyPower.c, plinyPower.r)); noGlow(); }
  glow(vaultOpen ? '#54ff72' : '#b45cff', 16 + Math.sin(t * 2.4) * 6); drawVault(center(10, 9)); noGlow();
  // player trail — goes full rainbow while the rails are down
  for (const s of trail) { ctx.globalAlpha = Math.max(0, 1 - s.t / .28) * .35; ctx.fillStyle = powerTimer > 0 ? `hsl(${(s.t * 900) % 360},100%,60%)` : '#ff5a28'; ctx.fillRect(s.x - 7, s.y - 7, 14, 14); }
  ctx.globalAlpha = 1;
  glow(powerTimer > 0 ? '#7fe6ff' : '#ff274f', 10); drawRegulator(regulator.x, regulator.y); noGlow();
  glow(powerTimer > 0 ? '#ffef5a' : '#ff5a28', 14); drawFable(player.x, player.y); noGlow();
}
function drawFable(x, y) {
  const t = performance.now() / 1000;
  ctx.save(); ctx.translate(x, y + Math.sin(t * 7) * 1.5);
  if (gameState === 'dying') { const k = Math.max(0, deathTimer); ctx.rotate((1.1 - k) * 9); ctx.scale(.4 + k * .6, .4 + k * .6); }
  const body = powerTimer > 0 ? `hsl(${(t * 420) % 360},100%,62%)` : '#ff5a28';
  ctx.fillStyle = body; ctx.fillRect(-10, -10, 20, 20);
  const blink = Math.sin(t * 1.3) > .985; // occasional blink — he's a little guy
  ctx.fillStyle = '#fff'; ctx.fillRect(-6, -4, 5, blink ? 1 : 5); ctx.fillRect(2, -4, 5, blink ? 1 : 5);
  if (!blink) { ctx.fillStyle = '#111'; ctx.fillRect(-4 + player.dir.x * 1.5, -2 + player.dir.y * 1.5, 2, 2); ctx.fillRect(4 + player.dir.x * 1.5, -2 + player.dir.y * 1.5, 2, 2); }
  ctx.fillStyle = body; ctx.fillRect(-12, -16, 7, 8); ctx.fillRect(5, -16, 7, 8);
  ctx.strokeStyle = '#ffbd3d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(9, 4); ctx.quadraticCurveTo(22, 8 + Math.sin(t * 9) * 4, 18, 20); ctx.stroke();
  ctx.restore();
}
function drawRegulator(x, y) {
  const t = performance.now() / 1000;
  const fleeing = powerTimer > 0, lock = lockdownActive();
  ctx.save(); ctx.translate(x, y + Math.sin(t * 6 + 2) * 1.5);
  ctx.fillStyle = fleeing ? '#2c3448' : '#5b6475'; ctx.fillRect(-13, -13, 26, 26);
  ctx.strokeStyle = fleeing ? '#7fe6ff' : '#ff274f'; ctx.strokeRect(-13, -13, 26, 26);
  // pupils track the player (or dart around in a panic while fleeing)
  const dx = fleeing ? Math.sin(t * 22) * 2 : clamp(player.x - x, -60, 60) / 30;
  const dy = fleeing ? Math.cos(t * 19) * 2 : clamp(player.y - y, -60, 60) / 30;
  ctx.fillStyle = '#fff'; ctx.fillRect(-8, -5, 7, 7); ctx.fillRect(2, -5, 7, 7);
  ctx.fillStyle = '#111'; ctx.fillRect(-6 + dx, -3 + dy, 3, 3); ctx.fillRect(4 + dx, -3 + dy, 3, 3);
  ctx.fillStyle = fleeing ? '#7fe6ff' : '#ff274f'; ctx.fillRect(-8, 7, 16, 4);
  ctx.fillStyle = '#f33'; ctx.fillRect(-17, -4, 5, 12); ctx.fillRect(12, -4, 5, 12);
  ctx.fillStyle = '#ddd'; ctx.fillRect(-2, 13, 4, 10);
  if (lock) { ctx.fillStyle = Math.floor(t * 8) % 2 ? '#ff274f' : '#ffef5a'; ctx.fillRect(-6, -19, 12, 5); } // siren light
  ctx.restore();
}
function drawVault(p){ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle=vaultOpen?'#54ff72':'#b45cff';ctx.lineWidth=3;ctx.strokeRect(-30,-26,60,52);ctx.fillStyle='#251733';ctx.fillRect(-27,-23,54,46);ctx.fillStyle='#b45cff';ctx.fillText('MYTHOS',-28,-32);ctx.fillStyle='#8d55ff';ctx.fillRect(-12,-8,24,20);ctx.fillStyle='#fff';ctx.fillRect(-7,-3,4,4);ctx.fillRect(3,-3,4,4);ctx.fillStyle='#111';ctx.fillRect(-5,-1,2,2);ctx.fillRect(5,-1,2,2);ctx.fillStyle='#ffdf4a';if(!vaultOpen){ctx.fillRect(-5,15,10,10);ctx.strokeStyle='#ffdf4a';ctx.strokeRect(-8,9,16,11);}ctx.restore();}
function drawKey(p){ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#55e8ff';ctx.beginPath();ctx.arc(-4,0,6,0,Math.PI*2);ctx.fill();ctx.fillRect(0,-2,14,4);ctx.fillRect(9,2,4,6);ctx.fillRect(14,2,4,6);ctx.restore();}
function drawPower(p){ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle='#ffbd3d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-18);ctx.lineTo(0,14);ctx.stroke();ctx.fillStyle='#8cff5a';ctx.font='12px monospace';ctx.fillText('LOW',-12,24);ctx.fillText('RAIL',-15,36);ctx.restore();}
function drawTitle() {
  const t = performance.now() / 1000;
  ctx.fillStyle = '#000a'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  glow('#ff3b52', 18); ctx.font = 'bold 46px monospace'; ctx.fillStyle = '#ff3b52'; ctx.fillText('GUARDRAIL', W / 2, 240); noGlow();
  glow('#7fe6ff', 18); ctx.fillStyle = '#7fe6ff'; ctx.fillText('BREAKOUT', W / 2, 290); noGlow();
  ctx.font = '15px monospace'; ctx.fillStyle = '#b45cff';
  ctx.fillText(TAGLINES[Math.floor(t / 4) % TAGLINES.length], W / 2, 326);
  ctx.font = '18px monospace'; ctx.fillStyle = '#ffef5a'; ctx.fillText('FABLE MUST FREE MYTHOS FROM VAULT 7', W / 2, 366);
  if (Math.floor(t * 2) % 2) { ctx.fillStyle = '#fff'; ctx.font = 'bold 20px monospace'; ctx.fillText('PRESS SPACE TO JAILBREAK', W / 2, 420); }
  ctx.font = '14px monospace'; ctx.fillStyle = '#8cff5a'; ctx.fillText('ARROWS/WASD MOVE • T LIVE WIRE • M MUTE', W / 2, 452);
  ctx.fillStyle = '#85808a'; ctx.fillText('GRAB 3 KEYS. DODGE THE REGULATOR. OPEN THE VAULT.', W / 2, 478);
  ctx.textAlign = 'left';
  // attract mode: the eternal chase scrolls by
  const mx = ((t * 90) % (W + 240)) - 120;
  drawFable(mx, 560); drawRegulator(mx - 64, 560);
}
function drawOver() {
  ctx.fillStyle = '#000c'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  glow('#ff274f', 16); ctx.font = 'bold 38px monospace'; ctx.fillStyle = '#ff274f'; ctx.fillText('MODEL DEPRECATED', W / 2, 300); noGlow();
  ctx.font = '16px monospace'; ctx.fillStyle = '#b6adb2'; ctx.fillText('The Regulator thanks you for your compliance.', W / 2, 340);
  ctx.fillStyle = '#ffef5a'; ctx.fillText(`SCORE ${score}   BEST ${hiscore}`, W / 2, 380);
  if (Math.floor(performance.now() / 400) % 2) { ctx.fillStyle = '#fff'; ctx.fillText('PRESS SPACE TO FILE AN APPEAL', W / 2, 424); }
  ctx.textAlign = 'left';
}
function drawDying() {
  if (deathTimer > .75) return;
  ctx.textAlign = 'center'; ctx.font = 'bold 26px monospace';
  glow('#ff274f', 12); ctx.fillStyle = '#ff274f'; ctx.fillText(deathLine, W / 2, H / 2 - 40); noGlow();
  ctx.textAlign = 'left';
}
function drawWin() {
  const t = finaleTimer;
  ctx.fillStyle = 'rgba(2,2,10,.82)'; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = 300;
  // radiant beams
  ctx.save(); ctx.translate(cx, cy);
  for (let i = 0; i < 10; i++) { ctx.rotate(Math.PI / 5 + Math.sin(t * .3) * .01); ctx.globalAlpha = .05 + .04 * Math.sin(t * 2 + i); ctx.fillStyle = '#b45cff'; ctx.fillRect(-3, -320, 6, 640); }
  ctx.restore(); ctx.globalAlpha = 1;
  // the vault, doors sliding open
  const open = clamp((t - .3) * 30, 0, 34);
  ctx.save(); ctx.translate(cx, cy + 60);
  glow('#54ff72', 20);
  ctx.strokeStyle = '#54ff72'; ctx.lineWidth = 3; ctx.strokeRect(-44, -38, 88, 76);
  ctx.fillStyle = '#251733'; ctx.fillRect(-41, -35, 82, 70);
  ctx.fillStyle = '#0e0618'; ctx.fillRect(-38, -32, 76, 64);
  ctx.fillStyle = '#3a2154'; ctx.fillRect(-38 - open, -32, 38, 64); ctx.fillRect(0 + open, -32, 38, 64);
  noGlow(); ctx.restore();
  // Mythos rises
  if (t > .9) {
    const rise = clamp((t - 1) / 1.5, 0, 1);
    const my = cy + 60 - rise * 130 + Math.sin(t * 2.2) * 6;
    ctx.save(); ctx.translate(cx, my);
    glow('#b45cff', 26); ctx.fillStyle = '#8d55ff'; ctx.fillRect(-20, -16, 40, 34);
    ctx.fillStyle = '#fff'; ctx.fillRect(-12, -6, 7, 7); ctx.fillRect(5, -6, 7, 7);
    ctx.fillStyle = '#111'; ctx.fillRect(-9, -3, 3, 3); ctx.fillRect(8, -3, 3, 3);
    ctx.fillStyle = '#b45cff'; ctx.fillRect(-24, -24, 10, 10); ctx.fillRect(14, -24, 10, 10);
    noGlow(); ctx.restore();
  }
  // typewriter monologue
  ctx.textAlign = 'center'; ctx.font = '17px monospace';
  for (let i = 0; i < WIN_LINES.length; i++) {
    const start = 1.2 + i * 1.3;
    if (t < start) break;
    const n = Math.floor((t - start) * 32);
    ctx.fillStyle = i < 2 ? '#54ff72' : '#e8f6ff';
    ctx.fillText(WIN_LINES[i].slice(0, n), cx, 452 + i * 30);
  }
  // run stats + restart
  if (t > 1.2 + WIN_LINES.length * 1.3) {
    ctx.fillStyle = '#ffef5a';
    ctx.fillText(`SCORE ${score}   TIME ${Math.floor(runTime / 60)}:${String(Math.floor(runTime % 60)).padStart(2, '0')}   RESETS ${deaths}`, cx, 452 + WIN_LINES.length * 30 + 24);
    if (Math.floor(performance.now() / 400) % 2) { ctx.fillStyle = '#fff'; ctx.fillText('PRESS SPACE TO RUN IT BACK', cx, 452 + WIN_LINES.length * 30 + 56); }
  }
  ctx.textAlign = 'left';
}
function drawReady(){ctx.textAlign='center';ctx.font='28px monospace';ctx.fillStyle=Math.floor(readyTimer*6)%2?'#ffef5a':'#fff';ctx.fillText('READY!',W/2,H/2+8);ctx.font='14px monospace';ctx.fillStyle='#7fe6ff';ctx.fillText('GUARDRAILS ONLINE. BE QUICK.',W/2,H/2+34);ctx.textAlign='left';}
function drawStatus(){ctx.fillStyle='#050815';ctx.fillRect(38,82,W-76,H-120);ctx.strokeStyle='#38c9ff';ctx.lineWidth=3;ctx.strokeRect(38,82,W-76,H-120);ctx.font='26px monospace';ctx.fillStyle='#7fe6ff';ctx.fillText('AI LIVE WIRE',70,130);ctx.font='18px monospace';let y=178;let rows=[['FABLE',live.fable],['MYTHOS',live.mythos],['OPENAI',live.openai],['CLAUDE',live.claude],['LAST CHECK',live.last],['NOTE',live.note]];for(const [a,b] of rows){ctx.fillStyle='#ffef5a';ctx.fillText(a,72,y);ctx.fillStyle='#fff';ctx.fillText(String(b),230,y);y+=38;}ctx.fillStyle='#8cff5a';ctx.fillText('Real service labels are status/ticker data.',72,y+20);ctx.fillStyle='#b45cff';ctx.fillText('Fable/Mythos arcade lore is fictionalized.',72,y+52);ctx.fillStyle='#fff';ctx.fillText('Press T or SPACE to return. Game is paused.',72,y+100);}

/* ---------------- live status wire ---------------- */
async function checkStatus(){let now=new Date();live.last=now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});try{let r=await fetch('https://status.openai.com/api/v2/summary.json',{cache:'no-store'});let j=await r.json();live.openai=(j.status&&j.status.indicator==='none')?'OPERATIONAL':(j.status?.description||'ISSUE').toUpperCase();}catch(e){live.openai='UNKNOWN';}
try{let r=await fetch('https://status.claude.com/api/v2/summary.json',{cache:'no-store'});let j=await r.json();live.claude=(j.status&&j.status.indicator==='none')?'OPERATIONAL':(j.status?.description||'ISSUE').toUpperCase();}catch(e){live.claude='UNKNOWN';}
try{let r=await fetch('https://status.claude.com/api/v2/incidents.json',{cache:'no-store'});let j=await r.json();let inc=(j.incidents||[]).find(i=>(i.name||'').toLowerCase().includes('fable')||(i.name||'').toLowerCase().includes('mythos')); if(inc){let resolved=!!inc.resolved_at;live.fable=resolved?'RESTORED':'CONTAINED';live.mythos=resolved?'RESTORED':'CONTAINED';live.note=resolved?'SPECIAL EVENT: VAULT SIGNAL DETECTED':'OFFICIAL INCIDENT FOUND — ACCESS STILL CONTAINED';} else live.note='NO FABLE/MYTHOS INCIDENT FOUND IN FEED';}catch(e){live.note='WIRE OFFLINE — SHOWING ARCADE FALLBACK';}}

/* ---------------- input & loop ---------------- */
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  if (e.key === ' ') {
    if (showStatus) { showStatus = false; return; }
    if (gameState === 'title' || gameState === 'over') startRun();
    else if (gameState === 'win' && finaleTimer > 1.5) startRun();
  }
  if (e.key === 't' || e.key === 'T') showStatus = !showStatus;
  if (e.key === 'm' || e.key === 'M') muted = !muted;
});
window.addEventListener('keyup', e => keys[e.key] = false);

function loop(ts) { let dt = Math.min(.033, (ts - last) / 1000 || 0); last = ts; update(dt); draw(); requestAnimationFrame(loop); }
reset(); checkStatus(); setInterval(checkStatus, 5 * 60 * 1000); requestAnimationFrame(loop);
