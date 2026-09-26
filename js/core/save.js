// Persistent progress (currency, upgrades, settings, records, run checkpoint) with validation.
(function () {
  'use strict';
  const KEY = 'ruinseed.save.v1';
  const UPGRADE_IDS = ['hp', 'blade', 'speed', 'dodgeDist', 'dodgeCd', 'potion', 'magnet'];

  function defaults() {
    return {
      version: 1,
      currency: 0,
      totalEarned: 0,
      upgrades: { hp: 0, blade: 0, speed: 0, dodgeDist: 0, dodgeCd: 0, potion: 0, magnet: 0 },
      settings: { music: true, musicVol: 0.7, sfx: true, sfxVol: 0.8, ambient: true, shake: true, hints: true },
      cheats: { godMode: false },
      best: null, // { time, seed, date }
      stats: { runs: 0, wins: 0, defeats: 0 },
      lastSeed: null,
      attempts: {}, // seed -> attempt count
      run: null // in-progress checkpoint
    };
  }

  const num = (v, d, lo, hi) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);

  function sanitize(raw) {
    const d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    d.currency = Math.floor(num(raw.currency, 0, 0, 999999));
    d.totalEarned = Math.floor(num(raw.totalEarned, 0, 0, 99999999));
    if (raw.upgrades && typeof raw.upgrades === 'object') {
      for (const id of UPGRADE_IDS) {
        const def = RS.Upgrades ? RS.Upgrades.byId[id] : null;
        const max = def ? def.max : 5;
        d.upgrades[id] = Math.floor(num(raw.upgrades[id], 0, 0, max));
      }
    }
    if (raw.settings && typeof raw.settings === 'object') {
      const s = raw.settings;
      d.settings.music = bool(s.music, true);
      d.settings.musicVol = num(s.musicVol, 0.7, 0, 1);
      d.settings.sfx = bool(s.sfx, true);
      d.settings.sfxVol = num(s.sfxVol, 0.8, 0, 1);
      d.settings.ambient = bool(s.ambient, true);
      d.settings.shake = bool(s.shake, true);
      d.settings.hints = bool(s.hints, true);
    }
    if (raw.cheats && typeof raw.cheats === 'object') d.cheats.godMode = bool(raw.cheats.godMode, false);
    if (raw.best && typeof raw.best === 'object' && typeof raw.best.time === 'number' && isFinite(raw.best.time)) {
      d.best = { time: Math.max(0, raw.best.time), seed: String(raw.best.seed || '').slice(0, 12), date: String(raw.best.date || '').slice(0, 20) };
    }
    if (raw.stats && typeof raw.stats === 'object') {
      d.stats.runs = Math.floor(num(raw.stats.runs, 0, 0, 1e7));
      d.stats.wins = Math.floor(num(raw.stats.wins, 0, 0, 1e7));
      d.stats.defeats = Math.floor(num(raw.stats.defeats, 0, 0, 1e7));
    }
    if (typeof raw.lastSeed === 'number' && isFinite(raw.lastSeed)) d.lastSeed = Math.floor(Math.abs(raw.lastSeed)) % 1000000;
    if (raw.attempts && typeof raw.attempts === 'object') {
      let n = 0;
      for (const k of Object.keys(raw.attempts)) {
        if (n++ > 50) break;
        const v = raw.attempts[k];
        if (/^\d{1,6}$/.test(k) && typeof v === 'number' && isFinite(v)) d.attempts[k] = Math.floor(Math.min(9999, Math.max(0, v)));
      }
    }
    if (raw.run && typeof raw.run === 'object' && typeof raw.run.seed === 'number' && typeof raw.run.attempt === 'number') {
      const r = raw.run;
      const sig = Array.isArray(r.sigils) ? r.sigils.filter((x) => x === 0 || x === 1 || x === 2).slice(0, 3) : [];
      d.run = {
        seed: Math.floor(Math.abs(r.seed)) % 1000000,
        attempt: Math.floor(num(r.attempt, 1, 1, 9999)),
        sigils: Array.from(new Set(sig)),
        time: num(r.time, 0, 0, 360000),
        earned: Math.floor(num(r.earned, 0, 0, 999999)),
        hp: num(r.hp, 6, 1, 40),
        potions: Math.floor(num(r.potions, 0, 0, 9)),
        checkpoint: typeof r.checkpoint === 'string' ? r.checkpoint.slice(0, 16) : 'camp',
        opened: Array.isArray(r.opened) ? r.opened.filter((x) => typeof x === 'string').slice(0, 200).map((x) => x.slice(0, 24)) : [],
        explored: typeof r.explored === 'string' ? r.explored.slice(0, 20000) : ''
      };
    }
    return d;
  }

  let data = defaults();
  let available = true;
  let lastError = null;
  let dirty = false;
  let timer = null;

  function load() {
    try {
      const s = window.localStorage.getItem(KEY);
      if (s) {
        let raw = null;
        try { raw = JSON.parse(s); } catch (e) { lastError = 'corrupt'; raw = null; }
        data = sanitize(raw);
        if (lastError === 'corrupt') {
          // keep a backup of the unreadable data for safety, then overwrite with clean defaults
          try { window.localStorage.setItem(KEY + '.corrupt', s.slice(0, 50000)); } catch (e) { /* ignore */ }
          try { window.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
        }
      } else data = defaults();
    } catch (e) {
      available = false;
      lastError = 'unavailable';
      data = defaults();
    }
    return data;
  }

  function saveNow() {
    dirty = false;
    if (!available) return false;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      lastError = 'write';
      return false;
    }
  }
  function save() {
    dirty = true;
    if (timer) return;
    timer = setTimeout(() => { timer = null; if (dirty) saveNow(); }, 400);
  }
  function reset() {
    const keepSettings = data.settings;
    data = defaults();
    data.settings = keepSettings;
    saveNow();
  }

  window.addEventListener('beforeunload', () => { if (dirty) saveNow(); });

  RS.Save = {
    load, save, saveNow, reset, sanitize, defaults,
    get data() { return data; },
    get available() { return available; },
    get lastError() { return lastError; },
    clearError() { lastError = null; },
    UPGRADE_IDS
  };
})();
