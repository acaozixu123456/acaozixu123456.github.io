'use strict';

/* ---------- 步行冥想：拿铁跟着你的脚步走 ---------- */

// 步伐：自由 = 小猫跟着你真实的脚步走；慢行、散步 = 按固定节拍轻响一声木鱼，提醒抬脚、落脚
const WALK_PACES = {
  free: { name: '自由' },
  slow: { name: '慢行', ms: 2000 },
  stroll: { name: '散步', ms: 1100 },
};
const WALK_IDLE_MS = 2600;  // 自由步伐下，这么久没迈步就算停下来了
const WALK_AUTO_MS = 1150;  // 没有运动传感器时，小猫自己慢慢走
const WALK_DIM_MS = 15000;  // 这么久没碰屏幕，就把画面调暗（放进口袋也不会误触）

const walk = {
  on: false,
  pace: 'free',
  steps: 0,          // 计到的步数（来自传感器）
  sensor: false,     // 收到过加速度数据
  // 计步
  base: 9.8, lp: 0, peak: 1.6, max: 0, armed: true, lastStep: 0, run: 0, runStart: 0,
  // 小猫的动作
  side: 0, stepStart: 0, stepDur: 700, queued: 0, lastBeat: -1, lastCatStep: 0, gap: 900,
  raf: 0, touchAt: 0, dimmed: false, startedAt: 0,
};

function resetWalk(now) {
  Object.assign(walk, {
    on: timer.mode === 'walk', pace: WALK_PACES[settings.pace] ? settings.pace : 'free',
    steps: 0, sensor: false, base: 9.8, lp: 0, peak: 1.6, max: 0, armed: true, lastStep: 0, run: 0,
    side: 0, stepStart: 0, stepDur: 700, queued: 0, lastBeat: -1, lastCatStep: 0, gap: 900,
    touchAt: now, dimmed: false, startedAt: now,
  });
  $('stage-cat').style.removeProperty('--swl');
  $('stage-cat').style.removeProperty('--swr');
}

/* 计步：加速度（含重力）的大小减去慢慢跟随的平均值，平滑后找峰。
   一步一个峰；两峰至少隔 0.28 秒；门槛跟着最近几步的力度自动调。
   连续迈出第二步才开始计数，免得把手机晃一下也当成一步。 */
function walkMotion(e) {
  const g = e.accelerationIncludingGravity;
  if (!g || g.x == null) return;
  walk.sensor = true;
  if (timer.phase !== 'running') return;
  const now = Date.now();
  const m = Math.hypot(g.x, g.y, g.z);
  walk.base += (m - walk.base) * 0.03;
  walk.lp += (m - walk.base - walk.lp) * 0.35;
  const th = Math.max(0.55, walk.peak * 0.42);
  if (walk.armed) {
    if (walk.lp > th && now - walk.lastStep > 280) {
      walk.armed = false;
      walk.max = walk.lp;
      footfall(now);
    }
  } else {
    walk.max = Math.max(walk.max, walk.lp);
    if (walk.lp < th * 0.35) {
      walk.armed = true;
      walk.peak = Math.min(8, walk.peak * 0.7 + walk.max * 0.3);
    }
  }
}

function footfall(now) {
  if (now - walk.lastStep > 2500) walk.run = 0;
  walk.run++;
  walk.lastStep = now;
  if (walk.run === 2) walk.steps += 2;
  else if (walk.run > 2) walk.steps++;
  if (walk.run >= 2 && walk.pace === 'free') catStepNow(now);
}

// 让小猫迈一步；上一步还没走完就排在后面接着走
function catStepNow(now) {
  if (walk.lastCatStep) walk.gap = walk.gap * 0.6 + Math.min(2500, now - walk.lastCatStep) * 0.4;
  walk.lastCatStep = now;
  if (walk.stepStart && now - walk.stepStart < walk.stepDur) { walk.queued = Math.min(2, walk.queued + 1); return; }
  beginCatStep(now);
}

function beginCatStep(now) {
  walk.side = 1 - walk.side;
  walk.stepStart = now;
  walk.stepDur = Math.max(380, Math.min(1500, walk.gap * 0.85));
}

// 一声很轻的木鱼，左右脚分别偏左、偏右
function walkTick(side) {
  if (settings.cue === 'off' || !ctx) return;
  const t0 = ctx.currentTime + 0.02;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(side ? 250 : 220, t0);
  o.frequency.exponentialRampToValueAtTime(side ? 205 : 180, t0 + 0.12);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.22, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
  let out = master;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = side ? 0.45 : -0.45;
    p.connect(master);
    out = p;
  }
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + 0.4);
}

// 落脚的地方漾开一圈
function footRipple(side) {
  const stage = $('stage');
  const r = document.createElement('i');
  r.className = 'foot-ripple ' + (side ? 'r' : 'l');
  stage.querySelector('.footfalls').append(r);
  setTimeout(() => r.remove(), 1600);
}

function walkFrame() {
  if (!walk.on || timer.phase === 'idle') return;
  walk.raf = requestAnimationFrame(walkFrame);
  const now = Date.now();
  const host = $('stage-cat');
  if (timer.phase === 'running') {
    const pace = WALK_PACES[walk.pace];
    const el = elapsedMs(now);
    if (pace.ms) {
      // 按节拍走：每一拍迈一步，同时轻响一声
      const beat = Math.floor(el / pace.ms);
      if (beat !== walk.lastBeat) {
        walk.lastBeat = beat;
        walk.gap = pace.ms;
        catStepNow(now);
        walkTick(walk.side);
      }
    } else if (!walk.sensor && now - walk.startedAt > 2500 && now - walk.lastCatStep > WALK_AUTO_MS) {
      walk.gap = WALK_AUTO_MS;
      catStepNow(now);
    }
    if (now - walk.touchAt > WALK_DIM_MS && !walk.dimmed) setWalkDim(true);
  }
  let u = walk.stepStart ? (now - walk.stepStart) / walk.stepDur : 1;
  if (u >= 1 && walk.stepStart) {
    // 这一步落地
    footRipple(walk.side);
    Space.puff('step', walk.side);
    walk.stepStart = 0;
    if (walk.queued > 0 && timer.phase === 'running') { walk.queued--; beginCatStep(now); u = 0; }
  }
  if (timer.phase === 'paused') return;
  catStep(host, walk.side, Math.min(1, u), 1);
  // 停下来时睁眼看你；走着的时候眯着眼，很享受
  const moving = walk.stepStart || now - walk.lastCatStep < (WALK_PACES[walk.pace].ms || WALK_IDLE_MS);
  const stage = $('stage');
  stage.classList.toggle('walking', !!moving && timer.phase === 'running');
}

function startWalk(now) {
  resetWalk(now);
  if (!walk.on) return;
  setSit(0);
  catStep($('stage-cat'), 0, 1, 0);
  cancelAnimationFrame(walk.raf);
  walk.raf = requestAnimationFrame(walkFrame);
}

function stopWalk() {
  cancelAnimationFrame(walk.raf);
  setWalkDim(false);
  $('stage').classList.remove('walking');
  $('stage-cat').style.removeProperty('--swl');
  $('stage-cat').style.removeProperty('--swr');
  walk.on = false;
}

// 口袋模式：一段时间没碰屏幕就调暗、按钮暂时点不到；轻点一下亮回来
function setWalkDim(on) {
  walk.dimmed = on;
  $('session').classList.toggle('pocket', on);
  Space.dimmer(on ? 0.3 : 1);
}

function walkTouched() {
  walk.touchAt = Date.now();
  if (walk.dimmed) { setWalkDim(false); return true; }
  return false;
}

function walkSummary() {
  return walk.sensor && walk.steps ? `走了 ${walk.steps.toLocaleString('zh-CN')} 步` : '';
}
