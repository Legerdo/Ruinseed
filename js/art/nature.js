// Procedural nature sprites: trees (7 species, many variants), bushes, rocks, logs, stumps,
// mushrooms, ferns, animated tall grass & reeds, shadows, water glints.
(function () {
  'use strict';
  const P = RS.PAL, A = RS.Art, S = RS.Sprites;
  const C32 = RS.Color.c32;

  const RAMPS = {
    oak: [P.moss0, P.moss1, P.moss2, P.moss3, P.moss4, P.moss5, P.moss6],
    oakLush: [P.moss1, P.moss2, P.moss3, P.moss4, P.moss5, P.moss6, P.moss7],
    oakGold: [P.earth1, P.gold0, P.gold1, P.gold2, P.gold3, P.gold4, P.gold5],
    oakDeep: [P.ink1, P.moss0, P.moss1, P.moss2, P.moss3, P.moss4, P.moss5],
    pine: [P.ink1, P.moss0, P.moss1, P.moss2, P.moss3, P.moss4],
    pineDeep: [P.ink0, P.ink1, P.moss0, P.moss1, P.moss2, P.moss3],
    birch: [P.moss2, P.moss3, P.moss4, P.moss5, P.moss6, P.moss7, P.moss8],
    willow: [P.moss1, P.moss2, P.moss3, P.moss4, P.moss5, P.moss6, P.moss7],
    swampWillow: [P.swamp0, P.swamp1, P.swamp2, P.swamp3, P.swamp4, P.swamp5, P.moss6],
    palm: [P.moss1, P.moss2, P.moss4, P.moss5, P.moss6, P.moss7],
    bush: [P.moss1, P.moss2, P.moss3, P.moss4, P.moss5, P.moss6],
    cbush: [P.moss2, P.moss4, P.moss5, P.moss6, P.moss7, P.moss8],
    rock: [P.rock1, P.rock2, P.rock3, P.rock4, P.rock5, P.rock6],
    bone: [P.bone1, P.bone2, P.bone3, P.bone4, P.bone5, P.bone6],
    sandstone: [P.cany1, P.cany2, P.cany3, P.cany4, P.cany5, P.cany6]
  };
  const BARK = [P.earth1, P.earth2, P.earth3, P.earth4, P.earth5];

  function clumpNoise(seed, scale) {
    const vn = RS.makeValueNoise(seed);
    return (x, y) => vn(x / scale, y / scale) * 2 - 1;
  }

  // shaded canopy from spheres with leafy clump texture; returns PixBuf
  function canopy(w, h, spheres, ramp, seed, opts) {
    opts = opts || {};
    const b = new A.PixBuf(w, h);
    const nz = clumpNoise(seed, opts.clump || 2.4);
    const nz2 = clumpNoise(seed + 9, 5);
    A.shadeBlob(b, spheres, ramp, {
      noise: (x, y) => nz2(x, y) * 0.6 + nz(x, y) * 0.4,
      noiseAmp: opts.bumpy === undefined ? 0.36 : opts.bumpy,
      jitter: (x, y) => nz(x, y) * (opts.leaf === undefined ? 0.2 : opts.leaf),
      bias: opts.bias || 0,
      dither: false
    });
    // sparkle highlights on the lit upper-left
    const lt = C32(ramp[ramp.length - 1]);
    const rng = new RS.RNG('spark' + seed);
    for (let k = 0; k < (opts.sparks || 10); k++) {
      const x = rng.int(2, w - 3), y = rng.int(2, Math.floor(h * 0.6));
      if (b.opaque(x, y) && b.get(x, y) === C32(ramp[ramp.length - 2])) b.set32(x, y, lt);
    }
    return b;
  }

  function outlineDark(b, col) { return A.outline(b, col || P.ink0); }

  function drawTrunk(b, cx, top, base, w, opts) {
    opts = opts || {};
    const bark = opts.bark || BARK;
    for (let y = top; y <= base; y++) {
      const t = (y - top) / Math.max(1, base - top);
      let ww = w + (t > 0.72 ? Math.round((t - 0.72) * 9) : 0);
      const x0 = Math.round(cx - ww / 2);
      for (let x = x0; x < x0 + ww; x++) {
        const u = (x - x0) / Math.max(1, ww - 1);
        let c = u < 0.25 ? bark[3] : u < 0.6 ? bark[2] : bark[1];
        if (((x * 7 + y * 3) % 11) === 0) c = bark[1];
        if (u < 0.12 && ((y + x) % 4 === 0)) c = bark[4];
        b.set(x, y, c);
      }
    }
    // roots
    if (!opts.noRoots) {
      b.set(Math.round(cx - w / 2) - 2, base, bark[1]); b.set(Math.round(cx + w / 2) + 1, base, bark[1]);
      b.set(Math.round(cx - w / 2) - 1, base - 1, bark[2]);
    }
  }

  function tintBuf(b, fn) {
    for (let i = 0; i < b.u32.length; i++) { const c = b.u32[i]; if (c >>> 24) b.u32[i] = fn(c); }
    return b;
  }

  // ---- species ---------------------------------------------------------------
  function oak(v, deep) {
    const rng = new RS.RNG('oak' + v + (deep ? 'd' : ''));
    const W = 36, H = 44;
    const b = new A.PixBuf(W, H);
    const cx = 18, base = H - 2;
    const trunkTop = 22;
    drawTrunk(b, cx, trunkTop, base, rng.int(4, 5));
    // branch hints
    b.line(cx - 1, trunkTop + 3, cx - 5, trunkTop - 1, BARK[2]);
    b.line(cx + 1, trunkTop + 4, cx + 5, trunkTop, BARK[1]);
    const sp = [];
    const R = rng.range(10.5, 12.5);
    sp.push({ x: cx + rng.range(-1, 1), y: 16, r: R, h: 1.1 });
    const n = rng.int(5, 7);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const d = rng.range(6.5, 9.5);
      sp.push({ x: cx + Math.cos(a) * d, y: 16 + Math.sin(a) * d * 0.75, r: rng.range(5.5, 8), h: 0.8, z: Math.sin(a) < 0 ? 0.15 : -0.1 });
    }
    let ramp = deep ? RAMPS.oakDeep : (v === 5 ? RAMPS.oakGold : v % 2 ? RAMPS.oakLush : RAMPS.oak);
    const cn = canopy(W, 34, sp, ramp, 100 + v * 13 + (deep ? 7 : 0), { sparks: deep ? 3 : 12 });
    b.blit(cn, 0, 0);
    outlineDark(b, deep ? P.ink0 : P.moss0);
    return b;
  }

  function pine(v, deep) {
    const rng = new RS.RNG('pine' + v + (deep ? 'd' : ''));
    const W = 28, H = 46;
    const b = new A.PixBuf(W, H);
    const cx = 14, base = H - 2;
    drawTrunk(b, cx, base - 9, base, 3, { noRoots: false });
    const ramp = deep ? RAMPS.pineDeep : RAMPS.pine;
    const tiers = rng.int(3, 4);
    const top = 2 + rng.int(0, 2);
    const bottom = base - 6;
    const jn = clumpNoise(300 + v, 1.6);
    for (let k = tiers - 1; k >= 0; k--) {
      const t0 = top + (bottom - top) * (k / tiers) * 0.82;
      const t1 = top + (bottom - top) * ((k + 1) / tiers) + 2;
      const halfW = 5 + (k + 1) * (8 / tiers) + rng.range(0, 1.5);
      for (let y = Math.floor(t0); y <= Math.ceil(t1); y++) {
        const tt = (y - t0) / (t1 - t0);
        const hw = halfW * Math.pow(Math.max(0, tt), 0.85) + jn(y, k * 10) * 1.3;
        for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
          if (x < 0 || x >= W) continue;
          const u = (x - cx) / Math.max(1, hw);
          let li = 0.62 - u * 0.4 - tt * 0.28 + jn(x * 1.3, y * 1.3) * 0.16;
          if (tt > 0.86) li -= 0.22;
          if (y === Math.floor(t0) || y === Math.floor(t0) + 1) li += 0.12;
          const idx = RS.M.clamp(Math.floor(li * ramp.length), 0, ramp.length - 1);
          b.set(x, y, ramp[idx]);
        }
      }
    }
    // snowless tip highlight
    b.set(cx, top, ramp[ramp.length - 1]);
    outlineDark(b, P.ink0);
    return b;
  }

  function birch(v) {
    const rng = new RS.RNG('birch' + v);
    const W = 30, H = 44;
    const b = new A.PixBuf(W, H);
    const cx = 15, base = H - 2;
    const bark = [P.bone2, P.bone4, P.bone6, P.bone7, P.white];
    for (let y = 20; y <= base; y++) {
      for (let x = cx - 2; x <= cx + 1; x++) b.set(x, y, x === cx - 2 ? bark[3] : x === cx + 1 ? bark[1] : bark[2]);
      if ((y * 5 + v) % 6 === 0) { b.set(cx - 1, y, P.ink1); b.set(cx, y, P.ink1); }
      if ((y * 3 + v) % 9 === 0) b.set(cx + 1, y, P.ink2);
    }
    b.set(cx - 3, base, bark[1]); b.set(cx + 2, base, bark[1]);
    const sp = [{ x: cx, y: 14, r: 9.5, h: 1 }];
    for (let k = 0; k < 5; k++) { const a = rng.range(0, Math.PI * 2); sp.push({ x: cx + Math.cos(a) * 6, y: 14 + Math.sin(a) * 6, r: rng.range(4.5, 6.5), h: 0.8 }); }
    const cn = canopy(W, 28, sp, RAMPS.birch, 500 + v, { clump: 1.8, sparks: 14 });
    b.blit(cn, 0, 0);
    outlineDark(b, P.moss1);
    return b;
  }

  function willow(v, swampy) {
    const rng = new RS.RNG('willow' + v);
    const W = 40, H = 44;
    const b = new A.PixBuf(W, H);
    const cx = 20, base = H - 2;
    drawTrunk(b, cx, 22, base, 5);
    const ramp = swampy ? RAMPS.swampWillow : RAMPS.willow;
    const sp = [{ x: cx, y: 14, r: 12, ry: 10, h: 1 }];
    for (let k = 0; k < 5; k++) { const a = Math.PI + (k / 4) * Math.PI; sp.push({ x: cx + Math.cos(a) * 9, y: 14 + Math.sin(a) * 5, r: 7, h: 0.8 }); }
    const cn = canopy(W, 28, sp, ramp, 700 + v, { clump: 2, sparks: 8 });
    b.blit(cn, 0, 0);
    // hanging strands
    for (let x = 6; x < W - 6; x++) {
      if (rng.chance(0.35)) continue;
      let y0 = 0;
      for (let y = 27; y > 0; y--) if (b.opaque(x, y)) { y0 = y; break; }
      if (!y0) continue;
      const len = rng.int(5, 14);
      for (let k = 1; k <= len; k++) {
        const col = k > len - 2 ? ramp[2] : (k % 3 === 0 ? ramp[3] : ramp[4]);
        b.set(x + (k > len / 2 && (x & 1) ? 1 : 0), y0 + k, col);
      }
    }
    outlineDark(b, P.ink0);
    return b;
  }

  function deadTree(v) {
    const rng = new RS.RNG('dead' + v);
    const W = 34, H = 42;
    const b = new A.PixBuf(W, H);
    const cx = 17, base = H - 2;
    const bark = [P.ink2, P.earth1, P.earth2, P.bone2, P.bone3];
    drawTrunk(b, cx, 14, base, 4, { bark });
    const branch = (x, y, a, len, w) => {
      for (let i = 0; i < len; i++) {
        x += Math.cos(a); y += Math.sin(a);
        b.set(Math.round(x), Math.round(y), i < len * 0.4 && w > 1 ? bark[2] : bark[1]);
        if (w > 1) b.set(Math.round(x) + 1, Math.round(y), bark[1]);
        a += rng.range(-0.25, 0.25);
      }
      if (len > 4) {
        branch(x, y, a - rng.range(0.4, 0.9), len * 0.55, 1);
        branch(x, y, a + rng.range(0.4, 0.9), len * 0.5, 1);
      }
    };
    branch(cx, 15, -Math.PI / 2 - 0.5, 9, 2);
    branch(cx, 17, -Math.PI / 2 + 0.6, 8, 2);
    branch(cx, 14, -Math.PI / 2, 7, 1);
    // hanging moss
    if (v % 2 === 0) for (let k = 0; k < 6; k++) { const x = rng.int(7, W - 8); for (let y = 6; y < 20; y++) if (b.opaque(x, y)) { for (let j = 1; j < rng.int(3, 7); j++) b.set(x, y + j, j % 2 ? P.swamp4 : P.swamp3); break; } }
    outlineDark(b, P.ink0);
    return b;
  }

  function palm(v) {
    const rng = new RS.RNG('palm' + v);
    const W = 34, H = 42;
    const b = new A.PixBuf(W, H);
    const base = H - 2;
    let x = 17 + (v % 2 ? 2 : -2), y = base;
    const lean = v % 2 ? -0.18 : 0.18;
    const pts = [];
    for (let i = 0; i < 26; i++) { pts.push([x, y]); y -= 1; x += lean * (i / 26) * 1.6; }
    for (const [px, py] of pts) {
      const seg = (Math.round(py) % 3) === 0;
      b.set(Math.round(px) - 1, Math.round(py), seg ? P.earth3 : P.earth5);
      b.set(Math.round(px), Math.round(py), seg ? P.earth2 : P.earth4);
      b.set(Math.round(px) + 1, Math.round(py), P.earth2);
    }
    const [hx, hy] = pts[pts.length - 1];
    for (let f = 0; f < 6; f++) {
      const a = -Math.PI + (f / 5) * Math.PI + rng.range(-0.15, 0.15);
      let fx = hx, fy = hy;
      for (let i = 0; i < 12; i++) {
        fx += Math.cos(a) * 1.1; fy += Math.sin(a) * 0.8 + i * 0.09;
        const c = i < 3 ? RAMPS.palm[5] : i < 8 ? RAMPS.palm[3] : RAMPS.palm[2];
        b.set(Math.round(fx), Math.round(fy), c);
        b.set(Math.round(fx), Math.round(fy) + 1, RAMPS.palm[1]);
        if (i > 2 && i % 2 === 0) b.set(Math.round(fx), Math.round(fy) + 2, RAMPS.palm[2]);
      }
    }
    b.set(Math.round(hx), Math.round(hy) + 1, P.earth2); b.set(Math.round(hx) + 1, Math.round(hy) + 2, P.earth3); // coconuts
    outlineDark(b, P.ink0);
    return b;
  }

  function windswept(v) {
    const rng = new RS.RNG('wind' + v);
    const W = 38, H = 40;
    const b = new A.PixBuf(W, H);
    const base = H - 2;
    const dir = v % 2 ? 1 : -1;
    // bent trunk
    for (let i = 0; i < 20; i++) {
      const x = 19 + Math.round(dir * Math.pow(i / 20, 1.6) * 8), y = base - i;
      b.set(x - 1, y, BARK[3]); b.set(x, y, BARK[2]); b.set(x + 1, y, BARK[1]);
    }
    const hx = 19 + dir * 8;
    const sp = [];
    for (let k = 0; k < 6; k++) sp.push({ x: hx + dir * rng.range(-2, 9) - dir * 3, y: 14 + rng.range(-3, 3), r: rng.range(4.5, 7.5), ry: rng.range(3.5, 5), h: 0.9 });
    const cn = canopy(W, 26, sp, RAMPS.pine, 900 + v, { clump: 2.2, sparks: 6 });
    b.blit(cn, 0, 0);
    outlineDark(b, P.ink0);
    return b;
  }

  // ---- bushes, rocks, logs ------------------------------------------------------
  function bush(v, kind) {
    const rng = new RS.RNG('bush' + kind + v);
    const W = 18, H = 16;
    const sp = [{ x: 9, y: 9, r: 7, ry: 6, h: 1 }];
    for (let k = 0; k < 4; k++) sp.push({ x: 9 + rng.range(-4, 4), y: 8 + rng.range(-3, 2), r: rng.range(3, 4.5), h: 0.8 });
    const ramp = kind === 'cut' ? RAMPS.cbush : RAMPS.bush;
    const b = canopy(W, H - 1, sp, ramp, 1100 + v * 7 + (kind === 'cut' ? 50 : 0), { clump: kind === 'cut' ? 1.6 : 2, sparks: 6, bumpy: 0.25 });
    const out = new A.PixBuf(W, H);
    out.blit(b, 0, 0);
    if (kind === 'cut') {
      // leaf vein pattern to read as cuttable
      for (let y = 3; y < 13; y += 3) for (let x = 3 + (y % 2); x < 15; x += 4) if (out.opaque(x, y)) { out.set(x, y, P.moss3); out.set(x + 1, y - 1, P.moss8); }
    }
    if (kind === 'flower') {
      for (let k = 0; k < 6; k++) { const x = rng.int(3, 14), y = rng.int(3, 11); if (out.opaque(x, y)) { out.set(x, y, v ? P.bone7 : '#e7a9a0'); out.set(x + 1, y, P.gold4); } }
    }
    if (kind === 'berry') {
      for (let k = 0; k < 5; k++) { const x = rng.int(3, 14), y = rng.int(4, 12); if (out.opaque(x, y)) { out.set(x, y, P.emb3); out.set(x, y - 1, P.emb5); } }
    }
    outlineDark(out, P.moss0);
    return out;
  }

  function rock(v, size, ramp) {
    const rng = new RS.RNG('rock' + size + v);
    const dims = { s: [13, 11], m: [17, 15], b: [34, 28] }[size];
    const [W, H] = dims;
    const b = new A.PixBuf(W, H);
    const sp = [];
    const n = size === 'b' ? 5 : 3;
    for (let k = 0; k < n; k++) sp.push({ x: W / 2 + rng.range(-W * 0.2, W * 0.2), y: H * 0.58 + rng.range(-H * 0.15, H * 0.1), r: rng.range(W * 0.24, W * 0.36), ry: rng.range(H * 0.26, H * 0.38), h: rng.range(0.8, 1.1) });
    const facet = clumpNoise(1300 + v, size === 'b' ? 4 : 2.5);
    A.shadeBlob(b, sp, ramp, { noise: (x, y) => facet(x, y), noiseAmp: 0.18, jitter: (x, y) => Math.round(facet(x * 1.3, y * 1.3) * 2) * 0.07, dither: false, bias: 0.05 });
    // cracks & moss
    if (size !== 's' || v % 2) {
      let x = rng.int(3, W - 4), y = rng.int(2, 4);
      for (let k = 0; k < H * 0.5; k++) { if (b.opaque(x, y)) b.set(x, y, ramp[0]); y++; if (rng.chance(0.4)) x += rng.sign(); }
    }
    if (v % 3 === 0) {
      for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
        if (!b.opaque(x, y)) continue;
        if (!b.opaque(x, y - 1) || !b.opaque(x, y - 2)) { if (RS.rand2(x, y, v) < 0.55) b.set(x, y, P.moss5); else if (b.opaque(x, y + 1)) b.set(x, y + 1, P.moss4); }
      }
    }
    outlineDark(b, P.ink0);
    return b;
  }

  // jagged rock pillar: wide base, irregular edges, vertical striations, flat broken top
  function spire(v, sand) {
    const rng = new RS.RNG('spire' + v + (sand ? 's' : ''));
    const W = 20, H = 40;
    const b = new A.PixBuf(W, H);
    const ramp = sand ? RAMPS.sandstone : RAMPS.rock;
    let lw = 2.2 + rng.range(0, 1), rw = 2.2 + rng.range(0, 1);
    const top = 3 + rng.int(0, 5);
    const crack = new Set([top + rng.int(5, 9), top + rng.int(13, 19), top + rng.int(22, 28)]);
    for (let y = top; y < H; y++) {
      const t = (y - top) / (H - top);
      lw += rng.range(-0.35, 0.55) * 0.8 + t * 0.12; rw += rng.range(-0.35, 0.55) * 0.8 + t * 0.12;
      lw = RS.M.clamp(lw, 2, 9); rw = RS.M.clamp(rw, 2, 9);
      const x0 = Math.round(10 - lw), x1 = Math.round(10 + rw);
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0) / Math.max(1, x1 - x0);
        let li = 0.78 - u * 0.5 - t * 0.14;
        if (((x + (y >> 3)) % 4) === 0) li -= 0.12;       // striations
        if (crack.has(y)) li -= 0.3;
        if (crack.has(y - 1)) li += 0.12;
        if (y === top) li += 0.18;
        b.set(x, y, ramp[RS.M.clamp(Math.floor(li * ramp.length), 0, ramp.length - 1)]);
      }
    }
    // notch the top
    for (let k = 0; k < 3; k++) { const x = rng.int(6, 14); b.set(x, top, null); b.set(x + 1, top, null); }
    if (!sand && v !== 1) for (let x = 0; x < W; x++) for (let y = top; y < top + 3; y++) if (b.opaque(x, y) && !b.opaque(x, y - 1) && RS.rand2(x, y, v) < 0.6) b.set(x, y, P.moss4);
    outlineDark(b, P.ink0);
    return b;
  }

  function standStone(v) {
    const b = new A.PixBuf(13, 26);
    const ramp = RAMPS.bone;
    for (let y = 1; y < 26; y++) {
      const hw = 3.2 + (y > 20 ? 1 : 0) - (y < 4 ? (4 - y) * 0.6 : 0);
      for (let x = Math.floor(6.5 - hw); x <= Math.ceil(6.5 + hw); x++) {
        const u = (x - 6.5) / hw;
        let li = 0.64 - u * 0.34 - (y / 26) * 0.18;
        b.set(x, y, ramp[RS.M.clamp(Math.floor(li * ramp.length), 0, ramp.length - 1)]);
      }
    }
    // carved rune
    const rr = [[6, 8], [6, 9], [6, 10], [5, 9], [7, 11], [5, 12], [7, 12], [6, 13]];
    for (const [x, y] of rr) b.set(x, y + v, P.gold2);
    for (let x = 2; x < 11; x++) if (RS.rand2(x, v, 3) < 0.6) b.set(x, 3 + (x % 2), P.moss4);
    outlineDark(b, P.ink0);
    return b;
  }

  function waterRock(v) {
    const b = new A.PixBuf(18, 12);
    const r = rock(v, 's', RAMPS.rock);
    b.blit(r, 2, 0);
    for (let x = 1; x < 17; x++) if ((x + v) % 3) b.set(x, 10 + ((x + v) % 2), P.sea8);
    return b;
  }

  function log(v) {
    const W = 34, H = 16;
    const b = new A.PixBuf(W, H);
    for (let y = 4; y < 14; y++) for (let x = 3; x < 31; x++) {
      const u = (y - 4) / 9;
      let c = u < 0.2 ? BARK[4] : u < 0.5 ? BARK[3] : u < 0.8 ? BARK[2] : BARK[1];
      if (((x * 3 + y * 7) % 13) === 0) c = BARK[1];
      b.set(x, y, c);
    }
    // end rings
    b.ellipse(4, 9, 3, 5, P.earth5);
    b.ellipse(4, 9, 2, 3.5, P.earth6);
    b.set(4, 9, P.earth3); b.set(4, 8, P.earth4);
    // stub branch & moss
    b.rect(20, 1, 2, 4, BARK[2]); b.set(20, 1, BARK[4]);
    if (v === 0) for (let x = 8; x < 26; x++) if (RS.rand2(x, 1, 9) < 0.6) { b.set(x, 4, P.moss5); b.set(x, 5, P.moss4); }
    else for (let x = 10; x < 18; x++) b.set(x, 4, P.moss4);
    outlineDark(b, P.ink0);
    return b;
  }

  function stump(v) {
    const b = new A.PixBuf(16, 14);
    for (let y = 5; y < 13; y++) for (let x = 3; x < 13; x++) b.set(x, y, x < 5 ? BARK[3] : x > 10 ? BARK[1] : BARK[2]);
    b.ellipse(8, 5, 5, 2.6, P.earth5);
    b.ellipse(8, 5, 3, 1.5, P.earth6);
    b.set(8, 5, P.earth4);
    b.set(2, 12, BARK[2]); b.set(13, 12, BARK[1]);
    if (v) { b.set(4, 8, P.moss5); b.set(5, 9, P.moss4); b.set(11, 10, P.emb3); b.set(11, 9, P.emb5); }
    outlineDark(b, P.ink0);
    return b;
  }

  function mushroom(v) {
    const b = new A.PixBuf(12, 12);
    const caps = [[P.emb2, P.emb3, P.emb5], [P.earth3, P.earth4, P.earth6], [P.gold1, P.gold2, P.gold4]][v % 3];
    const put = (x, y, s) => {
      b.rect(x - 1, y, 2, s + 1, P.bone5); b.set(x - 1, y, P.bone6);
      b.ellipse(x, y, s + 0.5, s * 0.6 + 0.4, caps[1]);
      b.set(x - 1, y - 1, caps[2]); b.hline(x - s, x + s - 1, y + 1, caps[0]);
      if (v === 0) { b.set(x + 1, y - 1, P.bone7); b.set(x - 2, y, P.bone7); }
    };
    put(4, 6, 3); put(9, 8, 2);
    outlineDark(b, P.ink0);
    return b;
  }
  function glowMush(v) {
    const b = new A.PixBuf(12, 12);
    const put = (x, y, s) => {
      b.rect(x - 1, y, 2, s + 1, P.bone4);
      b.ellipse(x, y, s + 0.5, s * 0.6 + 0.4, P.sea6);
      b.set(x - 1, y - 1, P.sea9); b.set(x, y - 1, P.sea8);
      b.hline(x - s, x + s - 1, y + 1, P.sea4);
    };
    put(4, 7, 3); put(9, 8, 2); if (v) put(7, 4, 1.5);
    outlineDark(b, P.ink1);
    return b;
  }
  function fern(v) {
    const b = new A.PixBuf(16, 12);
    const rng = new RS.RNG('fern' + v);
    for (let f = 0; f < 5; f++) {
      const a = -Math.PI / 2 + (f - 2) * 0.55 + rng.range(-0.1, 0.1);
      let x = 8, y = 11;
      for (let i = 0; i < 9; i++) {
        x += Math.cos(a) * 0.9; y += Math.sin(a) * 0.9 + i * 0.07;
        b.set(Math.round(x), Math.round(y), i > 6 ? P.moss7 : P.moss5);
        if (i % 2 === 0 && i > 1) { b.set(Math.round(x) - 1, Math.round(y) + 1, P.moss4); b.set(Math.round(x) + 1, Math.round(y) + 1, P.moss3); }
      }
    }
    outlineDark(b, P.moss0);
    return b;
  }
  function driftwood(v) {
    const b = new A.PixBuf(26, 9);
    b.line(1, 6, 24, 3 + v, P.bone4); b.line(1, 7, 24, 4 + v, P.bone3); b.line(2, 5, 23, 2 + v, P.bone6);
    b.line(8, 5, 5, 1, P.bone4); b.line(17, 4, 20, 0, P.bone3);
    outlineDark(b, P.ink1);
    return b;
  }

  // animated tall grass: 4 sway frames
  function tallGrass(v, frame) {
    const rng = new RS.RNG('tg' + v);
    const pal = [[P.moss3, P.moss5, P.moss7], [P.moss4, P.moss6, P.moss8], [P.moss2, P.moss4, P.moss6]][v];
    const b = new A.PixBuf(13, 12);
    const sway = [0, 1, 0, -1][frame];
    const blades = 6;
    for (let i = 0; i < blades; i++) {
      const x0 = 1 + i * 2 + rng.int(0, 1);
      const len = rng.int(6, 10);
      const lean = rng.pick([-1, 0, 1]);
      for (let j = 0; j < len; j++) {
        const t = j / len;
        const dx = Math.round((lean * t * 1.5) + sway * t * t * 2);
        const col = j >= len - 2 ? pal[2] : j < 2 ? pal[0] : pal[1];
        b.set(x0 + dx, 11 - j, col);
      }
    }
    outlineDark(b, P.moss0);
    return b;
  }
  function reeds(v, frame) {
    const rng = new RS.RNG('rd' + v);
    const b = new A.PixBuf(12, 17);
    const sway = [0, 1, 0, -1][frame];
    for (let i = 0; i < 5; i++) {
      const x0 = 1 + i * 2 + rng.int(0, 1);
      const len = rng.int(9, 15);
      for (let j = 0; j < len; j++) {
        const t = j / len;
        const dx = Math.round(sway * t * t * 1.6);
        b.set(x0 + dx, 16 - j, j > len - 3 ? P.moss8 : j < 3 ? P.moss4 : (j % 4 === 0 ? P.moss6 : P.moss7));
      }
      if (rng.chance(0.6)) { const dx = Math.round(sway * 1.4); b.set(x0 + dx, 16 - len, P.earth5); b.set(x0 + dx, 17 - len, P.earth4); b.set(x0 + dx, 18 - len, P.earth3); }
    }
    outlineDark(b, P.swamp1);
    return b;
  }

  function shadowSprite(w, h) {
    const b = new A.PixBuf(w, h);
    b.ellipse(w / 2, h / 2, w / 2, h / 2, P.ink0);
    return b;
  }

  function build() {
    // trees
    for (let v = 0; v < 6; v++) {
      S.add('tree_oak_' + v, oak(v, false), 18, 43);
      S.add('treeD_oak_' + v, oak(v, true), 18, 43);
      S.add('tree_pine_' + v, pine(v, false), 14, 45);
      S.add('treeD_pine_' + v, pine(v, true), 14, 45);
    }
    for (let v = 0; v < 4; v++) {
      S.add('tree_birch_' + v, birch(v), 15, 43);
      S.add('treeD_birch_' + v, birch(v), 15, 43);
      S.add('tree_willow_' + v, willow(v, v >= 2), 20, 43);
      S.add('treeD_willow_' + v, willow(v, true), 20, 43);
      S.add('tree_dead_' + v, deadTree(v), 17, 41);
      S.add('treeD_dead_' + v, deadTree(v), 17, 41);
      S.add('tree_palm_' + v, palm(v), 17, 41);
      S.add('tree_windswept_' + v, windswept(v), 19, 39);
      S.add('treeD_windswept_' + v, windswept(v), 19, 39);
    }
    for (let v = 0; v < 4; v++) S.add('bush_' + v, bush(v, 'plain'), 9, 15);
    for (let v = 0; v < 2; v++) S.add('bushF_' + v, bush(v, 'flower'), 9, 15);
    for (let v = 0; v < 3; v++) S.add('cbush_' + v, bush(v, 'cut'), 9, 15);
    S.add('bushB_0', bush(0, 'berry'), 9, 15);
    for (let v = 0; v < 4; v++) {
      S.add('rock_s_' + v, rock(v, 's', v % 2 ? RAMPS.bone : RAMPS.rock), 6, 10);
      S.add('rock_m_' + v, rock(v, 'm', v % 2 ? RAMPS.bone : RAMPS.rock), 8, 14);
      S.add('rockC_s_' + v, rock(v + 10, 's', RAMPS.sandstone), 6, 10);
      S.add('rockC_m_' + v, rock(v + 10, 'm', RAMPS.sandstone), 8, 14);
    }
    for (let v = 0; v < 3; v++) {
      S.add('boulder_' + v, rock(v, 'b', v ? RAMPS.bone : RAMPS.rock), 17, 27);
      S.add('boulderC_' + v, rock(v + 10, 'b', RAMPS.sandstone), 17, 27);
      S.add('spire_' + v, spire(v, false), 10, 39);
      S.add('spireC_' + v, spire(v, true), 10, 39);
      S.add('standstone_' + v, standStone(v), 6, 25);
      S.add('wrock_' + v, waterRock(v), 9, 11);
      S.add('mush_' + v, mushroom(v), 6, 11);
      S.add('fern_' + v, fern(v), 8, 11);
    }
    for (let v = 0; v < 2; v++) {
      S.add('log_' + v, log(v), 17, 14);
      S.add('stump_' + v, stump(v), 8, 13);
      S.add('gmush_' + v, glowMush(v), 6, 11);
      S.add('driftwood_' + v, driftwood(v), 13, 8);
    }
    for (let v = 0; v < 3; v++) for (let f = 0; f < 4; f++) {
      S.add('tgrass_' + v + '_' + f, tallGrass(v, f), 6, 12);
      S.add('reeds_' + v + '_' + f, reeds(v, f), 6, 17);
    }
    // hazards: bramble thorns, bubbling poison pool, floor spikes
    for (let f = 0; f < 2; f++) {
      const b = new A.PixBuf(18, 12);
      const rng = new RS.RNG('thorn');
      for (let k = 0; k < 7; k++) {
        let x = rng.int(2, 15), y = 11;
        for (let j = 0; j < rng.int(4, 8); j++) {
          b.set(x, y, j % 2 ? P.earth3 : P.earth4);
          if (j % 2 === 0) b.set(x + (j % 4 ? 1 : -1), y, P.bone5);
          y--; x += rng.int(-1, 1) + (f && j > 3 ? 1 : 0) * 0;
        }
      }
      for (let k = 0; k < 4; k++) b.set(rng.int(3, 14), rng.int(3, 9), P.moss4);
      A.outline(b, P.ink1);
      S.add('thorns_' + f, b, 9, 11);
    }
    for (let f = 0; f < 3; f++) {
      const b = new A.PixBuf(18, 10);
      b.ellipse(9, 5, 8, 4, P.swamp3);
      b.ellipse(9, 5, 6.5, 3, '#6f8a3a');
      b.ellipse(8, 4, 3, 1.4, '#98b24c');
      const bx = [5, 11, 8][f], by = [4, 5, 3][f];
      b.set(bx, by, P.moss9); b.set(bx + 1, by, '#c8e070'); b.set(bx, by - 1, P.moss9);
      A.outline(b, P.swamp1);
      S.add('poison_' + f, b, 9, 8);
    }
    for (let f = 0; f < 3; f++) {
      const b = new A.PixBuf(16, 14);
      b.rect(1, 9, 14, 4, P.rock2); b.hline(1, 14, 9, P.rock4);
      for (let k = 0; k < 4; k++) {
        const x = 2 + k * 4;
        b.set(x, 11, P.ink0); b.set(x + 1, 11, P.ink0);
        if (f > 0) { const h = f === 1 ? 3 : 7; for (let j = 0; j < h; j++) { b.set(x, 10 - j, j === h - 1 ? P.bone7 : P.bone5); b.set(x + 1, 10 - j, P.bone3); } }
      }
      A.outline(b, P.ink0);
      S.add('spikes_' + f, b, 8, 13);
    }
    S.add('shadow_s', shadowSprite(10, 4), 5, 2);
    S.add('shadow_m', shadowSprite(16, 6), 8, 3);
    S.add('shadow_l', shadowSprite(26, 8), 13, 4);
    S.add('shadow_xl', shadowSprite(44, 14), 22, 7);
    // water glints
    for (let f = 0; f < 4; f++) {
      const b = new A.PixBuf(7, 3);
      const w = [3, 5, 7, 3][f];
      const o = (7 - w) >> 1;
      b.hline(o, o + w - 1, 1, f === 3 ? P.sea7 : P.sea8);
      if (f === 2) { b.set(o + 1, 0, P.sea9); b.set(o + w - 2, 0, P.sea9); }
      S.add('glint_' + f, b, 3, 2);
    }
  }

  RS.Nature = { build, RAMPS, canopy, bush, rock, oak };
})();
