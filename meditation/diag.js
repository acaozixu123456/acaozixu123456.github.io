'use strict';

/* ---------- 运行日志：记下出错、显卡被收回、页面意外重启前的状态，方便以后排查 ---------- */
// 全部只存在这台手机的 localStorage 里；设置页可以一键复制出来

const Diag = (() => {
  const KEY = 'meditation.diag.v1';
  const BEAT_KEY = 'meditation.diag.beat';
  const MAX = 200;
  const born = Date.now();
  let entries = [];
  try { entries = JSON.parse(localStorage.getItem(KEY)) || []; } catch {}
  let state = () => ({});

  function save() {
    if (entries.length > MAX) entries = entries.slice(-MAX);
    try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch {}
  }

  function note(kind, msg) {
    entries.push({ t: Date.now(), k: kind, m: String(msg || '').slice(0, 600) });
    save();
  }

  function snapshot() {
    let s = {};
    try { s = state() || {}; } catch {}
    return { ...s, up: Math.round((Date.now() - born) / 1000) };
  }

  // 每 5 秒记一次“还活着”和当时的状态；正常离开时标记 clean
  function beat(clean) {
    try { localStorage.setItem(BEAT_KEY, JSON.stringify({ t: Date.now(), clean: !!clean, s: snapshot() })); } catch {}
  }

  // 上次打开时没有正常离开（没收到 pagehide），多半是被系统强制重启了
  try {
    const last = JSON.parse(localStorage.getItem(BEAT_KEY));
    if (last && !last.clean) {
      const ago = Math.round((Date.now() - last.t) / 1000);
      note('restart', `上次没有正常关闭，最后一次记录在 ${ago} 秒前：${JSON.stringify(last.s)}`);
    }
  } catch {}
  note('open', `打开 app（${innerWidth}×${innerHeight} @${devicePixelRatio}x）`);

  addEventListener('error', e => note('error', `${e.message} @${(e.filename || '').split('/').pop()}:${e.lineno}:${e.colno}`));
  addEventListener('unhandledrejection', e => note('error', `未处理的 Promise：${e.reason && (e.reason.stack || e.reason.message) || e.reason}`));
  addEventListener('pagehide', () => beat(true));
  document.addEventListener('visibilitychange', () => beat(document.visibilityState === 'hidden'));
  setInterval(() => { if (document.visibilityState === 'visible') beat(false); }, 5000);
  beat(false);

  async function text() {
    let ver = '';
    try { ver = (await caches.keys()).filter(k => k.startsWith('meditation-')).join(','); } catch {}
    const fmt = t => new Date(t).toLocaleString('zh-CN', { hour12: false });
    const head = `冥想 app 运行日志\n版本 ${ver || '未知'}\n${navigator.userAgent}\n现在：${JSON.stringify(snapshot())}\n`;
    return head + entries.map(e => `${fmt(e.t)} [${e.k}] ${e.m}`).join('\n');
  }

  return {
    note,
    text,
    clear() { entries = []; save(); },
    get count() { return entries.length; },
    // app.js 提供当前状态（在哪一页、练习进度、显卡画质等）
    set state(fn) { state = fn; },
  };
})();
