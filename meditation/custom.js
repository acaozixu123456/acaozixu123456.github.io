'use strict';

/* ---------- 捏脸：自己调小猫的毛色、花纹、眼睛、五官和项圈 ---------- */
// 全部存在 localStorage，套用时只改 <html> 上的 CSS 变量和 data-cat-* 属性，页面上每只猫一起变

const CAT_LOOK_KEY = 'meditation.cat.v1';

// 毛色：头（hi/fur/lo）和身体（bhi/body/blo）各三档，bridge 是鼻梁那道深一点的毛
const FURS = {
  latte: { name: '拿铁', hi: '#c9ab84', fur: '#a68a64', lo: '#6b5640', bhi: '#b99d78', body: '#8c7456', blo: '#43362a', bridge: '#cf9a64' },
  orange: { name: '橘', hi: '#f6c58c', fur: '#e79b55', lo: '#a9612c', bhi: '#efb276', body: '#d98a47', blo: '#7a421b', bridge: '#e0874a' },
  cream: { name: '奶油', hi: '#fbf1e2', fur: '#f0dcc0', lo: '#cfb38e', bhi: '#f6e8d4', body: '#e8d1b2', blo: '#b99b74', bridge: '#e8c49a' },
  silver: { name: '银灰', hi: '#d6dae1', fur: '#adb3bd', lo: '#6e7480', bhi: '#c7ccd4', body: '#9aa0ab', blo: '#4f545e', bridge: '#bcc1c9' },
  blue: { name: '蓝灰', hi: '#a9b2c2', fur: '#828c9e', lo: '#4c5465', bhi: '#9ba4b4', body: '#727c8e', blo: '#363c4a', bridge: '#8a93a4' },
  choco: { name: '巧克力', hi: '#8f6b52', fur: '#6c4c38', lo: '#3f2b1f', bhi: '#7e5d46', body: '#5e4130', blo: '#2a1c14', bridge: '#7a5640' },
  black: { name: '黑', hi: '#55555f', fur: '#3b3b45', lo: '#23232a', bhi: '#4c4c56', body: '#34343d', blo: '#1c1c22', bridge: '#3b3b45' },
  white: { name: '雪白', hi: '#ffffff', fur: '#f4f0ea', lo: '#cbc3b8', bhi: '#fcf9f4', body: '#ece6dd', blo: '#b3a99b', bridge: '#f0e6da' },
};
const STRIPE_COLORS = { black: '#211913', brown: '#4a3020', ginger: '#b0581f', grey: '#3e424b', tan: '#c9a57a', silver: '#8d97a8' };
const CAT_PATTERNS = { tabby: '虎斑', soft: '淡纹', none: '纯色', point: '重点色' };
const WHITES = { none: '无', bib: '白胸口', more: '奶牛' };
const MUZZLES = { tan: '奶茶', light: '浅色', white: '白', same: '同毛色' };
// 眼睛：上、中、下三段渐变
const EYE_COLORS = {
  green: { name: '青绿', c: ['#5f7028', '#9eab45', '#ecd774'] },
  gold: { name: '金黄', c: ['#9a6f12', '#d9ad3c', '#f6e08e'] },
  copper: { name: '铜橙', c: ['#8a4210', '#d07a2a', '#f3c06a'] },
  blue: { name: '蓝', c: ['#2d5b9a', '#6d9fd8', '#d4e9fb'] },
  aqua: { name: '湖绿', c: ['#2b6a64', '#5cb0a4', '#d6efe2'] },
  odd: { name: '异瞳', c: ['#2d5b9a', '#6d9fd8', '#d4e9fb'], c2: ['#9a6f12', '#d9ad3c', '#f6e08e'] },
};
const EYE_SIZES = { s: ['小', .9], m: ['标准', 1], l: ['大', 1.1] };
const EARS = { up: '立耳', fold: '折耳' };
const NOSES = { pink: ['粉', '#d4837a', '#6e3f33'], rose: ['砖红', '#b86656', '#5e2e24'], dark: ['深色', '#4e3c38', '#2a1e1b'] };
const BLUSH = { on: '有', off: '无' };
// 项圈：带子、高光、暗边、字
const COLLARS = {
  brown: ['#7a4a2c', '#a46a43', '#5a341e', '#f3e3c8'],
  red: ['#b23a3a', '#d65c5c', '#7e2424', '#ffe9e0'],
  pink: ['#e58aa0', '#f3adbe', '#b8607a', '#fff4f6'],
  blue: ['#3a6ea8', '#5f92cc', '#24507e', '#eaf3ff'],
  green: ['#4b766e', '#6f9a90', '#335650', '#eef7f2'],
  black: ['#2a2a30', '#4a4a52', '#16161a', '#f0d58a'],
  none: null,
};

const CAT_PRESETS = [
  { name: '拿铁', look: { fur: 'latte', pattern: 'tabby', stripe: 'black', white: 'bib', muzzle: 'tan', eyes: 'green', eyeSize: 'm', ears: 'up', nose: 'pink', blush: 'on' } },
  { name: '橘子', look: { fur: 'orange', pattern: 'tabby', stripe: 'ginger', white: 'bib', muzzle: 'light', eyes: 'gold', eyeSize: 'm', ears: 'up', nose: 'pink', blush: 'on' } },
  { name: '奶牛', look: { fur: 'black', pattern: 'none', stripe: 'black', white: 'more', muzzle: 'white', eyes: 'green', eyeSize: 'm', ears: 'up', nose: 'pink', blush: 'on' } },
  { name: '蓝胖', look: { fur: 'blue', pattern: 'none', stripe: 'grey', white: 'none', muzzle: 'same', eyes: 'copper', eyeSize: 'l', ears: 'up', nose: 'dark', blush: 'off' } },
  { name: '暹罗', look: { fur: 'cream', pattern: 'point', stripe: 'brown', white: 'none', muzzle: 'same', eyes: 'blue', eyeSize: 'm', ears: 'up', nose: 'dark', blush: 'off' } },
  { name: '银虎斑', look: { fur: 'silver', pattern: 'tabby', stripe: 'black', white: 'bib', muzzle: 'white', eyes: 'aqua', eyeSize: 'm', ears: 'up', nose: 'rose', blush: 'on' } },
  { name: '煤球', look: { fur: 'black', pattern: 'none', stripe: 'black', white: 'none', muzzle: 'same', eyes: 'gold', eyeSize: 'l', ears: 'up', nose: 'dark', blush: 'off' } },
  { name: '团子', look: { fur: 'white', pattern: 'none', stripe: 'tan', white: 'none', muzzle: 'same', eyes: 'odd', eyeSize: 'l', ears: 'fold', nose: 'pink', blush: 'on' } },
  { name: '布丁', look: { fur: 'cream', pattern: 'soft', stripe: 'tan', white: 'bib', muzzle: 'white', eyes: 'copper', eyeSize: 'm', ears: 'fold', nose: 'pink', blush: 'on' } },
];
const DEFAULT_LOOK = { ...CAT_PRESETS[0].look, collar: 'brown', name: '拿铁' };

// 每一项的可选值，捏脸页按这个排
const LOOK_OPTIONS = {
  fur: FURS, pattern: CAT_PATTERNS, stripe: STRIPE_COLORS, white: WHITES, muzzle: MUZZLES,
  eyes: EYE_COLORS, eyeSize: EYE_SIZES, ears: EARS, nose: NOSES, blush: BLUSH, collar: COLLARS,
};

let catStyle = loadCatLook();

function loadCatLook() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(CAT_LOOK_KEY)); } catch {}
  const look = { ...DEFAULT_LOOK, ...(saved || {}) };
  // 以前在衣柜里买过毛色的，第一次打开时换成对应的样子
  if (!saved) {
    try {
      const worn = (JSON.parse(localStorage.getItem('meditation.wardrobe.v1')) || {}).worn || [];
      const coat = { 'coat-cream': 'cream', 'coat-grey': 'silver', 'coat-black': 'black' }[worn.find(w => w.startsWith('coat-'))];
      if (coat) Object.assign(look, { fur: coat, stripe: coat === 'cream' ? 'tan' : coat === 'silver' ? 'grey' : 'black' });
      if (coat === 'black') Object.assign(look, { pattern: 'none', muzzle: 'same', eyes: 'gold' });
    } catch {}
  }
  for (const k in LOOK_OPTIONS) if (!(look[k] in LOOK_OPTIONS[k])) look[k] = DEFAULT_LOOK[k];
  if (typeof look.name !== 'string') look.name = DEFAULT_LOOK.name;
  return look;
}

function saveCatLook() {
  try { localStorage.setItem(CAT_LOOK_KEY, JSON.stringify(catStyle)); } catch {}
}

/* 颜色小工具 */
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbHex = c => '#' + c.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const mixHex = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * t)); };
const luma = h => { const [r, g, b] = hexRgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };

// 一套样子 → 全部颜色变量
function catLookVars(look) {
  const F = FURS[look.fur], v = {};
  Object.assign(v, {
    'fur-hi': F.hi, fur: F.fur, 'fur-lo': F.lo, 'body-hi': F.bhi, body: F.body, 'body-lo': F.blo, 'fur-dark': F.lo,
    stripe: STRIPE_COLORS[look.stripe],
  });
  // 白色部分；没有白就用比身体浅一点的毛
  if (look.white === 'none') Object.assign(v, { 'white-hi': mixHex(F.bhi, '#ffffff', .12), 'fur-light': mixHex(F.bhi, F.body, .35), 'white-lo': F.body });
  else Object.assign(v, { 'white-hi': '#ffffff', 'fur-light': '#fbf7f1', 'white-lo': luma(F.fur) < .3 ? '#cfc6bb' : '#dcd0c2' });
  const light = v['fur-light'];
  const muzzle = {
    tan: ['#dcb48a', '#e2c19c'],
    light: [mixHex(F.hi, '#ffffff', .4), mixHex(F.hi, '#ffffff', .5)],
    white: ['#fbf7f1', '#fdfaf6'],
    same: [F.hi, mixHex(F.hi, F.fur, .3)],
  }[look.muzzle];
  v.muzzle = muzzle[0];
  v['muzzle-lo'] = muzzle[1];
  v.bridge = look.muzzle === 'tan' ? '#cf9a64' : F.bridge;
  // 线条颜色跟着底色走：深色毛上用浅色的线，看得清
  const darkFur = luma(F.fur) < .3;
  v['cat-ink'] = darkFur ? '#d9d2c6' : '#2a1f19';
  v.mouth = luma(muzzle[0]) < .4 ? '#d8c9a8' : '#4e3327';
  v.dots = luma(muzzle[0]) < .4 ? '#8a8a96' : mixHex(F.lo, muzzle[0], .2);
  v.whisker = luma(light) > .85 && luma(F.fur) > .8 ? '#d8d0c4' : '#ffffff';
  const E = EYE_COLORS[look.eyes], E2 = E.c2 || E.c;
  ['top', 'mid', 'bot'].forEach((k, i) => { v['eye-' + k] = E.c[i]; v['eye2-' + k] = E2[i]; });
  v['eye-s'] = EYE_SIZES[look.eyeSize][1];
  const N = NOSES[look.nose];
  v.nose = N[1];
  v['nose-ink'] = N[2];
  const C = COLLARS[look.collar] || COLLARS.brown;
  Object.assign(v, { collar: C[0], 'collar-hi': C[1], 'collar-lo': C[2], 'collar-text': C[3] });
  return v;
}

function applyCatLook() {
  const root = document.documentElement, vars = catLookVars(catStyle);
  for (const k in vars) root.style.setProperty('--' + k, vars[k]);
  root.dataset.catPattern = catStyle.pattern;
  root.dataset.catWhite = catStyle.white;
  root.dataset.catEars = catStyle.ears;
  root.dataset.catBlush = catStyle.blush;
  root.dataset.catCollar = catStyle.collar === 'none' ? 'none' : 'on';
  for (const t of document.querySelectorAll('.cat .tag textPath')) t.textContent = catStyle.name;
}

function setCatLook(patch) {
  Object.assign(catStyle, patch);
  saveCatLook();
  applyCatLook();
}

function randomCatLook() {
  const pick = o => { const k = Object.keys(o); return k[Math.floor(Math.random() * k.length)]; };
  const look = {};
  for (const k in LOOK_OPTIONS) if (k !== 'collar') look[k] = pick(LOOK_OPTIONS[k]);
  // 异瞳、重点色这些少见的，别太常出现
  if (look.eyes === 'odd' && Math.random() < .5) look.eyes = pick(EYE_COLORS);
  if (look.pattern === 'point' && Math.random() < .5) look.pattern = 'tabby';
  return look;
}

// 小猫头像（预设格子和星图上用），颜色直接写死，不依赖页面变量
function catFace(look, open = true) {
  const v = catLookVars({ ...DEFAULT_LOOK, ...look });
  const fold = look.ears === 'fold';
  const ears = fold
    ? `<path fill="${v.fur}" d="M44 68 C 38 48, 50 30, 70 30 C 82 30, 90 36, 92 44 C 80 46, 66 54, 58 66 Z M156 68 C 162 48, 150 30, 130 30 C 118 30, 110 36, 108 44 C 120 46, 134 54, 142 66 Z"/>`
    : `<path fill="${v.fur}" d="M42 74 Q34 30 48 16 Q56 10 66 16 Q82 26 96 42 Z M158 74 Q166 30 152 16 Q144 10 134 16 Q118 26 104 42 Z"/><path fill="${look.pattern === 'point' ? v.stripe : '#ef9f9a'}" opacity=".85" d="M52 60 Q48 36 54 27 Q58 24 64 27 Q74 34 82 44 Z M148 60 Q152 36 146 27 Q142 24 136 27 Q126 34 118 44 Z"/>`;
  const stripes = look.pattern === 'tabby' || look.pattern === 'soft'
    ? `<path d="M100 34 v18 M88 35 l3 17 M112 35 l-3 17 M76 40 l5 16 M124 40 l-5 16" stroke="${v.stripe}" stroke-width="6" stroke-linecap="round" opacity="${look.pattern === 'soft' ? .45 : .9}"/>` : '';
  const white = look.white === 'more'
    ? `<path fill="#fbf7f1" d="M100 70 C 96 84, 92 96, 84 102 C 70 106, 54 112, 46 124 Q 70 135 100 135 Q 130 135 154 124 C 146 112, 130 106, 116 102 C 108 96, 104 84, 100 70 Z"/>`
    : look.white === 'bib' ? `<path fill="#fbf7f1" d="M58 120 Q100 98 142 120 Q124 135 100 135 Q76 135 58 120 Z"/>` : '';
  const point = look.pattern === 'point' ? `<ellipse cx="100" cy="104" rx="34" ry="26" fill="${v.stripe}" opacity=".75"/>` : '';
  const eye = (x, c) => open
    ? `<ellipse cx="${x}" cy="93" rx="${13 * v['eye-s']}" ry="${14.5 * v['eye-s']}" fill="${c}" stroke="${v['cat-ink']}" stroke-width="2"/><ellipse cx="${x}" cy="94" rx="${7 * v['eye-s']}" ry="${10 * v['eye-s']}" fill="#17110e"/><circle cx="${x + 4}" cy="88" r="3.6" fill="#fff"/>`
    : `<path d="M${x - 11} 94 Q${x} 102 ${x + 11} 94" stroke="${v['cat-ink']}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  return `<svg class="cat-face" viewBox="26 8 148 132" aria-hidden="true">${ears}<ellipse fill="${v.fur}" cx="100" cy="84" rx="64" ry="51"/>${stripes}${white}<ellipse fill="${v.muzzle}" cx="100" cy="110" rx="15" ry="9"/>${point}${eye(72, v['eye-mid'])}${eye(128, v['eye2-mid'])}<path fill="${v.nose}" d="M96 103 h8 l-4 5 z"/></svg>`;
}

applyCatLook();
