// Modal overlays: dialogue, world map, pause, settings (audio status + cheats), confirm, controls.
(function () {
  'use strict';
  const P = RS.PAL, T = RS.T, UI = RS.UI;

  // ---- dialogue ------------------------------------------------------------------------------
  class DialogModal {
    constructor(g) { this.g = g; this.pausesGame = true; this.t = 0; this.built = false; }
    build() {
      const W = RS.App.W;
      const d = this.g.dialog;
      this.bw = Math.min(W - 12, 460);
      this.tw = this.bw - 22;
      const maxLines = RS.App.H < 230 ? 3 : 4;
      // split pages into chunks that fit
      this.pages = [];
      for (const pg of d.pages) {
        const lines = RS.Text.wrap(pg, 'body', this.tw);
        for (let i = 0; i < lines.length; i += maxLines) this.pages.push(lines.slice(i, i + maxLines));
      }
      this.page = 0; this.chars = 0;
      // box fits the longest page (at least two lines) so it never jumps between pages
      this.maxLines = Math.max(2, Math.min(maxLines, Math.max(...this.pages.map((p) => p.length))));
      this.built = true;
      this.lastW = W;
    }
    update(dt) {
      if (!this.built || this.lastW !== RS.App.W) this.build();
      this.t += dt;
      const lines = this.pages[this.page];
      const total = lines.reduce((a, l) => a + Array.from(l).length, 0);
      if (this.chars < total) { const before = Math.floor(this.chars); this.chars += dt * 58; if (Math.floor(this.chars) !== before && Math.floor(this.chars) % 3 === 0) RS.Audio && RS.Audio.sfx('type'); }
      const adv = RS.Input.uiPressed('confirm') || RS.Input.mouse.pressed || RS.Input.pressed('attack');
      if (adv) {
        if (this.chars < total) this.chars = total;
        else if (this.page < this.pages.length - 1) { this.page++; this.chars = 0; RS.Audio && RS.Audio.sfx('ui_move'); }
        else this.close();
      } else if (RS.Input.uiPressed('cancel')) this.close();
    }
    close() {
      RS.App.popModal(this);
      const d = this.g.dialog;
      this.g.dialog = null;
      if (d && d.onClose) d.onClose();
    }
    render(ctx) {
      if (!this.built) this.build();
      const W = RS.App.W, H = RS.App.H;
      const lh = RS.Text.lineHeight('body') + 3;
      const bh = this.maxLines * lh + 20;
      const x = Math.round((W - this.bw) / 2), y = H - bh - 8;
      UI.panel(ctx, x, y, this.bw, bh, 'stone');
      const name = this.g.dialog ? this.g.dialog.name : '';
      if (name) {
        const nw = RS.Text.measure(name, 'bold') + 16;
        UI.panel(ctx, x + 8, y - 12, nw, 18, 'gold');
        RS.Text.draw(ctx, name, x + 16, y - 9, { font: 'bold', color: P.gold5, shadow: P.ink0 });
      }
      const lines = this.pages[this.page] || [];
      let left = Math.floor(this.chars);
      lines.forEach((ln, i) => {
        const n = Array.from(ln).length;
        if (left <= 0) return;
        RS.Text.draw(ctx, ln, x + 12, y + 11 + i * lh, { font: 'body', color: P.bone7, chars: Math.min(n, left), shadow: P.ink0 });
        left -= n;
      });
      const total = lines.reduce((a, l) => a + Array.from(l).length, 0);
      if (this.chars >= total && Math.floor(this.t * 3) % 2 === 0) {
        const last = this.page >= this.pages.length - 1;
        RS.Text.draw(ctx, last ? '■' : '▼', x + this.bw - 14, y + bh - 15, { font: 'small', color: P.emb5 });
      }
      if (this.pages.length > 1) RS.Text.draw(ctx, T.fmt(T.misc.page, { a: this.page + 1, b: this.pages.length }), x + this.bw - 22, y + 4, { font: 'small', color: P.bone4, align: 'right' });
    }
  }

  // ---- map -----------------------------------------------------------------------------------
  function mapCanvases(g, name) {
    g.mapCache = g.mapCache || {};
    const L = name === 'overworld' ? g.world.level : g.levelName === name ? g.level : null;
    if (!L) return null;
    let mc = g.mapCache[name];
    if (!mc) {
      const img = RS.MapView.build(L);
      const fog = RS.Art.makeCanvas(L.w, L.h);
      mc = { img, fog, L, dirty: true };
      g.mapCache[name] = mc;
    }
    // refresh fog from explored mask
    const ex = g.explored[name];
    const fctx = mc.fog.getContext('2d');
    const id = fctx.createImageData(L.w, L.h);
    const u = new Uint32Array(id.data.buffer);
    const c = RS.Color.c32(P.ink1);
    for (let i = 0; i < u.length; i++) if (!ex[i]) u[i] = c;
    fctx.putImageData(id, 0, 0);
    return mc;
  }
  RS.UI.mapCanvases = mapCanvases;

  function drawMarker(ctx, type, x, y, time, col) {
    x = Math.round(x); y = Math.round(y);
    if (type === 'player') {
      if (Math.floor(time * 4) % 2 === 0) { ctx.fillStyle = P.white; ctx.fillRect(x - 1, y - 1, 3, 3); }
      ctx.fillStyle = P.emb4; ctx.fillRect(x, y, 1, 1);
    } else if (type === 'camp') {
      ctx.fillStyle = P.ink0; ctx.fillRect(x - 2, y - 2, 5, 5);
      ctx.fillStyle = P.emb5; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = P.emb7; ctx.fillRect(x, y - 1, 1, 1);
    } else if (type === 'dungeon' || type === 'done') {
      ctx.fillStyle = P.ink0; ctx.fillRect(x - 3, y - 1, 7, 3); ctx.fillRect(x - 1, y - 3, 3, 7); ctx.fillRect(x - 2, y - 2, 5, 5);
      ctx.fillStyle = col; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); ctx.fillRect(x - 1, y - 1, 3, 3);
      if (type === 'done') { ctx.fillStyle = P.white; ctx.fillRect(x, y, 1, 1); }
    } else if (type === 'lair') {
      ctx.fillStyle = P.ink0; ctx.fillRect(x - 3, y - 3, 7, 7);
      ctx.fillStyle = P.heart; ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillStyle = P.ink0; ctx.fillRect(x - 1, y - 1, 3, 4);
    } else if (type === 'target') {
      const r = 4 + Math.floor(time * 6) % 3;
      ctx.fillStyle = P.gold4;
      ctx.fillRect(x - r, y, 2, 1); ctx.fillRect(x + r - 1, y, 2, 1); ctx.fillRect(x, y - r, 1, 2); ctx.fillRect(x, y + r - 1, 1, 2);
    } else if (type === 'exit') {
      ctx.fillStyle = P.ink0; ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillStyle = P.sea8; ctx.fillRect(x - 1, y - 1, 3, 3);
    } else if (type === 'sigil') {
      ctx.fillStyle = P.ink0; ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillStyle = col || P.gold4; ctx.fillRect(x - 1, y - 1, 3, 3);
    }
  }
  RS.UI.drawMarker = drawMarker;
  const THEME_COL = { moss: P.rootGlow, tide: P.tideGlow, ember: P.emberGlow };
  RS.UI.THEME_COL = THEME_COL;

  // markers for a level in tile coordinates
  function markers(g, name) {
    const out = [];
    const TS = RS.TS;
    if (name === 'overworld') {
      const w = g.world;
      out.push({ type: 'camp', tx: w.camp.tx, ty: w.camp.ty });
      const known = g.run.talked;
      for (const dg of w.dungeons) {
        const ex = g.explored.overworld[dg.entrance.ty * w.level.w + dg.entrance.tx];
        const done = g.run.sigils.includes(dg.index);
        if (known || ex) out.push({ type: done ? 'done' : 'dungeon', tx: dg.entrance.tx, ty: dg.entrance.ty, col: done ? P.gold4 : THEME_COL[dg.theme] });
      }
      if (w.lairSite) out.push({ type: 'lair', tx: w.lairSite.gateX, ty: w.lairSite.gateY });
    } else if (name.startsWith('dungeon')) {
      const d = g.dungeonData[+name.slice(7)];
      if (d) {
        out.push({ type: 'exit', tx: Math.floor(d.entryPos.x / TS), ty: Math.floor(d.entryPos.y / TS) - 1 });
        if (d.pedestal && g.explored[name][d.pedestal.ty * d.level.w + d.pedestal.tx]) out.push({ type: 'sigil', tx: d.pedestal.tx, ty: d.pedestal.ty, col: THEME_COL[d.theme] });
      }
    }
    return out;
  }
  RS.UI.mapMarkers = markers;

  class MapModal {
    constructor(g) { this.g = g; this.pausesGame = true; this.t = 0; }
    enter() { this.mc = mapCanvases(this.g, this.g.levelName); RS.Audio && RS.Audio.sfx('map'); }
    update(dt) {
      this.t += dt;
      if (RS.Input.uiPressed('cancel') || RS.Input.uiPressed('map') || RS.Input.uiPressed('confirm') || RS.Input.pressed('map') || RS.Input.mouse.pressed) RS.App.popModal(this);
    }
    // legend entries wrapped into as many centred rows as the width needs
    legend(W) {
      const g = this.g, name = g.levelName;
      const items = name === 'overworld'
        ? [['player', T.map.legendYou, P.white], ['camp', T.map.legendCamp], ['dungeons', T.map.legendDungeon], ['done', T.map.legendDone, P.gold4], ['lair', T.map.legendLair], ['target', T.map.legendGoal]]
        : name === 'arena' ? [['player', T.map.legendYou, P.white]]
          : [['player', T.map.legendYou, P.white], ['exit', T.exitStairs], ['sigil', T.hud.sigils, THEME_COL[g.dungeonData[+name.slice(7)].theme]], ['target', T.map.legendGoal]];
      const ents = items.map(([type, label, col]) => ({ type, label, col, iw: type === 'dungeons' ? 22 : type === 'target' ? 12 : 9 }));
      ents.push({ type: null, label: T.fmt(T.map.close, { key: RS.Input.keyLabel('map') }), iw: 0, close: true });
      for (const e of ents) e.w = e.iw + RS.Text.measure(e.label, 'small');
      const maxW = W - 28, gap = 12;
      const rows = [];
      let cur = [], cw = 0;
      for (const e of ents) {
        const add = (cur.length ? gap : 0) + e.w;
        if (cur.length && cw + add > maxW) { rows.push({ ents: cur, w: cw }); cur = []; cw = 0; }
        cw += (cur.length ? gap : 0) + e.w; cur.push(e);
      }
      if (cur.length) rows.push({ ents: cur, w: cw });
      return { rows, gap, h: rows.length * 13 + 5, w: Math.max(...rows.map((r) => r.w)) };
    }
    render(ctx) {
      const W = RS.App.W, H = RS.App.H, g = this.g, mc = this.mc;
      UI.veil(ctx, 0.82);
      if (!mc) return;
      const L = mc.L;
      const lg = this.legend(W);
      const titleH = 22, legendH = lg.h + 4;
      const availW = W - 16, availH = H - titleH - legendH - 12;
      let s = Math.floor(Math.min(availW / L.w, availH / L.h) * 2) / 2;
      if (s >= 1) s = Math.floor(s); else s = Math.max(0.5, s);
      const mw = Math.round(L.w * s), mh = Math.round(L.h * s);
      const mx = Math.round((W - mw) / 2), my = titleH + 4 + Math.round((availH - mh) / 2);
      UI.panel(ctx, mx - 5, my - 5, mw + 10, mh + 10, 'stone');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(mc.img, mx, my, mw, mh);
      ctx.drawImage(mc.fog, mx, my, mw, mh);
      const title = g.levelName === 'overworld' ? T.map.title : g.levelName === 'arena' ? T.lairName : T.dungeons[g.dungeonData[+g.levelName.slice(7)].theme].name;
      RS.Text.draw(ctx, title, W / 2, 5, { font: 'bold', color: P.gold5, align: 'center', shadow: P.ink0 });
      // region names on explored hubs
      if (g.levelName === 'overworld') {
        for (const r of g.world.regions) {
          if (!g.explored.overworld[r.hub.y * L.w + r.hub.x]) continue;
          RS.Text.draw(ctx, r.name, mx + r.hub.x * s, my + r.hub.y * s - 6, { font: 'small', color: P.bone6, outline: P.ink0, align: 'center' });
        }
      }
      for (const m of markers(g, g.levelName)) drawMarker(ctx, m.type, mx + (m.tx + 0.5) * s, my + (m.ty + 0.5) * s, this.t, m.col);
      const ob = g.objective();
      if (ob.x !== null && ob.x !== undefined) drawMarker(ctx, 'target', mx + ob.x / RS.TS * s, my + ob.y / RS.TS * s, this.t);
      drawMarker(ctx, 'player', mx + g.player.x / RS.TS * s, my + g.player.y / RS.TS * s, this.t);
      // legend on its own panel so nothing from the game view shows through the labels
      const pw = lg.w + 16, py = H - lg.h - 6;
      UI.panel(ctx, Math.round(W / 2 - pw / 2), py, pw, lg.h + 2, 'dark');
      lg.rows.forEach((row, ri) => {
        let x = Math.round(W / 2 - row.w / 2);
        const ly = py + 3 + ri * 13;
        for (const e of row.ents) {
          if (e.type === 'dungeons') ['moss', 'tide', 'ember'].forEach((th, k) => drawMarker(ctx, 'dungeon', x + 3 + k * 7, ly + 6, 0, THEME_COL[th]));
          else if (e.type === 'target') drawMarker(ctx, 'target', x + 5, ly + 6, 0);
          else if (e.type) drawMarker(ctx, e.type, x + 3, ly + 6, 0.2, e.col);
          RS.Text.draw(ctx, e.label, x + e.iw, ly + 1, { font: 'small', color: e.close ? P.gold4 : P.bone5 });
          x += e.w + lg.gap;
        }
      });
    }
  }

  // ---- confirm -------------------------------------------------------------------------------
  class ConfirmModal {
    constructor(title, sub, onYes, onNo) {
      this.pausesGame = true;
      this.title = title; this.sub = sub;
      this.menu = new UI.Menu([
        { label: T.pause.no, action: () => { RS.App.popModal(this); onNo && onNo(); } },
        { label: T.pause.yes, danger: true, action: () => { RS.App.popModal(this); onYes && onYes(); } }
      ], { center: true, onCancel: () => { RS.App.popModal(this); onNo && onNo(); } });
    }
    update() { this.menu.update(); }
    render(ctx) {
      const W = RS.App.W, H = RS.App.H;
      UI.veil(ctx, 0.5);
      const w = Math.min(W - 20, Math.max(220, RS.Text.measure(this.title, 'bold') + 40));
      const subH = this.sub ? UI.textHeight(this.sub, w - 24, 'small', 2) : 0;
      const h = 34 + subH + 2 * 20 + 14;
      const x = Math.round((W - w) / 2), y = Math.round((H - h) / 2);
      UI.panel(ctx, x, y, w, h, 'stone');
      RS.Text.draw(ctx, this.title, W / 2, y + 10, { font: 'bold', color: P.gold5, align: 'center', shadow: P.ink0 });
      if (this.sub) RS.Text.drawWrapped(ctx, this.sub, x + 12, y + 28, w - 24, { font: 'small', color: P.bone5 });
      const bw = Math.min(160, w - 40);
      this.menu.layout(Math.round(W / 2 - bw / 2), y + 32 + subH, bw, 18);
      this.menu.draw(ctx);
    }
  }

  // ---- controls ------------------------------------------------------------------------------
  class ControlsModal {
    constructor() { this.pausesGame = true; }
    update() { if (RS.Input.uiPressed('cancel') || RS.Input.uiPressed('confirm') || RS.Input.mouse.pressed) { RS.App.popModal(this); RS.Audio && RS.Audio.sfx('ui_back'); } }
    // regular layout first; short screens fall back to small labels, tighter rows and the close
    // hint moved up beside the title, and only if that still does not fit the tip is left out
    measure(W, H) {
      const rows = T.controls.rows;
      const closeHint = RS.Input.keyLabel('cancel') + ' ' + T.misc.close;
      const variant = (f1, rowMin, pad, compact, tip) => {
        let c1 = 0, c2 = 0;
        for (const [a, b] of rows) { c1 = Math.max(c1, RS.Text.measure(a, f1)); c2 = Math.max(c2, RS.Text.measure(b, 'small')); }
        const w = Math.min(W - 12, c1 + c2 + 44);
        const col2W = w - c1 - 38;
        const rowHs = rows.map(([, b]) => Math.max(rowMin, UI.textHeight(b, col2W, 'small', 1) + pad));
        const tipH = tip ? UI.textHeight(T.controls.tip, w - 24, 'small', 1) + 4 : 0;
        const head = compact ? 24 : 28, foot = compact ? 6 : 20;
        const h = head + rowHs.reduce((a, b) => a + b, 0) + tipH + foot;
        return { f1, c1, w, col2W, rowHs, tipH, h, head, compact, tip, closeHint };
      };
      let v = variant('body', 15, 3, false, true);
      if (v.h > H - 8) v = variant('small', 12, 0, true, true);
      if (v.h > H - 8) v = variant('small', 12, 0, true, false);
      return v;
    }
    render(ctx) {
      const W = RS.App.W, H = RS.App.H;
      UI.veil(ctx, 0.72);
      const rows = T.controls.rows;
      const v = this.measure(W, H);
      const { w, h, c1, col2W } = v;
      const x = Math.round((W - w) / 2), y = Math.max(4, Math.round((H - h) / 2));
      UI.panel(ctx, x, y, w, h, 'stone');
      RS.Text.draw(ctx, T.controls.title, W / 2, y + (v.compact ? 6 : 8), { font: 'bold', color: P.gold5, align: 'center', shadow: P.ink0 });
      let yy = y + v.head;
      const lh = v.f1 === 'body' ? 0 : 1;
      rows.forEach(([a, b], i) => {
        RS.Text.draw(ctx, a, x + 14, yy + lh, { font: v.f1, color: P.bone6 });
        RS.Text.drawWrapped(ctx, b, x + 24 + c1, yy + (v.f1 === 'body' ? 2 : 1), col2W, { font: 'small', color: P.gold4, lineGap: 1 });
        yy += v.rowHs[i];
      });
      if (v.tip) RS.Text.drawWrapped(ctx, T.controls.tip, x + 12, yy + 4, w - 24, { font: 'small', color: P.emb6, lineGap: 1 });
      if (v.compact) RS.Text.draw(ctx, v.closeHint, x + w - 10, y + 7, { font: 'small', color: P.bone4, align: 'right' });
      else RS.Text.draw(ctx, v.closeHint, x + w - 10, y + h - 14, { font: 'small', color: P.bone4, align: 'right' });
    }
  }

  // ---- settings ------------------------------------------------------------------------------
  class SettingsModal {
    constructor(game) {
      this.pausesGame = true;
      this.g = game || null;
      const S = RS.Save.data.settings;
      const st = T.settings;
      const set = (k) => (v) => { S[k] = v; RS.Save.save(); RS.Audio && RS.Audio.applySettings(); };
      const items = [
        { type: 'toggle', label: st.music, get: () => S.music, set: set('music') },
        { type: 'slider', label: st.musicVol, get: () => S.musicVol, set: set('musicVol') },
        { type: 'toggle', label: st.sfx, get: () => S.sfx, set: set('sfx') },
        { type: 'slider', label: st.sfxVol, get: () => S.sfxVol, set: set('sfxVol') },
        { type: 'toggle', label: st.ambient, get: () => S.ambient, set: set('ambient') },
        { type: 'toggle', label: st.shake, get: () => S.shake, set: set('shake') },
        { type: 'toggle', label: st.hints, get: () => S.hints, set: set('hints') },
        { type: 'label', label: st.cheats },
        { type: 'toggle', label: st.god, get: () => RS.Save.data.cheats.godMode, set: (v) => { RS.Save.data.cheats.godMode = v; RS.Save.save(); if (this.g) this.g.godMode = v; } },
        { label: st.addEmbers, action: () => { RS.Save.data.currency += 100; RS.Save.save(); this.flashMsg = T.toast.cheatEmbers; this.flashT = 2; RS.Audio && RS.Audio.sfx('coins'); } },
        { label: st.toBoss, disabled: !this.g, action: () => { if (!this.g) return; RS.App.modals.length = 0; RS.Cheats.toBoss(this.g); } },
        { label: st.reset, danger: true, action: () => {
          RS.App.pushModal(new ConfirmModal(st.resetConfirm, st.resetSub, () => { RS.Save.reset(); this.flashMsg = st.resetDone; this.flashT = 2; if (this.g) this.g.godMode = false; }));
        } },
        { label: st.back, action: () => RS.App.popModal(this), gap: 4 }
      ];
      this.menu = new UI.Menu(items, { onCancel: () => RS.App.popModal(this) });
      this.t = 0;
    }
    update(dt) {
      this.t += dt;
      if (this.flashT > 0) this.flashT -= dt;
      this.menu.update();
    }
    audioStatus() {
      const st = T.settings;
      const A = RS.Audio;
      if (!A || !A.supported) return st.audioNone;
      if (!A.unlocked) return st.audioWait;
      if (!RS.Save.data.settings.music && RS.Save.data.settings.sfx) return st.audioMusicOff;
      return st.audioOn;
    }
    render(ctx) {
      const W = RS.App.W, H = RS.App.H;
      UI.veil(ctx, 0.72);
      const w = Math.min(W - 12, Math.max(250, this.menu.widest('body') + 20));
      const status = T.settings.audio + ': ' + this.audioStatus();
      const h = Math.min(H - 8, 60 + this.menu.items.length * 20);
      const x = Math.round((W - w) / 2), y = Math.round((H - h) / 2);
      UI.panel(ctx, x, y, w, h, 'stone');
      RS.Text.draw(ctx, T.settings.title, W / 2, y + 7, { font: 'bold', color: P.gold5, align: 'center', shadow: P.ink0 });
      RS.Text.draw(ctx, UI.fitText(status, 'small', w - 20), W / 2, y + 23, { font: 'small', color: RS.Audio && RS.Audio.unlocked ? P.moss8 : P.emb6, align: 'center' });
      // list stops above the key help line; it scrolls in whole rows with a scrollbar when short
      const navY = y + h - 15;
      this.menu.layout(x + 8, y + 38, w - 16, 18, navY - 3 - (y + 38));
      this.menu.draw(ctx);
      ctx.fillStyle = P.ink3; ctx.fillRect(x + 8, navY - 2, w - 16, 1);
      RS.Text.draw(ctx, UI.fitText(T.settings.navHelp, 'small', w - 16), W / 2, navY + 1, { font: 'small', color: P.bone3, align: 'center' });
      if (this.flashT > 0) {
        const mw = RS.Text.measure(this.flashMsg, 'body') + 20;
        UI.panel(ctx, W / 2 - mw / 2, y - 10, mw, 18, 'gold');
        RS.Text.draw(ctx, this.flashMsg, W / 2, y - 7, { font: 'body', color: P.gold5, align: 'center' });
      }
    }
  }

  // ---- pause -----------------------------------------------------------------------------------
  class PauseModal {
    constructor(g) {
      this.g = g; this.pausesGame = true;
      const pt = T.pause;
      const items = [
        { label: pt.resume, action: () => RS.App.popModal(this) },
        { label: pt.map, action: () => { RS.App.popModal(this); RS.App.pushModal(new MapModal(g)); } },
        { label: pt.settings, action: () => RS.App.pushModal(new SettingsModal(g)) },
        { label: pt.controls, action: () => RS.App.pushModal(new ControlsModal()) }
      ];
      if (g.levelName.startsWith('dungeon')) items.push({ label: pt.exitDungeon, action: () => { RS.App.popModal(this); g.exitDungeon(); } });
      items.push({ label: pt.abandon, danger: true, action: () => RS.App.pushModal(new ConfirmModal(pt.confirmAbandon, pt.confirmAbandonSub, () => { RS.App.modals.length = 0; g.abandon(); })) });
      items.push({ label: pt.toTitle, action: () => RS.App.pushModal(new ConfirmModal(pt.confirmTitle, pt.confirmTitleSub, () => { RS.App.modals.length = 0; g.saveRun(); RS.Audio && RS.Audio.stopMusic(0.5); RS.App.setScene('title'); })) });
      this.menu = new UI.Menu(items, { center: true, onCancel: () => RS.App.popModal(this) });
    }
    enter() { RS.Audio && RS.Audio.sfx('pause'); RS.Audio && RS.Audio.duckMusic(0, 0.45); }
    exit() { RS.Audio && RS.Audio.duckMusic(0, 1); }
    update() {
      if (RS.Input.uiPressed('cancel') && false) return;
      this.menu.update();
    }
    render(ctx) {
      const W = RS.App.W, H = RS.App.H, g = this.g;
      UI.veil(ctx, 0.6);
      const w = Math.min(W - 16, Math.max(220, this.menu.widest('body') + 30));
      const h = 50 + this.menu.items.length * 20 + 6;
      const x = Math.round((W - w) / 2), y = Math.max(4, Math.round((H - h) / 2));
      UI.panel(ctx, x, y, w, h, 'stone');
      RS.Text.draw(ctx, T.pause.title, W / 2, y + 8, { font: 'bold', color: P.gold5, align: 'center', shadow: P.ink0 });
      const info = T.fmt(T.pause.info, { seed: g.seed, time: RS.formatTime(g.runTime), sig: g.run.sigils.length });
      RS.Text.draw(ctx, info, W / 2, y + 25, { font: 'small', color: P.bone4, align: 'center' });
      this.menu.layout(x + 12, y + 42, w - 24, 18);
      this.menu.draw(ctx);
    }
  }

  Object.assign(RS.UI, { DialogModal, MapModal, ConfirmModal, ControlsModal, SettingsModal, PauseModal });
})();
