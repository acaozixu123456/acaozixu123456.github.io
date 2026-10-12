'use strict';

// 小猫主角：一张 SVG，动作全靠 CSS 类切换（见 style.css 的“小猫”部分）
const HEART = 'M0 3 C0 -1 6 -1 6 3 C6 -1 12 -1 12 3 C12 7 6 10 6 12 C6 10 0 7 0 3 Z';

const CAT_SVG = `
<svg class="cat" viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg">
  <ellipse class="shadow" cx="100" cy="197" rx="54" ry="6"/>
  <g class="hopper">
    <g class="tail">
      <path d="M136 182 C 180 188, 196 144, 168 120"/>
      <path class="tail-tip" d="M171 124 C 175 128, 177 132, 178 136"/>
    </g>
    <g class="body-g">
      <path class="fur" d="M100 104 C 58 104, 45 148, 50 175 C 53 195, 147 195, 150 175 C 155 148, 142 104, 100 104 Z"/>
      <ellipse class="belly" cx="100" cy="161" rx="28" ry="25"/>
      <g class="paw paw-l"><ellipse class="light" cx="82" cy="189" rx="14" ry="9"/><path class="toe" d="M77 192 v-4 M87 192 v-4"/></g>
      <g class="paw paw-r"><ellipse class="light" cx="118" cy="189" rx="14" ry="9"/><path class="toe" d="M113 192 v-4 M123 192 v-4"/></g>
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
