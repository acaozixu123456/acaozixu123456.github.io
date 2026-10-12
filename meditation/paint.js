'use strict';

/* ---------- 画板：用手指直接在小猫身上画 ---------- */
// 落笔的地方是哪个部位，这一笔就记在哪个部位上（头、耳朵、身体、爪子、尾巴），
// 坐标换成那个部位自己的坐标，所以小猫动起来、调了形，画上去的花纹都跟着走

const PAINT_COLORS = ['#211913', '#4a3020', '#8c5a32', '#b0581f', '#e79b55', '#f6c445', '#f0dcc0', '#ffffff',
  '#9aa0ab', '#3e424b', '#ef9f9a', '#e0607e', '#6d9fd8', '#5cb0a4'];
// 左右对称时，这一笔的镜像落在哪一层
const MIRROR_LAYER = { head: 'head', body: 'body', 'ear-l': 'ear-r', 'ear-r': 'ear-l', 'paw-l': 'paw-r', 'paw-r': 'paw-l' };
// 落笔时先测哪个：画在上面的先测（折耳盖在头上，立耳在头后面）
const HIT_ORDER = [['paw-l'], ['paw-r'], ['ear-l', '.ear-fold '], ['ear-r', '.ear-fold '], ['head'], ['ear-l', '.ear-up '], ['ear-r', '.ear-up '], ['body'], ['tail']];

const painter = {
  tool: 'brush', size: 8, alpha: 1, color: '#211913', mirror: true, clip: true,
  work: null, history: [], at: 0,
  stroke: null, pointers: new Map(), pinch: null,
  zoom: { k: 1, x: 0, y: 0 }, raf: 0, onClose: null,
};

const pt$ = id => document.getElementById(id);
const paintSvg = () => pt$('paint-cat').querySelector('.cat');
const clonePaint = p => JSON.parse(JSON.stringify(p));

// 页面上的点 → svg 根坐标（viewBox 0 0 200 210）；用外框算，带上画板的缩放
function rootPoint(svg, x, y) {
  const r = svg.getBoundingClientRect();
  return { x: (x - r.left) / r.width * 200, y: (y - r.top) / r.height * 210, px: r.width / 200 };
}

// 某个元素自己的坐标 ↔ svg 根坐标
function toRoot(svg, el) {
  return svg.getScreenCTM().inverse().multiply(el.getScreenCTM());
}

function localPoint(svg, el, x, y) {
  const p = rootPoint(svg, x, y);
  const m = toRoot(svg, el);
  const q = new DOMPoint(p.x, p.y).matrixTransform(m.inverse());
  return { x: q.x, y: q.y, rs: Math.hypot(m.a, m.b) };
}

function shown(el, svg) {
  for (let n = el; n && n !== svg; n = n.parentNode) if (getComputedStyle(n).display === 'none') return false;
  return true;
}

// 落笔点在哪个部位
function hitLayer(svg, x, y) {
  for (const [l, scope = ''] of HIT_ORDER) {
    for (const el of svg.querySelectorAll(`${scope}[data-hit="${l}"]`)) {
      if (!shown(el, svg)) continue;
      const q = localPoint(svg, el, x, y);
      const pt = svg.createSVGPoint();
      pt.x = q.x; pt.y = q.y;
      if (l === 'tail' ? el.isPointInStroke(pt) : el.isPointInFill(pt)) return l;
    }
  }
  return null;
}

// 一层画在哪个组里（取它的坐标用）
const layerGroup = (svg, l) => [...svg.querySelectorAll(`.ptc[data-l="${l}"]`)].find(g => shown(g, svg)) ||
  svg.querySelector(`.ptc[data-l="${l}"]`);

const f1 = n => Math.round(n * 10) / 10;

// 把点连成平滑的线：每两点取中点，用二次曲线连
function pathOf(pts) {
  if (pts.length === 1) return `M${f1(pts[0].x)} ${f1(pts[0].y)}h.01`;
  let d = `M${f1(pts[0].x)} ${f1(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    d += `Q${f1(a.x)} ${f1(a.y)} ${f1((a.x + b.x) / 2)} ${f1((a.y + b.y) / 2)}`;
  }
  const z = pts[pts.length - 1];
  return d + `L${f1(z.x)} ${f1(z.y)}`;
}

// 正在画的这一笔，按层展开成要存的笔画（含镜像、橡皮的每一层）
function strokeEntries(st) {
  const base = { c: painter.color, o: painter.alpha, s: painter.tool === 'soft' ? 1 : 0 };
  const out = [];
  if (st.eraser) {
    for (const l of PAINT_LAYERS) {
      const t = st.tracks[l];
      out.push([l, { d: pathOf(t.pts), w: f1(t.w), o: 1, s: 0, e: 1, c: '#000' }]);
      if (painter.mirror && l !== 'tail') {
        const m = st.tracks[MIRROR_LAYER[l]];
        out.push([l, { d: pathOf(m.pts.map(p => ({ x: 200 - p.x, y: p.y }))), w: f1(m.w), o: 1, s: 0, e: 1, c: '#000' }]);
      }
    }
    return out;
  }
  const t = st.tracks[st.layer];
  const s = { ...base, d: pathOf(t.pts), w: f1(t.w) };
  if (!painter.clip || st.free) s.f = 1;
  out.push([st.layer, s]);
  if (painter.mirror && st.layer !== 'tail') {
    out.push([MIRROR_LAYER[st.layer], { ...s, d: pathOf(t.pts.map(p => ({ x: 200 - p.x, y: p.y }))) }]);
  }
  return out;
}

function withStroke() {
  if (!painter.stroke) return painter.work;
  const p = { ...painter.work };
  for (const [l, s] of strokeEntries(painter.stroke)) p[l] = [...p[l], s];
  return p;
}

function redraw() {
  painter.raf = 0;
  renderCatPaint(paintSvg(), withStroke());
}
const queueRedraw = () => { if (!painter.raf) painter.raf = requestAnimationFrame(redraw); };

function addPoint(e) {
  const st = painter.stroke, svg = paintSvg();
  for (const l in st.tracks) {
    const t = st.tracks[l];
    const q = localPoint(svg, t.el, e.clientX, e.clientY);
    const last = t.pts[t.pts.length - 1];
    if (!last || Math.hypot(q.x - last.x, q.y - last.y) > 0.3 / painter.zoom.k) t.pts.push({ x: q.x, y: q.y });
  }
  queueRedraw();
}

function startStroke(e) {
  const svg = paintSvg();
  const eraser = painter.tool === 'eraser';
  let layer = hitLayer(svg, e.clientX, e.clientY), free = false;
  // 落在边缘外一点点也算：在周围找最近的部位
  for (let r = 4; !layer && r <= 12; r += 4) {
    for (let k = 0; k < 8 && !layer; k++) layer = hitLayer(svg, e.clientX + Math.cos(k * Math.PI / 4) * r, e.clientY + Math.sin(k * Math.PI / 4) * r);
  }
  if (!eraser && !layer) {
    if (painter.clip) return;   // 不出界时，画在猫外面不算
    // 画在猫外面：头附近的跟着头，下面的跟着身体
    const q = localPoint(svg, layerGroup(svg, 'head'), e.clientX, e.clientY);
    layer = q.y < 128 ? 'head' : 'body';
    free = true;
  }
  const layers = eraser ? PAINT_LAYERS : [layer, ...(painter.mirror && layer !== 'tail' ? [MIRROR_LAYER[layer]] : [])];
  const tracks = {};
  for (const l of new Set(layers)) {
    const el = layerGroup(svg, l);
    const q = localPoint(svg, el, e.clientX, e.clientY);
    tracks[l] = { el, pts: [], w: brushUnits() / q.rs };
  }
  painter.stroke = { eraser, layer, free, tracks };
  addPoint(e);
}

function endStroke() {
  const st = painter.stroke;
  if (!st) return;
  painter.work = withStroke();
  painter.stroke = null;
  pushHistory();
  queueRedraw();
}

function pushHistory() {
  painter.history = painter.history.slice(0, painter.at + 1);
  painter.history.push(clonePaint(painter.work));
  if (painter.history.length > 60) painter.history.shift();
  painter.at = painter.history.length - 1;
  syncPainterUi();
}

function stepHistory(d) {
  const at = painter.at + d;
  if (at < 0 || at >= painter.history.length) return;
  painter.at = at;
  painter.work = clonePaint(painter.history[at]);
  queueRedraw();
  syncPainterUi();
}

// 笔刷粗细，按小猫的坐标算（放大画面时笔刷看起来也跟着变大，和修图软件一样）
const brushUnits = () => painter.size * 0.45 * (painter.tool === 'eraser' ? 1.6 : 1);

/* 双指缩放、平移 */
function applyZoom() {
  const z = painter.zoom;
  pt$('pt-zoom').style.transform = `translate(${z.x}px, ${z.y}px) scale(${z.k})`;
  pt$('pt-fit').hidden = z.k === 1 && !z.x && !z.y;
}

function pinchInfo() {
  const [a, b] = [...painter.pointers.values()];
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
}

function onDown(e) {
  e.preventDefault();
  pt$('pt-canvas').setPointerCapture?.(e.pointerId);
  painter.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (painter.pointers.size === 2) {
    // 第二根手指放下：刚才那一笔不算，改成缩放
    painter.stroke = null;
    queueRedraw();
    const r = pt$('pt-canvas').getBoundingClientRect();
    painter.pinch = { ...pinchInfo(), z: { ...painter.zoom }, r };
  } else if (painter.pointers.size === 1) {
    startStroke(e);
  }
  showRing(e);
}

function onMove(e) {
  if (!painter.pointers.has(e.pointerId)) { showRing(e); return; }
  painter.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (painter.pinch && painter.pointers.size >= 2) {
    const p = painter.pinch, n = pinchInfo();
    const k = Math.min(6, Math.max(1, p.z.k * n.d / p.d));
    // 以两指中点为中心缩放（pt-zoom 的变换原点是画布中心）
    const ox = p.r.left + p.r.width / 2, oy = p.r.top + p.r.height / 2;
    const ax = (p.cx - ox - p.z.x) / p.z.k, ay = (p.cy - oy - p.z.y) / p.z.k;
    painter.zoom = { k, x: n.cx - ox - ax * k, y: n.cy - oy - ay * k };
    applyZoom();
  } else if (painter.stroke) {
    const list = e.getCoalescedEvents?.() || [e];
    for (const ev of list) addPoint(ev);
  }
  showRing(e);
}

function onUp(e) {
  painter.pointers.delete(e.pointerId);
  if (painter.pinch) {
    if (painter.pointers.size < 2) painter.pinch = null;
  } else if (painter.pointers.size === 0) {
    endStroke();
  }
  if (e.pointerType !== 'mouse') pt$('pt-ring').hidden = true;
}

// 笔刷大小的圈，跟着手指
function showRing(e) {
  const ring = pt$('pt-ring'), r = pt$('pt-canvas').getBoundingClientRect();
  const d = brushUnits() * paintSvg().getBoundingClientRect().width / 200;
  ring.hidden = false;
  ring.style.width = ring.style.height = `${Math.max(4, d)}px`;
  ring.style.transform = `translate(${e.clientX - r.left - d / 2}px, ${e.clientY - r.top - d / 2}px)`;
}

/* 工具栏 */
function renderPaintColors() {
  const box = pt$('pt-colors');
  box.textContent = '';
  const list = [...new Set([...PAINT_COLORS, catPartColor('fur'), catPartColor('stripe')])];
  for (const c of list) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = c;
    b.setAttribute('aria-label', c);
    b.classList.toggle('on', c === painter.color);
    b.addEventListener('click', () => { painter.color = c; if (painter.tool === 'eraser') painter.tool = 'brush'; syncPainterUi(); renderPaintColors(); });
    box.append(b);
  }
  // 任意颜色
  const pick = document.createElement('label');
  pick.className = 'swatch swatch-pick';
  pick.classList.toggle('on', !list.includes(painter.color));
  if (!list.includes(painter.color)) pick.style.background = painter.color;
  const input = document.createElement('input');
  input.type = 'color';
  input.value = painter.color;
  input.addEventListener('input', () => { painter.color = input.value; pick.style.background = input.value; for (const s of box.querySelectorAll('.swatch')) s.classList.toggle('on', s === pick); if (painter.tool === 'eraser') { painter.tool = 'brush'; syncPainterUi(); } });
  pick.append(input);
  box.append(pick);
}

function syncPainterUi() {
  for (const b of pt$('pt-mode').children) b.classList.toggle('on', b.dataset.tool === painter.tool);
  pt$('pt-mirror').classList.toggle('on', painter.mirror);
  pt$('pt-clip').classList.toggle('on', painter.clip);
  pt$('pt-undo').disabled = painter.at <= 0;
  pt$('pt-redo').disabled = painter.at >= painter.history.length - 1;
  const dot = pt$('pt-size-dot'), d = Math.max(3, Math.min(30, painter.size * 0.8));
  dot.style.width = dot.style.height = `${d}px`;
  dot.style.background = painter.tool === 'eraser' ? 'transparent' : painter.color;
  dot.style.opacity = painter.tool === 'eraser' ? 1 : painter.alpha;
  pt$('pt-alpha-val').textContent = `${Math.round(painter.alpha * 100)}%`;
}

let clearArmed = false;

function openPainter(onClose) {
  painter.onClose = onClose;
  painter.work = clonePaint(catPaint);
  painter.history = [clonePaint(painter.work)];
  painter.at = 0;
  painter.zoom = { k: 1, x: 0, y: 0 };
  painter.stroke = null;
  painter.pointers.clear();
  clearArmed = false;
  pt$('pt-clear').textContent = '清空';
  if (!paintSvg()) pt$('paint-cat').innerHTML = catMarkup();
  catLight(catLightNow);
  applyZoom();
  pt$('painter').hidden = false;
  pt$('pt-ring').hidden = true;
  renderPaintColors();
  syncPainterUi();
  redraw();
}

function closePainter(save) {
  if (save) {
    catPaint = painter.work;
    if (!saveCatPaint()) toast('画得太多了，存不下，撤销几笔再试试');
    renderAllPaint();
  }
  pt$('painter').hidden = true;
  painter.onClose?.(save);
}

(() => {
  const canvas = pt$('pt-canvas');
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') pt$('pt-ring').hidden = true; });
  pt$('pt-mode').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) { painter.tool = b.dataset.tool; syncPainterUi(); }
  });
  pt$('pt-mirror').addEventListener('click', () => { painter.mirror = !painter.mirror; syncPainterUi(); });
  pt$('pt-clip').addEventListener('click', () => { painter.clip = !painter.clip; syncPainterUi(); });
  pt$('pt-size').addEventListener('input', e => { painter.size = +e.target.value; syncPainterUi(); });
  pt$('pt-alpha').addEventListener('input', e => { painter.alpha = +e.target.value / 100; syncPainterUi(); });
  pt$('pt-undo').addEventListener('click', () => stepHistory(-1));
  pt$('pt-redo').addEventListener('click', () => stepHistory(1));
  pt$('pt-fit').addEventListener('click', () => { painter.zoom = { k: 1, x: 0, y: 0 }; applyZoom(); });
  pt$('pt-cancel').addEventListener('click', () => closePainter(false));
  pt$('pt-done').addEventListener('click', () => closePainter(true));
  // iOS 不让弹确认框：点两下才清空
  pt$('pt-clear').addEventListener('click', () => {
    if (!clearArmed) {
      clearArmed = true;
      pt$('pt-clear').textContent = '再点一次清空';
      setTimeout(() => { clearArmed = false; pt$('pt-clear').textContent = '清空'; }, 3000);
      return;
    }
    clearArmed = false;
    pt$('pt-clear').textContent = '清空';
    painter.work = Object.fromEntries(PAINT_LAYERS.map(l => [l, []]));
    pushHistory();
    queueRedraw();
  });
})();
