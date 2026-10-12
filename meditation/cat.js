'use strict';

// 小猫主角：一张 SVG，动作全靠 CSS 类切换（见 style.css 的“小猫”部分）
const CAT_SVG = `
<svg class="cat" viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg">
  <ellipse class="shadow" cx="100" cy="196" rx="56" ry="6"/>
  <g class="hopper">
    <g class="tail">
      <path d="M138 178 C 182 184, 196 140, 170 116"/>
    </g>
    <g class="body-g">
      <path class="fur" d="M100 98 C 62 98, 44 142, 48 172 C 50 192, 150 192, 152 172 C 156 142, 138 98, 100 98 Z"/>
      <ellipse class="belly" cx="100" cy="156" rx="27" ry="28"/>
      <g class="paw paw-l"><ellipse class="light" cx="84" cy="186" rx="13" ry="8"/><path class="toe" d="M80 189 v-4 M88 189 v-4"/></g>
      <g class="paw paw-r"><ellipse class="light" cx="116" cy="186" rx="13" ry="8"/><path class="toe" d="M112 189 v-4 M120 189 v-4"/></g>
    </g>
    <g class="head">
      <g class="ear ear-l"><path class="fur" d="M58 64 L56 22 L92 44 Z"/><path class="inner" d="M63 56 L62 32 L83 46 Z"/></g>
      <g class="ear ear-r"><path class="fur" d="M142 64 L144 22 L108 44 Z"/><path class="inner" d="M137 56 L138 32 L117 46 Z"/></g>
      <ellipse class="fur" cx="100" cy="76" rx="50" ry="42"/>
      <path class="stripe" d="M100 36 v12 M88 38 l2 10 M112 38 l-2 10"/>
      <ellipse class="blush" cx="68" cy="90" rx="8" ry="4.5"/>
      <ellipse class="blush" cx="132" cy="90" rx="8" ry="4.5"/>
      <g class="eyes eyes-closed"><path d="M72 79 Q80 86 88 79"/><path d="M112 79 Q120 86 128 79"/></g>
      <g class="eyes eyes-happy"><path d="M72 82 Q80 72 88 82"/><path d="M112 82 Q120 72 128 82"/></g>
      <g class="eyes-open">
        <circle class="pupil" cx="80" cy="78" r="8"/><circle class="pupil" cx="120" cy="78" r="8"/>
        <circle class="shine" cx="83" cy="75" r="2.6"/><circle class="shine" cx="123" cy="75" r="2.6"/>
      </g>
      <path class="nose" d="M96 88 h8 l-4 4.5 z"/>
      <path class="mouth" d="M92 95 Q96 99 100 95 Q104 99 108 95"/>
      <path class="whisker" d="M52 88 L30 84 M52 94 L31 97 M148 88 L170 84 M148 94 L169 97"/>
    </g>
  </g>
  <g class="yarn">
    <path class="thread" d="M-2 194 C 14 200, 28 186, 40 192"/>
    <g class="ball"><circle cx="40" cy="182" r="13"/><path d="M30 176 Q40 186 50 176 M29 186 Q40 176 51 188 M36 170 Q46 182 38 195"/></g>
  </g>
  <g class="bubble">
    <circle cx="164" cy="34" r="17"/>
    <text x="164" y="41" text-anchor="middle"></text>
  </g>
</svg>`;

function mountCats() {
  for (const host of document.querySelectorAll('.cat-host')) host.innerHTML = CAT_SVG;
}
