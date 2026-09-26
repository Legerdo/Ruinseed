// Pixel art toolkit: pixel buffers, string sprites, outlines, shaded blobs, transforms.
(function () {
  'use strict';
  const C32 = (hex) => RS.Color.c32(hex);
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

  function makeCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, w | 0); cv.height = Math.max(1, h | 0);
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return cv;
  }

  class PixBuf {
    constructor(w, h) {
      this.w = w | 0; this.h = h | 0;
      this.u32 = new Uint32Array(this.w * this.h);
    }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    set(x, y, hex) { x |= 0; y |= 0; if (this.inb(x, y)) this.u32[y * this.w + x] = hex ? C32(hex) : 0; }
    set32(x, y, c) { x |= 0; y |= 0; if (this.inb(x, y)) this.u32[y * this.w + x] = c; }
    get(x, y) { x |= 0; y |= 0; return this.inb(x, y) ? this.u32[y * this.w + x] : 0; }
    opaque(x, y) { return (this.get(x, y) >>> 24) > 0; }
    rect(x, y, w, h, hex) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, hex); }
    hline(x0, x1, y, hex) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, hex); }
    vline(x, y0, y1, hex) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, hex); }
    line(x0, y0, x1, y1, hex) {
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        this.set(x0, y0, hex);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    ellipse(cx, cy, rx, ry, hex) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) this.set(x, y, hex);
        }
      }
    }
    // Replace colours using a map hex->hex
    recolor(map) {
      const m = new Map();
      for (const k of Object.keys(map)) m.set(C32(k), map[k] ? C32(map[k]) : 0);
      for (let i = 0; i < this.u32.length; i++) { const v = m.get(this.u32[i]); if (v !== undefined) this.u32[i] = v; }
      return this;
    }
    blit(src, dx, dy, flip) {
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
        const c = src.u32[y * src.w + (flip ? src.w - 1 - x : x)];
        if (c >>> 24) this.set32(dx + x, dy + y, c);
      }
      return this;
    }
    clone() { const b = new PixBuf(this.w, this.h); b.u32.set(this.u32); return b; }
    toCanvas() {
      const cv = makeCanvas(this.w, this.h);
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(this.w, this.h);
      new Uint32Array(img.data.buffer).set(this.u32);
      ctx.putImageData(img, 0, 0);
      return cv;
    }
  }

  // Outline: every transparent pixel touching an opaque one (4-neigh) gets colour.
  // col may be a hex string or function(neighbourC32) -> c32
  function outline(buf, col, diag) {
    const w = buf.w, h = buf.h, src = buf.u32.slice();
    const fixed = typeof col === 'string' ? C32(col) : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (src[y * w + x] >>> 24) continue;
      let nb = 0;
      const test = (xx, yy) => { if (xx >= 0 && yy >= 0 && xx < w && yy < h) { const c = src[yy * w + xx]; if (c >>> 24) nb = nb || c; } };
      test(x - 1, y); test(x + 1, y); test(x, y - 1); test(x, y + 1);
      if (diag) { test(x - 1, y - 1); test(x + 1, y - 1); test(x - 1, y + 1); test(x + 1, y + 1); }
      if (nb) buf.u32[y * w + x] = fixed || col(nb);
    }
    return buf;
  }

  // Darken a packed colour (for selective outlines)
  function darken32(c, f) {
    const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
    // push towards ink blue rather than pure black
    const ir = 12, ig = 14, ib = 30;
    const nr = Math.round(r * f + ir * (1 - f)), ng = Math.round(g * f + ig * (1 - f)), nb = Math.round(b * f + ib * (1 - f));
    return ((255 << 24) | (nb << 16) | (ng << 8) | nr) >>> 0;
  }

  // Sprite from string rows and a char->hex map ('.' or ' ' = transparent)
  function fromRows(rows, map) {
    const h = rows.length, w = Math.max(...rows.map((r) => r.length));
    const b = new PixBuf(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      const hex = map[ch];
      if (hex) b.set(x, y, hex);
    }
    return b;
  }

  // Shaded organic blob from overlapping spheres. ramp: array dark->light hex.
  // opts: {light:[lx,ly], noise(x,y)->[-1,1], noiseAmp, dither, rim}
  function shadeBlob(buf, spheres, ramp, opts) {
    opts = opts || {};
    const L = opts.light || [-0.55, -0.75];
    const lz = 0.55;
    const ln = Math.hypot(L[0], L[1], lz);
    const lx = L[0] / ln, ly = L[1] / ln, lzz = lz / ln;
    const noise = opts.noise;
    const amp = opts.noiseAmp || 0;
    const hField = new Float32Array(buf.w * buf.h).fill(-1);
    for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
      let best = -1;
      for (const s of spheres) {
        const dx = (x + 0.5 - s.x) / s.r, dy = (y + 0.5 - s.y) / (s.ry || s.r);
        let d2 = dx * dx + dy * dy;
        if (noise) d2 += noise(x, y) * amp;
        if (d2 < 1) {
          const hh = Math.sqrt(1 - d2) * (s.h || 1) + (s.z || 0);
          if (hh > best) best = hh;
        }
      }
      hField[y * buf.w + x] = best;
    }
    const H = (x, y) => (x < 0 || y < 0 || x >= buf.w || y >= buf.h ? -1 : hField[y * buf.w + x]);
    for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
      const hc = H(x, y);
      if (hc < 0) continue;
      const hl = H(x - 1, y), hr = H(x + 1, y), hu = H(x, y - 1), hd = H(x, y + 1);
      const gx = ((hr < 0 ? hc - 0.6 : hr) - (hl < 0 ? hc - 0.6 : hl)) * 0.5;
      const gy = ((hd < 0 ? hc - 0.6 : hd) - (hu < 0 ? hc - 0.6 : hu)) * 0.5;
      const nx = -gx * 3.2, ny = -gy * 3.2, nz = 1;
      const nl = Math.hypot(nx, ny, nz);
      let li = (nx * lx + ny * ly + nz * lzz) / nl;
      li = li * 0.85 + hc * 0.25 + (opts.bias || 0);
      if (opts.jitter) li += opts.jitter(x, y);
      let t = RS.M.clamp(li, 0, 0.999) * ramp.length;
      if (opts.dither === true) {
        // irregular (hash based) dithering on band edges only — never a regular checkerboard
        const fr = t - Math.floor(t);
        const th = RS.rand2(x, y, 913);
        if (fr > 0.72 && th > 0.6) t = Math.floor(t) + 1;
      }
      const idx = RS.M.clamp(Math.floor(t), 0, ramp.length - 1);
      buf.set(x, y, ramp[idx]);
    }
    return hField;
  }

  function flipH(cv) {
    const o = makeCanvas(cv.width, cv.height);
    const ctx = o.getContext('2d');
    ctx.translate(cv.width, 0); ctx.scale(-1, 1); ctx.drawImage(cv, 0, 0);
    return o;
  }
  function rot90(cv, times) {
    times = ((times % 4) + 4) % 4;
    if (times === 0) return cv;
    const w = times % 2 ? cv.height : cv.width, h = times % 2 ? cv.width : cv.height;
    const o = makeCanvas(w, h);
    const ctx = o.getContext('2d');
    ctx.translate(w / 2, h / 2); ctx.rotate(times * Math.PI / 2); ctx.drawImage(cv, -cv.width / 2, -cv.height / 2);
    return o;
  }
  // Solid-colour silhouette (hit flashes)
  function silhouette(cv, hex) {
    const o = makeCanvas(cv.width, cv.height);
    const ctx = o.getContext('2d');
    ctx.drawImage(cv, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = hex; ctx.fillRect(0, 0, cv.width, cv.height);
    return o;
  }
  function bufFromCanvas(cv) {
    const ctx = cv.getContext('2d');
    const img = ctx.getImageData(0, 0, cv.width, cv.height);
    const b = new PixBuf(cv.width, cv.height);
    b.u32.set(new Uint32Array(img.data.buffer));
    return b;
  }

  RS.Art = { makeCanvas, PixBuf, outline, darken32, fromRows, shadeBlob, flipH, rot90, silhouette, bufFromCanvas, BAYER4 };
})();
