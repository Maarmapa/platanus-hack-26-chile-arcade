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
    { x: 160, y: 300, okA: 0, okR: 0, cor: 0, tgt: null, ban: 0, xp: 0, lv: 1, faltan: 0, popT: 0 },
    { x: 640, y: 300, okA: 0, okR: 0, cor: 0, tgt: null, ban: 0, xp: 0, lv: 1, faltan: 0, popT: 0 },
  ],
  screen: 'play',
  timeLeft: 180,
  waveT: 6,
  winner: -1,
  shake: 0,
  t: 0,
  seq: 0,
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
    req: 0, reqMax: 5, mis: 0, cd: 0, flash: 0,
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

function corrupt(a) {
  if (!a.on || a.bad) return;
  a.bad = 1;
  a.req = 0;
  G.ops[a.side].cor += 1;
  G.shake = Math.min(9, G.shake + 5);
  burst(a.x, a.y, BAD, 7);
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
  if (b1) corrupt(b1);
  if (b2) corrupt(b2);
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
  }
}

function grantBanana(side, n, x, y) {
  G.ops[side].ban += n;
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
  a.oy = ((G.seq++ % 5) - 2) * 3;
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
  }
  if (!a.bad) grantBanana(a.side, 1, a.x, a.y);
  a.on = 0;
  a.req = 0;
}

function stepAgent(a, dt) {
  a.cd = Math.max(0, a.cd - dt);
  a.slow = Math.max(0, a.slow - dt);
  a.flash = Math.max(0, a.flash - dt);
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
      foe.hp -= dmgHit(a.lv);
      foe.flash = 0.08;
      a.cd = 0.6;
      if (foe.hp <= 0) {
        foe.on = 0;
        foe.req = 0;
        burst(foe.x, foe.y, foe.bad ? BAD : COL[foe.side], 4);
      }
    }
    return;
  }
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

function stepOps(dt) {
  for (let s = 0; s < 2; s++) {
    const op = G.ops[s];
    const pre = 'P' + (s + 1) + '_';
    let vx = 0;
    let vy = 0;
    if (held[pre + 'L']) vx -= 1;
    if (held[pre + 'R']) vx += 1;
    if (held[pre + 'U']) vy -= 1;
    if (held[pre + 'D']) vy += 1;
    const mag = Math.hypot(vx, vy);
    if (mag > 0) {
      const spd = spdOf(op);
      op.x = clamp(op.x + (vx / mag) * spd * dt, 16, W - 16);
      op.y = clamp(op.y + (vy / mag) * spd * dt, 42, H - 24);
    }
    op.tgt = nearestReq(s);
    if (edge[pre + '1']) actApprove(s);
    if (edge[pre + '2']) actReject(s);
    if (edge[pre + '3']) actFork(s);
    if (edge[pre + '4']) actAudit(s);
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
  if (G.screen !== 'play') return;
  G.winner = winnerOf();
  G.screen = 'over';
}

function step(dt) {
  G.waveT -= dt;
  if (G.waveT <= 0) {
    spawnWave();
    G.waveT += 6;
  }
  const A = G.agents;
  for (let i = 0; i < A.length; i++) {
    if (A[i].on) stepAgent(A[i], dt);
  }
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
    jx = Math.sin(G.t * 0.05 + a.x) * 1.7;
    jy = Math.cos(G.t * 0.063 + a.y) * 1.3;
    if (((G.t / 400) | 0) % 3 === 0 && (G.t % 400) < 80) jx += 6;
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
  if (a.mis && (G.t % 400) < 80 && ((G.t / 400) | 0) % 3 === 0) {
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

  for (let s = 0; s < 2; s++) {
    const op = G.ops[s];
    const right = s === 1;
    const barX = right ? 552 : 184;
    hud.fillStyle(0x1c240c, 1);
    hud.fillRect(barX, 16, 64, 6);
    hud.fillStyle(COL[s], 1);
    hud.fillRect(barX, 16, 64 * xpFill(op), 6);
    drawBanana(hud, right ? 700 : 100, 16, 1);
    if (op.faltan > 0) drawBanana(hud, right ? 708 : 72, 40, 0.8);
  }

  if (G.screen === 'over') {
    hud.fillStyle(0x070a02, 0.78);
    hud.fillRect(150, 145, 500, 300);
  }
}

function overBody() {
  const w = G.winner;
  let s = w < 0 ? 'EMPATE' : 'GANA P' + (w + 1);
  s += '\n\n';
  for (let i = 0; i < 2; i++) {
    const o = G.ops[i];
    s += 'P' + (i + 1);
    s += '  APR ' + o.okA;
    s += '  RCH ' + o.okR;
    s += '  COR ' + o.cor + '\n';
    s += '    BAN ' + o.ban;
    s += '  NV ' + o.lv;
    s += '  NUC ' + G.cores[i].hp;
    s += '  PTS ' + scoreOf(i) + '\n';
  }
  s += '\nSTART  OTRA VEZ';
  return s;
}

function syncUi() {
  const ui = G.ui;
  ui.hp0.setText('P1  ' + G.cores[0].hp);
  ui.hp1.setText(G.cores[1].hp + '  P2');
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
  const over = G.screen === 'over';
  ui.over.setVisible(over);
  if (over) {
    ui.over.setText(overBody());
    ui.over.setColor(G.winner < 0 ? '#ffd23f' : COL_CSS[G.winner]);
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
  }
  G.timeLeft = 180;
  G.waveT = 6;
  G.winner = -1;
  G.shake = 0;
  G.screen = 'play';
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
    over: label(this, W / 2, 175, '', 15, '#f4f7e4', 0.5, 0),
  };
  G.ui.over.setVisible(false);
  G.ui.faltan0.setVisible(false);
  G.ui.faltan1.setVisible(false);
  G.ui.pop0.setAlpha(0);
  G.ui.pop1.setAlpha(0);
  resetMatch();
}

function update(time, delta) {
  const dt = Math.min(0.05, (delta || 16) / 1000);
  G.t = time || 0;
  takeEdges();
  if (G.screen === 'play') step(dt);
  else if (G.screen === 'over' && (edge.START1 || edge.START2 || edge.P1_1 || edge.P2_1)) resetMatch();
  if (G.screen !== 'play') {
    stepParts(dt);
    stepFlies(dt);
    stepPulses(dt);
  }
  decayUi(dt);
  G.shake = Math.max(0, G.shake - dt * 16);
  drawWorld();
  syncUi();
}
