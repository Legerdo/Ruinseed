// Title, camp (shop between runs), defeat and victory scenes + debug cheats.
(function () {
  'use strict';
  const P = RS.PAL, T = RS.T, UI = RS.UI;
  RS.Scenes = RS.Scenes || {};

  // ---- procedural pixel backdrops -------------------------------------------------------------
  const bdCache = {};
  function backdrop(kind, W, H) {
    const key = kind + W + 'x' + H;
    if (bdCache[key]) return bdCache[key];
    const b = new RS.Art.PixBuf(W, H);
    const rng = new RS.RNG('bd' + kind);
    const sky = kind === 'dawn' ? [P.emb1, P.emb2, P.emb3, P.gold2, P.gold3, P.gold4] : kind === 'defeat' ? [P.ink0, P.ink0, P.ink1, P.ink1, P.ink2, '#2a1a24'] : [P.ink0, P.ink1, P.ink1, P.ink2, P.ink3, P.ink4];
    const skyH = Math.floor(H * 0.72);
    // flat colour bands joined by a short ordered-dither ramp, the classic pixel-art sky gradient
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const bandH = skyH / sky.length, ramp = 0.45;
    for (let y = 0; y < H; y++) {
      const f = (y / skyH) * sky.length;
      const band = Math.min(sky.length - 1, Math.floor(f));
      const local = f - band;
      if (band >= sky.length - 1 || local < 1 - ramp || bandH < 4) { b.hline(0, W - 1, y, sky[band]); continue; }
      const t = (local - (1 - ramp)) / ramp;
      for (let x = 0; x < W; x++) b.set(x, y, bayer[(y & 3) * 4 + (x & 3)] / 16 < t ? sky[band + 1] : sky[band]);
    }
    // moon / sun
    const mr = Math.max(10, Math.floor(H * 0.07)), my = Math.floor(H * 0.2);
    // on narrow screens the logo reaches W*0.73, so the moon moves out to the corner
    const mx = W < 360 ? W - mr - 18 : Math.floor(W * 0.76);
    if (kind === 'dawn') { b.ellipse(mx, Math.floor(H * 0.55), mr * 1.6, mr * 1.6, P.gold4); b.ellipse(mx, Math.floor(H * 0.55), mr * 1.2, mr * 1.2, P.gold5); }
    else if (kind !== 'defeat') {
      b.ellipse(mx, my, mr + 3, mr + 3, P.ink4);
      b.ellipse(mx, my, mr, mr, P.bone6);
      b.ellipse(mx - 3, my - 2, mr * 0.3, mr * 0.25, P.bone5); b.ellipse(mx + mr * 0.4, my + mr * 0.3, mr * 0.2, mr * 0.2, P.bone5);
    }
    // ridge helper
    const vn = RS.makeValueNoise(kind === 'dawn' ? 9 : 4);
    const ridge = (base, amp, freq, col, top, seed) => {
      for (let x = 0; x < W; x++) {
        const h = base + (vn.fbm(x * freq + seed, seed, 3, 2, 0.5) - 0.5) * amp * 2;
        const y0 = Math.floor(H - h);
        for (let y = y0; y < H; y++) b.set(x, y, col);
        if (top) b.set(x, y0, top);
      }
    };
    const far = kind === 'dawn' ? [P.emb1, P.cany2] : [P.ink3, P.ink4];
    const mid = kind === 'dawn' ? [P.earth1, P.cany1] : [P.ink2, P.ink3];
    const near = kind === 'dawn' ? [P.earth0, P.earth1] : [P.ink1, P.ink2];
    ridge(H * 0.5, H * 0.14, 0.012, far[0], far[1], 3);
    ridge(H * 0.36, H * 0.1, 0.02, mid[0], mid[1], 11);
    // ruined tower & broken arches silhouetted on the far hill, one window still warm
    const sil = kind === 'dawn' ? P.earth0 : P.ink1;
    // far left, so its lit window never sits beside the centred menus
    const tw = Math.max(9, Math.floor(W * 0.03)), th = Math.floor(H * 0.34);
    const tx = Math.max(tw + 6, Math.floor(W * 0.1)), tb = Math.floor(H - H * 0.34);
    for (let y = tb - th; y < tb + 8; y++) {
      const taper = Math.floor((y - (tb - th)) / 18);
      for (let x = tx - tw - taper; x <= tx + tw + taper; x++) {
        const broken = y < tb - th + 7 && RS.rand2(x, 1, 7) < 0.55;
        if (!broken) b.set(x, y, sil);
      }
    }
    // battlement teeth and a lit window
    for (let x = tx - tw; x <= tx + tw; x += 4) b.rect(x, tb - th - 3, 2, 3, sil);
    if (kind !== 'defeat') {
      b.rect(tx - 2, tb - Math.floor(th * 0.64), 4, 6, kind === 'dawn' ? P.gold5 : P.emb5);
      b.set(tx - 1, tb - Math.floor(th * 0.64) + 1, kind === 'dawn' ? P.white : P.emb7);
    }
    for (let k = 0; k < 4; k++) {
      const ax = tx + tw + 6 + k * 15;
      const ah = k === 3 ? 12 : 22;
      for (let y = tb - ah; y < tb + 8; y++) for (let x = ax; x < ax + 13; x++) {
        const inner = ((x - ax - 6.5) / 4.2) ** 2 + ((y - tb - 4) / 14) ** 2 < 1;
        const brokenTop = k === 2 && y < tb - 12 && x > ax + 7;
        if (!inner && !brokenTop) b.set(x, y, sil);
      }
    }
    ridge(H * 0.2, H * 0.05, 0.03, near[0], near[1], 23);
    // pine silhouettes along the near ridge
    const pines = [0.52, 0.58, 0.63, 0.86, 0.9, 0.95, 0.06, 0.1];
    for (const f of pines) {
      const px = Math.floor(W * f), ph = Math.floor(H * (0.1 + RS.rand2(px, 2, 3) * 0.08));
      const base = H - Math.floor(H * 0.2) + 2;
      for (let y = 0; y < ph; y++) {
        const hw = Math.floor((y / ph) * ph * 0.28) + ((y % 5) === 4 ? 1 : 0);
        for (let x = px - hw; x <= px + hw; x++) b.set(x, base - ph + y, near[0]);
      }
      b.rect(px - 1, base, 2, 3, near[0]);
    }
    // foreground grass tufts
    for (let k = 0; k < W / 3; k++) {
      const x = rng.int(0, W - 1), y = H - Math.floor(H * 0.2) + rng.int(2, Math.floor(H * 0.2) - 2);
      b.set(x, y, near[1]); b.set(x, y - 1, near[1]);
    }
    const stars = [];
    if (kind !== 'dawn') for (let k = 0; k < W * H / 900; k++) stars.push({ x: rng.int(0, W - 1), y: rng.int(0, Math.floor(H * 0.5)), p: rng.next() * 6 });
    const out = { cv: b.toCanvas(), stars, groundY: H - Math.floor(H * 0.2) };
    bdCache[key] = out;
    return out;
  }

  const embers = [];
  function drawBackdrop(ctx, kind, t, fire) {
    const W = RS.App.W, H = RS.App.H;
    const bd = backdrop(kind, W, H);
    ctx.drawImage(bd.cv, 0, 0);
    for (const s of bd.stars) {
      const tw = Math.sin(t * 2 + s.p * 3);
      if (tw > -0.3) { ctx.fillStyle = tw > 0.7 ? P.white : P.ink6; ctx.fillRect(s.x, s.y, 1, 1); }
    }
    if (fire) {
      // embers drifting up from the fire position
      if (embers.length < 40 && Math.random() < 0.5) embers.push({ x: fire.x + (Math.random() - 0.5) * 6, y: fire.y - 8, vx: (Math.random() - 0.5) * 8, vy: -14 - Math.random() * 16, l: 0, m: 2 + Math.random() * 2 });
      for (const e of embers) { e.l += 1 / 60; e.x += e.vx / 60 + Math.sin(e.l * 3) * 0.1; e.y += e.vy / 60; }
      for (let i = embers.length - 1; i >= 0; i--) if (embers[i].l > embers[i].m) embers.splice(i, 1);
      for (const e of embers) { ctx.fillStyle = e.l / e.m < 0.5 ? P.emb6 : P.emb4; ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, 1); }
    }
    return bd;
  }

  // chunky gradient logo (large pixel font scaled 2x)
  let logoCache = null;
  function logo() {
    if (logoCache) return logoCache;
    const e = RS.Text.renderLine(T.gameTitle, { font: 'large', color: '#ffffff' });
    const w = e.canvas.width, h = e.canvas.height;
    const src = RS.Art.bufFromCanvas(e.canvas);
    const b = new RS.Art.PixBuf(w + 4, h + 4);
    const grad = [P.emb7, P.emb6, P.emb6, P.emb5, P.emb5, P.emb4, P.emb4, P.emb3, P.emb3, P.emb2];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (src.opaque(x, y)) {
      b.set(x + 2, y + 3, P.emb1);                 // drop shadow
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (src.opaque(x, y)) {
      const gi = Math.min(grad.length - 1, Math.floor(y / h * grad.length * 1.2));
      b.set(x + 1, y + 1, grad[gi]);
    }
    RS.Art.outline(b, P.ink0);
    logoCache = b.toCanvas();
    return logoCache;
  }
  function drawLogo(ctx, cx, y, scale) {
    const lg = logo();
    const w = lg.width * scale, h = lg.height * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lg, Math.round(cx - w / 2), Math.round(y), w, h);
    return h;
  }

  // ---- seed entry modal ---------------------------------------------------------------------
  class SeedModal {
    constructor(onDone) {
      this.pausesGame = true; this.value = ''; this.onDone = onDone; this.t = 0;
      this.off = RS.Input.onKey((e) => {
        if (/^Digit\d$/.test(e.code) || /^Numpad\d$/.test(e.code)) { if (this.value.length < 6) this.value += e.code.slice(-1); RS.Audio && RS.Audio.sfx('ui_move'); }
        else if (e.code === 'Backspace') this.value = this.value.slice(0, -1);
      });
    }
    exit() { this.off && this.off(); }
    update(dt) {
      this.t += dt;
      const I = RS.Input;
      // Backspace edits the value, so only Escape (or a click outside) cancels here
      if (I.uiPressed('confirm') && this.value.length) { const v = +this.value; RS.App.popModal(this); this.onDone(v); RS.Audio && RS.Audio.sfx('ui_ok'); return; }
      if (I.isDown('Escape') || I.mouse.rpressed) { RS.App.popModal(this); RS.Audio && RS.Audio.sfx('ui_back'); }
    }
    render(ctx) {
      const W = RS.App.W, H = RS.App.H;
      UI.veil(ctx, 0.6);
      const w = Math.min(W - 20, 260), h = 82;
      const x = Math.round((W - w) / 2), y = Math.round((H - h) / 2);
      UI.panel(ctx, x, y, w, h, 'stone');
      RS.Text.draw(ctx, UI.fitText(T.title.seedPrompt, 'bold', w - 16), W / 2, y + 8, { font: 'bold', color: P.gold5, align: 'center', shadow: P.ink0 });
      UI.panel(ctx, W / 2 - 50, y + 28, 100, 22, 'dark');
      const shown = this.value + (Math.floor(this.t * 2) % 2 ? '_' : ' ');
      RS.Text.draw(ctx, shown, W / 2, y + 32, { font: 'large', color: P.bone7, align: 'center' });
      RS.Text.draw(ctx, UI.fitText(T.title.seedHelp, 'small', w - 16), W / 2, y + 60, { font: 'small', color: P.bone4, align: 'center' });
    }
  }

  // ---- credits ---------------------------------------------------------------------------------
  class CreditsModal {
    constructor() { this.pausesGame = true; }
    update() { if (RS.Input.uiPressed('cancel') || RS.Input.uiPressed('confirm') || RS.Input.mouse.pressed) RS.App.popModal(this); }
    render(ctx) {
      const W = RS.App.W, H = RS.App.H;
      UI.veil(ctx, 0.7);
      const w = Math.min(W - 16, 340);
      const hs = T.credits.map((l) => UI.textHeight(l, w - 24, 'small', 2) + 4);
      const h = 34 + hs.reduce((a, b) => a + b, 0) + 10;
      const x = Math.round((W - w) / 2), y = Math.round((H - h) / 2);
      UI.panel(ctx, x, y, w, h, 'stone');
      RS.Text.draw(ctx, T.title.credits, W / 2, y + 8, { font: 'bold', color: P.gold5, align: 'center' });
      let yy = y + 30;
      T.credits.forEach((l, i) => { RS.Text.drawWrapped(ctx, l, x + 12, yy, w - 24, { font: 'small', color: i === 0 ? P.emb6 : P.bone6 }); yy += hs[i]; });
    }
  }

  function randomSeed() { return 100000 + Math.floor(Math.random() * 899999); }

  // ---- title -------------------------------------------------------------------------------------
  RS.Scenes.title = {
    drawBackdrop(ctx, t) { drawBackdrop(ctx, 'night', t, null); },
    enter() {
      this.t = 0;
      this.started = RS.Input.hasInput;
      this.buildMenu();
      if (this.started) RS.Audio && RS.Audio.playMusic('title');
      RS.Audio && RS.Audio.setAmbient('overworld');
      if (RS.Save.lastError === 'corrupt') { this.notice = T.hud.saveCorrupt; RS.Save.clearError(); }
      else if (!RS.Save.available) this.notice = T.hud.saveFail;
    },
    buildMenu() {
      const s = RS.Save.data;
      const tt = T.title;
      const items = [];
      if (s.run) items.push({ label: tt.continue, action: () => this.continueRun() });
      items.push({ label: tt.newWorld, action: () => RS.App.setScene('camp', { seed: randomSeed(), fresh: true }) });
      if (s.lastSeed !== null && s.lastSeed !== undefined) items.push({ label: () => tt.retry + ' · ' + s.lastSeed, action: () => RS.App.setScene('camp', { seed: s.lastSeed }) });
      items.push({ label: tt.enterSeed, action: () => RS.App.pushModal(new SeedModal((v) => RS.App.setScene('camp', { seed: v % 1000000 }))) });
      items.push({ label: tt.settings, action: () => RS.App.pushModal(new UI.SettingsModal(null)) });
      items.push({ label: tt.controls, action: () => RS.App.pushModal(new UI.ControlsModal()) });
      items.push({ label: tt.credits, action: () => RS.App.pushModal(new CreditsModal()) });
      this.menu = new UI.Menu(items, { center: true });
    },
    continueRun() {
      const r = RS.Save.data.run;
      if (!r) return;
      RS.Audio && RS.Audio.stopMusic(0.5);
      RS.App.setScene('loading', { seed: r.seed, attempt: r.attempt, resume: r });
    },
    update(dt) {
      this.t += dt;
      if (!this.started) {
        if (RS.Input.anyPressed()) { this.started = true; RS.Audio && RS.Audio.sfx('ui_ok'); RS.Audio && RS.Audio.playMusic('title'); }
        return;
      }
      this.menu.update();
    },
    render(ctx) {
      const W = RS.App.W, H = RS.App.H;
      // hero by the fire on the foreground ledge, kept clear of the centred menu on narrow screens
      const fireX = Math.round(W * (W < 360 ? 0.12 : 0.18));
      const bd = drawBackdrop(ctx, 'night', this.t, { x: fireX, y: bd0y(H) });
      const gy = bd.groundY + 8;
      RS.Sprites.draw(ctx, 'campfire_' + (Math.floor(this.t * 8) & 3), fireX, gy);
      RS.Sprites.draw(ctx, 'hero_up_idle_' + (Math.floor(this.t * 1.5) & 1), fireX + (W < 360 ? 18 : 22), gy);
      const scale = W >= 560 && H >= 260 ? 3 : 2;
      const short = H < 210;
      // a save warning gets its own strip at the top and pushes the logo down
      const noticeH = this.notice ? 18 : 0;
      if (this.notice) {
        const nt = UI.fitText(this.notice, 'small', W - 20);
        const nw = RS.Text.measure(nt, 'small') + 14;
        UI.panel(ctx, Math.round(W / 2 - nw / 2), 2, nw, 15, 'ember', 0.95);
        RS.Text.draw(ctx, nt, W / 2, 4, { font: 'small', color: P.emb6, align: 'center' });
      }
      const logoY = noticeH + (short ? 6 : Math.max(8, H * 0.08));
      const logoH = drawLogo(ctx, W / 2, logoY, scale);
      const ly = logoY + logoH;
      let my;
      if (short) {
        // one subtitle line keeps room for the menu on 180px-tall screens
        const wa = RS.Text.measure(T.gameSub, 'bold'), wb = RS.Text.measure(T.gameSubKo, 'body');
        const x0 = Math.round(W / 2 - (wa + 10 + wb) / 2);
        RS.Text.draw(ctx, T.gameSub, x0, ly + 1, { font: 'bold', color: P.gold4, outline: P.ink0 });
        RS.Text.draw(ctx, T.gameSubKo, x0 + wa + 10, ly + 1, { font: 'body', color: P.bone6, outline: P.ink0 });
        my = ly + 20;
      } else {
        RS.Text.draw(ctx, T.gameSub, W / 2, ly + 2, { font: 'bold', color: P.gold4, align: 'center', outline: P.ink0 });
        RS.Text.draw(ctx, T.gameSubKo, W / 2, ly + 18, { font: 'body', color: P.bone6, align: 'center', outline: P.ink0 });
        my = ly + 38;
      }
      const s = RS.Save.data;
      if (!this.started) {
        if (Math.floor(this.t * 1.6) % 2 === 0) RS.Text.draw(ctx, T.title.pressAny, W / 2, Math.max(my + 6, H * 0.66), { font: 'bold', color: P.bone7, align: 'center', outline: P.ink0 });
        RS.Text.draw(ctx, T.title.audioHint, W / 2, Math.max(my + 6, H * 0.66) + 18, { font: 'small', color: P.bone4, align: 'center', outline: P.ink0 });
      } else {
        const mw = Math.min(W - 40, Math.max(180, this.menu.widest('body')));
        const bottom = H - (s.run ? 28 : 16);
        this.menu.layout(Math.round(W / 2 - mw / 2), my, mw, 17, bottom - my);
        this.menu.draw(ctx);
      }
      // footer stats
      const best = s.best ? RS.formatTime(s.best.time) : T.title.noRecord;
      const foot = T.currency + ' ' + s.currency + ' · ' + T.title.best + ' ' + best + ' · ' + T.title.wins + ' ' + s.stats.wins + ' · ' + T.title.runs + ' ' + s.stats.runs;
      RS.Text.draw(ctx, UI.fitText(foot, 'small', W - 12), W / 2, H - 13, { font: 'small', color: P.gold3, align: 'center', outline: P.ink0 });
      if (s.run && this.started) RS.Text.draw(ctx, UI.fitText(T.fmt(T.title.continueInfo, { seed: s.run.seed, sig: s.run.sigils.length }), 'small', W - 12), W / 2, H - 25, { font: 'small', color: P.bone5, align: 'center', outline: P.ink0 });
    }
  };
  function bd0y(H) { return H - Math.floor(H * 0.2) + 2; }

  // ---- camp (shop between runs) -------------------------------------------------------------------
  RS.Scenes.camp = {
    enter(p) {
      this.t = 0;
      this.seed = p.seed !== undefined ? p.seed : (RS.Save.data.lastSeed || randomSeed());
      this.fresh = !!p.fresh;
      this.msg = null; this.msgT = 0;
      this.focus = 'shop';
      this.buildMenus();
      RS.Audio && RS.Audio.playMusic('camp');
      RS.Audio && RS.Audio.setAmbient('overworld');
    },
    buildMenus() {
      const s = RS.Save.data;
      const items = RS.Upgrades.list.map((u) => ({
        label: () => T.upgrades[u.id].name,
        value: () => { const lv = s.upgrades[u.id]; return lv >= u.max ? T.camp.maxed : T.fmt(T.camp.price, { n: u.price[lv] }); },
        up: u,
        action: () => this.buy(u)
      }));
      this.shop = new UI.Menu(items, {});
      const att = (s.attempts[this.seed] || 0) + 1;
      const dep = [
        { label: () => T.fmt(T.camp.departSame, { seed: this.seed }), action: () => this.depart(this.seed) },
        { label: T.camp.departNew, action: () => this.depart(randomSeed()) },
        { label: T.camp.toTitle, action: () => RS.App.setScene('title') }
      ];
      void att;
      this.dep = new UI.Menu(dep, { center: true });
      this.depRow = new UI.Menu(dep, { center: true, horizontal: true });
    },
    // layout depends only on the screen size: wide = two columns, otherwise a full-width shop with
    // the departure buttons in one row at the bottom; short screens get a one-line header
    layoutFor(W, H) {
      if (this.L && this.L.W === W && this.L.H === H) return this.L;
      const L = { W, H, compact: H < 230, wide: W >= 380 };
      L.top = L.compact ? 24 : 48;
      L.colW = RS.M.clamp(Math.floor(W * 0.34), 132, 190);
      L.shopX = 8;
      L.shopW = L.wide ? Math.min(W - L.colW - 40, 340) : W - 16;
      // short screens drop the panel caption (the header already names the camp) so 1080p fits all rows
      L.shopTitle = !L.compact;
      const descLines = Math.max(...RS.Upgrades.list.map((u) => RS.Text.wrap(T.upgrades[u.id].desc, 'small', L.shopW - 8).length));
      L.descH = 14 + descLines * 12;
      L.panelY = L.top - 2;
      L.listY = L.panelY + (L.shopTitle ? 18 : 4);
      if (L.wide) L.panelMax = H - 4;
      else {
        L.rowY = H - 21;
        L.capY = L.rowY - 12;
        L.panelMax = L.capY - 3;
      }
      L.listMaxH = L.panelMax - 4 - L.descH - 2 - L.listY;
      return (this.L = L);
    },
    activeDep() { return this.L && !this.L.wide ? this.depRow : this.dep; },
    buy(u) {
      const s = RS.Save.data;
      const lv = s.upgrades[u.id];
      if (lv >= u.max) { RS.Audio && RS.Audio.sfx('deny'); return; }
      const price = u.price[lv];
      if (s.currency < price) { this.msg = T.camp.notEnough; this.msgT = 1.6; RS.Audio && RS.Audio.sfx('deny'); return; }
      s.currency -= price;
      s.upgrades[u.id] = lv + 1;
      RS.Save.saveNow();
      this.msg = T.fmt(T.camp.bought, { name: T.upgrades[u.id].name }); this.msgT = 1.6;
      RS.Audio && RS.Audio.sfx('buy');
    },
    depart(seed) {
      const s = RS.Save.data;
      s.attempts[seed] = (s.attempts[seed] || 0) + 1;
      const keys = Object.keys(s.attempts);
      if (keys.length > 40) delete s.attempts[keys[0]];
      s.lastSeed = seed;
      s.stats.runs++;
      s.run = null;
      RS.Save.saveNow();
      RS.Audio && RS.Audio.stopMusic(0.6);
      RS.App.setScene('loading', { seed, attempt: s.attempts[seed] });
    },
    update(dt) {
      this.t += dt;
      if (this.msgT > 0) this.msgT -= dt;
      const I = RS.Input;
      const L = this.layoutFor(RS.App.W, RS.App.H);
      const dep = this.activeDep();
      const swap = () => { this.focus = this.focus === 'shop' ? 'dep' : 'shop'; RS.Audio && RS.Audio.sfx('ui_move'); };
      if (I.uiPressed('tab')) { swap(); return; }
      if (L.wide) {
        // side by side: left/right hops between the columns
        if (I.uiPressed('left') || I.uiPressed('right')) { swap(); return; }
      } else if (this.focus === 'shop') {
        // stacked: stepping past either end of the list lands on the button row below
        const last = this.shop.items.length - 1;
        if ((I.uiPressed('down') && this.shop.sel === last) || (I.uiPressed('up') && this.shop.sel === 0) || I.uiPressed('left') || I.uiPressed('right')) { swap(); return; }
      } else if (I.uiPressed('up') || I.uiPressed('down')) { swap(); return; }
      if (I.uiPressed('cancel')) { RS.App.setScene('title'); return; }
      // mouse focus follows hover
      const m = I.mouse;
      if (m.moved || m.pressed) {
        const inRects = (menu) => menu.rects.some((r) => m.x >= r.x && m.x < r.x + r.w && m.y >= r.y - menu.scroll && m.y < r.y - menu.scroll + r.h && m.y >= menu.viewY - 1 && m.y < menu.viewY + menu.viewH + 1);
        if (this.shop.rects.length && inRects(this.shop)) this.focus = 'shop';
        else if (dep.rects.length && inRects(dep)) this.focus = 'dep';
      }
      (this.focus === 'shop' ? this.shop : dep).update();
    },
    render(ctx) {
      const W = RS.App.W, H = RS.App.H;
      const L = this.layoutFor(W, H);
      const fx = W >= 440 ? W - 70 : W - 60;
      drawBackdrop(ctx, 'night', this.t, L.wide ? { x: fx, y: H - 34 } : null);
      if (L.wide) {
        // the keeper tending the fire below the departure column
        const gy = H - 24;
        RS.Sprites.draw(ctx, 'tent', fx - 34, gy - 4);
        RS.Sprites.draw(ctx, 'campfire_' + (Math.floor(this.t * 8) & 3), fx, gy);
        RS.Sprites.draw(ctx, 'keeper_' + (Math.floor(this.t * 1.2) & 1), fx + 22, gy, { flip: true });
      }
      const s = RS.Save.data;
      // header: big centred title + currency chip, or both on one line when the screen is short
      const own = T.camp.owned + ' ' + s.currency;
      const ow = RS.Text.measure(own, 'bold') + 24;
      let chipX, chipY;
      if (L.compact) {
        RS.Text.draw(ctx, T.camp.title, 8, 4, { font: 'bold', color: P.emb6, outline: P.ink0 });
        chipX = W - ow - 6; chipY = 3;
      } else {
        RS.Text.draw(ctx, T.camp.title, W / 2, 5, { font: 'large', color: P.emb6, align: 'center', outline: P.ink0 });
        chipX = W / 2 - ow / 2; chipY = 26;
      }
      UI.panel(ctx, chipX, chipY, ow, 17, 'gold');
      RS.Sprites.draw(ctx, 'icon_ember', chipX + 5, chipY + 4);
      RS.Text.draw(ctx, own, chipX + ow / 2 + 6, chipY + 3, { font: 'bold', color: P.emb6, align: 'center' });
      // shop list (scrolls in whole rows) with the selected upgrade's description underneath
      this.shop.layout(L.shopX, L.listY, L.shopW, 18, L.listMaxH);
      const descY = L.listY + this.shop.viewH + 4;
      const panelH = descY + L.descH + 4 - L.panelY;
      UI.panel(ctx, L.shopX - 4, L.panelY, L.shopW + 8, panelH, 'stone');
      if (L.shopTitle) RS.Text.draw(ctx, T.camp.shop, L.shopX + 4, L.panelY + 3, { font: 'bold', color: P.gold5 });
      this.drawShop(ctx);
      const sel = this.shop.items[this.shop.sel];
      const u = sel.up, lv = s.upgrades[u.id];
      ctx.fillStyle = P.ink3; ctx.fillRect(L.shopX + 2, descY - 1, L.shopW - 4, 1);
      const pips = '●'.repeat(lv) + '○'.repeat(u.max - lv);
      RS.Text.draw(ctx, pips + '  ' + T.fmt(T.camp.level, { a: lv, b: u.max }), L.shopX + 4, descY + 2, { font: 'small', color: P.gold4 });
      RS.Text.drawWrapped(ctx, T.upgrades[u.id].desc, L.shopX + 4, descY + 14, L.shopW - 8, { font: 'small', color: P.bone6, lineGap: 1 });
      // departure
      const att = (s.attempts[this.seed] || 0) + 1;
      const seedCap = T.fmt(T.camp.departSeed, { seed: this.seed, n: att });
      const dep = this.activeDep();
      dep.opts.inactive = this.focus !== 'dep';
      if (L.wide) {
        const dx = L.shopX + L.shopW + 16, dw = W - L.shopW - 40;
        const kh = UI.textHeight(T.camp.keeperLine, dw - 4, 'small', 2);
        UI.panel(ctx, dx - 4, L.panelY, dw + 8, kh + 10, 'dark', 0.9);
        RS.Text.drawWrapped(ctx, T.camp.keeperLine, dx, L.panelY + 4, dw - 4, { font: 'small', color: P.moss8 });
        const dTop = L.panelY + kh + 18;
        dep.layout(dx, dTop, dw, 18);
        // make room under the first button for the seed caption
        dep.rects.forEach((r, i) => { if (i > 0) r.y += 12; });
        dep.viewH += 12; dep.totalH += 12;
        dep.draw(ctx);
        RS.Text.draw(ctx, UI.fitText(seedCap, 'small', dw), dx + dw / 2, dTop + 19, { font: 'small', color: P.gold3, align: 'center', outline: P.ink0 });
      } else {
        dep.layoutRow(8, L.rowY, W - 16, 18, 4);
        dep.draw(ctx);
        RS.Text.draw(ctx, UI.fitText(seedCap, 'small', W - 16), W / 2, L.capY, { font: 'small', color: P.gold3, align: 'center', outline: P.ink0 });
      }
      if (this.msgT > 0) {
        const mw = RS.Text.measure(this.msg, 'bold') + 20;
        UI.panel(ctx, W / 2 - mw / 2, H / 2 - 10, mw, 20, 'gold');
        RS.Text.draw(ctx, this.msg, W / 2, H / 2 - 7, { font: 'bold', color: P.gold5, align: 'center' });
      }
    },
    drawShop(ctx) {
      const s = RS.Save.data;
      const m = this.shop;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, m.viewY - 2, RS.App.W, m.viewH + 4); ctx.clip();
      m.items.forEach((it, i) => {
        const r = m.rects[i];
        const y = r.y - m.scroll;
        if (y < m.viewY - 2 || y + r.h > m.viewY + m.viewH + 2) return;
        const focus = i === m.sel && this.focus === 'shop';
        const u = it.up, lv = s.upgrades[u.id];
        const maxed = lv >= u.max;
        const afford = !maxed && s.currency >= u.price[lv];
        UI.panel(ctx, r.x, y, r.w, r.h, focus ? 'gold' : 'dark');
        RS.Sprites.draw(ctx, 'up_' + u.id, r.x + 4, y + 4);
        const name = T.upgrades[u.id].name;
        const val = maxed ? T.camp.maxed : T.fmt(T.camp.price, { n: u.price[lv] });
        const vw = RS.Text.measure(val, 'small') + 12;
        RS.Text.draw(ctx, UI.fitText(name, 'body', r.w - vw - 44), r.x + 16, y + 3, { font: 'body', color: focus ? P.gold5 : P.bone6, shadow: P.ink0 });
        // level pips
        for (let k = 0; k < u.max; k++) { ctx.fillStyle = k < lv ? P.emb5 : P.ink4; ctx.fillRect(r.x + r.w - vw - 22 + k * 5, y + 8, 3, 3); }
        RS.Text.draw(ctx, val, r.x + r.w - 6, y + 4, { font: 'small', color: maxed ? P.moss8 : afford ? P.emb6 : P.bone3, align: 'right' });
      });
      ctx.restore();
      if (m.scrolls) UI.scrollbar(ctx, m.sbX, m.viewY, m.viewH, m.scroll, m.totalH);
    }
  };

  // ---- defeat --------------------------------------------------------------------------------------
  RS.Scenes.defeat = {
    enter(p) {
      this.g = p.game; this.t = 0;
      RS.Audio && RS.Audio.playMusic('defeat');
      const d = T.defeat;
      this.menu = new UI.Menu([
        { label: d.toCamp, action: () => RS.App.setScene('camp', { seed: this.g.seed }) },
        { label: d.toTitle, action: () => RS.App.setScene('title') }
      ], { center: true });
    },
    update(dt) { this.t += dt; if (this.t > 0.8) this.menu.update(); },
    render(ctx) {
      const W = RS.App.W, H = RS.App.H, g = this.g, d = T.defeat;
      const compact = H < 230;
      const rows = [
        [d.time, RS.formatTime(g.runTime)],
        [d.sigils, g.run.sigils.length + '/3'],
        [d.earned, String(g.run.earned)],
        [d.total, String(RS.Save.data.currency)]
      ];
      // short screens: buttons in one row at the bottom right, the fallen hero by the fire at the left
      const rowW = this.menu.rowWidth(6);
      const group = compact && W - 16 - rowW >= 70;
      const fireX = group ? 22 : Math.round(W / 2) - 20;
      drawBackdrop(ctx, 'defeat', this.t, { x: fireX, y: H - 30 });
      RS.Sprites.draw(ctx, 'campfire_' + (Math.floor(this.t * 5) & 3), fireX, H - 20);
      RS.Sprites.draw(ctx, 'hero_death_1', fireX + 28, H - 20);
      RS.Text.draw(ctx, d.title, W / 2, compact ? 6 : 12, { font: 'large', color: P.heart, align: 'center', outline: P.ink0 });
      const subW = Math.min(340, W - 20);
      const subY = compact ? 26 : 34;
      const subH = RS.Text.drawWrapped(ctx, d.sub, Math.round(W / 2 - subW / 2), subY, subW, { font: compact ? 'small' : 'body', color: P.bone5, align: 'left' });
      const rh = compact ? 14 : 16;
      const w = Math.min(W - 20, 240);
      const x = Math.round(W / 2 - w / 2), y = subY + subH + (compact ? 4 : 6);
      UI.panel(ctx, x, y, w, rows.length * rh + 10, 'dark', 0.92);
      rows.forEach(([a, b], i) => {
        RS.Text.draw(ctx, a, x + 10, y + 5 + i * rh, { font: 'body', color: P.bone6 });
        RS.Text.draw(ctx, b, x + w - 10, y + 5 + i * rh, { font: 'bold', color: P.emb6, align: 'right' });
      });
      if (compact) {
        this.menu.opts.horizontal = true;
        if (group) this.menu.layoutRow(W - 8 - rowW, H - 22, rowW, 18, 6);
        else this.menu.layoutRow(8, H - 22, W - 16, 18, 6);
      } else {
        this.menu.opts.horizontal = false;
        const mw = Math.min(W - 40, Math.max(180, this.menu.widest('body')));
        this.menu.layout(Math.round(W / 2 - mw / 2), y + rows.length * rh + 18, mw, 18);
      }
      if (this.t > 0.8) this.menu.draw(ctx);
    }
  };

  // ---- victory ---------------------------------------------------------------------------------------
  RS.Scenes.victory = {
    enter(p) {
      this.g = p.game; this.t = 0;
      RS.Audio && RS.Audio.playMusic('victory');
      const v = T.victory;
      this.menu = new UI.Menu([
        { label: v.toCamp, action: () => RS.App.setScene('camp', { seed: this.g.seed }) },
        { label: v.toTitle, action: () => RS.App.setScene('title') }
      ], { center: true });
    },
    update(dt) { this.t += dt; if (this.t > 1) this.menu.update(); },
    render(ctx) {
      const W = RS.App.W, H = RS.App.H, g = this.g, v = T.victory, s = RS.Save.data;
      const ups = RS.Upgrades.list.filter((u) => s.upgrades[u.id] > 0).map((u) => T.upgrades[u.id].name + ' ' + s.upgrades[u.id]);
      const info = g.victoryInfo || { time: g.runTime, record: false };
      const rows = [
        [v.seed, String(g.seed)],
        [v.time, RS.formatTime(info.time) + (info.record ? '  ' + v.record : '')],
        [v.earned, String(g.run.earned)],
        [v.total, String(s.currency)],
        [v.best, s.best ? RS.formatTime(s.best.time) : '-']
      ];
      const upText = ups.length ? ups.join(' · ') : v.none;
      const w = Math.min(W - 16, 300);
      const x = Math.round(W / 2 - w / 2);
      const subW = Math.min(360, W - 20);
      // regular layout if it fits; otherwise small subtitle, tighter rows, upgrades inline and the
      // buttons in one row at the bottom
      const regSubH = UI.textHeight(v.sub, subW, 'body', 2);
      const regUpH = UI.textHeight(upText, w - 20, 'small', 1);
      const regH = 34 + regSubH + rows.length * 15 + 30 + regUpH + 8 + 2 * 20;
      const compact = regH > H - 4;
      const rh = compact ? 14 : 15;
      const rowW = this.menu.rowWidth(6);
      const group = !compact || W - 16 - rowW >= 90;
      const fireX = compact ? 18 : 36;
      drawBackdrop(ctx, 'dawn', this.t, group ? { x: fireX, y: H - 30 } : null);
      if (group) {
        RS.Sprites.draw(ctx, 'campfire_' + (Math.floor(this.t * 8) & 3), fireX, H - 20);
        RS.Sprites.draw(ctx, 'hero_cheer', fireX + 24, H - 20);
        const sx = compact ? fireX + 40 : 38, sy = compact ? H - 30 : H - 58;
        ['root', 'tide', 'ember'].forEach((k, i) => RS.Sprites.draw(ctx, 'sigil_' + k, sx + i * 16, sy + Math.round(Math.sin(this.t * 3 + i) * 2)));
      }
      RS.Text.draw(ctx, v.title, W / 2, compact ? 4 : 8, { font: 'large', color: P.gold5, align: 'center', outline: P.ink0 });
      const subY = compact ? 24 : 30;
      const subH = RS.Text.drawWrapped(ctx, v.sub, Math.round(W / 2 - subW / 2), subY, subW, { font: compact ? 'small' : 'body', color: P.bone7, shadow: P.ink0, lineGap: compact ? 1 : 2 });
      let y = subY + subH + 4;
      const upLine = compact ? v.upgrades + ': ' + upText : upText;
      const upH = UI.textHeight(upLine, w - 20, 'small', 1);
      const ph = compact ? rows.length * rh + upH + 12 : rows.length * rh + 22 + upH + 8;
      UI.panel(ctx, x, y, w, ph, 'dark', 0.92);
      rows.forEach(([a, b], i) => {
        RS.Text.draw(ctx, a, x + 10, y + 5 + i * rh, { font: 'body', color: P.bone6 });
        RS.Text.draw(ctx, b, x + w - 10, y + 5 + i * rh, { font: 'bold', color: i === 1 && info.record ? P.gold5 : P.emb6, align: 'right' });
      });
      if (compact) RS.Text.drawWrapped(ctx, upLine, x + 10, y + 7 + rows.length * rh, w - 20, { font: 'small', color: P.bone6, lineGap: 1 });
      else {
        RS.Text.draw(ctx, v.upgrades, x + 10, y + 8 + rows.length * rh, { font: 'small', color: P.gold4 });
        RS.Text.drawWrapped(ctx, upText, x + 10, y + 20 + rows.length * rh, w - 20, { font: 'small', color: P.bone6, lineGap: 1 });
      }
      y += ph + 8;
      if (compact) {
        this.menu.opts.horizontal = true;
        if (group) this.menu.layoutRow(W - 8 - rowW, H - 22, rowW, 18, 6);
        else this.menu.layoutRow(8, H - 22, W - 16, 18, 6);
      } else {
        this.menu.opts.horizontal = false;
        const mw = Math.min(W - 40, Math.max(180, this.menu.widest('body')));
        this.menu.layout(Math.round(W / 2 - mw / 2), y, mw, 18);
      }
      if (this.t > 1) this.menu.draw(ctx);
    }
  };

  // ---- cheats --------------------------------------------------------------------------------------
  RS.Cheats = {
    toBoss(g) {
      if (!g) return;
      for (const dg of g.world.dungeons) if (!g.run.sigils.includes(dg.index)) g.run.sigils.push(dg.index);
      const lo = g.world.lairSite.obj;
      if (lo) RS.Spawn.openLairGate(g, lo);
      g.run.talked = true;
      g.enterArena();
    }
  };

  RS.UI.SeedModal = SeedModal;
  RS.UI.drawBackdrop = drawBackdrop;
})();
