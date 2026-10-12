'use strict';

/* ---------- 每个地点自己的环境音（全部现场合成，不用音频文件） ---------- */
// 用到 app.js 里的 ctx、loopSource、filter、lfo，只在播放时才调用

function tone(out, parts, type, freq, gain, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  const g = ctx.createGain();
  g.gain.value = gain;
  o.connect(g).connect(out);
  o.start();
  parts.push(o);
  return g;
}

// 每隔一阵随机触发一次 fn，停止时取消
function every(parts, minMs, maxMs, fn) {
  let id = null;
  const go = () => { fn(ctx.currentTime + 0.05); id = setTimeout(go, minMs + Math.random() * (maxMs - minMs)); };
  id = setTimeout(go, minMs * 0.5);
  parts.push({ stop() { clearTimeout(id); } });
}

function noiseBurst(out, t, { freq, q = 1, gain, attack = 0.01, decay }) {
  const src = loopSource('pink');
  const bp = filter('bandpass', freq, q);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0005, t + attack + decay);
  src.connect(bp).connect(g).connect(out);
  src.stop(t + attack + decay + 0.1);
}

const AMBIENCE = {
  // 月面：真空里几乎没有声音，只剩身体里低低的嗡鸣
  hum(out, parts) {
    const g1 = tone(out, parts, 'sine', 55, 0.22);
    const g2 = tone(out, parts, 'sine', 82.4, 0.08, 4);
    parts.push(lfo(g1.gain, 0.05, 0.22, 0.08), lfo(g2.gain, 0.037, 0.08, 0.05));
    // 手机外放出不来太低的音，加两层泛音让喇叭也听得到
    const g3 = tone(out, parts, 'sine', 220, 0.025, 3);
    const g4 = tone(out, parts, 'sine', 329.6, 0.012, -4);
    parts.push(lfo(g3.gain, 0.043, 0.025, 0.015), lfo(g4.gain, 0.029, 0.012, 0.008));
    const air = loopSource('pink');
    const lp = filter('lowpass', 260);
    const ag = ctx.createGain();
    air.connect(lp).connect(ag).connect(out);
    parts.push(air, lfo(ag.gain, 0.03, 0.05, 0.03));
  },
  // 火星：稀薄的风一阵阵吹过沙丘，带着沙粒的沙沙声
  wind(out, parts) {
    const w = loopSource('brown');
    const bp = filter('bandpass', 420, 0.8);
    const g = ctx.createGain();
    w.connect(bp).connect(g).connect(out);
    parts.push(w, lfo(g.gain, 0.045, 0.6, 0.35), lfo(bp.frequency, 0.07, 430, 200));
    const sand = loopSource('pink');
    const hp = filter('highpass', 2600);
    const sg = ctx.createGain();
    sand.connect(hp).connect(sg).connect(out);
    parts.push(sand, lfo(sg.gain, 0.045, 0.05, 0.04));
  },
  // TRAPPIST-1 冰原：低低的风，冰层偶尔咔地响一声
  ice(out, parts) {
    const w = loopSource('brown');
    const lp = filter('lowpass', 300);
    const g = ctx.createGain();
    w.connect(lp).connect(g).connect(out);
    parts.push(w, lfo(g.gain, 0.04, 0.45, 0.2));
    every(parts, 5000, 14000, t => {
      noiseBurst(out, t, { freq: 1200 + Math.random() * 1800, q: 3, gain: 0.12, decay: 0.25 });
      noiseBurst(out, t + 0.04, { freq: 300 + Math.random() * 200, q: 2, gain: 0.08, decay: 0.6 });
    });
  },
  // 土星：像卡西尼号录到的射电，一声声下滑的口哨和沙沙的静电
  radio(out, parts) {
    const st = loopSource('pink');
    const bp = filter('bandpass', 1400, 1.5);
    const sg = ctx.createGain();
    st.connect(bp).connect(sg).connect(out);
    parts.push(st, lfo(sg.gain, 0.06, 0.07, 0.05), lfo(bp.frequency, 0.02, 1400, 500));
    const whistle = (t, from, to, dur, gain) => {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(from, t);
      o.frequency.exponentialRampToValueAtTime(to, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + dur * 0.2);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 0.05);
    };
    every(parts, 2500, 7000, t => {
      whistle(t, 2400 + Math.random() * 1200, 300 + Math.random() * 200, 1.4 + Math.random() * 1.6, 0.035);
      if (Math.random() < 0.5) for (let i = 0; i < 4; i++) whistle(t + 0.8 + i * 0.22, 700, 1500 + Math.random() * 500, 0.18, 0.02);
    });
  },
  // 蟹状星云：中心脉冲星一下一下轻轻跳动
  pulsar(out, parts) {
    AMBIENCE.pad(out, parts, [110, 164.8, 220]);
    every(parts, 1100, 1100, t => {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.25);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.35);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.4);
      noiseBurst(out, t, { freq: 1800, q: 2, gain: 0.05, attack: 0.003, decay: 0.06 });
    });
  },
  // 黑洞：极低的轰鸣，缓慢地一涨一落
  deep(out, parts) {
    const g1 = tone(out, parts, 'sine', 36.7, 0.3);
    const g2 = tone(out, parts, 'sine', 55, 0.12, -6);
    parts.push(lfo(g1.gain, 0.08, 0.3, 0.15), lfo(g2.gain, 0.05, 0.12, 0.08));
    const g3 = tone(out, parts, 'triangle', 146.8, 0.03);
    parts.push(lfo(g3.gain, 0.08, 0.03, 0.02));
    const n = loopSource('brown');
    const lp = filter('lowpass', 140);
    const ng = ctx.createGain();
    ng.gain.value = 0.3;
    n.connect(lp).connect(ng).connect(out);
    parts.push(n);
  },
  // 星云和星系：几个音慢慢起伏，像远处的合唱
  pad(out, parts, notes = [220, 277.2, 329.6, 440]) {
    const lp = filter('lowpass', 1400);
    const g = ctx.createGain();
    g.gain.value = 0.5;
    lp.connect(g).connect(out);
    notes.forEach((f, i) => {
      const a = tone(lp, parts, 'triangle', f, 0.05, -5);
      const b = tone(lp, parts, 'sine', f * 1.002, 0.05, 5);
      parts.push(lfo(a.gain, 0.03 + i * 0.011, 0.05, 0.04), lfo(b.gain, 0.025 + i * 0.013, 0.05, 0.04));
    });
  },
};

const PLACE_SOUND = {
  moon: ['hum'], mars: ['wind'], saturn: ['radio'], trappist: ['ice'], crab: ['pulsar'], blackhole: ['deep'],
  orion: ['pad', [196, 246.9, 293.7, 392]], pleiades: ['pad', [293.7, 370, 440, 587.3]], pillars: ['pad', [146.8, 220, 261.6, 329.6]],
  andromeda: ['pad', [174.6, 220, 261.6, 349.2]], deepfield: ['pad', [261.6, 329.6, 392, 523.3]], cmb: ['pad', [130.8, 196, 261.6, 392]],
};

function placeAmbience(out, parts) {
  const [name, notes] = PLACE_SOUND[travel.here] || PLACE_SOUND.moon;
  AMBIENCE[name](out, parts, notes);
}
