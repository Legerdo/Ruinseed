// Pixel-perfect bitmap text renderer using packed Galmuri glyphs (full Hangul coverage).
(function () {
  'use strict';
  const fonts = {};
  // top trim: empty rows above the tallest common glyph; box: line box height used for layout
  const LAYOUT = {
    body: { trim: 2, box: 14 },
    bold: { trim: 2, box: 14 },
    small: { trim: 1, box: 11 },
    large: { trim: 3, box: 18 }
  };

  function b64ToBytes(s) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function init() {
    const data = RS.FONT_DATA;
    if (!data) throw new Error('font data missing');
    for (const name of Object.keys(data)) {
      const d = data[name];
      const meta = b64ToBytes(d.meta);
      const bits = b64ToBytes(d.bits);
      const map = new Map();
      let gi = 0, off = 0;
      for (const r of d.ranges) {
        for (let k = 0; k < r[1]; k++) {
          const m = gi * 5;
          const g = { dw: meta[m], w: meta[m + 1], h: meta[m + 2], xo: meta[m + 3] - 16, yo: meta[m + 4] - 16, off };
          off += g.w * g.h;
          map.set(r[0] + k, g);
          gi++;
        }
      }
      const lay = LAYOUT[name] || { trim: 0, box: d.ascent + d.descent };
      fonts[name] = { name, ascent: d.ascent, descent: d.descent, map, bits, trim: lay.trim, box: lay.box };
    }
    // bold falls back to body glyphs for anything missing; large falls back to bold/body
    fonts.bold.fallback = fonts.body;
    fonts.large.fallback = fonts.bold;
    fonts.small.fallback = fonts.body;
  }

  function glyph(font, cp) {
    let f = font;
    while (f) {
      const g = f.map.get(cp);
      if (g) return { g, f };
      f = f.fallback;
    }
    // last resort: question mark from the requested font
    const q = font.map.get(63) || fonts.body.map.get(63);
    return { g: q, f: font.map.get(63) ? font : fonts.body };
  }

  function measure(text, fontName, bold) {
    const font = fonts[fontName || 'body'];
    let w = 0;
    for (const ch of String(text)) {
      const cp = ch.codePointAt(0);
      if (cp === 10) continue;
      w += glyph(font, cp).g.dw + (bold ? 1 : 0);
    }
    return w;
  }

  function lineHeight(fontName) { return fonts[fontName || 'body'].box; }

  // Word-aware wrapping. Korean text breaks at spaces; long tokens break per character.
  function wrap(text, fontName, maxW, bold) {
    const out = [];
    const paragraphs = String(text).split('\n');
    for (const para of paragraphs) {
      if (para === '') { out.push(''); continue; }
      const words = para.split(' ');
      let line = '';
      const pushWord = (word) => {
        const candidate = line === '' ? word : line + ' ' + word;
        if (measure(candidate, fontName, bold) <= maxW) { line = candidate; return; }
        if (line !== '') { out.push(line); line = ''; }
        if (measure(word, fontName, bold) <= maxW) { line = word; return; }
        // break long token by characters (never split a character)
        let part = '';
        for (const ch of word) {
          if (measure(part + ch, fontName, bold) > maxW && part !== '') {
            // keep closing punctuation with the previous chunk
            out.push(part); part = ch;
          } else part += ch;
        }
        line = part;
      };
      for (const w of words) pushWord(w);
      out.push(line);
    }
    return out;
  }

  const cache = new Map();
  const CACHE_MAX = 900;

  // Renders one line to a small canvas. Returns {canvas, w, h, ox, oy, xs}
  function renderLine(text, o) {
    const fontName = o.font || 'body';
    const key = fontName + '|' + (o.color || '') + '|' + (o.outline || '') + '|' + (o.shadow || '') + '|' + (o.bold ? 1 : 0) + '|' + text;
    let e = cache.get(key);
    if (e) { cache.delete(key); cache.set(key, e); return e; }
    const font = fonts[fontName];
    const bold = !!o.bold;
    const pad = o.outline ? 1 : 0;
    const shadowPad = o.shadow ? 1 : 0;
    const chars = Array.from(String(text));
    let tw = 0;
    const xs = [];
    for (const ch of chars) { xs.push(tw); tw += glyph(font, ch.codePointAt(0)).g.dw + (bold ? 1 : 0); }
    xs.push(tw);
    const w = Math.max(1, tw + pad * 2 + shadowPad + (bold ? 1 : 0));
    const h = font.box + pad * 2 + shadowPad + 2;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(w, h);
    const u32 = new Uint32Array(img.data.buffer);
    const mask = new Uint8Array(w * h);
    const baseline = font.ascent - font.trim;
    let pen = 0;
    for (const ch of chars) {
      const { g, f } = glyph(font, ch.codePointAt(0));
      const top = baseline - g.yo - g.h;
      for (let gy = 0; gy < g.h; gy++) {
        for (let gx = 0; gx < g.w; gx++) {
          const bi = g.off + gy * g.w + gx;
          if ((f.bits[bi >> 3] >> (7 - (bi & 7))) & 1) {
            const px = pad + pen + g.xo + gx, py = pad + top + gy;
            if (px >= 0 && py >= 0 && px < w && py < h) mask[py * w + px] = 1;
            if (bold && px + 1 < w && py >= 0 && py < h) mask[py * w + px + 1] = 1;
          }
        }
      }
      pen += g.dw + (bold ? 1 : 0);
    }
    const C = RS.Color.c32;
    if (o.shadow) {
      const sc = C(o.shadow);
      const sx = o.shadowX === 0 ? 0 : 1;
      for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - sx; x++) if (mask[y * w + x]) u32[(y + 1) * w + x + sx] = sc;
    }
    if (o.outline) {
      const oc = C(o.outline);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (!mask[ny * w + nx]) u32[ny * w + nx] = oc;
        }
      }
    }
    const fc = C(o.color || '#ffffff');
    for (let i = 0; i < mask.length; i++) if (mask[i]) u32[i] = fc;
    ctx.putImageData(img, 0, 0);
    e = { canvas: cv, w, h, ox: pad, oy: pad, xs, tw };
    cache.set(key, e);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return e;
  }

  // draw(ctx, text, x, y, opts) — (x,y) is the top-left of the line box (before align)
  function draw(ctx, text, x, y, o) {
    o = o || {};
    if (text === undefined || text === null || text === '') return 0;
    const e = renderLine(String(text), o);
    let dx = Math.round(x) - e.ox, dy = Math.round(y) - e.oy;
    if (o.align === 'center') dx = Math.round(x - e.tw / 2) - e.ox;
    else if (o.align === 'right') dx = Math.round(x - e.tw) - e.ox;
    if (o.chars !== undefined && o.chars < e.xs.length - 1) {
      const cw = e.xs[Math.max(0, o.chars)] + e.ox + (o.outline ? 1 : 0);
      if (cw > 0) ctx.drawImage(e.canvas, 0, 0, cw, e.h, dx, dy, cw, e.h);
    } else {
      ctx.drawImage(e.canvas, dx, dy);
    }
    return e.tw;
  }

  // Draws wrapped text; returns total height. o.lineGap adds spacing between lines.
  function drawWrapped(ctx, text, x, y, maxW, o) {
    o = o || {};
    const lines = wrap(text, o.font || 'body', maxW, o.bold);
    const lh = lineHeight(o.font || 'body') + (o.lineGap === undefined ? 2 : o.lineGap);
    let remaining = o.chars;
    lines.forEach((ln, i) => {
      if (remaining !== undefined) {
        const n = Array.from(ln).length;
        if (remaining <= 0) return;
        draw(ctx, ln, x, y + i * lh, Object.assign({}, o, { chars: Math.min(n, remaining) }));
        remaining -= n + 1;
      } else draw(ctx, ln, x, y + i * lh, o);
    });
    return lines.length * lh;
  }

  function hasGlyph(fontName, ch) {
    return fonts[fontName].map.has(ch.codePointAt(0));
  }

  RS.Text = { init, measure, wrap, draw, drawWrapped, lineHeight, renderLine, hasGlyph, fonts };
})();
