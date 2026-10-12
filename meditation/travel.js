'use strict';

/* ---------- 小猫星旅：地点、修为、解锁和星图 ---------- */

const TRAVEL_KEY = 'meditation.travel.v1';

// 跨入新星域，需要一次这么多分钟、全程没分心的潜修
const REGIONS = [
  { name: '太阳系', gate: 0 },
  { name: '猎户臂', gate: 10 },
  { name: '银河深处', gate: 20 },
  { name: '河外', gate: 30 },
];

// need：累计修为（小时）
const PLACES = [
  { id: 'moon', name: '月海', r: 0, need: 0, desc: '坐在月面上，看地球从地平线升起。', dot: 'radial-gradient(circle at 38% 34%, #9fd0ff, #2f6eb3 45%, #0d2546 75%)' },
  { id: 'mars', name: '火星日落', r: 0, need: 0.5, desc: '火星的日落是蓝色的，风里飘着细沙。', dot: 'radial-gradient(circle at 40% 36%, #f2b48a, #b5532e 50%, #4a1d10 80%)' },
  { id: 'saturn', name: '土星环', r: 0, need: 2, desc: '冰粒从身边缓缓流过，土星就在眼前。', dot: 'radial-gradient(circle at 40% 38%, #f3e2b8, #c79e5f 50%, #5c4325 80%)' },
  { id: 'orion', name: '猎户座大星云', r: 1, need: 4, desc: '恒星诞生的地方，气体像潮水一样流动。', dot: 'radial-gradient(circle at 45% 45%, #ffd9a8, #d0507e 40%, #2a7f86 70%, #0b1424)' },
  { id: 'pleiades', name: '昴星团', r: 1, need: 7, desc: '七颗蓝白色的星，裹在一层薄雾里。', dot: 'radial-gradient(circle at 45% 45%, #ffffff, #8fb8ff 35%, #24427e 70%, #0a1226)' },
  { id: 'trappist', name: 'TRAPPIST-1', r: 1, need: 11, desc: '红矮星下的冰原，天上挂着邻居星球。', dot: 'radial-gradient(circle at 40% 40%, #ffb38a, #c0392b 45%, #3a0d0a 80%)' },
  { id: 'pillars', name: '创生之柱', r: 2, need: 16, desc: '几光年高的尘埃巨柱，边缘被星光点亮。', dot: 'radial-gradient(circle at 50% 40%, #e8d29a, #8a6a3a 40%, #2c3b4f 75%)' },
  { id: 'crab', name: '蟹状星云', r: 2, need: 22, desc: '超新星的余烬，中心的脉冲星随你的呼吸闪烁。', dot: 'radial-gradient(circle at 50% 50%, #ffffff 5%, #7fb6ff 20%, #e0703a 50%, #2a0e14 80%)' },
  { id: 'blackhole', name: '银心黑洞', r: 2, need: 30, desc: '银河系正中心，吸积盘绕着寂静旋转。', dot: 'radial-gradient(circle at 50% 50%, #000 30%, #ffcf8a 36%, #c2552a 55%, #1a0a05 80%)' },
  { id: 'andromeda', name: '仙女座星系', r: 3, need: 40, desc: '离开银河，第一次从外面看一个星系。', dot: 'radial-gradient(ellipse 60% 35% at 50% 50%, #fff3d6, #b8a6d9 45%, #2a2850 75%, #090a14)' },
  { id: 'deepfield', name: '哈勃深空', r: 3, need: 55, desc: '视野里每一个光点都是一整个星系。', dot: 'radial-gradient(circle at 30% 30%, #ffd9a0 6%, transparent 9%), radial-gradient(circle at 65% 60%, #a8c8ff 5%, transparent 8%), radial-gradient(circle, #1a1d33, #05060c)' },
  { id: 'cmb', name: '宇宙初光', r: 3, need: 75, desc: '138 亿年前的第一缕光，旅程的尽头。', dot: 'radial-gradient(circle at 35% 40%, #ffb36b, #e25a4a 35%, #3d6fc4 65%, #12204a)' },
];
const PLACE = Object.fromEntries(PLACES.map(p => [p.id, p]));

// here：小猫现在在哪；seen：星图上已经看过的解锁（没看过的显示“新”）
let travel = { here: 'moon', seen: ['moon'], ...loadTravel() };
if (!PLACE[travel.here]) travel.here = 'moon';

function loadTravel() {
  try {
    return JSON.parse(localStorage.getItem(TRAVEL_KEY)) || {};
  } catch {
    return {};
  }
}

function saveTravel() {
  try { localStorage.setItem(TRAVEL_KEY, JSON.stringify(travel)); } catch {}
}

// 一切从练习记录里算：没写地点的旧记录算在月海
function travelStats(entries) {
  let sec = 0, longestFocus = 0;
  const visits = {};
  for (const e of entries) {
    sec += e.sec;
    if (e.distractions === 0) longestFocus = Math.max(longestFocus, e.sec / 60);
    const id = PLACE[e.place] ? e.place : 'moon';
    const v = visits[id] || (visits[id] = { n: 0, sec: 0, first: e.start });
    v.n++;
    v.sec += e.sec;
    if (e.start < v.first) v.first = e.start;
  }
  return { hours: sec / 3600, longestFocus, visits };
}

function placeOpen(p, st) {
  return st.hours >= p.need && st.longestFocus >= REGIONS[p.r].gate;
}

function openPlaces(st) {
  return PLACES.filter(p => placeOpen(p, st)).map(p => p.id);
}

function nextPlace(st) {
  return PLACES.find(p => !placeOpen(p, st)) || null;
}

function formatHours(hours) {
  return hours < 10 ? hours.toFixed(1) : String(Math.floor(hours));
}

// 离下一站还差什么，给结束页用
function travelProgressText(st) {
  const next = nextPlace(st);
  if (!next) return '十二站都已点亮';
  const gate = REGIONS[next.r].gate;
  const lackH = next.need - st.hours;
  if (lackH > 0) return `距${next.name}还差 ${formatHours(Math.max(0.1, lackH))} 小时`;
  if (st.longestFocus < gate) return `再完成一次 ${gate} 分钟无分心潜修，就能去${next.name}`;
  return '';
}

function hasNewPlace(st) {
  return openPlaces(st).some(id => !travel.seen.includes(id));
}

/* ---------- 星图 ---------- */

const MAP_ROW = 96;
const MAP_REGION_GAP = 70;
const MAP_PAD = 90;
// 星图上的小猫头像，跟捏好的样子一致（闭着眼）
const miniCat = () => catFace(catStyle, false).replace('class="cat-face"', 'class="sm-cat"');

function shortDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function renderStarmap(entries, focusOn) {
  const st = travelStats(entries);
  const open = openPlaces(st);
  const fresh = open.filter(id => !travel.seen.includes(id));
  document.getElementById('sm-hours').textContent = `修为 ${formatHours(st.hours)} 小时`;

  const route = document.getElementById('sm-route');
  route.textContent = '';
  const pos = [];
  let y = 0;
  PLACES.forEach((p, i) => {
    if (i > 0 && PLACES[i - 1].r !== p.r) y += MAP_REGION_GAP;
    pos.push({ x: [50, 72, 30, 62][i % 4], y });
    y += MAP_ROW;
  });
  const H = y - MAP_ROW + MAP_PAD * 2;
  route.style.height = H + 'px';
  for (const q of pos) q.y = H - MAP_PAD - q.y; // 从下往上走

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 100 ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  route.appendChild(svg);
  for (let i = 1; i < PLACES.length; i++) {
    const a = pos[i - 1], b = pos[i], lit = !!st.visits[PLACES[i].id];
    const my = (a.y + b.y) / 2;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`);
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    path.setAttribute('class', lit ? 'sm-lit' : 'sm-dash');
    svg.appendChild(path);
  }

  REGIONS.forEach((rg, ri) => {
    const idx = PLACES.findIndex(p => p.r === ri);
    const el = document.createElement('div');
    el.className = 'sm-region';
    el.style.top = (pos[idx].y + 64) + 'px';
    el.textContent = rg.name;
    if (rg.gate) {
      const g = document.createElement('i');
      g.textContent = `跨入需一次 ${rg.gate} 分钟无分心潜修`;
      el.appendChild(g);
    }
    route.appendChild(el);
  });

  PLACES.forEach((p, i) => {
    const isOpen = open.includes(p.id), v = st.visits[p.id];
    const b = document.createElement('button');
    b.className = 'sm-node' + (isOpen ? '' : ' locked') + (fresh.includes(p.id) ? ' fresh' : '') + (travel.here === p.id ? ' here' : '');
    b.style.left = pos[i].x + '%';
    b.style.top = pos[i].y + 'px';
    const orb = document.createElement('span');
    orb.className = 'sm-orb';
    orb.style.background = p.dot;
    if (travel.here === p.id) orb.innerHTML = miniCat();
    const lbl = document.createElement('span');
    lbl.className = 'sm-lbl';
    lbl.textContent = p.name;
    const sub = document.createElement('span');
    sub.className = 'sm-sub';
    sub.textContent = v ? `${v.n} 次 · ${formatHours(v.sec / 3600)} 小时` : isOpen ? '新点亮' : `修为 ${p.need} 小时`;
    b.append(orb, lbl, sub);
    b.addEventListener('click', () => openPlaceSheet(p, st, isOpen, focusOn));
    route.appendChild(b);
  });

  // 看过星图，“新”就不再提示
  if (fresh.length) {
    travel.seen = [...new Set([...travel.seen, ...open])];
    saveTravel();
  }
  closePlaceSheet();
  return pos[PLACES.findIndex(p => p.id === travel.here)].y;
}

function openPlaceSheet(p, st, isOpen, focusOn) {
  const sheet = document.getElementById('sm-sheet');
  const v = st.visits[p.id];
  sheet.textContent = '';
  const close = document.createElement('button');
  close.className = 'sm-x';
  close.setAttribute('aria-label', '关闭');
  close.textContent = '✕';
  close.addEventListener('click', closePlaceSheet);
  const title = document.createElement('h3');
  title.textContent = p.name;
  const desc = document.createElement('p');
  desc.textContent = p.desc;
  sheet.append(close, title, desc);
  if (p.id === 'moon') {
    const real = document.createElement('p');
    real.className = 'sm-real';
    real.textContent = realSkyText();
    sheet.appendChild(real);
  }

  if (v) {
    const stats = document.createElement('div');
    stats.className = 'sm-stats';
    for (const [num, label] of [[v.n, '次潜修'], [formatHours(v.sec / 3600), '小时'], [shortDate(v.first), '初次到达']]) {
      const d = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = num;
      const s = document.createElement('span');
      s.textContent = label;
      d.append(b, s);
      stats.appendChild(d);
    }
    sheet.appendChild(stats);
  } else if (!isOpen) {
    const need = document.createElement('div');
    need.className = 'sm-need';
    const gate = REGIONS[p.r].gate;
    const rows = [[`修为 ${formatHours(st.hours)} / ${p.need} 小时`, st.hours / p.need]];
    if (gate) rows.push([`一次 ${gate} 分钟无分心潜修（最长 ${Math.floor(st.longestFocus)} 分钟）`, st.longestFocus / gate]);
    for (const [text, frac] of rows) {
      const row = document.createElement('div');
      row.textContent = text + (frac >= 1 ? ' ✓' : '');
      const bar = document.createElement('span');
      bar.className = 'sm-bar';
      const fill = document.createElement('i');
      fill.style.width = Math.min(100, frac * 100) + '%';
      bar.appendChild(fill);
      row.appendChild(bar);
      need.appendChild(row);
    }
    sheet.appendChild(need);
    if (gate && !focusOn && st.longestFocus < gate) {
      const tip = document.createElement('p');
      tip.textContent = '无分心潜修要在设置里打开专注检测才能记下。';
      sheet.appendChild(tip);
    }
  }

  if (isOpen) {
    const go = document.createElement('button');
    go.className = 'sm-go';
    go.textContent = travel.here === p.id ? '就在这里' : '前往潜修';
    go.disabled = travel.here === p.id;
    go.addEventListener('click', () => travelTo(p.id));
    sheet.appendChild(go);
  }
  sheet.classList.remove('off');
}

function closePlaceSheet() {
  document.getElementById('sm-sheet').classList.add('off');
}
