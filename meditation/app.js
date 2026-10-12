'use strict';

/* ---------- 存储 ---------- */

const LOG_KEY = 'meditation.log.v1';
const SETTINGS_KEY = 'meditation.settings.v1';
const DEFAULTS = {
  minutes: 10, interval: 0, prep: true, wake: true, volume: 0.7,
  mode: 'timer', pattern: '478', sound: 'none', noiseVolume: 0.5, focus: true,
};
const PREP_SEC = 10;
const MIN_SAVE_SEC = 60;

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 私密模式等情况下可能写不进去，界面照常可用
  }
}

let settings = { ...DEFAULTS, ...load(SETTINGS_KEY, {}) };
let log = load(LOG_KEY, []);

function saveSettings() { save(SETTINGS_KEY, settings); }
function saveLog() {
  log.sort((a, b) => a.start.localeCompare(b.start));
  save(LOG_KEY, log);
}

/* ---------- 日期与统计 ---------- */

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDay(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function computeStreak(entries, now = new Date()) {
  const days = new Set(entries.map(e => dayKey(e.start)));
  let cursor = days.has(dayKey(now)) ? now : shiftDay(now, -1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

function stats(now = new Date()) {
  const today = dayKey(now);
  let totalSec = 0;
  let todaySec = 0;
  for (const e of log) {
    totalSec += e.sec;
    if (dayKey(e.start) === today) todaySec += e.sec;
  }
  return {
    streak: computeStreak(log, now),
    todayMin: Math.floor(todaySec / 60),
    totalMin: Math.floor(totalSec / 60),
  };
}

/* ---------- 声音（Web Audio 合成颂钵声，无需音频文件） ---------- */

let ctx = null;
let master = null; // 钟声音量
let bus = null;    // 所有声音最后汇到这里
let keepAlive = null;

function ensureAudio() {
  if (!ctx) {
    // iOS 17+：按“播放”类型处理，静音键打开时也尽量出声
    if (navigator.audioSession) {
      try { navigator.audioSession.type = 'playback'; } catch {}
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    bus = ctx.createDynamicsCompressor();
    bus.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = settings.volume;
    master.connect(bus);
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

// 一次敲击：几组不成整数倍的泛音，每组两个略微失谐的正弦波产生颂钵特有的“嗡嗡”拍音
function strike(when, { f0, amp, decay }) {
  const nodes = [];
  const partials = [
    [1, 1, 1],
    [2.71, 0.45, 0.6],
    [5.15, 0.2, 0.35],
    [8.43, 0.08, 0.2],
  ];
  for (const [ratio, level, decayScale] of partials) {
    const d = decay * decayScale;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(amp * level, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + d);
    g.connect(master);
    for (const detune of [-0.7, 0.7]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f0 * ratio + detune * ratio;
      o.connect(g);
      o.start(when);
      o.stop(when + d + 0.1);
      nodes.push(o);
    }
  }
  // 敲击瞬间的一点木槌声
  const len = Math.floor(ctx.sampleRate * 0.04);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = f0 * 4;
  bp.Q.value = 1.5;
  const ng = ctx.createGain();
  ng.gain.value = amp * 0.25;
  noise.connect(bp).connect(ng).connect(master);
  noise.start(when);
  nodes.push(noise);
  return nodes;
}

const SOUNDS = {
  bowl: { f0: 220, amp: 0.5, decay: 10 },
  small: { f0: 523, amp: 0.25, decay: 4 },
};

function play(kind, delaySec = 0) {
  ensureAudio();
  return strike(ctx.currentTime + Math.max(0, delaySec) + 0.02, SOUNDS[kind]);
}

function cancelNodes(nodes) {
  for (const n of nodes) {
    try { n.stop(0); } catch {}
    try { n.disconnect(); } catch {}
  }
}

// 计时中放一个几乎听不到的音，让 iPhone 尽量保持音频运行（锁屏后能否继续由系统决定）
function startKeepAlive() {
  ensureAudio();
  if (keepAlive) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = 40;
  g.gain.value = 0.00001;
  o.connect(g).connect(ctx.destination);
  o.start();
  keepAlive = o;
}

function stopKeepAlive() {
  if (keepAlive) cancelNodes([keepAlive]);
  keepAlive = null;
}

/* ---------- 背景音（全部现场合成，离线可用） ---------- */

const NOISE_SEC = 8;
const noiseBuffers = {};

// 生成一段可无缝循环的噪声：多生成一点，把尾巴交叉淡入到开头
function makeLoop(fill) {
  const sr = ctx.sampleRate;
  const len = sr * NOISE_SEC;
  const fade = Math.floor(sr * 0.5);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(len + fade);
    fill(raw, sr);
    const out = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) out[i] = raw[i];
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      out[i] = raw[i] * Math.sqrt(t) + raw[len + i] * Math.sqrt(1 - t);
    }
  }
  return buf;
}

function fillPink(a) {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < a.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    a[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
}

function fillBrown(a) {
  let last = 0;
  for (let i = 0; i < a.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    a[i] = last * 3.5;
  }
}

// 雨：细密的粉噪声上叠加随机雨滴
function fillRain(a, sr) {
  fillPink(a);
  for (let i = 0; i < a.length; i++) a[i] *= 0.55;
  const drops = Math.floor(a.length / sr * 40);
  for (let d = 0; d < drops; d++) {
    const at = Math.floor(Math.random() * a.length);
    const amp = 0.05 + Math.random() ** 3 * 0.35;
    const dur = Math.floor(sr * (0.004 + Math.random() * 0.012));
    for (let i = 0; i < dur && at + i < a.length; i++) {
      a[at + i] += (Math.random() * 2 - 1) * amp * Math.exp(-5 * i / dur);
    }
  }
}

function getBuffer(kind) {
  if (!noiseBuffers[kind]) {
    noiseBuffers[kind] = makeLoop({ pink: fillPink, brown: fillBrown, rain: fillRain }[kind]);
  }
  return noiseBuffers[kind];
}

function loopSource(kind) {
  const src = ctx.createBufferSource();
  src.buffer = getBuffer(kind);
  src.loop = true;
  // 每次从不同位置开始，避免听起来重复
  src.start(0, Math.random() * NOISE_SEC);
  return src;
}

function filter(type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

// 缓慢起伏：返回一个 LFO，按 center ± depth 驱动某个参数
function lfo(param, rate, center, depth) {
  const o = ctx.createOscillator();
  o.frequency.value = rate;
  const g = ctx.createGain();
  g.gain.value = depth;
  param.value = center;
  o.connect(g).connect(param);
  o.start();
  return o;
}

const NOISE_RECIPES = {
  rain(out, parts) {
    const drops = loopSource('rain');
    const hp = filter('highpass', 400);
    const lp = filter('lowpass', 7500);
    const g = ctx.createGain();
    g.gain.value = 0.9;
    drops.connect(hp).connect(lp).connect(g).connect(out);
    const rumble = loopSource('brown');
    const rlp = filter('lowpass', 250);
    const rg = ctx.createGain();
    rg.gain.value = 0.35;
    rumble.connect(rlp).connect(rg).connect(out);
    parts.push(drops, rumble);
  },
  ocean(out, parts) {
    // 浪：低沉的褐噪声，音量和亮度一起慢慢起落
    const body = loopSource('brown');
    const lp = filter('lowpass', 700);
    const g = ctx.createGain();
    body.connect(lp).connect(g).connect(out);
    const rate = 0.075;
    parts.push(body, lfo(g.gain, rate, 0.65, 0.35), lfo(lp.frequency, rate, 800, 450));
    // 浪花的沙沙声
    const foam = loopSource('pink');
    const hp = filter('highpass', 1800);
    const fg = ctx.createGain();
    foam.connect(hp).connect(fg).connect(out);
    parts.push(foam, lfo(fg.gain, rate, 0.12, 0.1));
  },
  forest(out, parts) {
    // 风吹过树林
    const wind = loopSource('brown');
    const lp = filter('lowpass', 600);
    const g = ctx.createGain();
    wind.connect(lp).connect(g).connect(out);
    parts.push(wind, lfo(g.gain, 0.05, 0.45, 0.25), lfo(lp.frequency, 0.037, 650, 300));
    const leaves = loopSource('pink');
    const hp = filter('bandpass', 3500, 0.5);
    const lg = ctx.createGain();
    leaves.connect(hp).connect(lg).connect(out);
    parts.push(leaves, lfo(lg.gain, 0.06, 0.06, 0.04));
    // 远处偶尔几声鸟叫
    let timerId = null;
    const sing = () => {
      const t0 = ctx.currentTime + 0.05;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const bg = ctx.createGain();
      bg.gain.value = 0.05 + Math.random() * 0.04;
      if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; bg.connect(pan).connect(out); } else bg.connect(out);
      const base = 2600 + Math.random() * 1400;
      const notes = 2 + Math.floor(Math.random() * 4);
      for (let n = 0; n < notes; n++) {
        const t = t0 + n * (0.12 + Math.random() * 0.06);
        const o = ctx.createOscillator();
        const e = ctx.createGain();
        o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), t);
        o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.3), t + 0.07);
        e.gain.setValueAtTime(0, t);
        e.gain.linearRampToValueAtTime(1, t + 0.01);
        e.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        o.connect(e).connect(bg);
        o.start(t);
        o.stop(t + 0.1);
      }
      timerId = setTimeout(sing, 4000 + Math.random() * 9000);
    };
    timerId = setTimeout(sing, 2500);
    parts.push({ stop() { clearTimeout(timerId); } });
  },
};

let noise = null; // { kind, gain, parts }
let previewTimer = null;

function startNoise(kind, fadeSec = 3) {
  clearTimeout(previewTimer);
  if (!kind || kind === 'none' || !NOISE_RECIPES[kind]) { stopNoise(1); return; }
  ensureAudio();
  if (noise && noise.kind === kind) {
    fadeTo(noise.gain, settings.noiseVolume, fadeSec);
    return;
  }
  stopNoise(1);
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(bus);
  const parts = [];
  NOISE_RECIPES[kind](gain, parts);
  noise = { kind, gain, parts };
  fadeTo(gain, settings.noiseVolume, fadeSec);
}

function stopNoise(fadeSec = 3) {
  clearTimeout(previewTimer);
  if (!noise) return;
  const { gain, parts } = noise;
  noise = null;
  fadeTo(gain, 0, fadeSec);
  setTimeout(() => {
    for (const p of parts) { try { p.stop(); } catch {} }
    try { gain.disconnect(); } catch {}
  }, fadeSec * 1000 + 200);
}

function fadeTo(gain, value, sec) {
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(value, now + Math.max(0.05, sec));
}

// 首页点选背景音时试听几秒
function previewNoise(kind) {
  if (timer.phase !== 'idle') return;
  if (kind === 'none') { stopNoise(0.8); return; }
  startNoise(kind, 0.8);
  previewTimer = setTimeout(() => { if (timer.phase === 'idle') stopNoise(1.5); }, 4000);
}

/* ---------- 屏幕常亮 ---------- */

let wakeLock = null;

async function requestWake() {
  if (!settings.wake || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {
    wakeLock = null;
  }
}

function releaseWake() {
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
}

/* ---------- 呼吸节奏 ---------- */

const PATTERNS = {
  478: { name: '4-7-8', hint: '吸 4 秒，屏 7 秒，呼 8 秒', steps: [['吸气', 4, 'in'], ['屏息', 7, 'hold'], ['呼气', 8, 'out']] },
  box: { name: '方块', hint: '吸、屏、呼、屏，各 4 秒', steps: [['吸气', 4, 'in'], ['屏息', 4, 'hold'], ['呼气', 4, 'out'], ['屏息', 4, 'hold']] },
  calm: { name: '平稳', hint: '吸 5 秒，呼 5 秒', steps: [['吸气', 5, 'in'], ['呼气', 5, 'out']] },
};
const ORB_MIN = 0.45;
const ORB_MAX = 1;

// 按已练习的时间算出当前处在哪一步、圆有多大
function breathState(ms, pattern) {
  const cycle = pattern.steps.reduce((sum, st) => sum + st[1], 0);
  let t = (ms / 1000) % cycle;
  let level = ORB_MIN;
  for (const [label, dur, kind] of pattern.steps) {
    if (t < dur) {
      const ease = (1 - Math.cos(Math.PI * t / dur)) / 2;
      let scale = level;
      if (kind === 'in') scale = ORB_MIN + (ORB_MAX - ORB_MIN) * ease;
      if (kind === 'out') scale = ORB_MAX - (ORB_MAX - ORB_MIN) * ease;
      return { label, count: Math.ceil(dur - t), scale };
    }
    t -= dur;
    if (kind === 'in') level = ORB_MAX;
    if (kind === 'out') level = ORB_MIN;
  }
  return { label: '', count: 0, scale: ORB_MIN };
}

/* ---------- 专注检测：离开 app、碰屏幕、拿起手机 ---------- */

const GRACE_MS = 6000;     // 刚开始或刚继续时，留时间把手机放下
const MERGE_MS = 8000;     // 连续的动作算作一次
const LEAVE_MIN_MS = 3000; // 离开不到 3 秒不算
const FOCUS_TEXT = { leave: '离开了 app', touch: '碰了屏幕', move: '拿起了手机' };

const focus = {
  on: false,
  count: 0,
  kinds: { leave: 0, touch: 0, move: 0 },
  marks: [],
  lastAt: 0,
  graceUntil: 0,
  hiddenAt: 0,
  alertUntil: 0,
  stirTimer: null,
};
let motionGranted = false;
let motionListening = false;

function resetFocus(now) {
  focus.on = settings.focus;
  focus.count = 0;
  focus.kinds = { leave: 0, touch: 0, move: 0 };
  focus.marks = [];
  focus.lastAt = 0;
  focus.hiddenAt = 0;
  focus.alertUntil = 0;
  focus.graceUntil = now + GRACE_MS;
  $('marks').textContent = '';
}

// iPhone 需要在点击里申请“运动与方向”权限，只问一次
function requestMotion() {
  if (!settings.focus || motionListening || !('DeviceMotionEvent' in window)) return;
  const listen = () => {
    if (motionListening) return;
    motionListening = true;
    window.addEventListener('devicemotion', onMotion);
  };
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission()
      .then(state => { if (state === 'granted') { motionGranted = true; listen(); } })
      .catch(() => {});
  } else {
    motionGranted = true;
    listen();
  }
}

function onMotion(e) {
  if (timer.phase !== 'running' || !focus.on) return;
  const a = e.acceleration;
  const r = e.rotationRate;
  const acc = a && a.x != null ? Math.hypot(a.x, a.y, a.z) : 0;
  const rot = r && r.alpha != null ? Math.hypot(r.alpha, r.beta, r.gamma) : 0;
  if (acc > 1.2 || rot > 40) disturb('move');
}

function disturb(kind, now = Date.now()) {
  if (!focus.on || timer.phase !== 'running' || now < focus.graceUntil) return;
  const merged = now - focus.lastAt < MERGE_MS;
  focus.lastAt = now;
  if (merged) return;
  focus.count++;
  focus.kinds[kind]++;
  focus.alertUntil = now + 4000;
  focus.alertText = FOCUS_TEXT[kind];
  addMark(Math.min(1, elapsedMs(now) / timer.plannedMs));
  stir();
  renderFocus(now);
}

// 进度环上在分心的位置留一个小点
function addMark(fraction) {
  const angle = fraction * 2 * Math.PI;
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', String(100 - 90 * Math.sin(angle))); // 进度环从顶部逆时针走空
  c.setAttribute('cy', String(100 - 90 * Math.cos(angle)));
  c.setAttribute('r', '3.2');
  $('marks').append(c);
}

const MISCHIEF = [['m-peek', '?'], ['m-yarn', '喵'], ['m-hop', '!']];
const MISCHIEF_CLASSES = ['mischief', ...MISCHIEF.map(m => m[0])];

// 让小猫捣蛋一下：歪头、玩毛线球、蹦跳轮流来
function catMischief(host, index) {
  const [cls, text] = MISCHIEF[index % MISCHIEF.length];
  host.classList.remove(...MISCHIEF_CLASSES);
  void host.offsetWidth; // 重新触发动画
  host.classList.add('mischief', cls);
  const bubble = host.querySelector('.bubble text');
  if (bubble) bubble.textContent = text;
}

// 画面褪色、水面起波纹、小猫开始捣蛋，之后慢慢恢复平静
function stir() {
  document.body.classList.add('stirred');
  const stage = $('stage');
  stage.classList.add('stir');
  catMischief(stage, focus.count - 1);
  clearTimeout(focus.stirTimer);
  focus.stirTimer = setTimeout(calm, 4000);
}

function calm() {
  document.body.classList.remove('stirred');
  $('stage').classList.remove('stir', ...MISCHIEF_CLASSES);
}

function renderFocus(now = Date.now()) {
  const el = $('focus');
  if (!focus.on || timer.phase === 'prep') {
    el.textContent = '';
    el.className = 'focus';
    return;
  }
  if (now < focus.alertUntil) {
    el.textContent = focus.alertText;
    el.className = 'focus alert';
  } else if (focus.count === 0) {
    el.textContent = '心无旁骛';
    el.className = 'focus clean';
  } else {
    el.textContent = `分心 ${focus.count} 次`;
    el.className = 'focus';
  }
}

function focusSummary() {
  if (!focus.on) return '';
  if (focus.count === 0) return '全程专注，没有碰手机';
  const parts = Object.entries(focus.kinds).filter(([, n]) => n).map(([k, n]) => `${FOCUS_TEXT[k]} ${n} 次`);
  return `分心 ${focus.count} 次：${parts.join('，')}`;
}

/* ---------- 计时器 ---------- */

// 所有时间都按真实时钟（Date.now）计算，切到后台再回来会自动校正
const timer = {
  phase: 'idle', // idle | prep | running | paused
  prepEndsAt: 0,
  plannedMs: 0,
  intervalMs: 0,
  elapsedBefore: 0,
  segStart: 0,
  startedAt: null,
  mode: 'timer',     // timer | breath
  pattern: null,
  sound: 'none',
  scheduled: [],     // 已经排进音频时钟的声音节点
  audioAnchor: null, // 排程时音频时钟与真实时钟的对应关系
  tickId: null,
};

function elapsedMs(now = Date.now()) {
  if (timer.phase === 'running') return timer.elapsedBefore + (now - timer.segStart);
  if (timer.phase === 'paused') return timer.elapsedBefore;
  return 0;
}

// 音频时钟是否一直在走（锁屏或后台时 iPhone 可能把它挂起）
function audioClockHealthy(now = Date.now()) {
  if (!ctx || ctx.state !== 'running' || !timer.audioAnchor) return false;
  const expected = timer.audioAnchor.ctxTime + (now - timer.audioAnchor.wall) / 1000;
  return Math.abs(ctx.currentTime - expected) < 1;
}

function unschedule() {
  for (const nodes of timer.scheduled) cancelNodes(nodes);
  timer.scheduled = [];
  timer.audioAnchor = null;
}

// 把接下来的开始钟、中途钟和结束钟提前排进音频时钟，这样即使 JS 计时被系统放慢，声音也尽量准时
function schedule(now = Date.now()) {
  unschedule();
  ensureAudio();
  timer.audioAnchor = { ctxTime: ctx.currentTime, wall: now };
  let offsetSec; // 距“正式开始”还有多久（准备阶段为正）
  let elapsed;
  if (timer.phase === 'prep') {
    offsetSec = (timer.prepEndsAt - now) / 1000;
    elapsed = 0;
    timer.scheduled.push(play('bowl', offsetSec));
  } else if (timer.phase === 'running') {
    offsetSec = 0;
    elapsed = elapsedMs(now);
  } else {
    return;
  }
  if (timer.intervalMs > 0) {
    for (let t = timer.intervalMs; t < timer.plannedMs - 1000; t += timer.intervalMs) {
      if (t > elapsed) timer.scheduled.push(play('small', offsetSec + (t - elapsed) / 1000));
    }
  }
  timer.scheduled.push(play('bowl', offsetSec + (timer.plannedMs - elapsed) / 1000));
}

function startSession() {
  ensureAudio();
  timer.plannedMs = settings.minutes * 60 * 1000;
  timer.intervalMs = settings.interval * 60 * 1000;
  timer.elapsedBefore = 0;
  timer.startedAt = null;
  timer.mode = settings.mode;
  timer.pattern = PATTERNS[settings.pattern] || PATTERNS['478'];
  timer.sound = settings.sound;
  stopArmedUntil = 0;
  requestMotion();
  const now = Date.now();
  resetFocus(now);
  if (settings.prep) {
    timer.phase = 'prep';
    timer.prepEndsAt = now + PREP_SEC * 1000;
  } else {
    beginRunning(now);
  }
  schedule(now);
  startKeepAlive();
  startNoise(timer.sound, 4);
  requestWake();
  $('session').classList.toggle('breath', timer.mode === 'breath');
  document.body.classList.add('in-session');
  show('session');
  renderSession();
  timer.tickId = setInterval(tick, 250);
  if (timer.mode === 'breath') requestAnimationFrame(animateBreath);
}

function beginRunning(now) {
  focus.graceUntil = Math.max(focus.graceUntil, now + GRACE_MS);
  timer.phase = 'running';
  timer.segStart = now;
  timer.startedAt = new Date(now).toISOString();
}

function skipPrep() {
  if (timer.phase !== 'prep') return;
  beginRunning(Date.now());
  schedule(); // 重新排程：开始钟立刻响
  renderSession();
}

function tick() {
  const now = Date.now();
  if (timer.phase === 'prep' && now >= timer.prepEndsAt) {
    const healthy = audioClockHealthy(now);
    beginRunning(timer.prepEndsAt);
    if (!healthy) {
      // 声音没按时响（例如刚从后台回来），补响并重新排程
      schedule(now);
      play('bowl');
    }
  }
  if (timer.phase === 'running' && elapsedMs(now) >= timer.plannedMs) {
    finish(true, now);
    return;
  }
  renderSession(now);
}

function togglePause() {
  const now = Date.now();
  if (timer.phase === 'running') {
    timer.elapsedBefore = elapsedMs(now);
    timer.phase = 'paused';
    unschedule();
    if (noise) fadeTo(noise.gain, 0, 1.5);
  } else if (timer.phase === 'paused') {
    timer.phase = 'running';
    timer.segStart = now;
    focus.graceUntil = now + GRACE_MS;
    schedule(now);
    startNoise(timer.sound, 1.5);
  }
  renderSession(now);
}

let stopArmedUntil = 0;

function stopEarly() {
  if (timer.phase === 'prep') {
    finish(false);
    return;
  }
  // 不用系统弹窗（在一些环境里会被拦截），改为 3 秒内再点一次确认
  const now = Date.now();
  if (now < stopArmedUntil) {
    stopArmedUntil = 0;
    finish(false);
    return;
  }
  stopArmedUntil = now + 3000;
  renderSession(now);
}

function finish(completed, now = Date.now()) {
  const wasPrep = timer.phase === 'prep';
  const elapsed = completed ? timer.plannedMs : elapsedMs(now);
  const healthy = audioClockHealthy(now);
  clearInterval(timer.tickId);
  timer.tickId = null;
  if (completed) {
    if (healthy) {
      // 结束钟已在音频时钟里响起，只取消还没响的节点
      timer.scheduled = [];
      timer.audioAnchor = null;
    } else {
      unschedule();
      play('bowl');
    }
  } else {
    unschedule();
  }
  timer.phase = 'idle';
  stopNoise(completed ? 8 : 2);
  clearTimeout(focus.stirTimer);
  calm();
  document.body.classList.remove('in-session');
  // 等结束钟响完再停掉保活音
  setTimeout(() => { if (timer.phase === 'idle') stopKeepAlive(); }, 12000);
  releaseWake();

  if (wasPrep) {
    show('home');
    renderHome();
    return;
  }

  const sec = Math.round(elapsed / 1000);
  const savedEntry = sec >= MIN_SAVE_SEC;
  if (savedEntry) {
    const entry = { start: timer.startedAt, sec, planned: Math.round(timer.plannedMs / 1000) };
    if (timer.mode === 'breath') entry.mode = 'breath';
    if (focus.on) entry.distractions = focus.count;
    log.push(entry);
    saveLog();
  }
  if (!completed && !savedEntry) {
    // 不足一分钟的提前结束不记录，直接回首页
    show('home');
    renderHome();
    return;
  }
  const s = stats();
  $('done-title').textContent = completed ? '完成' : '已结束';
  $('done-detail').textContent = `这次${timer.mode === 'breath' ? '呼吸练习' : ''} ${formatDuration(sec)}，已连续 ${s.streak} 天`;
  $('done-focus').textContent = focusSummary();
  $('done-focus').className = `focus center${focus.on && focus.count === 0 ? ' clean' : ''}`;
  const messy = focus.on && focus.count > 0;
  $('done-cat').classList.toggle('happy', !messy);
  $('done-cat').classList.toggle('messy', messy);
  $('done-cat').classList.toggle('awake', messy);
  show('done');
}

/* ---------- 界面 ---------- */

const $ = id => document.getElementById(id);
const RING_LEN = 2 * Math.PI * 90;

function show(id) {
  for (const el of document.querySelectorAll('.screen')) el.classList.toggle('active', el.id === id);
  window.scrollTo(0, 0);
  if (id === 'stats' || id === 'settings') stopNoise(0.8);
}

function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} 秒`;
  return s ? `${m} 分 ${s} 秒` : `${m} 分钟`;
}

function renderSession(now = Date.now()) {
  const session = $('session');
  session.classList.toggle('paused', timer.phase === 'paused');
  // 准备和暂停时小猫睁着眼看你，正式开始后闭眼
  $('stage').classList.toggle('awake', timer.phase === 'prep' || timer.phase === 'paused');
  const breath = timer.mode === 'breath';
  let fraction;
  if (timer.phase === 'prep') {
    const left = Math.max(0, timer.prepEndsAt - now);
    $('phase').textContent = '准备';
    $('time').textContent = String(Math.ceil(left / 1000));
    $('sub').textContent = '';
    $('session-hint').textContent = '坐好，放松肩膀。轻点圆圈跳过';
    $('pause').hidden = true;
    $('stop').textContent = '取消';
    $('stop').classList.remove('armed');
    fraction = left / (PREP_SEC * 1000);
  } else {
    const left = timer.plannedMs - elapsedMs(now);
    const paused = timer.phase === 'paused';
    if (breath) {
      $('phase').textContent = paused ? '已暂停' : formatClock(left);
      $('session-hint').textContent = timer.pattern.hint;
    } else {
      $('phase').textContent = paused ? '已暂停' : '静坐';
      $('time').textContent = formatClock(left);
      $('sub').textContent = '';
      $('session-hint').textContent = '';
    }
    $('pause').hidden = false;
    $('pause').textContent = paused ? '继续' : '暂停';
    $('stop').textContent = now < stopArmedUntil ? '再点一次结束' : '结束';
    $('stop').classList.toggle('armed', now < stopArmedUntil);
    fraction = left / timer.plannedMs;
  }
  $('ring').style.strokeDashoffset = String(RING_LEN * (1 - Math.max(0, Math.min(1, fraction))));
  if (breath) renderBreath(now);
  renderFocus(now);
}

function renderBreath(now = Date.now()) {
  const orb = $('orb');
  if (timer.phase === 'prep') {
    orb.style.transform = `scale(${ORB_MIN})`;
    orb.style.opacity = '0.35';
    $('stage').style.setProperty('--b', '0');
    return;
  }
  const st = breathState(elapsedMs(now), timer.pattern);
  orb.style.transform = `scale(${st.scale.toFixed(4)})`;
  const b = (st.scale - ORB_MIN) / (ORB_MAX - ORB_MIN);
  orb.style.opacity = String(0.35 + 0.4 * b);
  $('stage').style.setProperty('--b', b.toFixed(3));
  if ($('time').textContent !== st.label) $('time').textContent = st.label;
  const count = String(st.count);
  if ($('sub').textContent !== count) $('sub').textContent = count;
}

// 呼吸圆每帧更新，动画才顺滑
function animateBreath() {
  if (timer.phase === 'idle' || timer.mode !== 'breath') return;
  renderBreath();
  requestAnimationFrame(animateBreath);
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function renderHome() {
  const s = stats();
  const breath = settings.mode === 'breath';
  for (const b of $('mode').children) b.classList.toggle('on', b.dataset.mode === settings.mode);
  $('minutes').value = settings.minutes;
  for (const b of $('presets').children) b.classList.toggle('on', Number(b.dataset.min) === settings.minutes);
  $('pattern-row').hidden = !breath;
  for (const b of $('patterns').children) b.classList.toggle('on', b.dataset.pattern === settings.pattern);
  for (const b of $('sounds').children) b.classList.toggle('on', b.dataset.sound === settings.sound);
  const parts = [];
  if (s.streak) parts.push(`连续 ${s.streak} 天`);
  if (s.todayMin) parts.push(`今天 ${s.todayMin} 分钟`);
  $('summary').textContent = parts.length ? parts.join(' · ') : (log.length ? '今天还没开始' : '');
}

function renderSettings() {
  $('interval').value = String(settings.interval);
  $('prep').checked = settings.prep;
  $('wake').checked = settings.wake;
  $('focus-detect').checked = settings.focus;
  $('volume').value = String(settings.volume);
  $('noise-volume').value = String(settings.noiseVolume);
}

/* ---------- 统计页 ---------- */

let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calSelected = null;

function level(sec) {
  const m = sec / 60;
  if (m <= 0) return 0;
  if (m < 10) return 1;
  if (m < 20) return 2;
  if (m < 30) return 3;
  return 4;
}

function renderStats(now = new Date()) {
  const byDay = new Map();
  for (const e of log) {
    const k = dayKey(e.start);
    const d = byDay.get(k) || { sec: 0, n: 0 };
    d.sec += e.sec;
    d.n++;
    byDay.set(k, d);
  }

  // 本周从周一算起
  const weekStart = shiftDay(now, -((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let weekSec = 0;
  let monthSec = 0;
  for (const e of log) {
    const t = new Date(e.start);
    if (t >= weekStart) weekSec += e.sec;
    if (t >= monthStart) monthSec += e.sec;
  }
  const s = stats(now);
  $('n-streak').textContent = s.streak;
  $('n-week').textContent = Math.floor(weekSec / 60);
  $('n-month').textContent = Math.floor(monthSec / 60);
  $('n-total').textContent = s.totalMin;

  // 月历
  const y = calMonth.getFullYear();
  const m = calMonth.getMonth();
  $('cal-title').textContent = `${y} 年 ${m + 1} 月`;
  $('cal-next').style.visibility = y === now.getFullYear() && m === now.getMonth() ? 'hidden' : 'visible';
  const cal = $('cal');
  cal.textContent = '';
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) cal.append(document.createElement('div'));
  const days = new Date(y, m + 1, 0).getDate();
  const todayKey = dayKey(now);
  for (let day = 1; day <= days; day++) {
    const date = new Date(y, m, day);
    const k = dayKey(date);
    const info = byDay.get(k);
    const cell = document.createElement('button');
    cell.className = 'd';
    cell.dataset.l = String(info ? level(info.sec) : 0);
    if (k === todayKey) cell.classList.add('today');
    if (date > now) cell.classList.add('future');
    if (k === calSelected) cell.classList.add('sel');
    const num = document.createElement('span');
    num.textContent = day;
    cell.append(num);
    cell.addEventListener('click', () => {
      calSelected = calSelected === k ? null : k;
      renderStats();
    });
    cal.append(cell);
  }
  let note = '';
  if (calSelected) {
    const d = new Date(calSelected + 'T00:00');
    const info = byDay.get(calSelected);
    const label = `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
    note = info ? `${label}：${info.n} 次，共 ${formatDuration(info.sec)}` : `${label}没有练习`;
  }
  $('cal-note').textContent = note;

  // 最近记录
  const list = $('log');
  list.textContent = '';
  for (const e of log.slice(-10).reverse()) {
    const d = new Date(e.start);
    const li = document.createElement('li');
    const when = document.createElement('span');
    when.className = 'when';
    when.textContent = `${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAYS[d.getDay()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (e.mode === 'breath') {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = '呼吸';
      when.append(tag);
    }
    if (e.distractions > 0) {
      const tag = document.createElement('span');
      tag.className = 'tag muted-tag';
      tag.textContent = `分心 ${e.distractions}`;
      when.append(tag);
    }
    const dur = document.createElement('span');
    dur.textContent = formatDuration(e.sec);
    const del = document.createElement('button');
    del.className = 'del';
    del.setAttribute('aria-label', '删除这条记录');
    del.textContent = '×';
    del.addEventListener('click', () => {
      if (!del.classList.contains('armed')) {
        del.classList.add('armed');
        del.textContent = '删除？';
        setTimeout(() => { del.classList.remove('armed'); del.textContent = '×'; }, 3000);
        return;
      }
      log = log.filter(x => x !== e);
      saveLog();
      renderStats();
    });
    const right = document.createElement('span');
    right.append(dur, del);
    li.append(when, right);
    list.append(li);
  }
  $('log-empty').hidden = log.length > 0;
}

let toastTimer = null;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3000);
}

function setMinutes(m) {
  const n = Math.round(Number(m));
  if (!Number.isFinite(n)) return;
  settings.minutes = Math.min(180, Math.max(1, n));
  saveSettings();
  renderHome();
}

/* ---------- 备份 ---------- */

async function exportLog() {
  const data = JSON.stringify({ app: 'meditation', version: 1, exportedAt: new Date().toISOString(), log }, null, 2);
  const name = `冥想记录-${dayKey(new Date())}.json`;
  const file = new File([data], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importLog(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = Array.isArray(parsed) ? parsed : parsed.log;
    if (!Array.isArray(incoming)) throw new Error('bad format');
    const known = new Set(log.map(e => e.start));
    let added = 0;
    for (const e of incoming) {
      if (!e || typeof e.start !== 'string' || isNaN(Date.parse(e.start)) || !(e.sec > 0)) continue;
      if (known.has(e.start)) continue;
      const entry = { start: e.start, sec: Math.round(e.sec), planned: Math.round(e.planned || e.sec) };
      if (e.mode === 'breath') entry.mode = 'breath';
      if (Number.isInteger(e.distractions) && e.distractions >= 0) entry.distractions = e.distractions;
      log.push(entry);
      known.add(e.start);
      added++;
    }
    saveLog();
    renderStats();
    toast(`导入完成，新增 ${added} 条记录。`);
  } catch {
    toast('这个文件不是有效的备份。');
  }
}

/* ---------- 事件 ---------- */

function pick(containerId, attr, onPick) {
  $(containerId).addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && b.dataset[attr]) onPick(b.dataset[attr]);
  });
}

// 节奏选项由 PATTERNS 生成
for (const [key, p] of Object.entries(PATTERNS)) {
  const b = document.createElement('button');
  b.dataset.pattern = key;
  b.textContent = p.name;
  $('patterns').append(b);
}

pick('mode', 'mode', v => { settings.mode = v; saveSettings(); renderHome(); });
pick('presets', 'min', setMinutes);
pick('patterns', 'pattern', v => { settings.pattern = v; saveSettings(); renderHome(); });
pick('sounds', 'sound', v => { settings.sound = v; saveSettings(); renderHome(); previewNoise(v); });
$('minus').addEventListener('click', () => setMinutes(settings.minutes - 1));
$('plus').addEventListener('click', () => setMinutes(settings.minutes + 1));
$('minutes').addEventListener('change', e => setMinutes(e.target.value));

$('open-stats').addEventListener('click', () => {
  const now = new Date();
  calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  calSelected = null;
  renderStats();
  show('stats');
});
$('open-settings').addEventListener('click', () => { renderSettings(); show('settings'); });
for (const b of document.querySelectorAll('[data-back]')) {
  b.addEventListener('click', () => { renderHome(); show('home'); });
}
$('cal-prev').addEventListener('click', () => {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1);
  calSelected = null;
  renderStats();
});
$('cal-next').addEventListener('click', () => {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
  calSelected = null;
  renderStats();
});

$('interval').addEventListener('change', e => { settings.interval = Number(e.target.value); saveSettings(); });
$('prep').addEventListener('change', e => { settings.prep = e.target.checked; saveSettings(); });
$('wake').addEventListener('change', e => { settings.wake = e.target.checked; saveSettings(); });
$('focus-detect').addEventListener('change', e => {
  settings.focus = e.target.checked;
  saveSettings();
  if (settings.focus) requestMotion();
});

// 计时中碰到屏幕（按钮除外）
$('session').addEventListener('pointerdown', e => {
  if (!e.target.closest('button')) disturb('touch');
});
$('volume').addEventListener('input', e => {
  settings.volume = Number(e.target.value);
  if (master) master.gain.value = settings.volume;
  saveSettings();
});
$('noise-volume').addEventListener('input', e => {
  settings.noiseVolume = Number(e.target.value);
  if (noise) fadeTo(noise.gain, settings.noiseVolume, 0.1);
  saveSettings();
});
$('test').addEventListener('click', () => play('bowl'));

$('start').addEventListener('click', startSession);
$('pause').addEventListener('click', togglePause);
$('stop').addEventListener('click', stopEarly);
$('stage').addEventListener('click', skipPrep);
$('back').addEventListener('click', () => { show('home'); renderHome(); });
$('export').addEventListener('click', exportLog);
$('import').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) importLog(f);
  e.target.value = '';
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (timer.phase === 'running') focus.hiddenAt = Date.now();
    return;
  }
  if (timer.phase === 'idle') return;
  // 屏幕常亮打开时，中途离开 app 算一次分心（锁屏也会被算进去）
  if (focus.hiddenAt && settings.wake && Date.now() - focus.hiddenAt > LEAVE_MIN_MS) {
    focus.graceUntil = 0;
    disturb('leave');
  }
  focus.hiddenAt = 0;
  // 回到前台：恢复音频、重新申请常亮、按真实时间校正
  ensureAudio();
  requestWake();
  tick();
  if ((timer.phase === 'prep' || timer.phase === 'running') && !audioClockHealthy()) schedule();
});

mountCats();
// 首页轻点小猫，它会歪头看你
let homeCatTimer = null;
$('home-cat').addEventListener('click', () => {
  catMischief($('home-cat'), 0);
  clearTimeout(homeCatTimer);
  homeCatTimer = setTimeout(() => $('home-cat').classList.remove(...MISCHIEF_CLASSES), 3600);
});
renderHome();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
