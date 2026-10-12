'use strict';

/* ---------- 小猫成长：小鱼干、衣柜、心情 ---------- */

const WARDROBE_KEY = 'meditation.wardrobe.v1';
const FISH_FOCUS_BONUS = 5;

// slot 相同的东西只能戴一个
const ITEMS = [
  { id: 'cushion', name: '坐垫', price: 30, slot: 'cushion' },
  { id: 'bow', name: '蝴蝶结', price: 40, slot: 'ear' },
  { id: 'scarf', name: '围巾', price: 60, slot: 'neck' },
  { id: 'glasses', name: '圆眼镜', price: 80, slot: 'face' },
  { id: 'beanie', name: '毛线帽', price: 100, slot: 'head' },
  { id: 'coat-cream', name: '奶白毛色', price: 120, slot: 'coat' },
  { id: 'coat-grey', name: '银灰毛色', price: 150, slot: 'coat' },
  { id: 'coat-black', name: '黑猫', price: 200, slot: 'coat' },
];

let wardrobe = { owned: [], worn: [], ...loadWardrobe() };

function loadWardrobe() {
  try {
    return JSON.parse(localStorage.getItem(WARDROBE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveWardrobe() {
  try { localStorage.setItem(WARDROBE_KEY, JSON.stringify(wardrobe)); } catch {}
}

// 小鱼干从记录里算出来：每练 1 分钟 1 条，全程没分心再奖励 5 条
function fishForEntry(e) {
  return Math.floor(e.sec / 60) + (e.distractions === 0 ? FISH_FOCUS_BONUS : 0);
}

function fishEarned(entries) {
  return entries.reduce((sum, e) => sum + fishForEntry(e), 0);
}

function fishSpent() {
  return wardrobe.owned.reduce((sum, id) => sum + (ITEMS.find(i => i.id === id)?.price || 0), 0);
}

function fishBalance(entries) {
  return Math.max(0, fishEarned(entries) - fishSpent());
}

// 把戴着的东西套到页面上每一只小猫身上
function applyWardrobe() {
  for (const host of document.querySelectorAll('.cat-host')) {
    for (const item of ITEMS) host.classList.toggle(`wear-${item.id}`, wardrobe.worn.includes(item.id));
  }
}

function toggleWear(id) {
  const item = ITEMS.find(i => i.id === id);
  if (wardrobe.worn.includes(id)) {
    wardrobe.worn = wardrobe.worn.filter(w => w !== id);
  } else {
    wardrobe.worn = wardrobe.worn.filter(w => ITEMS.find(i => i.id === w)?.slot !== item.slot);
    wardrobe.worn.push(id);
  }
  saveWardrobe();
  applyWardrobe();
}

function buyItem(id, entries) {
  const item = ITEMS.find(i => i.id === id);
  if (!item || wardrobe.owned.includes(id) || fishBalance(entries) < item.price) return false;
  wardrobe.owned.push(id);
  saveWardrobe();
  toggleWear(id);
  return true;
}

// 心情：连续打卡 3 天以上很精神；两天以上没练就趴着等你
function catMood(entries, now = new Date()) {
  if (!entries.length) return '';
  const last = new Date(entries[entries.length - 1].start);
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
    new Date(last.getFullYear(), last.getMonth(), last.getDate())) / 86400000);
  if (days >= 2) return 'lonely';
  if (computeStreak(entries, now) >= 3) return 'lively';
  return '';
}
