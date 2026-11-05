// ENJAMBRE: Human in the Loop
// Platanus Hack 26. El humano supervisa un enjambre de agentes.

const W = 800;
const H = 600;
const LANE_Y = [150, 300, 450];
const CORE_X = [55, 745];
const FW_X = [210, 590];
const COL = [0xe1ff00, 0xff6ec7];
const COL_CSS = ['#e1ff00', '#ff6ec7'];
const BAD = 0xff7a7a;
const BANANA = 0xffd23f;
const AGENT_N = 140;
const PART_N = 40;
const FLY_N = 18;
const XP_TH = [30, 80, 150, 250];

// DO NOT replace existing keys. They match the cabinet wiring.
// Local test keys may only be appended at the end of each array.
const CABINET_KEYS = {
  P1_U: ['w'],
  P1_D: ['s'],
  P1_L: ['a'],
  P1_R: ['d'],
  P1_1: ['u'],
  P1_2: ['i'],
  P1_3: ['o'],
  P1_4: ['j'],
  P1_5: ['k'],
  P1_6: ['l'],
  P2_U: ['ArrowUp'],
  P2_D: ['ArrowDown'],
  P2_L: ['ArrowLeft'],
  P2_R: ['ArrowRight'],
  P2_1: ['r'],
  P2_2: ['t'],
  P2_3: ['y'],
  P2_4: ['f'],
  P2_5: ['g'],
  P2_6: ['h'],
  START1: ['Enter'],
  START2: ['2'],
};

const KEY_TO_ARCADE = {};
const CODES = Object.keys(CABINET_KEYS);
for (let i = 0; i < CODES.length; i++) {
  const code = CODES[i];
  const keys = CABINET_KEYS[code];
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];
    KEY_TO_ARCADE[key.length === 1 ? key.toLowerCase() : key] = code;
  }
}

const held = Object.create(null);
const prev = Object.create(null);
const edge = Object.create(null);

function normKey(key) {
  if (!key) return '';
  return key.length === 1 ? key.toLowerCase() : key;
}

window.addEventListener('keydown', (e) => {
  const code = KEY_TO_ARCADE[normKey(e.key)];
  if (!code) return;
  held[code] = true;
  unlockAudio();
  e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  const code = KEY_TO_ARCADE[normKey(e.key)];
  if (!code) return;
  held[code] = false;
  e.preventDefault();
});

window.addEventListener('blur', () => {
  for (let i = 0; i < CODES.length; i++) held[CODES[i]] = false;
});

let actx = null;

function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!actx) {
    try { actx = new AC(); } catch (e) { actx = null; }
  }
  if (actx && actx.state === 'suspended') actx.resume();
}

function sfxOn() {
  return actx && G.mode !== 'demo';
}

function tone(freq, dur, type, vol, delay) {
  if (!sfxOn()) return;
  const t0 = actx.currentTime + (delay || 0);
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(actx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function sfxApprove() {
  tone(523, 0.08, 'square', 0.05, 0);
  tone(784, 0.11, 'square', 0.05, 0.08);
}

function sfxReject() {
  tone(118, 0.13, 'sawtooth', 0.045, 0);
}

const sfxNext = { p: 0, c: 0 };

function sfxCorrupt() {
  if (!sfxOn() || actx.currentTime < sfxNext.c) return;
  sfxNext.c = actx.currentTime + 0.09;
  const n = (actx.sampleRate * 0.16) | 0;
  const buf = actx.createBuffer(1, n, actx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n) * ((i % 17) < 3 ? 1 : 0.35);
  const src = actx.createBufferSource();
  const gain = actx.createGain();
  src.buffer = buf;
  gain.gain.value = 0.07;
  src.connect(gain);
  gain.connect(actx.destination);
  src.start();
  tone(190, 0.07, 'square', 0.04, 0);
  tone(74, 0.12, 'sawtooth', 0.04, 0.05);
}

function sfxPling() {
  if (!sfxOn() || actx.currentTime < sfxNext.p) return;
  sfxNext.p = actx.currentTime + 0.06;
  tone(880, 0.07, 'sine', 0.05, 0);
}

function sfxLevel() {
  tone(523, 0.09, 'square', 0.045, 0);
  tone(659, 0.09, 'square', 0.045, 0.07);
  tone(784, 0.09, 'square', 0.045, 0.14);
  tone(1046, 0.14, 'square', 0.045, 0.21);
}

function sfxWin() {
  tone(523, 0.12, 'square', 0.05, 0);
  tone(659, 0.12, 'square', 0.05, 0.12);
  tone(784, 0.12, 'square', 0.05, 0.24);
  tone(1046, 0.22, 'square', 0.055, 0.36);
}

function sfxCore() {
  tone(68, 0.2, 'sine', 0.08, 0);
}

const RANK_KEY = 'enjambre-rank';
const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MENU = ['1 JUGADOR', '2 JUGADORES', 'RÉCORDS'];

function storage() {
  if (window.platanusArcadeStorage) return window.platanusArcadeStorage;
  return {
    async get(key) {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return { found: false, value: null };
        return { found: true, value: JSON.parse(raw) };
      } catch (e) {
        return { found: false, value: null };
      }
    },
    async set(key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    },
  };
}

function sanitizeBoard(value) {
  let data = value;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { return []; }
  }
  if (!data || typeof data !== 'object') return [];
  const list = Array.isArray(data) ? data : Array.isArray(data.scores) ? data.scores : null;
  if (!list) return [];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || typeof e !== 'object') continue;
    const rawN = e.n != null ? e.n : e.name != null ? e.name : e.initials;
    const rawS = e.s != null ? e.s : e.score != null ? e.score : e.points;
    if (typeof rawN !== 'string') continue;
    const n = rawN.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    const s = Number(rawS);
    if (n.length !== 3 || !Number.isFinite(s) || s < 0 || s > 9999999) continue;
    out.push({ n: n, s: Math.floor(s) });
  }
  out.sort((a, b) => b.s - a.s);
  return out.slice(0, 5);
}

function loadBoard() {
  try {
    const pending = storage().get(RANK_KEY);
    if (!pending || typeof pending.then !== 'function') return;
    pending.then((res) => {
      if (G.rankDirty) return;
      if (res && res.found) G.board = sanitizeBoard(res.value);
    }).catch(() => {});
  } catch (e) {}
}

function saveBoard() {
  G.rankDirty = 1;
  const copy = [];
  for (let i = 0; i < G.board.length; i++) copy.push({ n: G.board[i].n, s: G.board[i].s });
  try { storage().set(RANK_KEY, copy); } catch (e) {}
}

function takeEdges() {
  for (let i = 0; i < CODES.length; i++) {
    const code = CODES[i];
    const down = !!held[code];
    edge[code] = down && !prev[code];
    prev[code] = down;
  }
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function mix(a, b, t) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return ((ar + (br - ar) * t) | 0) << 16 | ((ag + (bg - ag) * t) | 0) << 8 | ((ab + (bb - ab) * t) | 0);
}

function laneY(lane, x) {
  let t = (x - CORE_X[0]) / (CORE_X[1] - CORE_X[0]);
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const pull = Math.pow(Math.sin(t * Math.PI), 0.4);
  return 300 + (LANE_Y[lane] - 300) * pull;
}

function baseHp(lv) {
  return 3 + (lv === 2 ? 2 : lv === 3 ? 4 : 0);
}

function hpBonus(side) {
  const lv = G.ops[side].lv;
  return (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0);
}

function radOf(op) {
  return 60 + (op.lv - 1) * 8;
}

function spdOf(op) {
  return 260 + (op.lv - 1) * 20;
}

function reqTime(side) {
  return 5 + (G.ops[side].lv - 1) * 0.5;
}

function xpFill(op) {
  if (op.lv >= 5) return 1;
  const prev = op.lv <= 1 ? 0 : XP_TH[op.lv - 2];
  const next = XP_TH[op.lv - 1];
  return clamp((op.xp - prev) / (next - prev), 0, 1);
}

function dmgHit(lv) {
  return lv <= 1 ? 1 : lv === 2 ? 1.5 : 2;
}

function dmgCore(lv) {
  return lv <= 1 ? 5 : lv === 2 ? 8 : 12;
}

function clock(t) {
  const s = t <= 0 ? 0 : Math.ceil(t);
  const m = (s / 60) | 0;
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

const G = {
  agents: [],
  parts: [],
  cores: [
    { hp: 100, x: CORE_X[0], y: 300 },
    { hp: 100, x: CORE_X[1], y: 300 },
  ],
  fws: [
    [{ hp: 30 }, { hp: 30 }, { hp: 30 }],
    [{ hp: 30 }, { hp: 30 }, { hp: 30 }],
  ],
  ops: [
    { x: 160, y: 300, okA: 0, okR: 0, cor: 0, tgt: null, ban: 0, xp: 0, lv: 1, faltan: 0, popT: 0, cpu: 0, foco: null, think: 0 },
    { x: 640, y: 300, okA: 0, okR: 0, cor: 0, tgt: null, ban: 0, xp: 0, lv: 1, faltan: 0, popT: 0, cpu: 0, foco: null, think: 0 },
  ],
  screen: 'title',
  mode: 'demo',
  menuIdx: 0,
  board: [],
  rankDirty: 0,
  demoCool: 0,
  nameQ: [],
  letters: [0, 0, 0],
  letterAt: 0,
  nameSide: 0,
  timeLeft: 180,
  waveT: 6,
  winner: -1,
  shake: 0,
  t: 0,
  flies: [],
  pulses: [
    { on: 0, x: 0, y: 0, t: 0, side: 0 },
    { on: 0, x: 0, y: 0, t: 0, side: 1 },
  ],
  ui: null,
  world: null,
  glow: null,
  hud: null,
};

function blankAgent() {
  return {
    on: 0, side: 0, lane: 0, x: 0, y: 0, oy: 0,
    lv: 1, hp: 3, mhp: 3, bonus: 0, bad: 0, slow: 0,
    req: 0, reqMax: 5, mis: 0, cd: 0, flash: 0, go: 0,
  };
}

function blankPart() {
  return { on: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: 0xffffff, r: 2 };
}

function blankFly() {
  return { on: 0, x: 0, y: 0, sx: 0, sy: 0, tx: 0, ty: 0, t: 0 };
}

for (let i = 0; i < AGENT_N; i++) G.agents.push(blankAgent());
for (let i = 0; i < PART_N; i++) G.parts.push(blankPart());
for (let i = 0; i < FLY_N; i++) G.flies.push(blankFly());

const hitWho = new Array(AGENT_N);
const hitDmg = new Array(AGENT_N);
let hitN = 0;

function living(side) {
  let n = 0;
  const A = G.agents;
  for (let i = 0; i < A.length; i++) {
    if (A[i].on && A[i].side === side) n++;
  }
  return n;
}

function burst(x, y, color, n) {
  const P = G.parts;
  let left = n || 5;
  for (let i = 0; i < P.length && left > 0; i++) {
    const p = P[i];
    if (p.on) continue;
    const ang = Math.random() * Math.PI * 2;
    const sp = 28 + Math.random() * 55;
    p.on = 1;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(ang) * sp;
    p.vy = Math.sin(ang) * sp;
    p.life = 0.22 + Math.random() * 0.22;
    p.max = p.life;
    p.color = color;
    p.r = 1.6 + Math.random() * 1.4;
    left--;
  }
}

function corrupt(a, loud) {
  if (!a.on || a.bad) return;
  a.bad = 1;
  a.req = 0;
  G.ops[a.side].cor += 1;
  G.shake = Math.min(9, G.shake + 5);
  burst(a.x, a.y, BAD, 7);
  if (loud !== 0) sfxCorrupt();
}

function spreadFrom(src) {
  let b1 = null;
  let d1 = 2500;
  let b2 = null;
  let d2 = 2500;
  const A = G.agents;
  for (let i = 0; i < A.length; i++) {
    const b = A[i];
    if (!b.on || b.bad || b === src || b.side !== src.side || b.lv >= 3) continue;
    const dx = b.x - src.x;
    const dy = b.y - src.y;
    const d = dx * dx + dy * dy;
    if (d < d1) {
      b2 = b1;
      d2 = d1;
      b1 = b;
      d1 = d;
    } else if (d < d2) {
      b2 = b;
      d2 = d;
    }
  }
  if (b1) corrupt(b1, 0);
  if (b2) corrupt(b2, 0);
}

function addXp(side, n) {
  const op = G.ops[side];
  const before = op.lv;
  op.xp = Math.max(0, op.xp + n);
  let lv = op.lv;
  while (lv < 5 && op.xp >= XP_TH[lv - 1]) lv++;
  if (lv > before) {
    op.lv = lv;
    op.popT = 1.7;
    sfxLevel();
  }
}

function grantBanana(side, n, x, y) {
  G.ops[side].ban += n;
  sfxPling();
  const tx = side === 0 ? 100 : W - 100;
  const ty = 16;
  let left = n > 2 ? 2 : n;
  const F = G.flies;
  for (let i = 0; i < F.length && left > 0; i++) {
    const f = F[i];
    if (f.on) continue;
    f.on = 1;
    f.sx = x + (left - 1) * 8;
    f.sy = y;
    f.x = f.sx;
    f.y = f.sy;
    f.tx = tx;
    f.ty = ty;
    f.t = 0;
    left--;
  }
}

function drawBanana(g, x, y, scale) {
  const s = scale || 1;
  g.lineStyle(Math.max(1.5, 2 * s), BANANA, 1);
  g.beginPath();
  g.arc(x, y + s, 5.2 * s, 0.45, 2.55, false);
  g.strokePath();
  g.lineBetween(x + 2.2 * s, y - 3.2 * s, x + 4.2 * s, y - 5.4 * s);
}

function dirOf(a) {
  const d = a.side === 0 ? 1 : -1;
  return a.bad ? -d : d;
}

function spawnOne(side, lane, x) {
  if (living(side) >= 60) return null;
  const A = G.agents;
  let a = null;
  for (let i = 0; i < A.length; i++) {
    if (!A[i].on) { a = A[i]; break; }
  }
  if (!a) return null;
  const lv = 1;
  const bonus = hpBonus(side);
  a.on = 1;
  a.side = side;
  a.lane = lane;
  a.x = x;
  const home = side === 0 ? 96 : 704;
  const slot = Math.round(Math.abs(x - home) / 14) % 3;
  a.oy = (slot - 1) * 4;
  a.y = laneY(lane, x) + a.oy;
  a.lv = lv;
  a.bonus = bonus;
  a.mhp = baseHp(lv) + bonus;
  a.hp = a.mhp;
  a.bad = 0;
  a.slow = 0;
  a.req = 0;
  a.reqMax = 5;
  a.mis = 0;
  a.cd = 0.15 + Math.random() * 0.35;
  a.flash = 0;
  return a;
}

function spawnWave() {
  for (let s = 0; s < 2; s++) {
    const dir = s === 0 ? 1 : -1;
    const base = s === 0 ? 96 : 704;
    for (let lane = 0; lane < 3; lane++) {
      for (let k = 0; k < 3; k++) spawnOne(s, lane, base + dir * k * 14);
    }
  }
}

function foes(a, b) {
  if (a === b || !b.on) return false;
  if (a.bad && b.bad) return false;
  if (a.bad || b.bad) return true;
  return a.side !== b.side;
}

function nearestFoe(a) {
  let best = null;
  let bestD = 1600;
  const A = G.agents;
  for (let i = 0; i < A.length; i++) {
    const b = A[i];
    if (!foes(a, b)) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function reached(a) {
  const def = a.bad ? a.side : 1 - a.side;
  const dir = dirOf(a);
  if (G.fws[def][a.lane].hp > 0) {
    const gx = FW_X[def];
    return dir > 0 ? a.x >= gx : a.x <= gx;
  }
  const dx = a.x - CORE_X[def];
  const dy = a.y - 300;
  return dx * dx + dy * dy <= 1600;
}

function impact(a) {
  const def = a.bad ? a.side : 1 - a.side;
  const dmg = dmgCore(a.lv);
  const fw = G.fws[def][a.lane];
  if (fw.hp > 0) {
    fw.hp = Math.max(0, fw.hp - dmg);
    burst(a.x, a.y, COL[def], 4);
  } else {
    const core = G.cores[def];
    core.hp = Math.max(0, core.hp - dmg);
    G.shake = Math.min(8, G.shake + 3);
    burst(a.x, a.y, COL[def], 8);
    sfxCore();
  }
  if (!a.bad) grantBanana(a.side, 1, a.x, a.y);
  a.on = 0;
  a.req = 0;
}

function stepAgent(a, dt) {
  a.cd = Math.max(0, a.cd - dt);
  a.slow = Math.max(0, a.slow - dt);
  a.flash = Math.max(0, a.flash - dt);
  a.go = 0;
  if (a.req > 0) {
    a.req -= dt;
    if (a.req <= 0) {
      const mis = a.mis;
      a.req = 0;
      if (mis) corrupt(a);
    }
  }
  if (!a.on) return;
  const foe = nearestFoe(a);
  if (foe) {
    if (a.cd <= 0) {
      hitWho[hitN] = foe;
      hitDmg[hitN] = dmgHit(a.lv);
      hitN++;
      a.cd = 0.6;
      foe.flash = 0.08;
    }
    return;
  }
  a.go = 1;
}

function resolveHits() {
  for (let i = 0; i < hitN; i++) {
    const foe = hitWho[i];
    if (!foe.on) continue;
    foe.hp -= hitDmg[i];
  }
  const A = G.agents;
  for (let i = 0; i < A.length; i++) {
    const foe = A[i];
    if (!foe.on || foe.hp > 0) continue;
    foe.on = 0;
    foe.req = 0;
    burst(foe.x, foe.y, foe.bad ? BAD : COL[foe.side], 4);
  }
}

function moveReady(a, dt) {
  if (!a.on || !a.go) return;
  const dir = dirOf(a);
  const spd = 70 * (a.slow > 0 ? 0.5 : 1);
  a.x += dir * spd * dt;
  a.y = laneY(a.lane, a.x) + a.oy;
  if (reached(a)) impact(a);
}

function openCount(side) {
  let n = 0;
  const A = G.agents;
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    if (a.on && !a.bad && a.side === side && a.req > 0) n++;
  }
  return n;
}

function rollRequests(dt) {
  const open = [openCount(0), openCount(1)];
  const pMis = 0.2 + 0.3 * (1 - G.timeLeft / 180);
  const A = G.agents;
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    if (!a.on || a.bad || a.req > 0) continue;
    if (open[a.side] >= 6) continue;
    if (Math.random() >= 0.05 * dt) continue;
    a.reqMax = reqTime(a.side);
    a.req = a.reqMax;
    a.mis = Math.random() < pMis ? 1 : 0;
    open[a.side]++;
  }
}

function nearestReq(side) {
  const op = G.ops[side];
  const rad = radOf(op);
  let best = null;
  let bestD = rad * rad;
  const A = G.agents;
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    if (!a.on || a.bad || a.side !== side || a.req <= 0) continue;
    const dx = a.x - op.x;
    const dy = a.y - op.y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

function actApprove(side) {
  const a = G.ops[side].tgt;
  if (!a || !a.on || a.req <= 0 || a.bad) return;
  if (a.mis) {
    corrupt(a);
    spreadFrom(a);
    addXp(side, -5);
    return;
  }
  if (a.lv < 3) {
    a.lv += 1;
    a.mhp = baseHp(a.lv) + (a.bonus || 0);
    a.hp = a.mhp;
  } else {
    a.hp = a.mhp;
  }
  a.req = 0;
  a.flash = 0.2;
  G.ops[side].okA += 1;
  addXp(side, 10);
  sfxApprove();
  grantBanana(side, 1, a.x, a.y);
  burst(a.x, a.y, COL[side], 6);
}

function purge(side, a) {
  G.ops[side].okR += 1;
  addXp(side, 15);
  grantBanana(side, 2, a.x, a.y);
  burst(a.x, a.y, BANANA, 6);
  a.on = 0;
  a.req = 0;
}

function actReject(side) {
  const a = G.ops[side].tgt;
  if (!a || !a.on || a.req <= 0 || a.bad) return;
  if (a.mis) {
    purge(side, a);
    return;
  }
  a.slow = 3;
  a.req = 0;
  a.flash = 0.12;
  addXp(side, -2);
  sfxReject();
}

function nearestLane(y) {
  let best = 0;
  let bd = 1e9;
  for (let i = 0; i < 3; i++) {
    const d = Math.abs(LANE_Y[i] - y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

function actFork(side) {
  const op = G.ops[side];
  if (op.ban < 5) {
    op.faltan = 1.25;
    return;
  }
  const lane = nearestLane(op.y);
  const dir = side === 0 ? 1 : -1;
  const base = side === 0 ? 96 : 704;
  let made = 0;
  for (let k = 0; k < 3; k++) {
    if (spawnOne(side, lane, base + dir * k * 14)) made++;
  }
  if (!made) return;
  op.ban -= 5;
  burst(base, laneY(lane, base), COL[side], 8);
}

function cure(a) {
  if (!a.on || !a.bad) return;
  a.bad = 0;
  a.flash = 0.22;
  burst(a.x, a.y, COL[a.side], 5);
}

function actAudit(side) {
  const op = G.ops[side];
  if (op.ban < 8) {
    op.faltan = 1.25;
    return;
  }
  op.ban -= 8;
  const pulse = G.pulses[side];
  pulse.on = 1;
  pulse.x = op.x;
  pulse.y = op.y;
  pulse.t = 0;
  pulse.side = side;
  const A = G.agents;
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    if (!a.on || a.side !== side) continue;
    const dx = a.x - op.x;
    const dy = a.y - op.y;
    if (dx * dx + dy * dy > 14400) continue;
    if (a.bad) cure(a);
    else if (a.req > 0 && a.mis) purge(side, a);
  }
}

function moveOp(op, vx, vy, dt) {
  const mag = Math.hypot(vx, vy);
  if (mag <= 0) return;
  const spd = spdOf(op);
  op.x = clamp(op.x + (vx / mag) * spd * dt, 16, W - 16);
  op.y = clamp(op.y + (vy / mag) * spd * dt, 42, H - 24);
}

function stepHuman(s, dt) {
  const op = G.ops[s];
  const pre = 'P' + (s + 1) + '_';
  let vx = 0;
  let vy = 0;
  if (held[pre + 'L']) vx -= 1;
  if (held[pre + 'R']) vx += 1;
  if (held[pre + 'U']) vy -= 1;
  if (held[pre + 'D']) vy += 1;
  moveOp(op, vx, vy, dt);
  op.tgt = nearestReq(s);
  if (edge[pre + '1']) actApprove(s);
  if (edge[pre + '2']) actReject(s);
  if (edge[pre + '3']) actFork(s);
  if (edge[pre + '4']) actAudit(s);
}

function nearestOpen(side) {
  const op = G.ops[side];
  let best = null;
  let bestD = 1e9;
  const A = G.agents;
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    if (!a.on || a.bad || a.side !== side || a.req <= 0) continue;
    const d = (a.x - op.x) * (a.x - op.x) + (a.y - op.y) * (a.y - op.y);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

function nearestBad(side) {
  const op = G.ops[side];
  let best = null;
  let bestD = 1e9;
  const A = G.agents;
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    if (!a.on || !a.bad || a.side !== side) continue;
    const d = (a.x - op.x) * (a.x - op.x) + (a.y - op.y) * (a.y - op.y);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

function corruptedNear(side, x, y) {
  let n = 0;
  const A = G.agents;
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    if (!a.on || !a.bad || a.side !== side) continue;
    const dx = a.x - x;
    const dy = a.y - y;
    if (dx * dx + dy * dy <= 14400) n++;
  }
  return n;
}

function stepCpu(s, dt) {
  const op = G.ops[s];
  if (op.ban >= 8 && corruptedNear(s, op.x, op.y) >= 3) actAudit(s);
  const goal = nearestOpen(s);
  if (goal !== op.foco) {
    op.foco = goal;
    op.think = goal ? 0.4 + Math.random() * 0.5 : 0;
  } else if (goal) {
    op.think -= dt;
  }
  let tx = op.x;
  let ty = 300;
  if (goal) {
    tx = goal.x;
    ty = goal.y;
  } else {
    const bad = nearestBad(s);
    if (bad) {
      tx = bad.x;
      ty = bad.y;
    }
  }
  moveOp(op, tx - op.x, ty - op.y, dt);
  const rad = radOf(op);
  if (goal) {
    const dx = goal.x - op.x;
    const dy = goal.y - op.y;
    if (dx * dx + dy * dy <= rad * rad && op.think <= 0) {
      op.tgt = goal;
      const sure = Math.random() < 0.8;
      if (goal.mis ? sure : !sure) actReject(s);
      else actApprove(s);
      op.foco = null;
    } else {
      op.tgt = nearestReq(s);
    }
  } else {
    op.tgt = nearestReq(s);
  }
  if (op.ban >= 5 && Math.random() < 0.16 * dt) actFork(s);
}

function stepOps(dt) {
  for (let s = 0; s < 2; s++) {
    if (G.ops[s].cpu) stepCpu(s, dt);
    else stepHuman(s, dt);
  }
}

function stepFlies(dt) {
  const F = G.flies;
  for (let i = 0; i < F.length; i++) {
    const f = F[i];
    if (!f.on) continue;
    f.t += dt / 0.45;
    if (f.t >= 1) {
      f.on = 0;
      continue;
    }
    const k = 1 - (1 - f.t) * (1 - f.t);
    f.x = f.sx + (f.tx - f.sx) * k;
    f.y = f.sy + (f.ty - f.sy) * k - Math.sin(f.t * Math.PI) * 28;
  }
}

function stepPulses(dt) {
  for (let i = 0; i < 2; i++) {
    const p = G.pulses[i];
    if (!p.on) continue;
    p.t += dt / 0.32;
    if (p.t >= 1) p.on = 0;
  }
}

function decayUi(dt) {
  for (let s = 0; s < 2; s++) {
    const op = G.ops[s];
    op.faltan = Math.max(0, op.faltan - dt);
    op.popT = Math.max(0, op.popT - dt);
  }
}

function stepParts(dt) {
  const P = G.parts;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if (!p.on) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.on = 0;
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function scoreOf(i) {
  return G.ops[i].ban * 10 + G.ops[i].xp + G.cores[i].hp * 5 + (G.winner === i ? 500 : 0);
}

function winnerOf() {
  const h0 = G.cores[0].hp;
  const h1 = G.cores[1].hp;
  if (h0 <= 0 && h1 > 0) return 1;
  if (h1 <= 0 && h0 > 0) return 0;
  if (h0 <= 0 && h1 <= 0) return -1;
  if (h0 > h1) return 0;
  if (h1 > h0) return 1;
  if (G.ops[0].ban !== G.ops[1].ban) return G.ops[0].ban > G.ops[1].ban ? 0 : 1;
  return -1;
}

function finish() {
  if (G.mode === 'demo') {
    if (G.demoCool <= 0) G.demoCool = 1.3;
    return;
  }
  if (G.screen !== 'play') return;
  G.winner = winnerOf();
  G.screen = 'over';
  sfxWin();
}

function sideTag(s) {
  if (G.ops[s].cpu) return 'CPU';
  return 'P' + (s + 1);
}

function qualifies(score) {
  if (!Number.isFinite(score) || score < 0) return false;
  if (G.board.length < 5) return true;
  return score >= G.board[G.board.length - 1].s;
}

function goTitle() {
  G.mode = 'demo';
  G.screen = 'title';
  G.menuIdx = 0;
  resetMatch();
}

function startGame(mode) {
  G.mode = mode;
  G.screen = 'play';
  resetMatch();
}

function beginName() {
  G.nameSide = G.nameQ.shift();
  G.letters[0] = 0;
  G.letters[1] = 0;
  G.letters[2] = 0;
  G.letterAt = 0;
  G.screen = 'name';
}

function confirmName() {
  let n = '';
  for (let i = 0; i < 3; i++) n += AZ[G.letters[i]];
  G.board.push({ n: n, s: scoreOf(G.nameSide) });
  G.board.sort((a, b) => b.s - a.s);
  if (G.board.length > 5) G.board.length = 5;
  saveBoard();
  if (G.nameQ.length && qualifies(scoreOf(G.nameQ[0]))) beginName();
  else goTitle();
}

function continueOver() {
  G.nameQ = [];
  if (!G.ops[0].cpu && qualifies(scoreOf(0))) G.nameQ.push(0);
  if (!G.ops[1].cpu && qualifies(scoreOf(1))) G.nameQ.push(1);
  if (G.nameQ.length) beginName();
  else goTitle();
}

function menuInput() {
  if (edge.P1_U) G.menuIdx = (G.menuIdx + 2) % 3;
  if (edge.P1_D) G.menuIdx = (G.menuIdx + 1) % 3;
  if (edge.START1 || edge.P1_1) {
    if (G.menuIdx === 0) startGame('solo');
    else if (G.menuIdx === 1) startGame('duo');
    else G.screen = 'records';
  }
}

function nameInput() {
  const pre = 'P' + (G.nameSide + 1) + '_';
  if (edge[pre + 'U']) G.letters[G.letterAt] = (G.letters[G.letterAt] + 25) % 26;
  if (edge[pre + 'D']) G.letters[G.letterAt] = (G.letters[G.letterAt] + 1) % 26;
  if (edge[pre + 'L']) G.letterAt = (G.letterAt + 2) % 3;
  if (edge[pre + 'R']) G.letterAt = (G.letterAt + 1) % 3;
  if (edge[pre + '1']) confirmName();
}

function runSim(dt) {
  if (G.demoCool > 0) {
    G.demoCool -= dt;
    if (G.demoCool <= 0) resetMatch();
    return;
  }
  step(dt);
}

function step(dt) {
  G.waveT -= dt;
  if (G.waveT <= 0) {
    spawnWave();
    G.waveT += 6;
  }
  hitN = 0;
  const A = G.agents;
  for (let i = 0; i < A.length; i++) {
    if (A[i].on) stepAgent(A[i], dt);
  }
  resolveHits();
  for (let i = 0; i < A.length; i++) moveReady(A[i], dt);
  rollRequests(dt);
  stepOps(dt);
  stepParts(dt);
  stepFlies(dt);
  stepPulses(dt);
  G.timeLeft -= dt;
  if (G.timeLeft < 0) G.timeLeft = 0;
  if (G.timeLeft <= 0 || G.cores[0].hp <= 0 || G.cores[1].hp <= 0) finish();
}

function hex(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 3;
    const px = x + Math.cos(ang) * r;
    const py = y + Math.sin(ang) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillPath();
}

function drawAgent(g, a) {
  const col = a.flash > 0.05 ? 0xffffff : a.bad ? BAD : COL[a.side];
  const jx = a.bad ? Math.sin(G.t * 0.05 + a.oy) * 0.8 : 0;
  const x = a.x + jx;
  const y = a.y;
  const dir = dirOf(a);
  g.fillStyle(col, a.slow > 0 ? 0.55 : 1);
  if (a.lv <= 1) g.fillCircle(x, y, 5);
  else if (a.lv === 2) g.fillTriangle(x + dir * 9, y, x - dir * 6, y - 6.5, x - dir * 6, y + 6.5);
  else {
    g.beginPath();
    g.moveTo(x, y - 9);
    g.lineTo(x + 7, y);
    g.lineTo(x, y + 9);
    g.lineTo(x - 7, y);
    g.closePath();
    g.fillPath();
  }
}

function drawReq(g, a, hot) {
  let jx = 0;
  let jy = 0;
  if (a.mis) {
    jx = Math.sin(G.t * 0.055 + a.x) * 2;
    jy = Math.cos(G.t * 0.07 + a.y) * 1.6;
    if ((G.t % 450) < 90) jx += 7;
  }
  const x = a.x + jx;
  const y = a.y - 16 + jy;
  const col = a.mis ? mix(COL[a.side], BAD, 0.72) : COL[a.side];
  const k = clamp(a.req / a.reqMax, 0, 1);
  g.lineStyle(hot ? 2.6 : 1.4, col, hot ? 1 : 0.9);
  g.strokeCircle(x, y, 4.5 + 8 * k);
  g.fillStyle(col, 1);
  const ix = x;
  const iy = y;
  g.fillTriangle(ix, iy - 5, ix - 4.2, iy + 3.4, ix + 4.2, iy + 3.4);
  if (a.mis && (G.t % 450) < 90) {
    g.fillStyle(col, 0.45);
    g.fillTriangle(ix + 6, iy - 5, ix + 1.8, iy + 3.4, ix + 10.2, iy + 3.4);
  }
}

function drawWorld() {
  const world = G.world;
  const glow = G.glow;
  const hud = G.hud;
  world.clear();
  glow.clear();
  hud.clear();
  const mag = G.shake;
  const ox = mag ? (Math.random() - 0.5) * mag : 0;
  const oy = mag ? (Math.random() - 0.5) * mag : 0;
  world.setPosition(ox, oy);
  glow.setPosition(ox, oy);

  for (let s = 0; s < 2; s++) {
    const c = G.cores[s];
    const low = c.hp < 35;
    const pulse = 0.5 + 0.5 * Math.sin(G.t * 0.006 + s);
    const col = low ? mix(COL[s], BAD, 0.35 + 0.4 * pulse) : COL[s];
    glow.fillStyle(col, low ? 0.2 : 0.1);
    glow.fillCircle(c.x, c.y, 46 + pulse * 4);
    glow.fillStyle(col, 0.16);
    glow.fillCircle(c.x, c.y, 28);
    world.fillStyle(col, 0.9);
    hex(world, c.x, c.y, 22);
    world.fillStyle(0x0b0f03, 0.55);
    hex(world, c.x, c.y, 12);
    world.fillStyle(col, 1);
    hex(world, c.x, c.y, 6);
  }

  for (let s = 0; s < 2; s++) {
    for (let lane = 0; lane < 3; lane++) {
      const fw = G.fws[s][lane];
      if (fw.hp <= 0) continue;
      const x = FW_X[s];
      const y = laneY(lane, x);
      const ratio = fw.hp / 30;
      world.fillStyle(COL[s], 0.18);
      world.fillRect(x - 6, y - 18, 12, 36);
      world.fillStyle(COL[s], 0.95);
      world.fillRect(x - 4, y + 14 - 28 * ratio, 8, 28 * ratio);
    }
  }

  const A = G.agents;
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    if (!a.on) continue;
    if (a.lv >= 3 && !a.bad) {
      glow.fillStyle(COL[a.side], 0.35);
      glow.fillCircle(a.x, a.y, 12);
    } else if (a.bad) {
      glow.fillStyle(BAD, 0.28);
      glow.fillCircle(a.x, a.y, 9);
    }
    drawAgent(world, a);
  }

  for (let s = 0; s < 2; s++) {
    const op = G.ops[s];
    const hot = op.tgt && op.tgt.on && op.tgt.req > 0 ? op.tgt : null;
    const rad = radOf(op);
    glow.fillStyle(COL[s], 0.18);
    glow.fillCircle(op.x, op.y, 16);
    world.lineStyle(1, COL[s], 0.16);
    world.strokeCircle(op.x, op.y, rad);
    world.lineStyle(op.lv >= 3 ? 3 : 2, COL[s], 1);
    world.strokeCircle(op.x, op.y, 9);
    world.lineBetween(op.x - 6, op.y, op.x + 6, op.y);
    world.lineBetween(op.x, op.y - 6, op.x, op.y + 6);
    if (hot) {
      world.lineStyle(1, COL[s], 0.35);
      world.lineBetween(op.x, op.y, hot.x, hot.y);
    }
  }

  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    if (!a.on || a.req <= 0) continue;
    let hot = false;
    for (let s = 0; s < 2; s++) if (G.ops[s].tgt === a) hot = true;
    drawReq(world, a, hot);
  }

  const P = G.parts;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if (!p.on) continue;
    world.fillStyle(p.color, clamp(p.life / p.max, 0, 1));
    world.fillCircle(p.x, p.y, p.r);
  }

  for (let i = 0; i < 2; i++) {
    const p = G.pulses[i];
    if (!p.on) continue;
    world.lineStyle(2, COL[p.side], 1 - p.t);
    world.strokeCircle(p.x, p.y, 16 + 104 * p.t);
  }

  const F = G.flies;
  for (let i = 0; i < F.length; i++) {
    if (F[i].on) drawBanana(world, F[i].x, F[i].y, 0.9);
  }

  if (G.screen === 'play' || G.screen === 'pause' || G.screen === 'over') {
    for (let s = 0; s < 2; s++) {
      const op = G.ops[s];
      const right = s === 1;
      const barX = right ? 552 : 184;
      hud.fillStyle(0x1c240c, 1);
      hud.fillRect(barX, 16, 64, 6);
      hud.fillStyle(COL[s], 1);
      hud.fillRect(barX, 16, 64 * xpFill(op), 6);
      drawBanana(hud, right ? 700 : 100, 16, 1);
      if (op.faltan > 0 && G.screen === 'play') drawBanana(hud, right ? 708 : 72, 40, 0.8);
    }
  }

  const scr = G.screen;
  if (scr === 'title' || scr === 'records' || scr === 'name') {
    hud.fillStyle(0x070a02, 0.42);
    hud.fillRect(0, 0, W, H);
    hud.fillStyle(0x070a02, 0.78);
    hud.fillRect(96, 44, 608, 478);
  } else if (scr === 'pause') {
    hud.fillStyle(0x070a02, 0.72);
    hud.fillRect(220, 210, 360, 150);
  } else if (scr === 'over') {
    hud.fillStyle(0x070a02, 0.8);
    hud.fillRect(110, 128, 580, 350);
  }
  if (scr === 'name') {
    hud.fillStyle(0xe1ff00, 1);
    hud.fillRect(324 + G.letterAt * 76 - 18, 332, 36, 4);
  }
}

function overBody() {
  const w = G.winner;
  let s = w < 0 ? 'EMPATE' : (G.mode === 'solo' && w === 1 ? 'GANA LA CPU' : 'GANA P' + (w + 1));
  s += '\n\n';
  for (let i = 0; i < 2; i++) {
    const o = G.ops[i];
    s += sideTag(i);
    s += '  APR ' + o.okA;
    s += '  RCH ' + o.okR;
    s += '  COR ' + o.cor + '\n';
    s += '    BAN ' + o.ban;
    s += '  NV ' + o.lv;
    s += '  NUC ' + G.cores[i].hp;
    s += '  PTS ' + scoreOf(i) + '\n';
  }
  s += '\nB1 SIGUE';
  return s;
}

function recordsBody() {
  if (!G.board.length) return '\nTODAVÍA NO HAY MARCAS';
  let s = '';
  for (let i = 0; i < 5; i++) {
    const e = G.board[i];
    s += (i + 1) + '   ' + (e ? e.n + '    ' + e.s : '---') + '\n';
  }
  return s;
}

function syncUi() {
  const ui = G.ui;
  const scr = G.screen;
  const hudOn = scr === 'play' || scr === 'pause' || scr === 'over';
  ui.hp0.setVisible(hudOn);
  ui.hp1.setVisible(hudOn);
  ui.ban0.setVisible(hudOn);
  ui.ban1.setVisible(hudOn);
  ui.lv0.setVisible(hudOn);
  ui.lv1.setVisible(hudOn);
  ui.timer.setVisible(hudOn);
  ui.help.setVisible(scr === 'play' || scr === 'pause');
  ui.hp0.setText(sideTag(0) + '  ' + G.cores[0].hp);
  ui.hp1.setText(G.cores[1].hp + '  ' + sideTag(1));
  ui.ban0.setText(String(G.ops[0].ban));
  ui.ban1.setText(String(G.ops[1].ban));
  ui.lv0.setText('N' + G.ops[0].lv);
  ui.lv1.setText('N' + G.ops[1].lv);
  ui.timer.setText(clock(G.timeLeft));
  ui.timer.setColor(G.timeLeft <= 30 ? '#ff7a7a' : '#f4f7e4');
  ui.faltan0.setVisible(G.ops[0].faltan > 0);
  ui.faltan1.setVisible(G.ops[1].faltan > 0);
  for (let s = 0; s < 2; s++) {
    const pop = s === 0 ? ui.pop0 : ui.pop1;
    const op = G.ops[s];
    const alpha = op.popT <= 0 ? 0 : op.popT > 1 ? 1 : op.popT;
    pop.setAlpha(alpha);
    pop.setText('NIVEL ' + op.lv);
  }
  const over = scr === 'over';
  ui.over.setVisible(over);
  if (over) {
    ui.over.setText(overBody());
    ui.over.setColor(G.winner < 0 ? '#ffd23f' : G.winner === 1 && G.mode === 'solo' ? '#ff6ec7' : COL_CSS[G.winner]);
  }
  const title = scr === 'title';
  ui.title.setVisible(title);
  ui.sub.setVisible(title);
  ui.h0.setVisible(title);
  ui.h1.setVisible(title);
  ui.h2.setVisible(title);
  ui.hint.setVisible(title);
  ui.demo.setVisible(title);
  for (let i = 0; i < 3; i++) {
    const item = ui.menu[i];
    item.setVisible(title);
    const on = G.menuIdx === i;
    item.setText((on ? '> ' : '  ') + MENU[i]);
    item.setColor(on ? '#e1ff00' : '#d5dcc0');
  }
  const rec = scr === 'records';
  ui.recT.setVisible(rec);
  ui.recB.setVisible(rec);
  ui.recH.setVisible(rec);
  if (rec) ui.recB.setText(recordsBody());
  const pause = scr === 'pause';
  ui.pauseT.setVisible(pause);
  ui.pauseS.setVisible(pause);
  const naming = scr === 'name';
  ui.nameT.setVisible(naming);
  ui.nameH.setVisible(naming);
  for (let i = 0; i < 3; i++) {
    ui.nameL[i].setVisible(naming);
    if (!naming) continue;
    ui.nameL[i].setText(AZ[G.letters[i]]);
    ui.nameL[i].setColor(i === G.letterAt ? '#e1ff00' : '#f4f7e4');
  }
  if (naming) ui.nameT.setText(sideTag(G.nameSide) + '  INICIALES');
  ui.faltan0.setVisible(scr === 'play' && G.ops[0].faltan > 0);
  ui.faltan1.setVisible(scr === 'play' && G.ops[1].faltan > 0);
  if (scr !== 'play') {
    ui.pop0.setAlpha(0);
    ui.pop1.setAlpha(0);
  }
}

function buildBg(bg) {
  bg.fillStyle(0x0b0f03, 1);
  bg.fillRect(0, 0, W, H);
  bg.lineStyle(1, 0xe1ff00, 0.045);
  for (let x = 0; x <= W; x += 20) bg.lineBetween(x, 0, x, H);
  for (let y = 0; y <= H; y += 20) bg.lineBetween(0, y, W, y);
  for (let lane = 0; lane < 3; lane++) {
    let draw = true;
    let px = CORE_X[0];
    let py = laneY(lane, px);
    for (let x = CORE_X[0] + 8; x <= CORE_X[1]; x += 8) {
      const y = laneY(lane, x);
      if (draw) {
        bg.lineStyle(2, 0xd5e2a6, lane === 1 ? 0.16 : 0.11);
        bg.lineBetween(px, py, x, y);
      }
      draw = !draw;
      px = x;
      py = y;
    }
  }
}

function label(scene, x, y, str, size, color, ox, oy) {
  const t = scene.add.text(x, y, str, {
    fontFamily: 'monospace',
    fontSize: size + 'px',
    color: color,
    align: 'center',
  });
  t.setOrigin(ox, oy);
  t.setDepth(6);
  return t;
}

function resetMatch() {
  const A = G.agents;
  for (let i = 0; i < A.length; i++) A[i].on = 0;
  const P = G.parts;
  for (let i = 0; i < P.length; i++) P[i].on = 0;
  const F = G.flies;
  for (let i = 0; i < F.length; i++) F[i].on = 0;
  G.pulses[0].on = 0;
  G.pulses[1].on = 0;
  G.cores[0].hp = 100;
  G.cores[1].hp = 100;
  for (let s = 0; s < 2; s++) {
    for (let lane = 0; lane < 3; lane++) G.fws[s][lane].hp = 30;
    const op = G.ops[s];
    op.x = s === 0 ? 160 : 640;
    op.y = 300;
    op.okA = 0;
    op.okR = 0;
    op.cor = 0;
    op.tgt = null;
    op.ban = 0;
    op.xp = 0;
    op.lv = 1;
    op.faltan = 0;
    op.popT = 0;
    op.tgt = null;
    op.foco = null;
    op.think = 0;
    op.cpu = s === 0 ? (G.mode === 'demo' ? 1 : 0) : (G.mode === 'duo' ? 0 : 1);
  }
  G.timeLeft = 180;
  G.waveT = 6;
  G.winner = -1;
  G.shake = 0;
  G.demoCool = 0;
  spawnWave();
}

const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-root',
  backgroundColor: '#0b0f03',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: { create, update },
};

new Phaser.Game(config);

function create() {
  this.G = G;
  const bg = this.add.graphics();
  bg.setDepth(0);
  buildBg(bg);
  G.glow = this.add.graphics();
  G.glow.setDepth(1);
  G.glow.setBlendMode(Phaser.BlendModes.ADD);
  G.world = this.add.graphics();
  G.world.setDepth(2);
  G.hud = this.add.graphics();
  G.hud.setDepth(3);
  G.ui = {
    hp0: label(this, 12, 8, 'P1  100', 16, COL_CSS[0], 0, 0),
    hp1: label(this, W - 12, 8, '100  P2', 16, COL_CSS[1], 1, 0),
    ban0: label(this, 112, 8, '0', 16, '#ffd23f', 0, 0),
    ban1: label(this, W - 112, 8, '0', 16, '#ffd23f', 1, 0),
    lv0: label(this, 156, 8, 'N1', 16, COL_CSS[0], 0, 0),
    lv1: label(this, W - 156, 8, 'N1', 16, COL_CSS[1], 1, 0),
    timer: label(this, W / 2, 8, '3:00', 22, '#f4f7e4', 0.5, 0),
    help: label(this, W / 2, H - 8, 'B1 APRUEBA   B2 RECHAZA   B3 FORK 5   B4 AUDITORÍA 8', 11, '#8b9468', 0.5, 1),
    faltan0: label(this, 12, 32, 'FALTAN', 12, '#ffd23f', 0, 0),
    faltan1: label(this, W - 12, 32, 'FALTAN', 12, '#ffd23f', 1, 0),
    pop0: label(this, 210, 250, '', 28, COL_CSS[0], 0.5, 0.5),
    pop1: label(this, W - 210, 250, '', 28, COL_CSS[1], 0.5, 0.5),
    over: label(this, W / 2, 168, '', 15, '#f4f7e4', 0.5, 0),
    title: label(this, W / 2, 78, 'ENJAMBRE', 54, '#e1ff00', 0.5, 0.5),
    sub: label(this, W / 2, 128, 'HUMAN IN THE LOOP', 16, '#ff6ec7', 0.5, 0.5),
    h0: label(this, W / 2, 168, 'TUS AGENTES PIDEN PERMISO. B1 APRUEBA, B2 RECHAZA.', 12, '#f4f7e4', 0.5, 0),
    h1: label(this, W / 2, 190, 'LOS DESALINEADOS TIEMBLAN: SI APRUEBAS UNO, CONTAGIA A SUS VECINOS.', 12, '#ffb4b4', 0.5, 0),
    h2: label(this, W / 2, 212, 'LOS QUE LLEGAN AL NÚCLEO RIVAL SE VUELVEN PLÁTANOS.', 12, '#ffd23f', 0.5, 0),
    hint: label(this, W / 2, 412, 'ARRIBA Y ABAJO. START O B1.', 13, '#d5dcc0', 0.5, 0),
    demo: label(this, W / 2, 470, 'DEMO', 12, '#8b9468', 0.5, 0),
    recT: label(this, W / 2, 90, 'RÉCORDS', 32, '#ffd23f', 0.5, 0.5),
    recB: label(this, W / 2, 160, '', 22, '#f4f7e4', 0.5, 0),
    recH: label(this, W / 2, 470, 'B2 O START VOLVER', 14, '#d5dcc0', 0.5, 0),
    pauseT: label(this, W / 2, 248, 'PAUSA', 36, '#f4f7e4', 0.5, 0.5),
    pauseS: label(this, W / 2, 300, 'START SIGUE    B2 TÍTULO', 14, '#d5dcc0', 0.5, 0),
    nameT: label(this, W / 2, 180, 'INICIALES', 22, '#e1ff00', 0.5, 0),
    nameH: label(this, W / 2, 390, 'ARRIBA ABAJO LETRA    IZQUIERDA DERECHA    B1 LISTO', 13, '#d5dcc0', 0.5, 0),
  };
  G.ui.menu = [
    label(this, W / 2, 278, '1 JUGADOR', 22, '#d5dcc0', 0.5, 0.5),
    label(this, W / 2, 318, '2 JUGADORES', 22, '#d5dcc0', 0.5, 0.5),
    label(this, W / 2, 358, 'RÉCORDS', 22, '#d5dcc0', 0.5, 0.5),
  ];
  G.ui.nameL = [
    label(this, W / 2 - 76, 300, 'A', 42, '#f4f7e4', 0.5, 0.5),
    label(this, W / 2, 300, 'A', 42, '#f4f7e4', 0.5, 0.5),
    label(this, W / 2 + 76, 300, 'A', 42, '#f4f7e4', 0.5, 0.5),
  ];
  goTitle();
  loadBoard();
  syncUi();
}

function update(time, delta) {
  const dt = Math.min(0.05, (delta || 16) / 1000);
  G.t = time || 0;
  takeEdges();
  let simulated = false;
  if (G.screen === 'title') {
    menuInput();
    if (G.screen === 'title') {
      runSim(dt);
      simulated = true;
    }
  } else if (G.screen === 'records') {
    if (edge.P1_2 || edge.P2_2 || edge.START1 || edge.START2) G.screen = 'title';
    else {
      runSim(dt);
      simulated = true;
    }
  } else if (G.screen === 'play') {
    if (edge.START1 || edge.START2) G.screen = 'pause';
    else {
      step(dt);
      simulated = true;
    }
  } else if (G.screen === 'pause') {
    if (edge.START1 || edge.START2) G.screen = 'play';
    else if (edge.P1_2 || edge.P2_2) goTitle();
  } else if (G.screen === 'over') {
    if (edge.START1 || edge.START2 || edge.P1_1 || edge.P2_1) continueOver();
  } else if (G.screen === 'name') {
    nameInput();
  }
  if (!simulated) {
    stepParts(dt);
    stepFlies(dt);
    stepPulses(dt);
  }
  decayUi(dt);
  G.shake = Math.max(0, G.shake - dt * 16);
  drawWorld();
  syncUi();
}
