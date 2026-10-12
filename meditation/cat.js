'use strict';

// 小猫主角：一张 SVG，动作全靠 CSS 类切换（见 style.css 的“小猫”部分）
const HEART = 'M0 3 C0 -1 6 -1 6 3 C6 -1 12 -1 12 3 C12 7 6 10 6 12 C6 10 0 7 0 3 Z';

const CAT_SVG = `
<svg class="cat" viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg">
  <ellipse class="shadow" cx="100" cy="197" rx="54" ry="6"/>
  <g class="acc acc-cushion">
    <ellipse class="cushion-base" cx="100" cy="196" rx="76" ry="14"/>
    <ellipse class="cushion-top" cx="100" cy="191" rx="70" ry="10"/>
    <circle class="cushion-tuft" cx="100" cy="191" r="2.4"/>
  </g>
  <g class="sparkles">
    <path class="s1" d="M30 60 l3 -9 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 z"/>
    <path class="s2" d="M170 96 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 z"/>
    <path class="s3" d="M24 132 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 z"/>
  </g>
  <g class="hopper">
    <g class="poser">
    <g class="tail">
      <path d="M136 182 C 180 188, 196 144, 168 120"/>
      <path class="tail-tip" d="M171 124 C 175 128, 177 132, 178 136"/>
    </g>
    <g class="body-g">
      <path class="fur" d="M100 104 C 58 104, 45 148, 50 175 C 53 195, 147 195, 150 175 C 155 148, 142 104, 100 104 Z"/>
      <g class="thighs"><path class="limb thigh-r"/><path class="limb thigh-l"/></g>
      <ellipse class="belly" cx="100" cy="161" rx="28" ry="25"/>
      <g class="legs">
        <g class="leg leg-r"><path class="limb"/><path class="crease"/></g>
        <g class="leg leg-l"><path class="limb"/><path class="crease"/></g>
        <g class="foot foot-r"><ellipse class="light" rx="10.5" ry="6.5"/><ellipse class="pad" cx="-1" cy=".5" rx="3.6" ry="2.6"/><path class="toe" d="M-4 4 v-3.5 M4 4 v-3.5"/></g>
        <g class="foot foot-l"><ellipse class="light" rx="10.5" ry="6.5"/><ellipse class="pad" cx="1" cy=".5" rx="3.6" ry="2.6"/><path class="toe" d="M-4 4 v-3.5 M4 4 v-3.5"/></g>
      </g>
      <g class="pawpos-l"><g class="paw paw-l"><ellipse class="light" cx="82" cy="189" rx="14" ry="9"/><path class="toe" d="M77 192 v-4 M87 192 v-4"/></g></g>
      <g class="pawpos-r"><g class="paw paw-r"><ellipse class="light" cx="118" cy="189" rx="14" ry="9"/><path class="toe" d="M113 192 v-4 M123 192 v-4"/></g></g>
    </g>
    <g class="head">
      <g class="ear ear-l"><path class="fur" d="M52 66 Q46 24 58 17 Q72 18 94 42 Z"/><path class="inner" d="M59 56 Q56 32 62 27 Q72 30 84 43 Z"/></g>
      <g class="ear ear-r"><path class="fur" d="M148 66 Q154 24 142 17 Q128 18 106 42 Z"/><path class="inner" d="M141 56 Q144 32 138 27 Q128 30 116 43 Z"/></g>
      <ellipse class="fur" cx="100" cy="78" rx="57" ry="46"/>
      <path class="stripe" d="M100 34 v11 M87 36 l2.5 9 M113 36 l-2.5 9"/>
      <ellipse class="blush" cx="65" cy="96" rx="9" ry="5"/>
      <ellipse class="blush" cx="135" cy="96" rx="9" ry="5"/>
      <g class="eyes eyes-closed"><path d="M71 83 Q80 91 89 83"/><path d="M111 83 Q120 91 129 83"/></g>
      <g class="eyes eyes-happy"><path d="M71 86 Q80 75 89 86"/><path d="M111 86 Q120 75 129 86"/></g>
      <g class="eyes-open">
        <g class="look">
          <circle class="pupil" cx="80" cy="82" r="10.5"/><circle class="pupil" cx="120" cy="82" r="10.5"/>
          <circle class="shine" cx="84" cy="77.5" r="3.6"/><circle class="shine" cx="124" cy="77.5" r="3.6"/>
          <circle class="shine" cx="76.5" cy="87" r="1.6"/><circle class="shine" cx="116.5" cy="87" r="1.6"/>
        </g>
      </g>
      <path class="nose" d="M96.5 94 h7 l-3.5 4 z"/>
      <path class="mouth" d="M92 101 Q96 105 100 101 Q104 105 108 101"/>
      <g class="mouth-open"><ellipse cx="100" cy="106" rx="7" ry="8"/><ellipse class="tongue" cx="100" cy="110.5" rx="4.5" ry="3"/></g>
      <path class="whisker" d="M46 92 L24 88 M46 99 L25 102 M154 92 L176 88 M154 99 L175 102"/>
      <path class="collar" d="M66 117 Q100 134 134 117"/>
      <g class="bell"><circle cx="100" cy="129" r="6"/><path d="M95 129 h10 M100 131 v3"/></g>
      <g class="acc acc-scarf">
        <path class="scarf-tail" d="M114 122 l6 30 l12 -3 l-4 -30 z"/>
        <path class="scarf" d="M62 114 Q100 138 138 114"/>
        <path class="scarf-knit" d="M74 120 l2 6 M88 124 l1 6 M102 126 l0 6 M116 124 l-1 6 M128 119 l-2 6"/>
      </g>
      <g class="acc acc-glasses">
        <circle cx="80" cy="83" r="14"/><circle cx="120" cy="83" r="14"/>
        <path d="M94 82 Q100 78 106 82 M66 80 L50 76 M134 80 L150 76"/>
      </g>
      <g class="acc acc-beanie">
        <path class="beanie" d="M64 50 C 64 14, 136 14, 136 50 Z"/>
        <path class="beanie-rib" d="M80 26 v22 M92 21 v27 M108 21 v27 M120 26 v22"/>
        <rect class="beanie-band" x="60" y="44" width="80" height="11" rx="5.5"/>
        <circle class="beanie-pom" cx="100" cy="15" r="8"/>
      </g>
      <g class="acc acc-bow">
        <path class="bow" d="M132 34 l-14 -10 l2 18 z M132 34 l14 -10 l-2 18 z"/>
        <circle class="bow-knot" cx="132" cy="34" r="4"/>
      </g>
    </g>
    </g>
  </g>
  <g class="yarn">
    <path class="thread" d="M-2 196 C 14 202, 28 188, 40 194"/>
    <g class="ball"><circle cx="40" cy="182" r="13"/><path d="M30 176 Q40 186 50 176 M29 186 Q40 176 51 188 M36 170 Q46 182 38 195"/></g>
  </g>
  <g class="hearts">
    <path class="h1" transform="translate(146 46)" d="${HEART}"/>
    <path class="h2" transform="translate(162 66) scale(.8)" d="${HEART}"/>
    <path class="h3" transform="translate(40 52) scale(.9)" d="${HEART}"/>
  </g>
  <g class="zzz">
    <text class="z1" x="148" y="44">z</text>
    <text class="z2" x="160" y="30">z</text>
    <text class="z3" x="172" y="16">Z</text>
  </g>
  <g class="bubble">
    <circle cx="164" cy="34" r="17"/>
    <text x="164" y="41" text-anchor="middle"></text>
  </g>
</svg>`;

function mountCats() {
  for (const host of document.querySelectorAll('.cat-host')) host.innerHTML = CAT_SVG;
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
    leg.querySelector('.limb').setAttribute('d', `M${f(knee[0])} ${f(knee[1])} L${f(foot[0])} ${f(foot[1])}`);
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
