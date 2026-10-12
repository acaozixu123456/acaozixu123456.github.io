'use strict';

/*
 * 练习效果估算
 *
 * 不是测量，是按研究文献的群体平均趋势估算：
 * 1. 把每次练习的分钟数按类型加权（静坐 / 呼吸对各项指标的贡献不同），
 *    再按时间衰减（半衰期 6 周，停练后效果会慢慢回落），得到“有效练习分钟”。
 * 2. 效应量随有效分钟饱和增长：g = gMax × (1 − e^(−分钟 / 500))。
 *    约 730 分钟（每天 13 分钟 × 8 周，Basso 2019 出现显著效果的剂量）时达到 gMax 的 77%。
 * 3. 把效应量换算成百分位变化：一个处在中位（第 50 百分位）的人，
 *    效应量 g 会把他推到第 Φ(g) × 100 百分位。显示的数字就是推进了多少个百分位。
 */

const EFFECT_TAU_MIN = 500;
const EFFECT_HALF_LIFE_DAYS = 42;

const EFFECTS = [
  {
    key: 'attention', name: '注意力', dir: 1, gMax: 0.3, w: { timer: 1, breath: 0.5 },
    desc: '持续注意、工作记忆',
    basis: '正念训练对注意和执行功能有小到中等的改善（Zainal & Newman 2023，111 项随机对照试验）；每天 13 分钟、8 周后注意力和工作记忆明显提高，4 周时还不明显（Basso 等 2019）。',
  },
  {
    key: 'cortisol', name: '皮质醇', dir: -1, gMax: 0.25, w: { timer: 1, breath: 1 },
    desc: '压力激素',
    basis: '冥想能降低皮质醇，压力大的人群下降中等，健康人群效果较小（Koncz 等，34 项随机对照试验）。这里按健康人群的小效应估算。',
  },
  {
    key: 'anxiety', name: '焦虑', dir: -1, gMax: 0.32, w: { timer: 0.8, breath: 1 },
    desc: '紧张、焦虑感',
    basis: '呼吸练习降低焦虑 g = 0.32、压力 g = 0.35（Fincham 等 2023，Scientific Reports）。',
  },
  {
    key: 'hrv', name: '心率变异性', dir: 1, gMax: 0.3, w: { timer: 0.3, breath: 1 },
    desc: '放松神经（副交感）活跃度',
    basis: '慢呼吸时心率变异性（RMSSD）大幅上升，研究中约从 47 ms 升到 91 ms（Laborde 等 2022）；多次练习后静息水平也会提高（Laborde 等 2022，Neuroscience & Biobehavioral Reviews 元分析）。',
  },
];

// 标准正态分布函数（Abramowitz–Stegun 近似）
function normalCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

function effectiveMinutes(entries, effect, now) {
  let total = 0;
  for (const e of entries) {
    const ageDays = Math.max(0, (now - new Date(e.start)) / 86400000);
    total += (e.sec / 60) * (effect.w[e.mode === 'breath' ? 'breath' : 'timer']) * 0.5 ** (ageDays / EFFECT_HALF_LIFE_DAYS);
  }
  return total;
}

// 返回每项指标：推进的百分位（带方向）和达到研究水平的比例
function estimateEffects(entries, now = Date.now()) {
  return EFFECTS.map(effect => {
    const minutes = effectiveMinutes(entries, effect, now);
    const g = effect.gMax * (1 - Math.exp(-minutes / EFFECT_TAU_MIN));
    const points = (normalCdf(g) - 0.5) * 100;
    return { ...effect, minutes, g, points: points * effect.dir, progress: g / effect.gMax };
  });
}

function formatPoints(v, digits = 1) {
  const s = Math.abs(v).toFixed(digits);
  if (Number(s) === 0) return '0';
  return (v > 0 ? '+' : '−') + s;
}
