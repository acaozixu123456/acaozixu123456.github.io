'use strict';

// 小猫主角“拿铁”：照着真猫画的虎斑猫。一张 SVG，动作全靠 CSS 类切换（见 style.css 的“小猫”部分）
// 颜色都是 CSS 变量，换毛色只改变量；渐变和裁切的 id 里的 __ 在挂载时换成每只猫自己的前缀
const HEART = 'M0 3 C0 -1 6 -1 6 3 C6 -1 12 -1 12 3 C12 7 6 10 6 12 C6 10 0 7 0 3 Z';

// 一笔两头尖的条纹：沿二次曲线 p1→c→p2，中间最宽 w
function taper(x1, y1, cx, cy, x2, y2, w) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len * w, ny = dx / len * w;
  const f = n => +n.toFixed(1);
  return `M${f(x1)} ${f(y1)} Q${f(cx + nx)} ${f(cy + ny)} ${f(x2)} ${f(y2)} Q${f(cx - nx)} ${f(cy - ny)} ${f(x1)} ${f(y1)} Z`;
}
// 给左半边的条纹，连同镜像的右半边一起画
const stripes = list => list.concat(list.map(([x1, y1, cx, cy, x2, y2, w]) => [200 - x1, y1, 200 - cx, cy, 200 - x2, y2, -w]))
  .map(a => taper(...a)).join(' ');

const CAT_HEAD = 'M100 30 C 150 30, 168 60, 166 90 Q 171 96 173 101 Q 167 101 164 104 Q 168 109 166 113 Q 160 112 156 114 C 145 128, 124 135, 100 135 C 76 135, 55 128, 44 114 Q 40 112 34 113 Q 32 109 36 104 Q 33 101 27 101 Q 29 96 34 90 C 32 60, 50 30, 100 30 Z';
const CAT_BODY = 'M100 118 C 64 118, 55 154, 57 176 C 59 197, 141 197, 143 176 C 145 154, 136 118, 100 118 Z';
const CAT_TAIL = 'M136 186 C 176 192, 190 154, 166 130';
const HEAD_STRIPES = taper(100, 28, 101, 40, 100, 54, 4.6) + ' ' + stripes([
  [90, 29, 91, 41, 92, 54, 3.8], [80, 32, 83, 44, 85, 57, 3.6], [69, 38, 73, 49, 76, 61, 3.2], [59, 48, 63, 56, 66, 66, 2.6],
  [56, 95, 44, 93, 28, 90, 3.6], [54, 104, 44, 104, 30, 106, 3.2], [50, 114, 42, 114, 34, 118, 2.4],
]);
const BODY_STRIPES = stripes([[52, 126, 64, 130, 78, 142, 6.5], [48, 144, 64, 148, 78, 162, 7.5], [48, 162, 62, 166, 76, 180, 7.5], [50, 180, 62, 184, 72, 198, 7]]);
// 眼睛：左眼中心 (72, 93)，右眼 (128, 93)
const EYE = [[72, 93], [128, 93]];
const eyes = fn => EYE.map(([x, y]) => fn(x, y)).join('');
const stop = (o, v, a = 1) => `<stop offset="${o}" style="stop-color:var(${v});stop-opacity:${a}"/>`;

const CAT_SVG = `
<svg class="cat" viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="__fur" cx=".45" cy=".3" r=".8">${stop(0, '--fur-hi')}${stop(.55, '--fur')}${stop(1, '--fur-lo')}</radialGradient>
    <radialGradient id="__body" cx=".45" cy=".25" r=".85">${stop(0, '--body-hi')}${stop(.55, '--body')}${stop(1, '--body-lo')}</radialGradient>
    <radialGradient id="__white" cx=".45" cy=".35" r=".75">${stop(0, '--white-hi')}${stop(.7, '--fur-light')}${stop(1, '--white-lo')}</radialGradient>
    <linearGradient id="__face" gradientUnits="userSpaceOnUse" x1="0" y1="109" x2="0" y2="121">${stop(0, '--fur-light', 0)}${stop(.6, '--fur-light', .85)}${stop(1, '--fur-light')}</linearGradient>
    <radialGradient id="__chin">${stop(.4, '--fur-light')}${stop(1, '--fur-light', 0)}</radialGradient>
    <radialGradient id="__muzzle">${stop(0, '--muzzle')}${stop(.65, '--muzzle-lo', .95)}${stop(1, '--muzzle-lo', 0)}</radialGradient>
    <radialGradient id="__bridge">${stop(0, '--bridge', .9)}${stop(1, '--bridge', 0)}</radialGradient>
    <radialGradient id="__cap">${stop(0, '--stripe', .6)}${stop(1, '--stripe', 0)}</radialGradient>
    <linearGradient id="__iris" x1="0" y1="0" x2="0" y2="1">${stop(0, '--eye-top')}${stop(.55, '--eye-mid')}${stop(1, '--eye-bot')}</linearGradient>
    <radialGradient id="__blush">${stop(0, '--cat-pink', .85)}${stop(1, '--cat-pink', 0)}</radialGradient>
    <linearGradient id="__rim" x1="0" y1="0" x2="1" y2="0">${stop(.6, '--rim', 0)}${stop(1, '--rim', .32)}</linearGradient>
    <clipPath id="__headc"><path d="${CAT_HEAD}"/></clipPath>
    <clipPath id="__bodyc"><path d="${CAT_BODY}"/></clipPath>
    <clipPath id="__eyec">${eyes((x, y) => `<ellipse cx="${x}" cy="${y}" rx="13" ry="14.5"/>`)}</clipPath>
  </defs>
  <ellipse class="shadow" cx="100" cy="198" rx="50" ry="6"/>
  <g class="acc acc-cushion">
    <ellipse class="cushion-base" cx="100" cy="196" rx="76" ry="14"/>
    <ellipse class="cushion-top" cx="100" cy="191" rx="70" ry="10"/>
    <circle class="cushion-tuft" cx="100" cy="191" r="2.4"/>
  </g>
  <g class="sparkles">
    <path class="s1" d="M24 60 l3 -9 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 z"/>
    <path class="s2" d="M176 100 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 z"/>
    <path class="s3" d="M20 140 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 z"/>
  </g>
  <g class="hopper">
    <g class="poser">
    <g class="tail">
      <path class="tail-base" d="${CAT_TAIL}"/>
      <path class="tail-ring" d="${CAT_TAIL}"/>
      <path class="tail-tip" d="M166 130 C 190 154, 176 192, 136 186" pathLength="100"/>
    </g>
    <g class="body-g">
      <path d="${CAT_BODY}" fill="url(#__body)"/>
      <g clip-path="url(#__bodyc)">
        <path class="stripe-f" d="${BODY_STRIPES}"/>
        <path class="rim" d="${CAT_BODY}" stroke="url(#__rim)"/>
      </g>
      <g class="thighs"><path class="limb thigh-r"/><path class="limb thigh-l"/></g>
      <path class="belly" d="M100 130 Q94 126 90 131 Q84 129 82 136 C 77 152, 78 170, 81 178 C 86 191, 114 191, 119 178 C 122 170, 123 152, 118 136 Q116 129 110 131 Q106 126 100 130 Z" fill="url(#__white)"/>
      <g class="legs">
        <g class="leg leg-r"><path class="limb"/><path class="limb-ring"/><path class="crease"/></g>
        <g class="leg leg-l"><path class="limb"/><path class="limb-ring"/><path class="crease"/></g>
        <g class="foot foot-r"><ellipse class="light" rx="10.5" ry="6.5"/><ellipse class="pad" cx="-1" cy=".5" rx="3.6" ry="2.6"/><path class="toe" d="M-4 4 v-3.5 M4 4 v-3.5"/></g>
        <g class="foot foot-l"><ellipse class="light" rx="10.5" ry="6.5"/><ellipse class="pad" cx="1" cy=".5" rx="3.6" ry="2.6"/><path class="toe" d="M-4 4 v-3.5 M4 4 v-3.5"/></g>
      </g>
      <g class="pawpos-l"><g class="paw paw-l"><ellipse cx="83" cy="190" rx="13.5" ry="8.5" fill="url(#__white)"/><path class="toe" d="M79 192.5 v-3.5 M87 192.5 v-3.5"/></g></g>
      <g class="pawpos-r"><g class="paw paw-r"><ellipse cx="117" cy="190" rx="13.5" ry="8.5" fill="url(#__white)"/><path class="toe" d="M113 192.5 v-3.5 M121 192.5 v-3.5"/></g></g>
    </g>
    <g class="head">
      <g class="ear ear-l">
        <path d="M42 74 Q34 30 48 16 Q56 10 66 16 Q82 26 96 42 Z" fill="url(#__fur)"/>
        <path class="inner" d="M50 62 Q45 34 52 24 Q57 20 64 24 Q76 32 86 44 Z"/>
        <path class="tuft" d="M51 54 l7 -5 M53 46 l6 -3"/>
      </g>
      <g class="ear ear-r">
        <path d="M158 74 Q166 30 152 16 Q144 10 134 16 Q118 26 104 42 Z" fill="url(#__fur)"/>
        <path class="inner" d="M150 62 Q155 34 148 24 Q143 20 136 24 Q124 32 114 44 Z"/>
        <path class="tuft" d="M149 54 l-7 -5 M147 46 l-6 -3"/>
      </g>
      <path d="${CAT_HEAD}" fill="url(#__fur)"/>
      <g clip-path="url(#__headc)">
        <ellipse cx="100" cy="27" rx="54" ry="30" fill="url(#__cap)"/>
        <ellipse cx="100" cy="96" rx="7" ry="11" fill="url(#__bridge)"/>
        <path d="M100 114 C 93 114, 88 110.5, 82 111 C 70 113, 57 119, 48 130 L 48 140 L 152 140 L 152 130 C 143 119, 130 113, 118 111 C 112 110.5, 107 114, 100 114 Z" fill="url(#__face)"/>
        <ellipse cx="100" cy="104" rx="7" ry="8" fill="url(#__muzzle)"/>
        <ellipse cx="92" cy="110.5" rx="11.5" ry="9" fill="url(#__muzzle)"/>
        <ellipse cx="108" cy="110.5" rx="11.5" ry="9" fill="url(#__muzzle)"/>
        <ellipse cx="100" cy="122.5" rx="15" ry="6" fill="url(#__chin)"/>
        <path class="dots" d="M88.5 109 h.1 M86.5 112 h.1 M89.8 112.6 h.1 M111.5 109 h.1 M113.5 112 h.1 M110.2 112.6 h.1"/>
        <path class="stripe-f" d="${HEAD_STRIPES}"/>
        <path class="rim" d="${CAT_HEAD}" stroke="url(#__rim)"/>
      </g>
      <ellipse class="blush" cx="54" cy="113" rx="11" ry="6.5" fill="url(#__blush)"/>
      <ellipse class="blush" cx="146" cy="113" rx="11" ry="6.5" fill="url(#__blush)"/>
      <g class="eyes eyes-closed">${eyes((x, y) => `<path d="M${x - 11} ${y + 1} Q${x} ${y + 9} ${x + 11} ${y + 1}"/>`)}</g>
      <g class="eyes eyes-happy">${eyes((x, y) => `<path d="M${x - 11} ${y + 5} Q${x} ${y - 5} ${x + 11} ${y + 5}"/>`)}</g>
      <g class="eyes-open">
        ${eyes((x, y) => `<ellipse class="iris" cx="${x}" cy="${y}" rx="13" ry="14.5" fill="url(#__iris)"/>`)}
        <g clip-path="url(#__eyec)"><g class="look">
          ${eyes((x, y) => `<ellipse class="pupil" cx="${x + .5}" cy="${y + .5}" rx="8" ry="11"/>`)}
          ${eyes((x, y) => `<circle class="shine" cx="${x + 4.6}" cy="${y - 5}" r="4.6"/><circle class="shine" cx="${x - 5}" cy="${y + 6.5}" r="2.1" opacity=".9"/><circle class="shine" cx="${x + 6.2}" cy="${y + 6}" r="1.1" opacity=".8"/>`)}
        </g></g>
        ${eyes((x, y) => `<ellipse class="eye-ring" cx="${x}" cy="${y}" rx="13.4" ry="14.9"/>`)}
      </g>
      <path class="nose" d="M96.6 103.5 h6.8 q-1 3.4 -3.4 4.4 q-2.4 -1 -3.4 -4.4 z"/>
      <ellipse class="nose-shine" cx="99" cy="104.3" rx="1.4" ry=".6"/>
      <path class="mouth" d="M100 108.4 v1.6 M100 110 Q97.6 113 95.2 111.4 M100 110 Q102.4 113 104.8 111.4"/>
      <g class="mouth-open"><ellipse cx="100" cy="114" rx="5.5" ry="6.5"/><ellipse class="tongue" cx="100" cy="117.5" rx="3.5" ry="2.3"/></g>
      <path class="whisker" d="M58 110 Q42 106 26 107 M58 116 Q44 118 30 123 M142 110 Q158 106 174 107 M142 116 Q156 118 170 123"/>
      <g class="collar">
        <path class="band" id="__collar" d="M68 130 Q100 147 132 130"/>
        <path class="band-hi" d="M69 126.2 Q100 142.4 131 126.2"/>
        <path class="band-lo" d="M69 133.8 Q100 151.6 131 133.8"/>
        <text class="tag" dy="2.7"><textPath href="#__collar" startOffset="50%" text-anchor="middle">拿铁</textPath></text>
      </g>
      <g class="acc acc-scarf">
        <path class="scarf-tail" d="M116 136 l6 30 l12 -3 l-4 -30 z"/>
        <path class="scarf" d="M60 127 Q100 152 140 127"/>
        <path class="scarf-knit" d="M72 134 l2 6 M86 139 l1 6 M100 141 l0 6 M114 139 l-1 6 M128 134 l-2 6"/>
      </g>
      <g class="acc acc-glasses">
        <circle cx="72" cy="93" r="17"/><circle cx="128" cy="93" r="17"/>
        <path d="M89 91 Q100 86 111 91 M55 90 L36 84 M145 90 L164 84"/>
      </g>
      <g class="acc acc-beanie">
        <path class="beanie" d="M56 56 C 56 12, 144 12, 144 56 Z"/>
        <path class="beanie-rib" d="M74 28 v26 M88 21 v33 M112 21 v33 M126 28 v26"/>
        <rect class="beanie-band" x="52" y="49" width="96" height="12" rx="6"/>
        <circle class="beanie-pom" cx="100" cy="13" r="9"/>
      </g>
      <g class="acc acc-bow">
        <path class="bow" d="M140 38 l-14 -10 l2 18 z M140 38 l14 -10 l-2 18 z"/>
        <circle class="bow-knot" cx="140" cy="38" r="4"/>
      </g>
    </g>
    </g>
  </g>
  <g class="yarn">
    <path class="thread" d="M-2 196 C 14 202, 28 188, 40 194"/>
    <g class="ball"><circle cx="40" cy="182" r="13"/><path d="M30 176 Q40 186 50 176 M29 186 Q40 176 51 188 M36 170 Q46 182 38 195"/></g>
  </g>
  <g class="hearts">
    <path class="h1" transform="translate(150 50)" d="${HEART}"/>
    <path class="h2" transform="translate(166 70) scale(.8)" d="${HEART}"/>
    <path class="h3" transform="translate(36 56) scale(.9)" d="${HEART}"/>
  </g>
  <g class="zzz">
    <text class="z1" x="156" y="46">z</text>
    <text class="z2" x="168" y="32">z</text>
    <text class="z3" x="180" y="18">Z</text>
  </g>
  <g class="bubble">
    <circle cx="174" cy="36" r="17"/>
    <text x="174" y="43" text-anchor="middle"></text>
  </g>
</svg>`;

let catCount = 0;
function catMarkup() {
  const p = `c${++catCount}-`;
  return CAT_SVG.replace(/__/g, p);
}

function mountCats() {
  for (const host of document.querySelectorAll('.cat-host')) host.innerHTML = catMarkup();
  for (const host of document.querySelectorAll('.lotus-mode')) catPose(host, 1);
}

/* ---------- 站着 ↔ 盘腿坐：s 从 0（站）到 1（盘腿），腿一路弯折收拢 ---------- */

// 三个关键姿势：站着、半蹲（膝盖向外打开）、盘腿。左腿的数据，右腿镜像。
// 胯跟着身体走；膝盖和脚按地面坐标给，脚先踩在地上，坐稳时翻成脚心朝上
const LEG_KEYS = {
  hip: [[85, 180], [84, 181], [82, 181]],
  knee: [[85, 186], [63, 186], [53, 187]],
  foot: [[85, 191], [89, 192], [112, 187]],
};
const SIT_LIFT = 14;

function legAt(key, s, flip) {
  const [a, m, b] = LEG_KEYS[key];
  // 经过中间姿势的二次贝塞尔，速度连续，不会在半蹲时卡一下
  const c = [2 * m[0] - (a[0] + b[0]) / 2, 2 * m[1] - (a[1] + b[1]) / 2];
  const t = Math.min(1, Math.max(0, s)), u = 1 - t;
  const x = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0];
  const y = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1];
  return [flip ? 200 - x : x, y];
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function catPose(host, s) {
  const svg = host.querySelector('.cat');
  if (!svg) return;
  const t = Math.min(1, Math.max(0, s));
  // 身体抬起的高度；坐下最后那一下轻轻往下一沉
  const lift = Math.max(-0.8, SIT_LIFT * (1 - s));
  const squash = 1 - 0.04 * Math.sin(Math.PI * t);
  svg.querySelector('.poser').style.transform = `translateY(${-lift}px) scale(${1 + (1 - squash) * 0.5}, ${squash})`;
  for (const [side, flip] of [['l', false], ['r', true]]) {
    const leg = svg.querySelector('.leg-' + side);
    const hip = legAt('hip', t, flip), knee = legAt('knee', t, flip), foot = legAt('foot', t, flip);
    knee[1] += lift; foot[1] += lift;
    const f = v => v.toFixed(1);
    // 大腿画在肚皮后面，小腿画在前面：坐下时小腿交叠在肚子前
    svg.querySelector('.thigh-' + side).setAttribute('d', `M${f(hip[0])} ${f(hip[1])} L${f(knee[0])} ${f(knee[1])}`);
    const shin = `M${f(knee[0])} ${f(knee[1])} L${f(foot[0])} ${f(foot[1])}`;
    leg.querySelector('.limb').setAttribute('d', shin);
    leg.querySelector('.limb-ring').setAttribute('d', shin);
    // 小腿上沿的一道折痕，交叠时分得清两条腿
    const dx = foot[0] - knee[0], dy = foot[1] - knee[1], len = Math.hypot(dx, dy) || 1;
    const nx = dy / len * 7.5 * (dx > 0 ? 1 : -1), ny = -Math.abs(dx) / len * 7.5;
    const crease = leg.querySelector('.crease');
    crease.setAttribute('d', `M${f(knee[0] + nx + dx * .25)} ${f(knee[1] + ny + dy * .25)} L${f(foot[0] + nx - dx * .2)} ${f(foot[1] + ny - dy * .2)}`);
    crease.style.opacity = (smooth(0.6, 0.95, t) * 0.45).toFixed(3);
    const rot = (flip ? -18 : 18) * smooth(0.45, 1, t);
    const foo = svg.querySelector('.foot-' + side);
    foo.setAttribute('transform', `translate(${f(foot[0])} ${f(foot[1])}) rotate(${rot.toFixed(1)})`);
    foo.querySelector('.pad').style.opacity = (smooth(0.65, 0.95, t) * 0.75).toFixed(3);
    foo.querySelector('.toe').style.opacity = ((1 - smooth(0.3, 0.7, t)) * 0.5).toFixed(3);
  }
}

/* ---------- 首页小猫：待机小动作和互动 ---------- */

const homeCat = {
  host: null,
  busyUntil: 0,
  lastTouch: Date.now(),
  sleeping: false,
  taps: 0,
  idleTimer: null,
  lookTimer: null,
};

const SLEEP_AFTER_MS = 40000;

// 播放一个动作：加上类名，到时间自动去掉
function catDo(cls, ms) {
  const host = homeCat.host;
  host.classList.remove(cls);
  void host.offsetWidth;
  host.classList.add(cls);
  homeCat.busyUntil = Date.now() + ms;
  setTimeout(() => host.classList.remove(cls), ms);
}

function catLook(x, y) {
  homeCat.host.style.setProperty('--lx', `${x.toFixed(2)}px`);
  homeCat.host.style.setProperty('--ly', `${y.toFixed(2)}px`);
}

function catSleep() {
  homeCat.sleeping = true;
  homeCat.host.classList.remove('awake');
  homeCat.host.classList.add('sleepy');
  catLook(0, 0);
}

function catWake(startled) {
  if (!homeCat.sleeping) return;
  homeCat.sleeping = false;
  homeCat.host.classList.remove('sleepy');
  homeCat.host.classList.add('awake');
  if (startled) {
    catMischief(homeCat.host, 2);
    homeCat.busyUntil = Date.now() + 2400;
    setTimeout(() => homeCat.host.classList.remove(...MISCHIEF_CLASSES), 2400);
  }
}

const IDLE_ACTIONS = [
  [34, () => catDo('blink', 260)],
  [22, () => {
    // 东张西望
    catLook((Math.random() < 0.5 ? -1 : 1) * 3.5, (Math.random() - 0.5) * 3);
    clearTimeout(homeCat.lookTimer);
    homeCat.lookTimer = setTimeout(() => catLook(0, 0), 1600);
    homeCat.busyUntil = Date.now() + 1800;
  }],
  [12, () => catDo('yawn', 2400)],
  [12, () => catDo('wave', 2000)],
  [10, () => catDo('swish', 2200)],
  [10, () => catDo('stretch', 2600)],
];

function idleTick() {
  const home = document.getElementById('home');
  const now = Date.now();
  if (home.classList.contains('active') && !homeCat.sleeping && now >= homeCat.busyUntil) {
    if (now - homeCat.lastTouch > SLEEP_AFTER_MS) {
      catSleep();
    } else {
      const total = IDLE_ACTIONS.reduce((s, a) => s + a[0], 0);
      let r = Math.random() * total;
      for (const [w, act] of IDLE_ACTIONS) {
        if ((r -= w) < 0) { act(); break; }
      }
    }
  }
  homeCat.idleTimer = setTimeout(idleTick, 2500 + Math.random() * 3500);
}

function setupHomeCat() {
  const host = document.getElementById('home-cat');
  const home = document.getElementById('home');
  homeCat.host = host;
  host.classList.add('awake');

  // 眼睛跟着手指走
  const follow = e => {
    homeCat.lastTouch = Date.now();
    if (homeCat.sleeping) return;
    const r = host.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height * 0.4);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 120);
    catLook(dx / d * 4 * k, dy / d * 3.5 * k);
    clearTimeout(homeCat.lookTimer);
    homeCat.lookTimer = setTimeout(() => catLook(0, 0), 2000);
  };
  home.addEventListener('pointerdown', e => {
    if (homeCat.sleeping && !host.contains(e.target)) catWake(false);
    follow(e);
  });
  home.addEventListener('pointermove', follow);

  // 摸摸小猫：冒爱心，连着摸会开心地蹦起来；睡着时会被吓一跳
  host.addEventListener('click', () => {
    homeCat.lastTouch = Date.now();
    if (homeCat.sleeping) { catWake(true); return; }
    homeCat.taps++;
    if (homeCat.taps % 4 === 0) {
      catMischief(host, 2);
      homeCat.busyUntil = Date.now() + 2400;
      setTimeout(() => host.classList.remove(...MISCHIEF_CLASSES), 2400);
    } else {
      catDo('love', 1800);
    }
  });

  idleTick();
}
