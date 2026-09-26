// Canvas pixel UI toolkit: 9-slice frames, buttons, menus with keyboard/mouse/gamepad, fades, warnings.
(function () {
  'use strict';
  const P = RS.PAL;
  const frames = {};

  function makeFrame(style) {
    // 12x12 source; corners 4px
    const b = new RS.Art.PixBuf(12, 12);
    const s = {
      stone: { o: P.ink0, a: P.bone4, hl: P.bone6, sh: P.bone2, fill: P.ink2, rivet: P.gold3 },
      dark: { o: P.ink0, a: P.ink4, hl: P.ink5, sh: P.ink3, fill: P.ink1, rivet: null },
      gold: { o: P.ink0, a: P.gold2, hl: P.gold4, sh: P.gold1, fill: P.ink2, rivet: P.gold5 },
      ember: { o: P.ink0, a: P.emb3, hl: P.emb5, sh: P.emb1, fill: P.ink1, rivet: P.emb6 },
      paper: { o: P.ink0, a: P.earth4, hl: P.earth6, sh: P.earth2, fill: '#2a2320', rivet: P.gold3 }
    }[style];
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      const edge = x === 0 || y === 0 || x === 11 || y === 11;
      const inner = x === 1 || y === 1 || x === 10 || y === 10;
      const hl2 = x === 2 || y === 2;
      let c = s.fill;
      if (edge) c = s.o;
      else if (inner) c = (x === 1 || y === 1) ? s.hl : s.sh;
      else if (hl2 && (x === 2 && y > 1 && y < 10 || y === 2 && x > 1 && x < 10)) c = s.a;
      b.set(x, y, c);
    }
    // rounded corners
    for (const [x, y] of [[0, 0], [11, 0], [0, 11], [11, 11]]) b.set(x, y, null);
    if (s.rivet) for (const [x, y] of [[2, 2], [9, 2], [2, 9], [9, 9]]) b.set(x, y, s.rivet);
    return { cv: b.toCanvas(), fill: s.fill };
  }
  function buildFrames() { for (const st of ['stone', 'dark', 'gold', 'ember', 'paper']) frames[st] = makeFrame(st); }

  function panel(ctx, x, y, w, h, style, alpha) {
    const f = frames[style || 'dark'];
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    const c = 4;
    const cv = f.cv;
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.fillStyle = f.fill;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    // corners
    ctx.drawImage(cv, 0, 0, c, c, x, y, c, c);
    ctx.drawImage(cv, 12 - c, 0, c, c, x + w - c, y, c, c);
    ctx.drawImage(cv, 0, 12 - c, c, c, x, y + h - c, c, c);
    ctx.drawImage(cv, 12 - c, 12 - c, c, c, x + w - c, y + h - c, c, c);
    // edges
    ctx.drawImage(cv, c, 0, 12 - 2 * c, c, x + c, y, w - 2 * c, c);
    ctx.drawImage(cv, c, 12 - c, 12 - 2 * c, c, x + c, y + h - c, w - 2 * c, c);
    ctx.drawImage(cv, 0, c, c, 12 - 2 * c, x, y + c, c, h - 2 * c);
    ctx.drawImage(cv, 12 - c, c, c, 12 - 2 * c, x + w - c, y + c, c, h - 2 * c);
    if (alpha !== undefined) ctx.globalAlpha = 1;
  }

  // Dithered-free pixel fade: grows square blocks from the centre outward
  function pixelFade(ctx, W, H, a, color) {
    if (a <= 0) return;
    ctx.fillStyle = color || P.black;
    if (a >= 0.999) { ctx.fillRect(0, 0, W, H); return; }
    const bs = 8;
    const cx = W / 2, cy = H / 2, maxD = Math.hypot(cx, cy);
    for (let y = 0; y < H; y += bs) for (let x = 0; x < W; x += bs) {
      const d = Math.hypot(x + bs / 2 - cx, y + bs / 2 - cy) / maxD;
      const local = RS.M.clamp(a * 1.6 - (1 - d) * 0.6, 0, 1);
      if (local <= 0) continue;
      const s = Math.ceil(bs * local);
      ctx.fillRect(x + ((bs - s) >> 1), y + ((bs - s) >> 1), s, s);
    }
  }

  // telegraph ring: dashed outline + filling disc, k = 0..1 progress
  function warnCircle(ctx, x, y, r, k, time, color) {
    x = Math.round(x); y = Math.round(y);
    const col = color || P.emb4;
    const ry = r * 0.62;
    ctx.globalAlpha = 0.22 + 0.25 * k;
    ctx.fillStyle = col;
    const ir = r * k, iry = ry * k;
    for (let yy = -Math.ceil(iry); yy <= Math.ceil(iry); yy++) {
      const w = Math.floor(ir * Math.sqrt(Math.max(0, 1 - (yy * yy) / Math.max(1, iry * iry))));
      ctx.fillRect(x - w, y + yy, w * 2 + 1, 1);
    }
    ctx.globalAlpha = 0.9;
    const n = Math.max(12, Math.round(r * 1.2));
    for (let i = 0; i < n; i++) {
      if ((i + Math.floor(time * 10)) % 3 === 0) continue;
      const a = i / n * Math.PI * 2;
      ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * ry), 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  function keyCap(ctx, label, x, y, color) {
    const w = RS.Text.measure(label, 'small') + 6;
    panel(ctx, x, y, Math.max(12, w), 13, 'dark');
    RS.Text.draw(ctx, label, x + Math.max(12, w) / 2, y + 1, { font: 'small', color: color || P.gold4, align: 'center' });
    return Math.max(12, w);
  }

  // ---- menu ------------------------------------------------------------------------------
  class Menu {
    constructor(items, opts) {
      this.items = items;
      this.opts = opts || {};
      this.sel = 0;
      while (this.items[this.sel] && (this.items[this.sel].disabled || this.items[this.sel].type === 'label')) this.sel++;
      this.rects = [];
      this.scroll = 0;
    }
    labelOf(it) {
      if (typeof it.label === 'function') return it.label();
      return it.label;
    }
    valueOf(it) {
      if (it.type === 'toggle') return it.get() ? RS.T.settings.on : RS.T.settings.off;
      if (it.type === 'slider') return Math.round(it.get() * 10) + '/10';
      if (it.value) return typeof it.value === 'function' ? it.value() : it.value;
      return null;
    }
    layout(x, y, w, rowH, maxH) {
      this.rects = [];
      rowH = rowH || 18;
      let yy = y, lastGap = 0;
      for (const it of this.items) {
        const h = it.type === 'label' ? 14 : rowH;
        this.rects.push({ x, y: yy, w, h });
        lastGap = it.gap || 2;
        yy += h + lastGap;
      }
      this.totalH = yy - y - lastGap;
      this.viewY = y; this.viewH = this.totalH;
      this.scrolls = !!(maxH && maxH < this.totalH);
      if (this.scrolls) {
        // show whole rows only: snap the viewport to the row pitch so scrolling never cuts a label,
        // and give up a thin gutter on the right for the scrollbar
        const pitch = rowH + 2;
        this.viewH = Math.max(rowH, Math.floor((maxH + 2) / pitch) * pitch - 2);
        for (const r of this.rects) r.w -= 7;
        this.sbX = x + w - 4;
      }
      // keep selection visible
      const r = this.rects[this.sel];
      if (r) {
        if (r.y - this.scroll < y) this.scroll = r.y - y;
        if (r.y + r.h - this.scroll > y + this.viewH) this.scroll = r.y + r.h - y - this.viewH;
      }
      this.scroll = RS.M.clamp(this.scroll, 0, Math.max(0, this.totalH - this.viewH));
    }
    // natural width of the items laid out as one row
    rowWidth(gap) {
      gap = gap === undefined ? 4 : gap;
      return this.items.reduce((a, it) => a + RS.Text.measure(this.labelOf(it), 'body') + 24, 0) + gap * (this.items.length - 1);
    }
    // single row of buttons sized to their labels (no scrolling); left/right moves between them
    layoutRow(x, y, maxW, h, gap) {
      gap = gap === undefined ? 4 : gap;
      const nat = this.items.map((it) => RS.Text.measure(this.labelOf(it), 'body') + 24);
      const sum = nat.reduce((a, b) => a + b, 0) + gap * (nat.length - 1);
      const extra = Math.max(0, Math.floor((maxW - sum) / nat.length));
      this.rects = [];
      let xx = x + Math.max(0, Math.floor((maxW - sum - extra * nat.length) / 2));
      for (const n of nat) { this.rects.push({ x: xx, y, w: n + extra, h }); xx += n + extra + gap; }
      this.viewY = y; this.viewH = h; this.totalH = h; this.scroll = 0;
      return sum <= maxW;
    }
    move(d) {
      const n = this.items.length;
      let s = this.sel;
      for (let k = 0; k < n; k++) {
        s = (s + d + n) % n;
        const it = this.items[s];
        if (!it.disabled && it.type !== 'label') { this.sel = s; RS.Audio && RS.Audio.sfx('ui_move'); return; }
      }
    }
    update() {
      const I = RS.Input;
      const hz = this.opts.horizontal;
      if (I.uiPressed(hz ? 'left' : 'up')) this.move(-1);
      if (I.uiPressed(hz ? 'right' : 'down')) this.move(1);
      const it = this.items[this.sel];
      const m = I.mouse;
      if (m.moved || m.pressed) {
        this.rects.forEach((r, i) => {
          const itm = this.items[i];
          if (itm.disabled || itm.type === 'label') return;
          if (m.x >= r.x && m.x < r.x + r.w && m.y >= r.y - this.scroll && m.y < r.y - this.scroll + r.h && m.y >= this.viewY && m.y < this.viewY + this.viewH) {
            if (this.sel !== i && m.moved) { this.sel = i; }
            if (m.pressed) { this.sel = i; this.activate(this.items[i], m.x > r.x + r.w / 2 ? 1 : -1, true); }
          }
        });
      }
      if (m.wheel && this.totalH > this.viewH) {
        // wheel steps from row start to row start so rows stay whole
        const starts = this.rects.map((r) => r.y - this.viewY);
        let s = this.scroll;
        if (m.wheel > 0) { const n = starts.find((v) => v > this.scroll + 0.5); s = n === undefined ? this.totalH : n; }
        else { const prev = starts.filter((v) => v < this.scroll - 0.5); s = prev.length ? prev[prev.length - 1] : 0; }
        this.scroll = RS.M.clamp(s, 0, this.totalH - this.viewH);
      }
      if (!it) return;
      if (it.type === 'slider' || it.type === 'toggle') {
        if (I.uiPressed('left')) this.adjust(it, -1);
        if (I.uiPressed('right')) this.adjust(it, 1);
      }
      if (I.uiPressed('confirm')) this.activate(it, 1, false);
      if (I.uiPressed('cancel') && this.opts.onCancel) { RS.Audio && RS.Audio.sfx('ui_back'); this.opts.onCancel(); }
    }
    adjust(it, d) {
      if (it.type === 'toggle') { it.set(!it.get()); RS.Audio && RS.Audio.sfx('ui_toggle'); }
      else if (it.type === 'slider') { it.set(RS.M.clamp(Math.round((it.get() + d * 0.1) * 10) / 10, 0, 1)); RS.Audio && RS.Audio.sfx('ui_move'); }
    }
    activate(it, d, mouse) {
      if (!it || it.disabled) return;
      if (it.type === 'toggle') return this.adjust(it, 1);
      if (it.type === 'slider') return this.adjust(it, mouse ? d : 1);
      RS.Audio && RS.Audio.sfx('ui_ok');
      if (it.action) it.action();
    }
    draw(ctx) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, this.viewY - 2, RS.App.W, this.viewH + 4); ctx.clip();
      this.items.forEach((it, i) => {
        const r = this.rects[i];
        if (!r) return;
        const y = r.y - this.scroll;
        // only whole rows are drawn; a half-visible row would cut its label
        if (y < this.viewY - 2 || y + r.h > this.viewY + this.viewH + 2) return;
        if (it.type === 'label') {
          RS.Text.draw(ctx, this.labelOf(it), r.x + 2, y + 1, { font: 'small', color: P.gold3 });
          return;
        }
        const focus = i === this.sel && !this.opts.inactive;
        const style = it.danger ? (focus ? 'ember' : 'dark') : focus ? 'gold' : 'dark';
        panel(ctx, r.x, y, r.w, r.h, style);
        const col = it.disabled ? P.bone2 : focus ? P.gold5 : P.bone6;
        const label = this.labelOf(it);
        const val = this.valueOf(it);
        const ty = y + Math.floor((r.h - 12) / 2);
        if (focus) RS.Text.draw(ctx, '▶', r.x + 5, ty + 1, { font: 'small', color: P.emb5 });
        const lx = r.x + 17;
        if (val !== null) {
          const vw = RS.Text.measure(val, 'body');
          const maxLabel = r.w - 28 - vw;
          RS.Text.draw(ctx, fitText(label, 'body', maxLabel), lx, ty, { font: 'body', color: col, shadow: P.ink0 });
          RS.Text.draw(ctx, val, r.x + r.w - 8, ty, { font: 'body', color: focus ? P.emb6 : P.bone5, align: 'right', shadow: P.ink0 });
          if (it.type === 'slider') {
            // pixel bar
            const bw = Math.min(60, r.w * 0.25);
            void bw;
          }
        } else {
          if (this.opts.center) {
            // centred label, nudged right when focused so it never touches the ▶ marker
            const lbl = fitText(label, 'body', r.w - 20);
            const lw = RS.Text.measure(lbl, 'body');
            let cx = r.x + r.w / 2 + (focus ? 3 : 0);
            if (focus) cx = Math.min(Math.max(cx, r.x + 18 + lw / 2), r.x + r.w - 4 - lw / 2);
            RS.Text.draw(ctx, lbl, Math.round(cx), ty, { font: 'body', color: col, align: 'center', shadow: P.ink0 });
          }
          else RS.Text.draw(ctx, fitText(label, 'body', r.w - 22), lx, ty, { font: 'body', color: col, shadow: P.ink0 });
        }
      });
      ctx.restore();
      if (this.scrolls) scrollbar(ctx, this.sbX, this.viewY, this.viewH, this.scroll, this.totalH);
    }
    widest(font) {
      let w = 0;
      for (const it of this.items) {
        const l = this.labelOf(it) || '';
        const v = this.valueOf(it);
        w = Math.max(w, RS.Text.measure(l, font || 'body') + (v ? RS.Text.measure(v, 'body') + 18 : 0));
      }
      return w + 30;
    }
  }

  // 3px scrollbar: dark track, gold thumb sized to the visible fraction
  function scrollbar(ctx, x, y, h, scroll, total) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = P.ink0; ctx.fillRect(x - 1, y - 1, 5, h + 2);
    ctx.fillStyle = P.ink3; ctx.fillRect(x, y, 3, h);
    const th = Math.max(6, Math.round(h * h / total));
    const ty = y + Math.round((h - th) * RS.M.clamp(scroll / Math.max(1, total - h), 0, 1));
    ctx.fillStyle = P.gold3; ctx.fillRect(x, ty, 3, th);
    ctx.fillStyle = P.gold5; ctx.fillRect(x, ty, 1, th);
  }

  // shrink text with an ellipsis if it does not fit (last resort — layouts size to content first)
  function fitText(s, font, maxW) {
    if (RS.Text.measure(s, font) <= maxW) return s;
    let out = '';
    for (const ch of s) { if (RS.Text.measure(out + ch + '…', font) > maxW) break; out += ch; }
    return out + '…';
  }

  // dark veil behind modals
  function veil(ctx, a) {
    ctx.globalAlpha = a === undefined ? 0.62 : a;
    ctx.fillStyle = P.ink0; ctx.fillRect(0, 0, RS.App.W, RS.App.H);
    ctx.globalAlpha = 1;
  }

  // text block helper: wrapped lines centred in a panel; returns height
  function textBlock(ctx, text, x, y, w, opts) {
    return RS.Text.drawWrapped(ctx, text, x, y, w, Object.assign({ font: 'body', color: P.bone6 }, opts || {}));
  }
  function textHeight(text, w, font, gap) {
    const lines = RS.Text.wrap(text, font || 'body', w);
    return lines.length * (RS.Text.lineHeight(font || 'body') + (gap === undefined ? 2 : gap));
  }

  RS.UI = Object.assign(RS.UI || {}, { buildFrames, panel, pixelFade, warnCircle, keyCap, Menu, fitText, veil, textBlock, textHeight, scrollbar, frames });
})();
