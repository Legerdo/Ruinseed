// Original synthesized audio: WebAudio instruments, look-ahead sequencer with composed tracks,
// ambient beds, and procedural SFX. Music / SFX / ambience use independent gain buses.
(function () {
  'use strict';
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(n) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
    if (!m) return null;
    let v = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return v + (+m[3] + 1) * 12;
  }
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // pattern string -> events. tokens: note | '.' rest | '-' hold ; step = 1/stepsPerToken of a bar-step
  function parse(str, stepLen) {
    const out = [];
    const toks = str.trim().split(/\s+/);
    let t = 0, last = null;
    for (const tk of toks) {
      if (tk === '-') { if (last) last.len += stepLen; }
      else if (tk === '.') last = null;
      else {
        const notes = tk.split('+').map(midi).filter((x) => x !== null);
        last = { t, notes, len: stepLen };
        out.push(last);
      }
      t += stepLen;
    }
    return { events: out, length: t };
  }

  // ---- composition ----------------------------------------------------------------------------
  // step unit = one 16th note
  const TRACKS = {
    title: {
      bpm: 72, bars: 8,
      parts: [
        { inst: 'pad', vol: 0.16, pat: 'D3+F3+A3+C4 - - - - - - - Bb2+D3+F3+A3 - - - - - - - F3+A3+C4+G4 - - - - - - - C3+E3+G3+D4 - - - - - - - D3+F3+A3+E4 - - - - - - - Bb2+D3+F3+C4 - - - - - - - G2+Bb2+D3+F3 - - - - - - - A2+C#3+E3+A3 - - - - - - -', step: 2 },
        { inst: 'pluck', vol: 0.12, pat: 'D4 A4 F4 A4 C5 A4 F4 A4 Bb3 F4 D4 F4 A4 F4 D4 F4 F4 C5 A4 C5 G4 C5 A4 C5 C4 G4 E4 G4 D5 G4 E4 G4 D4 A4 F4 A4 E5 A4 F4 A4 Bb3 F4 D4 F4 C5 F4 D4 F4 G3 D4 Bb3 D4 F4 D4 Bb3 D4 A3 E4 C#4 E4 A4 E4 C#4 E4', step: 2 },
        { inst: 'bell', vol: 0.1, pat: '. . . . A4 - - - . . E5 - D5 - - - . . . . F5 - E5 - C5 - - - . . . . . . . . G4 - A4 - C5 - - - . . . . A4 - - - . . D5 - E5 - F5 - E5 - D5 - - - . . . . C#5 - - - - - - - . . . .', step: 2 }
      ]
    },
    overworld: {
      bpm: 104, bars: 8,
      parts: [
        { inst: 'bass', vol: 0.2, pat: 'D2 . D3 . A2 . D3 . Bb1 . Bb2 . F2 . Bb2 . F2 . F3 . C3 . F3 . C2 . C3 . G2 . C3 . D2 . D3 . A2 . D3 . Bb1 . Bb2 . F2 . Bb2 . F2 . F3 . C3 . F3 . C2 . C3 . A2 . C#3 .', step: 2 },
        { inst: 'pluck', vol: 0.085, pat: 'D4 F4 A4 F4 D5 A4 F4 A4 D4 F4 Bb4 F4 D5 Bb4 F4 Bb4 C4 F4 A4 F4 C5 A4 F4 A4 C4 E4 G4 E4 C5 G4 E4 G4 D4 F4 A4 F4 D5 A4 F4 A4 D4 F4 Bb4 F4 D5 Bb4 F4 Bb4 C4 F4 A4 F4 C5 A4 F4 A4 C#4 E4 A4 E4 C#5 A4 E4 A4', step: 2 },
        { inst: 'lead', vol: 0.085, pat: 'A4 - D5 - E5 - F5 E5 D5 - - - C5 - D5 - C5 - A4 - F4 - G4 A4 G4 - - - - - - - A4 - D5 - E5 - F5 G5 A5 - G5 - F5 - D5 - C5 - F5 - E5 - C5 - D5 - - - - - - -', step: 2 },
        { inst: 'kick', vol: 0.22, pat: 'x . . . . . . . x . . . . . . . x . . . . . . . x . . . . . . . x . . . . . . . x . . . . . . . x . . . . . . . x . . . x . . .', step: 2, drum: true },
        { inst: 'hat', vol: 0.05, pat: '. . x . . . x . . . x . . . x . . . x . . . x . . . x . . . x . . . x . . . x . . . x . . . x . . . x . . . x . . . x . . . x .', step: 2, drum: true }
      ]
    },
    overworld2: {
      bpm: 112, bars: 4,
      parts: [
        { inst: 'bass', vol: 0.22, pat: 'D2 D2 D3 D2 A2 D2 D3 D2 Bb1 Bb1 Bb2 Bb1 F2 Bb1 Bb2 Bb1 C2 C2 C3 C2 G2 C2 C3 C2 A1 A1 A2 A1 E2 A1 C#3 E2', step: 2 },
        { inst: 'lead', vol: 0.085, pat: 'D5 - - A4 D5 - E5 - F5 - E5 - D5 - C5 - Bb4 - - - A4 - Bb4 - C5 - - - D5 - E5 - F5 - - - E5 - D5 - C5 - - - G4 - A4 - E5 - - - - - C#5 - A4 - - - - - - -', step: 2 },
        { inst: 'pad', vol: 0.09, pat: 'D3+F3+A3 - - - - - - - Bb2+D3+F3 - - - - - - - C3+E3+G3 - - - - - - - A2+C#3+E3 - - - - - - -', step: 2 },
        { inst: 'kick', vol: 0.24, pat: 'x . . . x . . . x . . . x . . . x . . . x . . . x . . . x . x .', step: 2, drum: true },
        { inst: 'snare', vol: 0.09, pat: '. . . . x . . . . . . . x . . . . . . . x . . . . . . . x . . x', step: 2, drum: true },
        { inst: 'hat', vol: 0.05, pat: 'x . x . x . x . x . x . x . x . x . x . x . x . x . x . x . x x', step: 2, drum: true }
      ]
    },
    dungeon: {
      bpm: 80, bars: 8,
      parts: [
        { inst: 'drone', vol: 0.18, pat: 'E2 - - - - - - - - - - - - - - - E2 - - - - - - - - - - - - - - - F2 - - - - - - - - - - - - - - - E2 - - - - - - - - - - - - - - -', step: 2 },
        { inst: 'bell', vol: 0.1, pat: 'E4 . . G4 . . F4 . E4 - - - . . . . B3 . . D4 . . C4 . B3 - - - . . . . E4 . . G4 . . A4 . G4 - F4 - E4 - - - F4 . . E4 . . D4 . E4 - - - - - . .', step: 2 },
        { inst: 'pluck', vol: 0.045, pat: 'E3 . B3 . E4 . . . E3 . B3 . G4 . . . E3 . C4 . G4 . . . F3 . C4 . A4 . . . E3 . B3 . E4 . . . E3 . B3 . G4 . . . F3 . C4 . A4 . . . E3 . B3 . F4 . . .', step: 2 },
        { inst: 'tom', vol: 0.14, pat: 'x . . . . . . . . . . . . . . . x . . . . . . . . . . . x . . . x . . . . . . . . . . . . . . . x . . . . . . . . . . . x . x .', step: 2, drum: true }
      ]
    },
    lair: {
      bpm: 66, bars: 4,
      parts: [
        { inst: 'drone', vol: 0.2, pat: 'D2 - - - - - - - - - - - - - - - D2 - - - - - - - - - - - - - - - Eb2 - - - - - - - - - - - - - - - D2 - - - - - - - - - - - - - - -', step: 2 },
        { inst: 'tom', vol: 0.14, pat: 'x . . . x . . . x . . . x . . . x . . . x . . . x . . . x . x .', step: 4, drum: true },
        { inst: 'bell', vol: 0.07, pat: '. . . . A4 - - - . . . . Bb4 - - - . . . . A4 - - - . . . . D5 - - -', step: 4 }
      ]
    },
    boss: {
      bpm: 140, bars: 4,
      parts: [
        { inst: 'bass', vol: 0.22, pat: 'D2 D2 D3 D2 F2 D2 E2 D2 D2 D2 D3 D2 A2 G2 F2 E2 Bb1 Bb1 Bb2 Bb1 D2 Bb1 C2 Bb1 C2 C2 C3 C2 E2 C2 A1 C#2 D2 D2 D3 D2 F2 D2 E2 D2 D2 D2 D3 D2 A2 G2 F2 E2 Bb1 Bb1 Bb2 Bb1 D2 Bb1 C2 Bb1 A1 A1 A2 A1 C#2 E2 A2 C#3', step: 1 },
        { inst: 'lead', vol: 0.08, pat: 'D5 - C5 D5 - F5 E5 D5 A4 - - - D5 - E5 - F5 - E5 F5 - G5 F5 E5 C#5 - - - E5 - A5 - D5 - C5 D5 - F5 E5 D5 A4 - - - F5 - G5 - A5 - G5 F5 - E5 D5 C#5 D5 - - - - - - -', step: 2 },
        { inst: 'kick', vol: 0.26, pat: 'x . . . x . . . x . . . x . x . x . . . x . . . x . . . x . x x', step: 2, drum: true },
        { inst: 'snare', vol: 0.11, pat: '. . . . x . . . . . . . x . . . . . . . x . . . . . . . x . x x', step: 2, drum: true },
        { inst: 'hat', vol: 0.05, pat: 'x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x', step: 2, drum: true }
      ]
    },
    victory: {
      bpm: 96, bars: 4, once: false,
      parts: [
        { inst: 'lead', vol: 0.1, pat: 'D4 F#4 A4 D5 - - F#5 - E5 - D5 - C#5 - A4 - B4 - C#5 - D5 - E5 - F#5 - - - E5 - - - D5 - F#5 - A5 - - - G5 - F#5 - E5 - - - D5 - C#5 - D5 - - - - - - - - - - -', step: 2 },
        { inst: 'pad', vol: 0.12, pat: 'D3+F#3+A3 - - - - - - - G3+B3+D4 - - - - - - - A3+C#4+E4 - - - - - - - D3+F#3+A3 - - - - - - -', step: 2 },
        { inst: 'pluck', vol: 0.07, pat: 'D4 A4 F#4 A4 D5 A4 F#4 A4 G4 D5 B4 D5 G5 D5 B4 D5 A4 E5 C#5 E5 A5 E5 C#5 E5 D4 A4 F#4 A4 D5 A4 F#4 A4', step: 2 },
        { inst: 'kick', vol: 0.16, pat: 'x . . . . . . . x . . . . . . . x . . . . . . . x . . . x . . .', step: 2, drum: true }
      ]
    },
    defeat: {
      bpm: 60, bars: 4, once: false,
      parts: [
        { inst: 'bell', vol: 0.1, pat: 'A4 - - F4 - - D4 - - - - - - - - - E4 - - C4 - - A3 - - - - - - - - -', step: 2 },
        { inst: 'pad', vol: 0.12, pat: 'D3+F3+A3 - - - - - - - A2+C3+E3 - - - - - - - Bb2+D3+F3 - - - - - - - A2+C#3+E3 - - - - - - -', step: 2 }
      ]
    }
  };
  TRACKS.camp = TRACKS.title;

  const A = {
    supported: !!(window.AudioContext || window.webkitAudioContext),
    unlocked: false, ctx: null,
    music: null, pendingMusic: null, curName: null,
    ambient: null, ambName: null,
    duckT: 0, duckLevel: 1, pauseDuck: 1,
    init() {
      RS.Input.onFirstInput(() => this.unlock());
    },
    unlock() {
      if (this.unlocked || !this.supported) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        const c = this.ctx;
        this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
        this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 3;
        this.comp.connect(this.master);
        this.musicBus = c.createGain(); this.musicBus.connect(this.comp);
        this.sfxBus = c.createGain(); this.sfxBus.connect(this.comp);
        this.ambBus = c.createGain(); this.ambBus.connect(this.comp);
        this.reverb = c.createConvolver(); this.reverb.buffer = this.impulse(2.4, 3);
        // reverb sends sit after each bus gain, so a muted bus also silences its echo
        this.revMusic = c.createGain(); this.revMusic.gain.value = 0.9; this.revMusic.connect(this.reverb);
        this.musicBus.connect(this.revMusic);
        this.revSfx = c.createGain(); this.revSfx.gain.value = 0.3; this.revSfx.connect(this.reverb);
        this.revAmb = c.createGain(); this.revAmb.gain.value = 0; this.revAmb.connect(this.reverb);
        this.revOut = c.createGain(); this.revOut.gain.value = 0.5; this.reverb.connect(this.revOut); this.revOut.connect(this.comp);
        this.noiseBuf = this.makeNoise();
        this.pulseWave = this.makePulse(0.25);
        if (c.state === 'suspended') c.resume();
        this.unlocked = true;
        this.applySettings();
        if (this.pendingMusic) { const n = this.pendingMusic; this.pendingMusic = null; this.playMusic(n); }
        if (this.pendingAmb) { const n = this.pendingAmb; this.pendingAmb = null; this.setAmbient(n); }
      } catch (e) { console.warn('audio unavailable', e); this.supported = false; }
    },
    impulse(sec, decay) {
      const c = this.ctx, n = Math.floor(c.sampleRate * sec);
      const b = c.createBuffer(2, n, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
      return b;
    },
    makeNoise() {
      const c = this.ctx, n = c.sampleRate * 2;
      const b = c.createBuffer(1, n, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return b;
    },
    makePulse(duty) {
      const n = 32, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      return this.ctx.createPeriodicWave(re, im);
    },
    applySettings() {
      if (!this.unlocked) return;
      const s = RS.Save.data.settings;
      const now = this.ctx.currentTime;
      this.musicBus.gain.setTargetAtTime(s.music ? s.musicVol * 0.55 * this.duckLevel * this.pauseDuck : 0, now, 0.08);
      this.sfxBus.gain.setTargetAtTime(s.sfx ? s.sfxVol * 0.8 : 0, now, 0.03);
      this.ambBus.gain.setTargetAtTime(s.ambient && s.sfx ? s.sfxVol * 0.5 : s.ambient ? 0.3 : 0, now, 0.2);
      // one-shot sfx voices feed revSfx directly, so its level carries the sfx toggle and volume
      this.revSfx.gain.setTargetAtTime(s.sfx ? 0.3 * s.sfxVol / 0.8 : 0, now, 0.03);
      this.revAmb.gain.setTargetAtTime(s.ambient ? (s.sfx ? 0.3 * s.sfxVol / 0.8 : 0.2) : 0, now, 0.2);
    },

    // ---- instruments ---------------------------------------------------------------------
    voice(inst, m, t, dur, vol, dest) {
      const c = this.ctx;
      const f = freq(m);
      const out = c.createGain();
      out.connect(dest);
      const env = (a, d, s, r) => {
        out.gain.setValueAtTime(0.0001, t);
        out.gain.linearRampToValueAtTime(vol, t + a);
        out.gain.setTargetAtTime(vol * s, t + a, d);
        out.gain.setTargetAtTime(0.0001, t + Math.max(a, dur), r);
      };
      let stopAt = t + dur + 1.2;
      if (inst === 'pluck') {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.25);
        o.connect(lp); lp.connect(out);
        out.gain.setValueAtTime(vol, t); out.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        o.start(t); o.stop(t + 0.5); stopAt = t + 0.5;
      } else if (inst === 'lead') {
        const o = c.createOscillator(); o.setPeriodicWave(this.pulseWave); o.frequency.value = f;
        const vib = c.createOscillator(); vib.frequency.value = 5.2; const vg = c.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.008, t + 0.25);
        vib.connect(vg); vg.connect(o.frequency);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
        o.connect(lp); lp.connect(out);
        env(0.012, 0.15, 0.7, 0.08);
        o.start(t); vib.start(t); o.stop(t + dur + 0.4); vib.stop(t + dur + 0.4); stopAt = t + dur + 0.4;
      } else if (inst === 'bass') {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(260, t + 0.18); lp.Q.value = 3;
        o.connect(lp); lp.connect(out);
        out.gain.setValueAtTime(vol, t); out.gain.setTargetAtTime(vol * 0.5, t + 0.02, 0.08); out.gain.setTargetAtTime(0.0001, t + dur * 0.9, 0.04);
        o.start(t); o.stop(t + dur + 0.3); stopAt = t + dur + 0.3;
      } else if (inst === 'pad') {
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.connect(out);
        for (const det of [-7, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 1.6); }
        out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(vol * 0.5, t + 0.5); out.gain.setTargetAtTime(0.0001, t + dur, 0.5);
        stopAt = t + dur + 1.6;
      } else if (inst === 'bell') {
        for (const [mul, g] of [[1, 1], [2.76, 0.35], [5.4, 0.12]]) {
          const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
          const gg = c.createGain(); gg.gain.setValueAtTime(vol * g, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + 1.6 / mul + 0.2);
          o.connect(gg); gg.connect(out); o.start(t); o.stop(t + 2);
        }
        out.gain.value = 1;
        stopAt = t + 2;
      } else if (inst === 'drone') {
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.connect(out);
        for (const [mul, ty] of [[1, 'triangle'], [1.5, 'sine'], [2, 'triangle']]) { const o = c.createOscillator(); o.type = ty; o.frequency.value = f * mul; o.detune.value = mul === 2 ? 5 : 0; o.connect(lp); o.start(t); o.stop(t + dur + 1.5); }
        out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(vol * 0.5, t + 0.6); out.gain.setTargetAtTime(0.0001, t + dur, 0.4);
        stopAt = t + dur + 1.5;
      }
      return stopAt;
    },
    drum(inst, t, vol, dest) {
      const c = this.ctx;
      const g = c.createGain(); g.connect(dest);
      if (inst === 'kick' || inst === 'tom') {
        const o = c.createOscillator(); o.type = 'sine';
        const f0 = inst === 'kick' ? 120 : 90, f1 = inst === 'kick' ? 40 : 55;
        o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.14);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (inst === 'kick' ? 0.25 : 0.45));
        o.connect(g); o.start(t); o.stop(t + 0.5);
      } else {
        const n = c.createBufferSource(); n.buffer = this.noiseBuf;
        const f = c.createBiquadFilter();
        if (inst === 'hat') { f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); }
        else { f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); const o = c.createOscillator(); o.frequency.value = 185; const og = c.createGain(); og.gain.setValueAtTime(vol * 0.6, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); o.connect(og); og.connect(dest); o.start(t); o.stop(t + 0.1); }
        n.connect(f); f.connect(g); n.start(t, Math.random()); n.stop(t + 0.2);
      }
    },

    // ---- music -------------------------------------------------------------------------------
    playMusic(name) {
      if (!TRACKS[name]) return;
      if (!this.unlocked) { this.pendingMusic = name; return; }
      if (this.curName === name && this.music) return;
      this.stopMusic(0.8);
      const tr = TRACKS[name];
      const stepDur = 60 / tr.bpm / 4;
      const parts = tr.parts.map((p) => {
        const parsed = parse(p.pat, p.step);
        // each part loops on its own length; events indexed by step for O(1) lookup
        const byStep = new Map();
        for (const ev of parsed.events) { if (!byStep.has(ev.t)) byStep.set(ev.t, []); byStep.get(ev.t).push(ev); }
        return { p, events: parsed.events, length: Math.max(1, parsed.length), byStep };
      });
      const loopSteps = tr.bars * 16;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 1.0);
      gain.connect(this.musicBus);
      this.music = { name, tr, parts, stepDur, loopSteps, start: this.ctx.currentTime + 0.1, nextStep: 0, gain };
      this.curName = name;
    },
    stopMusic(fade) {
      if (!this.unlocked) { this.pendingMusic = null; return; }
      if (this.music) {
        const g = this.music.gain, now = this.ctx.currentTime;
        g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(0.0001, now + (fade || 0.5));
        setTimeout(() => { try { g.disconnect(); } catch (e) { /* ignore */ } }, ((fade || 0.5) + 2) * 1000);
      }
      this.music = null; this.curName = null;
    },
    duckMusic(dur, level) {
      if (level !== undefined) { this.pauseDuck = level; this.applySettings(); return; }
      this.duckT = dur; this.duckLevel = 0.25; this.applySettings();
    },
    scheduleMusic() {
      const m = this.music;
      if (!m) return;
      const ahead = this.ctx.currentTime + 0.15;
      while (m.start + m.nextStep * m.stepDur < ahead) {
        const t = m.start + m.nextStep * m.stepDur;
        for (const pt of m.parts) {
          const evs = pt.byStep.get(m.nextStep % pt.length);
          if (!evs) continue;
          for (const ev of evs) {
            if (pt.p.drum) this.drum(pt.p.inst, t, pt.p.vol, m.gain);
            else for (const n of ev.notes) this.voice(pt.p.inst, n, t, ev.len * m.stepDur, pt.p.vol / Math.sqrt(ev.notes.length), m.gain);
          }
        }
        m.nextStep++;
      }
    },

    // ---- ambience ------------------------------------------------------------------------------
    setAmbient(name) {
      if (!this.unlocked) { this.pendingAmb = name; return; }
      if (this.ambName === name) return;
      if (this.ambient) { const a = this.ambient; const now = this.ctx.currentTime; a.g.gain.setTargetAtTime(0.0001, now, 0.4); setTimeout(() => { try { a.src.stop(); a.g.disconnect(); } catch (e) { /* ignore */ } }, 2500); }
      this.ambName = name;
      const c = this.ctx;
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter();
      const g = c.createGain(); g.gain.value = 0.0001;
      if (name === 'overworld') { f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6; g.gain.setTargetAtTime(0.06, c.currentTime, 1); }
      else { f.type = 'lowpass'; f.frequency.value = 160; g.gain.setTargetAtTime(0.12, c.currentTime, 1); }
      src.connect(f); f.connect(g); g.connect(this.ambBus);
      src.start();
      this.ambient = { src, f, g, name, t: 0, next: 1 };
    },
    updateAmbient(dt) {
      const a = this.ambient;
      if (!a) return;
      a.t += dt;
      if (a.name === 'overworld') {
        a.f.frequency.setTargetAtTime(420 + Math.sin(a.t * 0.23) * 180 + Math.sin(a.t * 0.61) * 60, this.ctx.currentTime, 0.5);
        a.next -= dt;
        if (a.next <= 0) { a.next = 2.5 + Math.random() * 5; this.bird(); }
      } else {
        a.next -= dt;
        if (a.next <= 0) { a.next = 1 + Math.random() * 3.5; this.drip(); }
      }
    },
    bird() {
      const c = this.ctx, t = c.currentTime;
      const n = 2 + Math.floor(Math.random() * 3);
      const base = 2200 + Math.random() * 1400;
      for (let k = 0; k < n; k++) {
        const o = c.createOscillator(); o.type = 'sine';
        const g = c.createGain();
        const s = t + k * 0.11;
        o.frequency.setValueAtTime(base, s); o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), s + 0.07);
        g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(0.05, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
        o.connect(g); g.connect(this.ambBus); o.start(s); o.stop(s + 0.1);
      }
    },
    drip() {
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator(); o.type = 'sine';
      const g = c.createGain();
      const f0 = 900 + Math.random() * 700;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.08);
      g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g); g.connect(this.ambBus); g.connect(this.revAmb); o.start(t); o.stop(t + 0.15);
    },

    // ---- sfx ------------------------------------------------------------------------------------
    tone(type, f0, f1, dur, vol, opts) {
      const c = this.ctx, t = c.currentTime + ((opts && opts.delay) || 0);
      const o = c.createOscillator();
      if (type === 'pulse') o.setPeriodicWave(this.pulseWave); else o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.01, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.sfxBus);
      if (opts && opts.rev) g.connect(this.revSfx);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, vol, type, f0, f1, opts) {
      const c = this.ctx, t = c.currentTime + ((opts && opts.delay) || 0);
      const n = c.createBufferSource(); n.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(f0 || 1000, t);
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      if (opts && opts.q) f.Q.value = opts.q;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.015, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(f); f.connect(g); g.connect(this.sfxBus);
      if (opts && opts.rev) g.connect(this.revSfx);
      n.start(t, Math.random() * 1.5); n.stop(t + dur + 0.05);
    },
    arp(notes, step, type, vol, rev) {
      notes.forEach((n, i) => this.tone(type || 'triangle', freq(midi(n)), null, step * 2.2, vol, { delay: i * step, rev }));
    },
    sfx(name) {
      if (!this.unlocked || !RS.Save.data.settings.sfx) return;
      const now = this.ctx.currentTime;
      this.lastSfx = this.lastSfx || {};
      if (this.lastSfx[name] && now - this.lastSfx[name] < 0.03) return;
      this.lastSfx[name] = now;
      switch (name) {
        case 'swing': this.noise(0.14, 0.22, 'bandpass', 2600, 700, { q: 1.2 }); this.tone('triangle', 700, 260, 0.1, 0.05); break;
        case 'hit': this.tone('square', 240, 90, 0.09, 0.12); this.noise(0.05, 0.2, 'highpass', 2000); break;
        case 'kill': this.noise(0.28, 0.2, 'lowpass', 1800, 200); this.tone('triangle', 520, 90, 0.26, 0.12); break;
        case 'hurt': this.tone('square', 320, 140, 0.22, 0.12); this.noise(0.12, 0.18, 'bandpass', 900); break;
        case 'dodge': this.noise(0.22, 0.14, 'bandpass', 500, 1700, { q: 0.8 }); break;
        case 'coin': this.tone('square', 1318, null, 0.05, 0.05); this.tone('square', 1760, null, 0.09, 0.05, { delay: 0.05 }); break;
        case 'coins': this.arp(['E6', 'A6', 'C#7'], 0.045, 'square', 0.04); break;
        case 'heal': this.arp(['C5', 'E5', 'G5', 'C6'], 0.06, 'sine', 0.09, true); break;
        case 'drink': this.arp(['G4', 'B4', 'D5'], 0.07, 'sine', 0.06); this.noise(0.2, 0.05, 'bandpass', 700); break;
        case 'pickup': this.arp(['A5', 'E6'], 0.05, 'triangle', 0.08); break;
        case 'sigil': this.arp(['D5', 'F#5', 'A5', 'D6', 'F#6', 'A6'], 0.09, 'triangle', 0.1, true); this.noise(1.4, 0.05, 'highpass', 6000, 9000, { rev: true }); this.tone('sine', 146.8, null, 1.6, 0.12, { rev: true }); break;
        case 'enter': this.noise(0.9, 0.2, 'lowpass', 300, 80); this.tone('sine', 110, 55, 0.9, 0.12, { rev: true }); break;
        case 'telegraph': this.tone('square', 300, 720, 0.24, 0.06); break;
        case 'charge': this.tone('sawtooth', 90, 180, 0.7, 0.08); this.noise(0.6, 0.08, 'bandpass', 300, 900); break;
        case 'dash': this.noise(0.3, 0.16, 'lowpass', 900, 200); break;
        case 'smash': this.noise(0.45, 0.35, 'lowpass', 900, 60); this.tone('sine', 110, 38, 0.45, 0.25); break;
        case 'crash': this.noise(0.6, 0.35, 'lowpass', 1200, 60); this.tone('sine', 90, 30, 0.6, 0.25); break;
        case 'thud': this.noise(0.2, 0.2, 'lowpass', 600, 80); this.tone('sine', 90, 45, 0.18, 0.15); break;
        case 'roar': for (const f of [70, 94, 118]) this.tone('sawtooth', f, f * 0.7, 1.2, 0.07, { rev: true }); this.noise(1.1, 0.12, 'lowpass', 600, 150); break;
        case 'slime': this.tone('sine', 180, 520, 0.12, 0.06); this.noise(0.08, 0.05, 'lowpass', 900); break;
        case 'spit': this.tone('square', 600, 240, 0.08, 0.06); break;
        case 'swell': this.tone('triangle', 200, 480, 0.5, 0.05); break;
        case 'squeak': this.tone('sine', 2400, 3200, 0.08, 0.05); this.tone('sine', 2600, 3400, 0.08, 0.04, { delay: 0.1 }); break;
        case 'blink': this.tone('sine', 1500, 500, 0.3, 0.06, { rev: true }); break;
        case 'orb': this.tone('triangle', 400, 260, 0.2, 0.07); break;
        case 'volley': this.tone('square', 220, 440, 0.2, 0.07); this.noise(0.25, 0.1, 'bandpass', 800, 2000); break;
        case 'clink': this.tone('sine', 2100, 1900, 0.12, 0.08); this.tone('sine', 3150, 2900, 0.1, 0.05); break;
        case 'bosshit': this.tone('square', 180, 70, 0.14, 0.14); this.noise(0.15, 0.22, 'lowpass', 2500, 400); break;
        case 'crumble': this.noise(0.4, 0.14, 'lowpass', 700, 120); break;
        case 'bossdie': this.noise(2.6, 0.3, 'lowpass', 1500, 40, { rev: true }); this.tone('sine', 120, 30, 2.6, 0.22, { rev: true }); this.arp(['D4', 'A4', 'D5', 'F#5', 'A5'], 0.3, 'triangle', 0.08, true); break;
        case 'death': this.arp(['A4', 'F4', 'D4', 'A3'], 0.16, 'triangle', 0.1, true); break;
        case 'summon': this.tone('sawtooth', 60, 140, 0.8, 0.07, { rev: true }); break;
        case 'trial': this.tone('sine', 98, null, 2, 0.16, { rev: true }); this.tone('sine', 196 * 1.34, null, 1.4, 0.05, { rev: true }); break;
        case 'bush': this.noise(0.16, 0.2, 'highpass', 1800, 900); break;
        case 'grass': this.noise(0.1, 0.12, 'highpass', 3000, 1500); break;
        case 'chest': this.tone('square', 160, 100, 0.08, 0.08); this.arp(['C5', 'E5', 'G5', 'C6', 'E6'], 0.07, 'triangle', 0.08, true); break;
        case 'ignite': this.noise(0.5, 0.18, 'bandpass', 400, 2000, { q: 0.6 }); this.tone('triangle', 200, 600, 0.3, 0.06); break;
        case 'lever': this.tone('square', 110, 80, 0.12, 0.12); this.noise(0.1, 0.12, 'lowpass', 800); this.tone('square', 150, 110, 0.1, 0.08, { delay: 0.15 }); break;
        case 'seal': this.noise(1.0, 0.18, 'lowpass', 400, 60); this.arp(['E4', 'B4', 'E5', 'G#5', 'B5'], 0.1, 'triangle', 0.08, true); break;
        case 'slam': this.noise(0.5, 0.3, 'lowpass', 500, 50); this.tone('sine', 70, 35, 0.5, 0.2); break;
        case 'talk': this.tone('square', 660, null, 0.04, 0.03); break;
        case 'type': this.tone('square', 900 + Math.random() * 200, null, 0.015, 0.012); break;
        case 'pause': this.arp(['E5', 'B4'], 0.06, 'triangle', 0.06); break;
        case 'map': this.noise(0.18, 0.08, 'bandpass', 1500, 3000); break;
        case 'ui_move': this.tone('square', 880, null, 0.03, 0.025); break;
        case 'ui_ok': this.arp(['A5', 'E6'], 0.05, 'square', 0.035); break;
        case 'ui_back': this.arp(['E5', 'A4'], 0.05, 'square', 0.03); break;
        case 'ui_toggle': this.tone('triangle', 1200, 1600, 0.05, 0.05); break;
        case 'buy': this.arp(['C5', 'G5', 'C6', 'E6'], 0.06, 'square', 0.04); break;
        case 'deny': this.tone('square', 200, 150, 0.15, 0.06); break;
        case 'step': this.noise(0.04, 0.02, 'lowpass', 500); break;
        default: this.tone('triangle', 440, null, 0.05, 0.03);
      }
    },

    update(dt) {
      if (!this.unlocked) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.scheduleMusic();
      this.updateAmbient(dt);
      if (this.duckT > 0) { this.duckT -= dt; if (this.duckT <= 0) { this.duckLevel = 1; this.applySettings(); } }
    }
  };

  RS.Audio = A;
  RS.AudioTracks = TRACKS;
})();
