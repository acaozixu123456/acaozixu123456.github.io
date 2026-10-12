'use strict';

/* ---------- 旅行明信片：当前风景 + 小猫 + 这次潜修，合成一张图 ---------- */

const CARD_W = 900;
const CARD_H = 1200;
const CARD_CAT_H = 0.3;     // 小猫占画面高度
const CARD_FEET_Y = -0.2;   // 脚底位置（以画面高度为 1，中心为原点，向上为正）

// 把页面上的小猫 SVG 连同算好的颜色一起画成图片
function catImage(svgEl, w, h) {
  const clone = svgEl.cloneNode(true);
  const src = [svgEl, ...svgEl.querySelectorAll('*')], dst = [clone, ...clone.querySelectorAll('*')];
  const props = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'fill-opacity', 'stroke-opacity', 'stop-color', 'stop-opacity', 'display', 'scale', 'transform-origin', 'transform-box', 'font-family', 'font-size', 'font-weight', 'letter-spacing'];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el), d = dst[i];
    for (const p of props) d.style.setProperty(p, cs.getPropertyValue(p));
    d.removeAttribute('class');
  });
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);
  const xml = new XMLSerializer().serializeToString(clone);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  });
}

function spacedText(g, text, x, y, spacing, align = 'left') {
  const chars = [...text];
  const widths = chars.map(c => g.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  chars.forEach((c, i) => { g.fillText(c, cx, y); cx += widths[i] + spacing; });
}

async function makePostcard(entry, catSvg) {
  const spotH = CARD_CAT_H;
  const spot = {
    x: 0, y: CARD_FEET_Y, height: spotH,
    top: CARD_FEET_Y + spotH * 192 / 210,
    r: spotH * (200 / 210) * 0.36,
  };
  const scene = Space.snapshot(Math.round(CARD_W * 0.8), Math.round(CARD_H * 0.8), spot);
  const card = document.createElement('canvas');
  card.width = CARD_W;
  card.height = CARD_H;
  const g = card.getContext('2d');
  g.fillStyle = '#06070c';
  g.fillRect(0, 0, CARD_W, CARD_H);
  if (scene) {
    g.imageSmoothingQuality = 'high';
    g.drawImage(scene, 0, 0, CARD_W, CARD_H);
  }
  // 上下压暗，文字更清楚
  let gr = g.createLinearGradient(0, 0, 0, CARD_H * 0.3);
  gr.addColorStop(0, 'rgba(4,5,10,.6)');
  gr.addColorStop(1, 'rgba(4,5,10,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, CARD_W, CARD_H * 0.3);
  gr = g.createLinearGradient(0, CARD_H * 0.7, 0, CARD_H);
  gr.addColorStop(0, 'rgba(4,5,10,0)');
  gr.addColorStop(1, 'rgba(4,5,10,.82)');
  g.fillStyle = gr;
  g.fillRect(0, CARD_H * 0.7, CARD_W, CARD_H * 0.3);

  // 小猫：脚底对准明信片里的地面
  const ch = CARD_H * CARD_CAT_H, cw = ch * 200 / 210;
  const feetY = CARD_H / 2 - CARD_FEET_Y * CARD_H;
  try {
    const img = await catImage(catSvg, cw, ch);
    g.drawImage(img, CARD_W / 2 - cw / 2, feetY - ch * 192 / 210, cw, ch);
  } catch {}

  const place = PLACE[entry.place] || PLACE.moon;
  const d = new Date(entry.start);
  g.fillStyle = '#f4efe6';
  g.textBaseline = 'alphabetic';
  g.font = '400 64px "Songti SC", "Noto Serif SC", serif';
  spacedText(g, place.name, 64, 130, 10);
  g.font = '400 26px -apple-system, "PingFang SC", sans-serif';
  g.fillStyle = 'rgba(244,239,230,.75)';
  spacedText(g, `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日  ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, 66, 180, 2);

  const lines = [];
  const sight = SIGHT[entry.sight];
  if (sight) lines.push(`遇见了${sight.name} ${sight.icon}`);
  const ct = conText(log.indexOf(entry) + 1);
  if (ct) lines.push(ct);
  g.fillStyle = '#f4efe6';
  g.font = '400 54px "Songti SC", "Noto Serif SC", serif';
  spacedText(g, `潜修 ${Math.max(1, Math.round(entry.sec / 60))} 分钟`, CARD_W / 2, CARD_H - 150 - (lines.length - 1) * 40, 8, 'center');
  g.font = '400 26px -apple-system, "PingFang SC", sans-serif';
  g.fillStyle = 'rgba(244,239,230,.8)';
  lines.forEach((t, i) => spacedText(g, t, CARD_W / 2, CARD_H - 96 - (lines.length - 1 - i) * 40 + 0, 2, 'center'));
  g.font = '400 20px -apple-system, "PingFang SC", sans-serif';
  g.fillStyle = 'rgba(232,208,150,.85)';
  spacedText(g, '小猫星旅', CARD_W / 2, CARD_H - 44, 8, 'center');
  return card;
}

let cardFile = null;

async function openPostcard(entry, catSvg) {
  const view = document.getElementById('postcard');
  const img = document.getElementById('postcard-img');
  const share = document.getElementById('postcard-share');
  view.hidden = false;
  img.removeAttribute('src');
  img.classList.add('loading');
  const card = await makePostcard(entry, catSvg);
  img.src = card.toDataURL('image/jpeg', 0.92);
  img.classList.remove('loading');
  cardFile = null;
  share.hidden = true;
  card.toBlob(blob => {
    if (!blob) return;
    const d = new Date(entry.start);
    const f = new File([blob], `小猫星旅-${d.getMonth() + 1}${String(d.getDate()).padStart(2, '0')}.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { cardFile = f; share.hidden = false; }
  }, 'image/jpeg', 0.92);
}

function closePostcard() {
  document.getElementById('postcard').hidden = true;
}

async function sharePostcard() {
  if (!cardFile) return;
  try { await navigator.share({ files: [cardFile] }); } catch {}
}
