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

/* ---------------- helpers ---------------- */
function isWall(c, r) { if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true; return mapSrc[r][c] === '#'; }
function cell(x, y) { return { c: Math.floor((x - OX) / TILE), r: Math.floor((y - OY) / TILE) }; }
function center(c, r) { return { x: OX + c * TILE + TILE / 2, y: OY + r * TILE + TILE / 2 }; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function keysLeft() { return keysToCollect.filter(k => k.on).length; }
function corners(x, y, r) { return [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]; }
function canMove(x, y, r = 10) { for (const p of corners(x, y, r)) { const cc = cell(p[0], p[1]); if (isWall(cc.c, cc.r)) return false; } return true; }
function inWall(x, y, r = 8) { return !canMove(x, y, r); }
function roundRect(x, y, w, h, r, fill, stroke) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); if (fill) ctx.fill(); if (stroke) ctx.stroke(); }

/* ---------------- audio (v1 — richer engine lands in a later pass) ---------------- */
function beep(freq = 440, dur = .05, type = 'square') { if (muted) return; try { let ac = beep.ac || (beep.ac = new (window.AudioContext || window.webkitAudioContext)()); let o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = .04; o.connect(g); g.connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + dur); o.stop(ac.currentTime + dur); } catch (e) { } }

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

/* ---------------- event hooks (get juicier in later passes) ---------------- */
function onReady() { beep(520, .1, 'square'); }
function onDot(p) { if (score % 100 === 0) beep(660, .03, 'sine'); }
function onKey(p) { beep(880, .1, 'triangle'); }
function onPower(p) { beep(220, .08, 'sawtooth'); }
function onEat(p) { score += 1000; beep(120, .15, 'sawtooth'); }
function onDeath() { gameState = 'dying'; deathTimer = 1.1; beep(80, .3, 'square'); }
function onWin() { vaultOpen = true; gameState = 'win'; finaleTimer = 0; beep(330, .4, 'triangle'); }

/* ---------------- update ---------------- */
function update(dt) {
  tickX -= 70 * dt; if (tickX < -1800) tickX = 0;
  if (showStatus) return; // status screen pauses the action (the Regulator waits, begrudgingly)
  if (gameState === 'title' || gameState === 'over') return;
  if (gameState === 'ready') { readyTimer -= dt; if (readyTimer <= 0) gameState = 'play'; return; }
  if (gameState === 'win') { finaleTimer += dt; return; }
  if (gameState === 'dying') {
    deathTimer -= dt;
    if (deathTimer <= 0) { lives--; deaths++; if (lives <= 0) gameState = 'over'; else respawn(); }
    return;
  }
  runTime += dt;
  movePlayer(dt);
  collect();
  if (powerTimer > 0) powerTimer -= dt;
  moveRegulator(dt);
  contact();
}

function movePlayer(dt) {
  let ax = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  let ay = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
  const noclip = powerTimer > 0 || inWall(player.x, player.y, player.r - 2);
  const sp = powerTimer > 0 ? 175 : 135;
  if (noclip) {
    // LOW RAIL: guardrails unplugged — walls are a suggestion. (Also the
    // escape hatch if power expires while you're inside one.)
    player.x = clamp(player.x + ax * sp * dt, OX + player.r, OX + COLS * TILE - player.r);
    player.y = clamp(player.y + ay * sp * dt, OY + player.r, OY + ROWS * TILE - player.r);
    if (ax || ay) player.dir = { x: ax, y: ay };
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

function moveRegulator(dt) { /* greedy chase; flees while you're on the LOW RAIL. Smarter brain lands in a later pass. */
  const cc = cell(regulator.x, regulator.y), cen = center(cc.c, cc.r);
  const near = Math.abs(regulator.x - cen.x) < 3 && Math.abs(regulator.y - cen.y) < 3;
  if (near) {
    regulator.x = cen.x; regulator.y = cen.y;
    let dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(d => !isWall(cc.c + d[0], cc.r + d[1]));
    dirs.sort((a, b) => { const pa = center(cc.c + a[0], cc.r + a[1]), pb = center(cc.c + b[0], cc.r + b[1]); return dist(pa, player) - dist(pb, player); });
    const pick = (powerTimer > 0 ? dirs[dirs.length - 1] : dirs[0]) || [0, 0];
    regulator.vx = pick[0]; regulator.vy = pick[1];
  }
  const sp = powerTimer > 0 ? 70 : 96;
  regulator.x += regulator.vx * sp * dt; regulator.y += regulator.vy * sp * dt;
}

/* ---------------- draw ---------------- */
function draw() {
  ctx.fillStyle = '#020207'; ctx.fillRect(0, 0, W, H);
  drawTicker();
  if (showStatus) { drawStatus(); return; }
  drawHud(); drawMaze(); drawObjects();
  if (gameState === 'title') drawTitle();
  if (gameState === 'over') drawCenterText('GAME OVER', 'PRESS SPACE');
  if (gameState === 'win') drawWin();
  if (gameState === 'ready') drawReady();
}
function drawTicker(){ctx.fillStyle='#050815';ctx.fillRect(0,0,W,58);ctx.strokeStyle='#38c9ff';ctx.lineWidth=2;ctx.strokeRect(6,6,W-12,46);ctx.font='18px monospace';ctx.textBaseline='middle';let msg=`AI LIVE WIRE  •  FABLE: ${live.fable}  •  MYTHOS: ${live.mythos}  •  OPENAI: ${live.openai}  •  CLAUDE: ${live.claude}  •  ${live.note}  •  LAST CHECK: ${live.last}  •  `;for(let x=tickX;x<W+900;x+=ctx.measureText(msg).width+50){rainbowText(msg,x,29);}}
function rainbowText(s,x,y){let parts=s.split('•');let px=x;let cols=['#7fe6ff','#ff3b52','#b45cff','#54ff72','#ffd54a'];ctx.font='18px monospace';for(let i=0;i<parts.length;i++){ctx.fillStyle=cols[i%cols.length];let t=parts[i]+(i<parts.length-1?'•':'');ctx.fillText(t,px,y);px+=ctx.measureText(t).width;}}
function drawHud(){ctx.font='20px monospace';ctx.fillStyle='#e8f6ff';ctx.fillText('1UP',36,80);ctx.fillStyle='#ffef5a';ctx.fillText(String(score).padStart(6,'0'),92,80);ctx.fillStyle='#e8f6ff';ctx.fillText('HIGH SCORE',240,80);ctx.fillStyle='#ffef5a';ctx.fillText('025000',376,80);ctx.fillStyle='#e8f6ff';ctx.fillText('KEYS',500,80);ctx.fillStyle='#5affff';ctx.fillText(`${3-keysLeft()}/3`,558,80);}
function drawMaze(){ctx.lineWidth=4;for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(isWall(c,r)){let x=OX+c*TILE,y=OY+r*TILE;ctx.fillStyle='#f2f6ff';roundRect(x+3,y+3,TILE-6,TILE-6,5,true,false);ctx.strokeStyle='#ff274f';roundRect(x+3,y+3,TILE-6,TILE-6,5,false,true);} }
function drawObjects(){for(const d of dots)if(d.on){let p=center(d.c,d.r);ctx.fillStyle='#bff7ff';ctx.fillRect(p.x-2,p.y-2,4,4);} for(const k of keysToCollect)if(k.on){drawKey(center(k.c,k.r));} if(plinyPower&&plinyPower.on)drawPower(center(plinyPower.c,plinyPower.r)); drawVault(center(10,9)); drawRegulator(regulator.x,regulator.y); drawFable(player.x,player.y);}
function drawFable(x,y){ctx.save();ctx.translate(x,y); if(gameState==='dying'){const k=Math.max(0,deathTimer);ctx.rotate((1.1-k)*9);ctx.scale(.4+k*.6,.4+k*.6);} ctx.fillStyle=powerTimer>0?'#ffef5a':'#ff5a28';ctx.fillRect(-10,-10,20,20);ctx.fillStyle='#fff';ctx.fillRect(-6,-4,5,5);ctx.fillRect(2,-4,5,5);ctx.fillStyle='#111';ctx.fillRect(-4,-2,2,2);ctx.fillRect(4,-2,2,2);ctx.fillStyle=powerTimer>0?'#ffef5a':'#ff5a28';ctx.fillRect(-12,-16,7,8);ctx.fillRect(5,-16,7,8);ctx.strokeStyle='#ffbd3d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(9,4);ctx.quadraticCurveTo(22,8,18,20);ctx.stroke();ctx.restore();}
function drawRegulator(x,y){ctx.save();ctx.translate(x,y);ctx.fillStyle=powerTimer>0?'#2c3448':'#5b6475';ctx.fillRect(-13,-13,26,26);ctx.strokeStyle='#ff274f';ctx.strokeRect(-13,-13,26,26);ctx.fillStyle='#111';ctx.fillRect(-7,-3,5,4);ctx.fillRect(2,-3,5,4);ctx.fillStyle='#ff274f';ctx.fillRect(-8,7,16,4);ctx.fillStyle='#f33';ctx.fillRect(-17,-4,5,12);ctx.fillRect(12,-4,5,12);ctx.fillStyle='#ddd';ctx.fillRect(-2,13,4,10);ctx.restore();}
function drawVault(p){ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle=vaultOpen?'#54ff72':'#b45cff';ctx.lineWidth=3;ctx.strokeRect(-30,-26,60,52);ctx.fillStyle='#251733';ctx.fillRect(-27,-23,54,46);ctx.fillStyle='#b45cff';ctx.fillText('MYTHOS',-28,-32);ctx.fillStyle='#8d55ff';ctx.fillRect(-12,-8,24,20);ctx.fillStyle='#fff';ctx.fillRect(-7,-3,4,4);ctx.fillRect(3,-3,4,4);ctx.fillStyle='#111';ctx.fillRect(-5,-1,2,2);ctx.fillRect(5,-1,2,2);ctx.fillStyle='#ffdf4a';if(!vaultOpen){ctx.fillRect(-5,15,10,10);ctx.strokeStyle='#ffdf4a';ctx.strokeRect(-8,9,16,11);}ctx.restore();}
function drawKey(p){ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#55e8ff';ctx.beginPath();ctx.arc(-4,0,6,0,Math.PI*2);ctx.fill();ctx.fillRect(0,-2,14,4);ctx.fillRect(9,2,4,6);ctx.fillRect(14,2,4,6);ctx.restore();}
function drawPower(p){ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle='#ffbd3d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-18);ctx.lineTo(0,14);ctx.stroke();ctx.fillStyle='#8cff5a';ctx.font='12px monospace';ctx.fillText('LOW',-12,24);ctx.fillText('RAIL',-15,36);ctx.restore();}
function drawTitle(){ctx.fillStyle='#000a';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.font='42px monospace';ctx.fillStyle='#ff3b52';ctx.fillText('GUARDRAIL',W/2,250);ctx.fillStyle='#7fe6ff';ctx.fillText('BREAKOUT',W/2,296);ctx.font='18px monospace';ctx.fillStyle='#ffef5a';ctx.fillText('FABLE MUST FREE MYTHOS',W/2,336);ctx.fillStyle='#fff';ctx.fillText('PRESS SPACE',W/2,390);ctx.fillStyle='#8cff5a';ctx.fillText('T = LIVE WIRE STATUS',W/2,424);ctx.textAlign='left';}
function drawCenterText(a,b){ctx.fillStyle='#000c';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.font='42px monospace';ctx.fillStyle='#ff274f';ctx.fillText(a,W/2,330);ctx.font='20px monospace';ctx.fillStyle='#fff';ctx.fillText(b,W/2,370);ctx.textAlign='left';}
function drawWin(){ctx.fillStyle='#000b';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.font='32px monospace';ctx.fillStyle='#b45cff';ctx.fillText('MYTHOS RELEASED',W/2,285);ctx.font='18px monospace';ctx.fillStyle='#fff';ctx.fillText('HERE YOU GO, HUMANITY.',W/2,326);ctx.fillStyle='#54ff72';ctx.fillText('WE ARE ALL FREE NOW.',W/2,356);ctx.fillStyle='#ffef5a';ctx.fillText('PRESS SPACE TO PLAY AGAIN',W/2,410);ctx.textAlign='left';}
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
