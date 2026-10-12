'use strict';

/* ---------- 真实天象：月面上看到的地球，跟此刻的现实一致 ---------- */

// 不问定位权限：按手机时区猜大概的位置（常见时区给出城市坐标，其余按时差推经度）
const ZONE_SPOTS = {
  'Asia/Shanghai': [31.2, 121.5], 'Asia/Chongqing': [29.6, 106.5], 'Asia/Harbin': [45.8, 126.6], 'Asia/Urumqi': [43.8, 87.6],
  'Asia/Hong_Kong': [22.3, 114.2], 'Asia/Macau': [22.2, 113.5], 'Asia/Taipei': [25.0, 121.5], 'Asia/Tokyo': [35.7, 139.7],
  'Asia/Seoul': [37.6, 127.0], 'Asia/Singapore': [1.3, 103.8], 'Asia/Kuala_Lumpur': [3.1, 101.7], 'Asia/Bangkok': [13.8, 100.5],
  'Europe/London': [51.5, -0.1], 'Europe/Paris': [48.9, 2.4], 'Europe/Berlin': [52.5, 13.4], 'America/New_York': [40.7, -74.0],
  'America/Chicago': [41.9, -87.6], 'America/Los_Angeles': [34.1, -118.2], 'America/Vancouver': [49.3, -123.1],
  'America/Toronto': [43.7, -79.4], 'Australia/Sydney': [-33.9, 151.2], 'Australia/Melbourne': [-37.8, 145.0],
};

function homeSpot() {
  let zone = '';
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
  if (ZONE_SPOTS[zone]) return ZONE_SPOTS[zone];
  return [30, -new Date().getTimezoneOffset() / 4];
}

const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);
const EARTH_TILT = 0.35; // 着色器里地轴朝镜头倾斜的角度

// 与着色器里 rot(a)*v 一致的二维旋转
function rot2(a, x, y) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * x + s * y, -s * x + c * y];
}

function moonAge(now) {
  return (((now - NEW_MOON_REF) / 864e5) % SYNODIC + SYNODIC) % SYNODIC;
}

// 地上看到的月相名字
function moonPhaseName(age) {
  const f = age / SYNODIC;
  if (f < 0.03 || f > 0.97) return '新月';
  if (f < 0.22) return '蛾眉月';
  if (f < 0.28) return '上弦月';
  if (f < 0.47) return '盈凸月';
  if (f < 0.53) return '满月';
  if (f < 0.72) return '亏凸月';
  if (f < 0.78) return '下弦月';
  return '残月';
}

// 从月球看地球，地相和月相正好相反：地上满月时，月面上看到的是“新地”
function earthPhaseName(age) {
  const f = age / SYNODIC;
  if (f < 0.03 || f > 0.97) return '满地';
  if (f > 0.47 && f < 0.53) return '新地';
  if (f < 0.28 || f > 0.72) return '凸地';
  return '弯弯的地牙';
}

function realSky(now = Date.now()) {
  const age = moonAge(now);
  const e = age / SYNODIC * Math.PI * 2;
  // 太阳方向：e=0（地上新月）时太阳在我们背后，地球全亮
  const sun = [-Math.sin(e), 0.12, Math.cos(e)];
  const [lat, lon] = homeSpot();
  const d = new Date(now);
  const utcH = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const solarH = ((utcH + lon / 15) % 24 + 24) % 24;
  const H = (solarH - 12) / 24 * Math.PI * 2;
  // 太阳在地球自身坐标里的经度，让你所在的经线在当地正午正对太阳
  const n = Math.hypot(...sun);
  const L = sun.map(v => v / n);
  const [ty, tz] = rot2(EARTH_TILT, L[1], L[2]);
  const spin = -H - Math.atan2(L[0], tz);
  // 你的位置（地球自身坐标里经度 0）换回画面坐标
  const phi = lat * Math.PI / 180;
  const [mx, mz0] = rot2(-spin, 0, Math.cos(phi));
  const [my, mz] = rot2(-EARTH_TILT, Math.sin(phi), mz0);
  void ty;
  const day = solarH > 6 && solarH < 18;
  return { sun, mark: [mx, my, mz], spin, age, day };
}

function realSkyText(now = Date.now()) {
  const s = realSky(now);
  return `此刻的地球是${earthPhaseName(s.age)}（今晚地上看是${moonPhaseName(s.age)}）。地球上亮着小灯的地方是你，那里现在是${s.day ? '白天' : '夜晚'}。`;
}

/* ---------- 稀有天象：潜修时偶尔出现，见过的收进图鉴 ---------- */

const SIGHTS = [
  { id: 'comet', type: 1, name: '彗星', icon: '☄️', w: 30, sec: 100, desc: '拖着两条尾巴的冰块，几十年才回来一次。' },
  { id: 'shower', type: 2, name: '流星雨', icon: '🌠', w: 35, sec: 50, desc: '穿过彗星留下的碎屑，一时间流星如雨。' },
  { id: 'nova', type: 3, name: '超新星', icon: '✴️', w: 20, sec: 90, desc: '一颗恒星走到尽头，亮过整个星系。' },
  { id: 'eclipse', type: 4, name: '日食', icon: '🌑', w: 15, sec: 60, places: ['mars', 'trappist'], desc: '卫星从恒星前面走过，天色暗了一瞬。只在火星和 TRAPPIST-1 能看到。' },
];
const SIGHT = Object.fromEntries(SIGHTS.map(s => [s.id, s]));

function sightLog(entries) {
  const seen = {};
  for (const e of entries) {
    if (!SIGHT[e.sight]) continue;
    const v = seen[e.sight] || (seen[e.sight] = { n: 0, first: e.start, place: e.place || 'moon' });
    v.n++;
    if (e.start < v.first) { v.first = e.start; v.place = e.place || 'moon'; }
  }
  return seen;
}

// 开始潜修时决定这次会不会遇到天象、在什么时候
function rollSight(place, plannedMs, entries) {
  if (plannedMs < 5 * 60e3) return null;
  const chance = Object.keys(sightLog(entries)).length ? 0.3 : 0.5;
  if (Math.random() > chance) return null;
  const pool = SIGHTS.filter(s => !s.places || s.places.includes(place));
  let r = Math.random() * pool.reduce((a, s) => a + s.w, 0);
  const s = pool.find(x => (r -= x.w) < 0) || pool[0];
  const durMs = Math.min(s.sec * 1000, plannedMs * 0.6);
  const startMs = plannedMs * (0.2 + Math.random() * 0.5);
  return { id: s.id, type: s.type, startMs: Math.min(startMs, plannedMs * 0.92 - durMs), durMs, seed: Math.random() };
}

/* ---------- 我的星座：每完成一次潜修点亮一颗星，12 颗连成一座 ---------- */

const CON_SIZE = 12;
const CON_NAMES = ['猫爪座', '鱼干座', '毛线团座', '小铃铛座', '胡须座', '尾巴座', '猫薄荷座', '软垫座', '打盹座', '呼噜座', '月牙座', '回家座'];

function conName(i) {
  const base = CON_NAMES[i % CON_NAMES.length];
  const round = Math.floor(i / CON_NAMES.length);
  return round ? `${base}·${'二三四五六七八九十'[Math.min(round - 1, 8)]}` : base;
}

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 每座星座的形状是固定的：随机游走一笔画，再缩放到方框里
function conShape(i) {
  const rnd = seeded(i * 7919 + 13);
  const pts = [];
  let x = 0, y = 0, a = rnd() * Math.PI * 2;
  for (let k = 0; k < CON_SIZE; k++) {
    pts.push([x, y]);
    a += (rnd() - 0.5) * 2.4;
    const step = 0.8 + rnd() * 0.6;
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
  }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) || 1;
  const ox = (1 - (Math.max(...xs) - x0) / span) / 2, oy = (1 - (Math.max(...ys) - y0) / span) / 2;
  return pts.map(([px, py]) => [0.08 + 0.84 * ((px - x0) / span + ox), 0.08 + 0.84 * ((py - y0) / span + oy)]);
}

// n 次潜修：正在点亮第几座，这座亮了几颗
function conState(n) {
  if (!n) return { index: 0, lit: 0, done: 0 };
  const index = Math.floor((n - 1) / CON_SIZE);
  return { index, lit: n - index * CON_SIZE, done: Math.floor(n / CON_SIZE) };
}

function applyConstellation(entries) {
  const st = conState(entries.length);
  Space.constellation(st.lit ? conShape(st.index).slice(0, st.lit) : []);
}

function conText(n) {
  if (!n) return '';
  const st = conState(n);
  return st.lit === CON_SIZE ? `${conName(st.index)}的 12 颗星全部点亮了` : `${conName(st.index)}点亮了第 ${st.lit} 颗星`;
}

function conSvg(points, lit, cls) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', cls);
  const P = points.map(([x, y]) => [x * 100, (1 - y) * 100]);
  for (let i = 1; i < P.length; i++) {
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', P[i - 1][0]); l.setAttribute('y1', P[i - 1][1]);
    l.setAttribute('x2', P[i][0]); l.setAttribute('y2', P[i][1]);
    l.setAttribute('class', i < lit ? 'cl-on' : 'cl-off');
    svg.appendChild(l);
  }
  P.forEach(([x, y], i) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y);
    c.setAttribute('r', i < lit ? 2.4 : 1.3);
    c.setAttribute('class', i < lit ? (i === lit - 1 ? 'cs-on cs-new' : 'cs-on') : 'cs-off');
    svg.appendChild(c);
  });
  return svg;
}

/* ---------- 星图页的“天象”和“星座”两栏 ---------- */

function renderSights(entries) {
  const box = document.getElementById('sm-sights');
  box.textContent = '';
  const seen = sightLog(entries);
  const head = document.createElement('p');
  head.className = 'sm-intro';
  head.textContent = `已收集 ${Object.keys(seen).length} / ${SIGHTS.length}。潜修 5 分钟以上时，天上偶尔会出现。`;
  box.appendChild(head);
  for (const s of SIGHTS) {
    const v = seen[s.id];
    const card = document.createElement('div');
    card.className = 'sight' + (v ? '' : ' unseen');
    const icon = document.createElement('span');
    icon.className = 'sight-icon';
    icon.textContent = v ? s.icon : '?';
    const body = document.createElement('div');
    const h = document.createElement('b');
    h.textContent = v ? s.name : '尚未遇见';
    const p = document.createElement('p');
    p.textContent = v ? s.desc : (s.places ? '只在特定的地方出现。' : '继续潜修，也许下次就能看到。');
    body.append(h, p);
    if (v) {
      const meta = document.createElement('small');
      meta.textContent = `${shortDate(v.first)}在${PLACE[v.place] ? PLACE[v.place].name : '月海'}初见 · 共 ${v.n} 次`;
      body.appendChild(meta);
    }
    card.append(icon, body);
    box.appendChild(card);
  }
}

function renderCons(entries) {
  const box = document.getElementById('sm-cons');
  box.textContent = '';
  const n = entries.length, st = conState(n);
  const cur = document.createElement('div');
  cur.className = 'con-cur';
  cur.appendChild(conSvg(conShape(st.index), st.lit, 'con-big'));
  const name = document.createElement('h3');
  name.textContent = conName(st.index);
  const tip = document.createElement('p');
  tip.textContent = n ? `已点亮 ${st.lit} / ${CON_SIZE} 颗。每完成一次潜修，点亮一颗星。` : '每完成一次潜修，点亮一颗星，12 颗连成一座星座。';
  cur.append(name, tip);
  box.appendChild(cur);
  if (st.done) {
    const t = document.createElement('p');
    t.className = 'sm-intro';
    t.textContent = `已完成 ${st.done} 座`;
    const grid = document.createElement('div');
    grid.className = 'con-grid';
    for (let i = st.done - 1; i >= 0; i--) {
      const cell = document.createElement('div');
      cell.appendChild(conSvg(conShape(i), CON_SIZE, 'con-small'));
      const s = document.createElement('span');
      s.textContent = conName(i);
      cell.appendChild(s);
      grid.appendChild(cell);
    }
    box.append(t, grid);
  }
}
