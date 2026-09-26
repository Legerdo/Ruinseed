// Terrain renderer: per-pixel dual-grid autotiling (corner-weighted blending of tile keys with
// seeded edge noise), material shaders, cliff faces, shorelines, chasms, and animated water overlays.
(function () {
  'use strict';
  const TS = 16, CT = 16, CP = CT * TS; // chunk: 16x16 tiles = 256px
  const K = RS.K, MAT = RS.MAT;
  const P = RS.PAL;
  const c = (hex) => RS.Color.c32(hex);
  const TW = 512, TMASK = 511;
  let NA, NB, NC, ND, NE; // tileable noise textures [0,1]
  let noiseSeed = null;

  function tileableNoise(seed, cell, octaves) {
    const rng = new RS.RNG('tn:' + seed + ':' + cell);
    const out = new Float32Array(TW * TW);
    let norm = 0, amp = 1;
    for (let o = 0; o < octaves; o++) {
      const cs = cell >> o;
      if (cs < 1) break;
      const L = TW / cs;
      const lat = new Float32Array(L * L);
      for (let i = 0; i < lat.length; i++) lat[i] = rng.next();
      for (let y = 0; y < TW; y++) {
        const gy = y / cs, iy = Math.floor(gy), fy = gy - iy, v = fy * fy * (3 - 2 * fy);
        const y0 = (iy % L) * L, y1 = ((iy + 1) % L) * L;
        for (let x = 0; x < TW; x++) {
          const gx = x / cs, ix = Math.floor(gx), fx = gx - ix, u = fx * fx * (3 - 2 * fx);
          const x0 = ix % L, x1 = (ix + 1) % L;
          const a = lat[y0 + x0], b = lat[y0 + x1], cc = lat[y1 + x0], d = lat[y1 + x1];
          out[y * TW + x] += (a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v) * amp;
        }
      }
      norm += amp; amp *= 0.5;
    }
    for (let i = 0; i < out.length; i++) out[i] /= norm;
    return out;
  }

  function initNoise(seed) {
    if (noiseSeed === seed) return;
    noiseSeed = seed;
    NA = tileableNoise(seed, 32, 2);
    NB = tileableNoise(seed + 1, 8, 2);
    NC = tileableNoise(seed + 2, 4, 1);
    ND = tileableNoise(seed + 3, 2, 1);
    NE = tileableNoise(seed + 4, 64, 2);
  }

  // ---- colour ramps --------------------------------------------------------
  let R = null;
  function ramps() {
    if (R) return R;
    const m = (arr) => arr.map((h) => c(h));
    R = {
      grass: m([P.moss2, P.moss3, P.moss4, P.moss5, P.moss6, P.moss7]),
      meadow: m([P.moss3, P.moss4, P.moss5, P.moss6, P.moss7, P.moss8]),
      forest: m([P.moss0, P.moss1, P.moss2, P.moss3, P.moss4]),
      deep: m([P.ink1, P.moss0, P.moss1, P.moss2]),
      litter: m([P.earth2, P.earth3, P.earth4, P.earth5]),
      dirt: m([P.earth2, P.earth3, P.earth4, P.earth5, P.earth6]),
      cobble: m([P.bone1, P.bone2, P.bone3, P.bone4, P.bone5, P.bone6]),
      sand: m([P.sand0, P.sand1, P.sand2, P.sand3, P.sand4, P.sand5]),
      mud: m([P.earth1, P.earth2, P.swamp2, P.earth3, P.swamp3]),
      rock: m([P.rock1, P.rock2, P.rock3, P.rock4, P.rock5, P.rock6]),
      gravel: m([P.rock2, P.rock3, P.rock4, P.bone3, P.rock5, P.bone4]),
      canyon: m([P.cany1, P.cany2, P.cany3, P.cany4, P.cany5, P.cany6]),
      ruin: m([P.bone1, P.bone2, P.bone3, P.bone4, P.bone5, P.bone6]),
      swamp: m([P.swamp1, P.swamp2, P.swamp3, P.swamp4, P.swamp5]),
      sanctum: m([P.rock2, P.rock3, P.bone2, P.bone3, P.bone4, P.bone5]),
      mount: m([P.rock2, P.rock3, P.rock4, P.rock5, P.rock6, P.rock7]),
      sea: m([P.sea0, P.sea1, P.sea2, P.sea3, P.sea4, P.sea5, P.sea6, P.sea7, P.sea8]),
      marsh: m(['#0f1c1d', '#152826', '#1d352f', '#27463a', '#3b6150', '#6f9a7a']),
      faceRock: m([P.rock0, P.rock1, P.rock2, P.rock3, P.rock4, P.rock5]),
      faceSand: m([P.cany1, P.cany2, P.cany3, P.cany4, P.cany5, P.cany6]),
      faceEarth: m([P.earth0, P.earth1, P.earth2, P.earth3, P.earth4, P.earth5]),
      faceMoss: m([P.ink1, P.rock1, P.rock2, P.moss2, P.moss3, P.rock4]),
      faceDark: m([P.ink1, P.ink2, P.ink3, P.rock2, P.rock3, P.ink5]),
      moss: m([P.moss2, P.moss3, P.moss4, P.moss5]),
      gold: m([P.gold1, P.gold2, P.gold3]),
      ink0: c(P.ink0), ink1: c(P.ink1), ink2: c(P.ink2), black: c(P.black),
      foam: c(P.sea8), foam2: c(P.sea9), plank: m([P.earth2, P.earth3, P.earth4, P.earth5, P.earth6])
    };
    return R;
  }

  // Shade a packed colour towards ink (f<1 darker) or towards warm light (f>1)
  function shade(col, f) {
    const r = col & 255, g = (col >>> 8) & 255, b = (col >>> 16) & 255;
    let nr, ng, nb;
    if (f <= 1) { nr = r * f + 10 * (1 - f); ng = g * f + 12 * (1 - f); nb = b * f + 28 * (1 - f); }
    else { const t = f - 1; nr = r + (250 - r) * t; ng = g + (236 - g) * t; nb = b + (200 - b) * t; }
    return ((255 << 24) | ((nb | 0) << 16) | ((ng | 0) << 8) | (nr | 0)) >>> 0;
  }
  const pick = (ramp, v) => ramp[v <= 0 ? 0 : v >= 0.9999 ? ramp.length - 1 : (v * ramp.length) | 0];

  // ---- floor material shaders: (x, y, i=noise index, lf) -> c32 ----------------
  function grassLike(ramp, x, y, i, lf, lush) {
    const a = NA[i], b = NB[i], cc = NC[i], d = ND[i];
    let v = 0.26 + lf * 0.42 + (a - 0.5) * 0.46 + (b - 0.5) * 0.26;
    // clumped leafy micro texture
    if (cc > 0.72) v += 0.11; else if (cc < 0.22) v -= 0.1;
    v += (d - 0.5) * 0.06;
    // grass blades: short vertical strokes (light tip over dark base)
    const hsh = RS.hash2(x, (y + (x & 1)) >> 1, 77) & 255;
    if (hsh < (lush || 9)) v += ((y + (x & 1)) & 1) ? -0.14 : 0.18;
    return pick(ramp, v);
  }
  function forestFloor(x, y, i, lf) {
    const r = ramps();
    const a = NA[i], b = NB[i], cc = NC[i];
    let v = 0.3 + lf * 0.35 + (a - 0.5) * 0.45 + (b - 0.5) * 0.3;
    // leaf litter clusters
    const lit = NE[i] * 0.6 + b * 0.4;
    if (lit > 0.6 && cc > 0.55) {
      const h = RS.hash2(x >> 1, y, 5) & 7;
      return r.litter[Math.min(3, (h >> 1) + (cc > 0.8 ? 1 : 0))];
    }
    if (cc > 0.7) v += 0.15; else if (cc < 0.22) v -= 0.12;
    return pick(r.forest, v);
  }
  function deepFloor(x, y, i, lf) {
    const r = ramps();
    let v = 0.35 + (NA[i] - 0.5) * 0.4 + (NC[i] - 0.5) * 0.3 + lf * 0.2;
    return pick(r.deep, v);
  }
  function dirt(x, y, i, lf) {
    const r = ramps();
    const a = NA[i], b = NB[i], cc = NC[i], d = ND[i];
    let v = 0.35 + lf * 0.3 + (a - 0.5) * 0.4 + (b - 0.5) * 0.35 + (d - 0.5) * 0.12;
    if (cc > 0.78) v += 0.18;
    // pebbles
    const hsh = RS.hash2(x >> 1, y >> 1, 31) & 1023;
    if (hsh < 10) return ((x + y) & 1) ? r.dirt[4] : r.cobble[3];
    return pick(r.dirt, v);
  }
  // Voronoi cobbles
  function cobbleCell(x, y, cell, seed) {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    let d1 = 1e9, d2 = 1e9, id = 0, cxp = 0, cyp = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const hx = gx + ox, hy = gy + oy;
      const h = RS.hash2(hx, hy, seed);
      const px = (hx + 0.2 + ((h & 255) / 255) * 0.6) * cell;
      const py = (hy + 0.2 + (((h >>> 8) & 255) / 255) * 0.6) * cell;
      const dd = (x + 0.5 - px) * (x + 0.5 - px) + (y + 0.5 - py) * (y + 0.5 - py);
      if (dd < d1) { d2 = d1; d1 = dd; id = h; cxp = px; cyp = py; } else if (dd < d2) d2 = dd;
    }
    return { edge: Math.sqrt(d2) - Math.sqrt(d1), id, dx: x + 0.5 - cxp, dy: y + 0.5 - cyp };
  }
  // anisotropic voronoi (cell cw x ch)
  function vcell(x, y, cw, ch, seed) {
    const gx = Math.floor(x / cw), gy = Math.floor(y / ch);
    let d1 = 1e9, d2 = 1e9, id = 0, cxp = 0, cyp = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const hx = gx + ox, hy = gy + oy;
      const h = RS.hash2(hx, hy, seed);
      const px = (hx + 0.15 + ((h & 255) / 255) * 0.7) * cw;
      const py = (hy + 0.15 + (((h >>> 8) & 255) / 255) * 0.7) * ch;
      const ddx = (x + 0.5 - px), ddy = (y + 0.5 - py) * (cw / ch);
      const dd = ddx * ddx + ddy * ddy;
      if (dd < d1) { d2 = d1; d1 = dd; id = h; cxp = px; cyp = py; } else if (dd < d2) d2 = dd;
    }
    return { edge: Math.sqrt(d2) - Math.sqrt(d1), id, dx: x + 0.5 - cxp, dy: y + 0.5 - cyp };
  }
  function cobble(x, y, i, lf, mossy) {
    const r = ramps();
    const cl = cobbleCell(x, y, 7, 911);
    if (cl.edge < 1.1) {
      if (mossy && NB[i] > 0.52) return r.moss[(NC[i] * 2.99) | 0];
      return r.cobble[cl.edge < 0.5 ? 0 : 1];
    }
    let v = 0.45 + (((cl.id >>> 16) & 255) / 255 - 0.5) * 0.35 + (NB[i] - 0.5) * 0.2 + lf * 0.1;
    // top-left light inside each stone
    v += (-cl.dx - cl.dy) * 0.035;
    if (NC[i] > 0.82) v -= 0.12;
    return pick(r.cobble, v);
  }
  function sand(x, y, i, lf) {
    const r = ramps();
    const a = NA[i], b = NB[i], d = ND[i];
    let v = 0.5 + lf * 0.25 + (a - 0.5) * 0.35 + (b - 0.5) * 0.2 + (d - 0.5) * 0.1;
    // wind ripples
    const rip = Math.sin(x * 0.18 + y * 0.62 + NA[i] * 9);
    if (rip > 0.93) v -= 0.18;
    const hsh = RS.hash2(x, y, 55) & 1023;
    if (hsh < 6) v += 0.3;
    return pick(r.sand, v);
  }
  function mud(x, y, i, lf) {
    const r = ramps();
    let v = 0.4 + (NA[i] - 0.5) * 0.5 + (NB[i] - 0.5) * 0.3 + lf * 0.2;
    if (NC[i] > 0.8 && NB[i] > 0.55) return c(P.swamp4); // wet sheen
    return pick(r.mud, v);
  }
  function rockGround(ramp, x, y, i, lf) {
    const a = NA[i], b = NB[i];
    // natural bedrock: broad tonal patches, sparse broken cracks with a lit lip
    const cl = vcell(x, y, 30, 22, 808);
    let v = 0.42 + lf * 0.22 + (a - 0.5) * 0.42 + (((cl.id >>> 8) & 255) / 255 - 0.5) * 0.1 + (b - 0.5) * 0.12;
    if (NC[i] > 0.76) v += 0.1; else if (NC[i] < 0.2) v -= 0.08;
    const crackOn = NB[((y + 90) & TMASK) * TW + ((x + 40) & TMASK)] > 0.45;
    if (cl.edge < 0.7 && crackOn) return ramp[1];
    if (cl.edge < 1.6 && crackOn && (cl.dx + cl.dy) < 0) v += 0.12;
    const pb = RS.hash2(x >> 1, y >> 1, 211) & 1023;
    if (pb < 7) return ramp[(y & 1) ? 1 : 4];
    return pick(ramp, v);
  }
  function gravel(x, y, i, lf) {
    const r = ramps();
    const cl = cobbleCell(x, y, 3, 313);
    let v = 0.35 + (((cl.id >>> 12) & 255) / 255) * 0.4 + (NA[i] - 0.5) * 0.3 + lf * 0.15;
    if (cl.edge < 0.6) v -= 0.25;
    return pick(r.gravel, v);
  }
  function canyon(x, y, i, lf) {
    const r = ramps();
    let v = 0.42 + lf * 0.25 + (NA[i] - 0.5) * 0.45 + (NB[i] - 0.5) * 0.22;
    if (NC[i] > 0.74) v += 0.12; else if (NC[i] < 0.2) v -= 0.1;
    // sparse pebbles with a lit top and shadowed base
    const pb = RS.hash2(x >> 1, y >> 1, 131) & 1023;
    if (pb < 9) return (y & 1) ? r.canyon[1] : r.canyon[5];
    const crack = Math.abs(NB[((y + 60) & TMASK) * TW + ((x + 100) & TMASK)] - 0.5);
    if (crack < 0.007 && NA[i] > 0.45) return r.canyon[1];
    return pick(r.canyon, v);
  }
  function ruinFloor(x, y, i, lf) {
    const r = ramps();
    // offset slabs 12x10
    const row = Math.floor(y / 10);
    const off = (RS.hash2(row, 0, 17) % 12);
    const sx = x + off, col = Math.floor(sx / 12);
    const lx = sx - col * 12, ly = y - row * 10;
    const slab = RS.hash2(col, row, 23);
    const missing = (slab & 15) === 0 || NE[i] > 0.72;
    if (missing) return grassLike(r.grass, x, y, i, lf * 0.6);
    if (lx === 0 || ly === 0) return (NB[i] > 0.5) ? r.moss[1] : r.ruin[1];
    let v = 0.45 + (((slab >>> 8) & 255) / 255 - 0.5) * 0.3 + (NB[i] - 0.5) * 0.2;
    if (lx === 1 || ly === 1) v += 0.14;
    const crack = Math.abs(NB[((y * 2 + 40) & TMASK) * TW + ((x * 2) & TMASK)] - 0.5);
    if (crack < 0.02 && ((slab >>> 4) & 3) === 0) return r.ruin[0];
    if (NC[i] > 0.83) return r.moss[2];
    return pick(r.ruin, v);
  }
  function sanctum(x, y, i, lf) {
    const r = ramps();
    const cl = cobbleCell(x, y, 9, 707);
    if (cl.edge < 1) return r.sanctum[0];
    let v = 0.45 + (((cl.id >>> 16) & 255) / 255 - 0.5) * 0.3 + (NB[i] - 0.5) * 0.2 + (-cl.dx - cl.dy) * 0.03;
    if (NC[i] > 0.86) return r.moss[1];
    return pick(r.sanctum, v);
  }
  function plank(x, y, i, vertical) {
    const r = ramps();
    const u = vertical ? x : y, v2 = vertical ? y : x;
    const board = Math.floor(u / 4);
    const lu = u - board * 4;
    if (lu === 3) return r.plank[0];
    const h = RS.hash2(board, Math.floor(v2 / 18), 99);
    let v = 0.45 + ((h & 255) / 255 - 0.5) * 0.3 + (NB[i] - 0.5) * 0.2;
    if (lu === 0) v += 0.15;
    if (((v2 + (h & 15)) % 18) === 0) return r.plank[1];
    return pick(r.plank, v);
  }

  function floorColor(mat, x, y, i, lf) {
    const r = ramps();
    switch (mat) {
      case MAT.GRASS: return grassLike(r.grass, x, y, i, lf);
      case MAT.MEADOW: return grassLike(r.meadow, x, y, i, lf, 22);
      case MAT.FOREST: return forestFloor(x, y, i, lf);
      case MAT.DEEPFOREST: return deepFloor(x, y, i, lf);
      case MAT.DIRT: return dirt(x, y, i, lf);
      case MAT.COBBLE: return cobble(x, y, i, lf, true);
      case MAT.SAND: return sand(x, y, i, lf);
      case MAT.MUD: return mud(x, y, i, lf);
      case MAT.ROCK: return rockGround(r.rock, x, y, i, lf);
      case MAT.GRAVEL: return gravel(x, y, i, lf);
      case MAT.CANYON: return canyon(x, y, i, lf);
      case MAT.RUIN: return ruinFloor(x, y, i, lf);
      case MAT.SWAMP: return grassLike(r.swamp, x, y, i, lf, 18);
      case MAT.SANCTUM: return sanctum(x, y, i, lf);
      case MAT.MOUNT: return rockGround(r.mount, x, y, i, lf);
      case MAT.PLANK: return plank(x, y, i, false);
      default:
        if (RS.DungeonShaders && RS.DungeonShaders[mat]) return RS.DungeonShaders[mat](x, y, i, lf);
        return r.ink1;
    }
  }

  // visual layering for same-height material transitions (higher layer outlines onto lower)
  const LAYER = {};
  LAYER[MAT.SEA] = 0; LAYER[MAT.WATER] = 0; LAYER[MAT.MARSH] = 0; LAYER[MAT.CHASM] = 0;
  LAYER[MAT.MUD] = 1; LAYER[MAT.SAND] = 2; LAYER[MAT.DIRT] = 3; LAYER[MAT.GRAVEL] = 3; LAYER[MAT.COBBLE] = 3;
  LAYER[MAT.RUIN] = 3; LAYER[MAT.SANCTUM] = 3; LAYER[MAT.CANYON] = 3; LAYER[MAT.ROCK] = 4; LAYER[MAT.PLANK] = 3;
  LAYER[MAT.GRASS] = 5; LAYER[MAT.MEADOW] = 5; LAYER[MAT.SWAMP] = 5; LAYER[MAT.FOREST] = 5; LAYER[MAT.DEEPFOREST] = 6;
  LAYER[MAT.MOUNT] = 7; LAYER[MAT.CLIFF] = 8;
  const isWaterMat = (m) => m === MAT.SEA || m === MAT.WATER || m === MAT.MARSH || m === MAT.DWATER;
  const isGrassMat = (m) => m === MAT.GRASS || m === MAT.MEADOW || m === MAT.SWAMP || m === MAT.FOREST || m === MAT.DEEPFOREST;

  // ---- per-level precomputation ------------------------------------------------
  function prepare(level) {
    initNoise(level.seed | 0);
    ramps();
    const w = level.w, h = level.h, n = w * h;
    const key = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
      let m = level.mat[i];
      const k = level.kind[i];
      if (k === K.FACE || k === K.FALLS) m = MAT.CLIFF;
      else if (k === K.STAIRS) m = MAT.CLIFF;
      key[i] = (m << 3) | (level.hgt[i] & 7);
    }
    level._key = key;
    // water depth field (tiles from non-water)
    const wd = new Float32Array(n).fill(0);
    const isW = (i) => {
      const k = level.kind[i];
      return (k === K.WATER || (level.kind[i] === K.BRIDGE && isWaterMat(level.mat[i])));
    };
    const starts = [];
    for (let i = 0; i < n; i++) if (!isW(i)) starts.push(i);
    const dist = RS.bfs(w, h, starts, (ni) => isW(ni), 8);
    for (let i = 0; i < n; i++) wd[i] = dist[i] < 0 ? 8 : dist[i];
    level._wdepth = wd;
    // low-frequency lighting per tile corner
    const vn = RS.makeValueNoise(level.seed + 911);
    const lfc = new Float32Array((w + 1) * (h + 1));
    for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) lfc[y * (w + 1) + x] = vn.fbm(x / 7, y / 7, 3, 2, 0.5);
    level._lf = lfc;
  }

  // ---- chunk rendering ------------------------------------------------------------
  function renderChunk(level, cx, cy) {
    if (!level._key) prepare(level);
    RS.Terrain.currentTheme = level.theme || null;
    const r = ramps();
    const w = level.w, h = level.h;
    const key = level._key, wdep = level._wdepth, lfc = level._lf;
    const cv = RS.Art.makeCanvas(CP, CP);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(CP, CP);
    const out = new Uint32Array(img.data.buffer);
    const foam = [];
    const tx0 = cx * CT, ty0 = cy * CT;
    const kAt = (x, y) => key[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];
    const iAt = (x, y) => (y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x);
    const cornerK = new Uint16Array(4), cornerI = new Int32Array(4), cornerW = new Float32Array(4);
    const keysU = new Uint16Array(4), keysW = new Float32Array(4), keysBest = new Int32Array(4), keysBW = new Float32Array(4);
    const keysDX = new Float32Array(4), keysDY = new Float32Array(4);

    for (let ty = ty0; ty < ty0 + CT; ty++) {
      if (ty >= h) break;
      for (let tx = tx0; tx < tx0 + CT; tx++) {
        if (tx >= w) break;
        const ti = ty * w + tx;
        const k0 = key[ti];
        let uniform = true;
        for (let oy = -1; oy <= 1 && uniform; oy++) for (let ox = -1; ox <= 1; ox++) if (kAt(tx + ox, ty + oy) !== k0) { uniform = false; break; }
        const lf00 = lfc[ty * (w + 1) + tx], lf10 = lfc[ty * (w + 1) + tx + 1], lf01 = lfc[(ty + 1) * (w + 1) + tx], lf11 = lfc[(ty + 1) * (w + 1) + tx + 1];
        for (let sy = 0; sy < TS; sy++) {
          const py = ty * TS + sy;
          const fyl = (sy + 0.5) / TS;
          for (let sx = 0; sx < TS; sx++) {
            const px = tx * TS + sx;
            const ni = ((py & TMASK) << 9) | (px & TMASK);
            const fxl = (sx + 0.5) / TS;
            const lf = (lf00 * (1 - fxl) + lf10 * fxl) * (1 - fyl) + (lf01 * (1 - fxl) + lf11 * fxl) * fyl;
            let col;
            if (uniform) {
              col = shadeTile(level, k0, ti, px, py, ni, lf, -1, 99, 0, 0, sx, sy);
            } else {
              // dual grid cell
              const gx = (px + 0.5 - 8) / TS, gy = (py + 0.5 - 8) / TS;
              const ax = Math.floor(gx), ay = Math.floor(gy);
              const fx = gx - ax, fy = gy - ay;
              cornerI[0] = iAt(ax, ay); cornerI[1] = iAt(ax + 1, ay); cornerI[2] = iAt(ax, ay + 1); cornerI[3] = iAt(ax + 1, ay + 1);
              cornerW[0] = (1 - fx) * (1 - fy); cornerW[1] = fx * (1 - fy); cornerW[2] = (1 - fx) * fy; cornerW[3] = fx * fy;
              let nk = 0;
              for (let q = 0; q < 4; q++) {
                const kk = key[cornerI[q]];
                cornerK[q] = kk;
                let j = 0;
                while (j < nk && keysU[j] !== kk) j++;
                const rx = (q & 1 ? 1 : 0) - fx, ry = (q & 2 ? 1 : 0) - fy;
                if (j === nk) { keysU[nk] = kk; keysW[nk] = 0; keysBW[nk] = -1; keysDX[nk] = 0; keysDY[nk] = 0; nk++; }
                keysW[j] += cornerW[q];
                keysDX[j] += rx * cornerW[q]; keysDY[j] += ry * cornerW[q];
                if (cornerW[q] > keysBW[j]) { keysBW[j] = cornerW[q]; keysBest[j] = cornerI[q]; }
              }
              let b1 = -1, b2 = -1, s1 = -9, s2 = -9;
              for (let j = 0; j < nk; j++) {
                const kk = keysU[j];
                const m = kk >> 3;
                // edge noise, key-specific offsets
                const ox = (kk * 97) & TMASK, oy = (kk * 57) & TMASK;
                const nidx = (((py + oy) & TMASK) << 9) | ((px + ox) & TMASK);
                let amp = 0.34;
                if (m === MAT.CLIFF) amp = 0.18;
                else if (m === MAT.COBBLE || m === MAT.RUIN || m === MAT.SANCTUM || m === MAT.PLANK) amp = 0.22;
                const s = keysW[j] + (NB[nidx] * 0.6 + NC[nidx] * 0.4 - 0.5) * amp + (m === MAT.CLIFF ? 0.02 : 0);
                if (s > s1) { s2 = s1; b2 = b1; s1 = s; b1 = j; } else if (s > s2) { s2 = s; b2 = j; }
              }
              const kw = keysU[b1];
              const tIdx = keysBest[b1];
              if (nk === 1 || b2 < 0) col = shadeTile(level, kw, tIdx, px, py, ni, lf, -1, 99, 0, 0, sx, sy);
              else {
                const d = (s1 - s2) * 8; // approx px to boundary
                // direction from this pixel towards the runner-up key's corners
                const ddx = keysDX[b2] / Math.max(0.0001, keysW[b2]), ddy = keysDY[b2] / Math.max(0.0001, keysW[b2]);
                col = shadeTile(level, kw, tIdx, px, py, ni, lf, keysU[b2], d, ddx, ddy, sx, sy, keysBest[b2]);
              }
              // foam collection: water pixels right at a land edge
              if ((kw >> 3) === MAT.SEA || (kw >> 3) === MAT.WATER) {
                if (b2 >= 0) {
                  const m2 = keysU[b2] >> 3;
                  if (!isWaterMat(m2) && (s1 - s2) * 8 < 2.2) foam.push((px - tx0 * TS) | ((py - ty0 * TS) << 8) | (((s1 - s2) * 8 < 1.0 ? 0 : 1) << 16));
                }
              }
            }
            out[(py - ty0 * TS) * CP + (px - tx0 * TS)] = col;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    const chunk = { canvas: cv, foam: Int32Array.from(foam), cx, cy };
    drawStructures(level, chunk, ctx);
    drawChunkDecals(level, chunk, ctx);
    return chunk;
  }

  // Core per-pixel shader for the winning key. k2/d/ddx/ddy describe the nearest other key.
  function shadeTile(level, kk, ti, px, py, ni, lf, k2, d, ddx, ddy, sx, sy, t2) {
    const r = ramps();
    const m = kk >> 3, hh = kk & 7;
    const m2 = k2 >= 0 ? (k2 >> 3) : -1, h2 = k2 >= 0 ? (k2 & 7) : 0;
    const w = level.w;
    // ---- water ----
    if (isWaterMat(m)) {
      const ramp = m === MAT.MARSH ? r.marsh : r.sea;
      // interpolated depth across the dual cell
      const gx = (px + 0.5 - 8) / TS, gy = (py + 0.5 - 8) / TS;
      const ax = Math.floor(gx), ay = Math.floor(gy), fx = gx - ax, fy = gy - ay;
      const W = level.w, H = level.h;
      const dp = (x, y) => level._wdepth[(y < 0 ? 0 : y >= H ? H - 1 : y) * W + (x < 0 ? 0 : x >= W ? W - 1 : x)];
      let depth = (dp(ax, ay) * (1 - fx) + dp(ax + 1, ay) * fx) * (1 - fy) + (dp(ax, ay + 1) * (1 - fx) + dp(ax + 1, ay + 1) * fx) * fy;
      depth += (NA[ni] - 0.5) * 0.9 + (NB[ni] - 0.5) * 0.35;
      if (m === MAT.SEA) depth *= 0.85; else if (m === MAT.MARSH) depth *= 1.4; else depth *= 1.25;
      let idx;
      if (m === MAT.MARSH) idx = depth < 0.9 ? 3 : depth < 1.7 ? 2 : depth < 2.8 ? 1 : 0;
      else idx = depth < 0.75 ? 5 : depth < 1.35 ? 4 : depth < 2.2 ? 3 : depth < 3.4 ? 2 : depth < 5 ? 1 : 0;
      if (m === MAT.WATER) idx = Math.max(2, idx);
      // shore edge
      if (m2 >= 0 && !isWaterMat(m2) && d < 3.2) {
        if (m2 === MAT.CLIFF) { if (d < 1.4 && ddy < 0) return r.foam; }
        else if (d < 1.1) return m === MAT.MARSH ? r.marsh[4] : r.sea[7];
        else if (d < 3.2) idx = Math.max(idx, m === MAT.MARSH ? 3 : 5);
      }
      // static ripples
      const rip = NB[((py * 2) & TMASK) * TW + ((px + (py >> 3) * 5) & TMASK)];
      if (rip > 0.8 && idx >= 1 && idx <= 4) idx += 1;
      return ramp[Math.min(ramp.length - 1, idx)];
    }
    // ---- chasm ----
    if (m === MAT.CHASM || m === MAT.DPIT) {
      const tyy = Math.floor(py / TS);
      const txx = Math.floor(px / TS);
      const above = level.inb(txx, tyy - 1) ? level.kind[(tyy - 1) * w + txx] : K.CHASM;
      const aboveOpen = above !== K.CHASM && above !== K.PIT;
      if (m2 >= 0 && m2 !== MAT.CHASM && m2 !== MAT.DPIT && d < 1.2 && ddy >= -0.2) return r.ink1;
      const above2 = level.inb(txx, tyy - 2) ? level.kind[(tyy - 2) * w + txx] : K.CHASM;
      const style = m === MAT.DPIT ? r.faceDark : (level._chasmStyle === 1 ? r.faceRock : r.faceSand);
      let v = -1;
      if (aboveOpen) v = sy;
      else if (above2 !== K.CHASM && above2 !== K.PIT) v = sy + 16;
      if (v >= 0) {
        v += (NB[ni] - 0.5) * 5;
        // strata of the far wall fading into darkness
        const band = Math.floor((v + ((RS.hash2(px >> 3, 0, 5) & 3))) / 4);
        const lit = (band & 1) ? 0 : 1;
        if (v < 2) return style[5];
        if (v < 8) return style[3 + lit];
        if (v < 14) return style[2 + lit];
        if (v < 19) return style[1 + (lit && NC[ni] > 0.5 ? 1 : 0)];
        if (v < 24) return (NC[ni] > 0.45) ? r.ink1 : style[0];
        if (v < 28) return (NC[ni] > 0.7) ? r.ink1 : r.ink0;
        return r.black;
      }
      return (NC[ni] > 0.93 && NB[ni] > 0.5) ? r.ink0 : r.black;
    }
    // ---- cliff face ----
    if (m === MAT.CLIFF) return faceColor(level, ti, px, py, ni, lf, m2, h2, d, ddx, ddy);
    // ---- floors ----
    let col = floorColor(m, px, py, ni, lf + (hh - 1) * 0.06);
    if (m2 < 0 || d > 6) return col;
    // edge effects
    if (m2 === MAT.CLIFF) {
      const faceTile = t2 !== undefined ? t2 : -1;
      const faceH = faceTile >= 0 ? level.hgt[faceTile] : hh;
      if (hh > faceH) {
        // plateau rim above a face: bright lip
        if (d < 1.1) return shade(col, 1.25);
        if (d < 2.2 && isGrassMat(m)) return shade(col, 0.82);
      } else if (ddy < -0.15) {
        // ground below a face: cast shadow
        if (d < 1.2) return shade(col, 0.42);
        if (d < 3.4 + NC[ni] * 1.5) return shade(col, 0.66);
        if (d < 5.5 && ((px + py) & 3) === 0 && NB[ni] > 0.5) return shade(col, 0.8);
      } else if (d < 1.1) return shade(col, 0.6);
      return col;
    }
    if (isWaterMat(m2)) {
      if (d < 1.1) return shade(col, m === MAT.SAND ? 0.74 : 0.6);
      if (m === MAT.SAND && d < 3.5 + NC[ni]) return shade(col, 0.86);
      if (isGrassMat(m) && d < 2.2) return r.dirt[2];
      return col;
    }
    if (m2 === MAT.CHASM || m2 === MAT.DPIT) {
      if (d < 1.1) return shade(col, 1.2);
      if (d < 2.1) return shade(col, 0.7);
      return col;
    }
    if (h2 !== hh && m2 !== MAT.MOUNT) {
      if (hh > h2) {
        // raised side/north lip: dark outer line, rocky band, then a lit grass rim
        const northEdge = ddy < -0.3 && Math.abs(ddx) < 0.4;
        const band = northEdge ? 2.4 : 3.6;
        if (d < 1.0) return r.ink1;
        if (d < band) {
          const rc = floorColor(MAT.ROCK, px, py, ni, lf);
          const lit = ddx > 0.2 ? 0.82 : ddx < -0.2 ? 1.0 : 1.12;
          return shade(rc, d < 2 ? lit * 0.85 : lit);
        }
        if (d < band + 1.2 && isGrassMat(m)) return shade(col, 1.14);
      } else {
        // lower side: shadow when the higher ground is north or west
        if ((ddx < -0.2 || ddy < -0.2) && d < 3 + NC[ni] * 1.2) return shade(col, d < 1.2 ? 0.5 : 0.7);
      }
      return col;
    }
    if (m2 === MAT.MOUNT) {
      if (d < 1.2) return shade(col, 0.55);
      return col;
    }
    const L1 = LAYER[m] || 0, L2 = LAYER[m2] || 0;
    if (L1 > L2) {
      // this material sits on top: darker outline at its edge
      if (d < 1.0) return shade(col, isGrassMat(m) ? 0.72 : 0.8);
      if (d < 2.0 && isGrassMat(m) && ((RS.hash2(px, py, 3) & 3) === 0)) return shade(col, 1.12);
    } else if (L1 < L2) {
      // lower material: soft contact shadow under the higher one
      if (d < 1.2) return shade(col, 0.7);
      if (d < 2.0 && (ddy < 0 || ddx < 0)) return shade(col, 0.85);
    }
    return col;
  }

  function faceRamp(style) {
    const r = ramps();
    switch (style) {
      case 1: return r.faceSand; case 2: return r.faceEarth; case 3: return r.faceMoss; case 4: return r.faceDark;
      case 5: return r.faceTemple || (r.faceTemple = [P.ink1, P.bone0, P.bone1, P.bone2, P.bone3, P.bone4].map(c));
      case 6: return r.faceEmber || (r.faceEmber = ['#140a08', '#24120d', '#3a1d14', '#52291b', '#6b3622', '#86462c'].map(c));
      default: return r.faceRock;
    }
  }

  function faceColor(level, ti, px, py, ni, lf, m2, h2, d, ddx, ddy) {
    const r = ramps();
    const f = level.face[ti];
    const row = f & 3, depth = Math.max(1, (f >> 2) & 3), style = (f >> 4) & 7;
    const ramp = faceRamp(style);
    const tyy = (ti / level.w) | 0;
    const top = (tyy - row) * TS;
    const fy = py - top;              // 0..depth*16
    const hpx = depth * TS;
    const v = RS.M.clamp(fy / hpx, 0, 1);
    if (level.kind[ti] === K.FALLS) {
      const s = NB[((py >> 1) & TMASK) * TW + ((px * 7) & TMASK)] + NC[ni] * 0.3;
      return r.sea[s > 0.85 ? 8 : s > 0.6 ? 7 : 6];
    }
    if (style === 5) {
      // sunken temple masonry: offset brick courses with lit top edges and moss in joints
      const course = Math.floor(fy / 5), lyb = fy - course * 5;
      const bx = px + (course & 1) * 5;
      const bi = Math.floor(bx / 10), lxb = bx - bi * 10;
      const hb = RS.hash2(bi, course + tyy * 7, 91);
      let t = 0.62 - v * 0.35 + ((hb & 255) / 255 - 0.5) * 0.2;
      if (lyb === 4 || lxb === 9) { if (NB[ni] > 0.62) return r.moss[1]; t = 0.08; }
      else if (lyb === 0 || lxb === 0) t += 0.16;
      if (m2 >= 0 && ddy > 0.15 && d < 1.2) return ramp[0];
      if (m2 >= 0 && h2 > level.hgt[ti] && ddy < -0.1 && d < 1.2) return r.ink1;
      return pick(ramp, t);
    }
    // rock columns of irregular width (2-3 per 24px block), wandering slightly, with fractures
    const wob = Math.round((NA[((py >> 1) & TMASK) * TW + ((px >> 3) & TMASK)] - 0.5) * 3);
    const X = px + wob;
    const blk = Math.floor(X / 24);
    const hb = RS.hash2(blk, 5, 44 + style);
    const o1 = 6 + (hb % 7), o2 = o1 + 6 + ((hb >> 4) % 6);
    const lxb = X - blk * 24;
    let ci, c0, cw;
    if (lxb < o1) { ci = 0; c0 = 0; cw = o1; }
    else if (lxb < o2 || o2 >= 22) { ci = 1; c0 = o1; cw = (o2 >= 22 ? 24 : o2) - o1; }
    else { ci = 2; c0 = o2; cw = 24 - o2; }
    const lx = lxb - c0;
    const hc = RS.hash2(blk * 3 + ci, 9, 45);
    const protrude = ((hc & 255) / 255 - 0.5) * 0.24;
    const fstep = 7 + ((hc >> 8) % 7);
    const fyo = (py + ((hc >> 12) & 15)) % fstep;
    let t = 0.72 - v * 0.42 + protrude + (NC[ni] - 0.5) * 0.12;
    if (lx === 0) t -= 0.36;                 // crevice between columns
    else if (lx === 1) t += 0.18;            // lit left edge
    else if (lx === cw - 1) t -= 0.12;       // shaded right edge
    if (fyo === 0 && lx > 0) t -= 0.28;      // horizontal fracture
    else if (fyo === 1 && lx > 0) t += 0.12; // lit ledge under the fracture
    // overall top light, bottom occlusion
    if (fy < 3) t += 0.12;
    if (fy > hpx - 4) t -= 0.14;
    const ledge = fyo === 1 && lx > 1 && lx < cw - 1;
    if (m2 >= 0) {
      if (h2 > (level.hgt[ti]) && ddy < -0.1) {
        if (d < 1.2) return r.ink1;        // shadow under the plateau lip
        if (d < 2.4) t -= 0.22;
      } else if (ddy > 0.15) {
        if (d < 1.2) return ramp[0];       // contact with the ground
        if (d < 2.4) t -= 0.16;
      } else if (d < 1.3) {
        return ramp[0];                    // face ends
      } else if (d < 2.6) t -= 0.1;
    }
    if (style === 6 && lx === 0 && NB[ni] > 0.55) return c(P.emb2);
    if (style === 3 && ((NE[ni] > 0.55 && NC[ni] > 0.5 && v < 0.7) || (ledge && NB[ni] > 0.55))) return r.moss[1 + ((NB[ni] * 2.99) | 0)];
    if (style === 2 && NE[ni] > 0.62 && NC[ni] > 0.6) return r.litter[1];
    if (ledge && NB[ni] > 0.8 && (style === 0 || style === 2)) return r.moss[2];
    return pick(ramp, t);
  }

  // ---- baked structures: bridges and stairs -------------------------------------
  function drawStructures(level, chunk, ctx) {
    const w = level.w, h = level.h;
    const tx0 = chunk.cx * CT, ty0 = chunk.cy * CT;
    const isK = (x, y, k) => level.inb(x, y) && level.kind[y * w + x] === k;
    const pw = RS.PAL;
    for (let ty = Math.max(0, ty0 - 1); ty < Math.min(h, ty0 + CT + 1); ty++) {
      for (let tx = Math.max(0, tx0 - 1); tx < Math.min(w, tx0 + CT + 1); tx++) {
        const k = level.kind[ty * w + tx];
        const dx = (tx - tx0) * TS, dy = (ty - ty0) * TS;
        if (k === K.BRIDGE) {
          const walk = (x, y) => level.inb(x, y) && (level.kind[y * w + x] === K.BRIDGE || level.kind[y * w + x] === K.FLOOR);
          const hn = (walk(tx - 1, ty) ? 1 : 0) + (walk(tx + 1, ty) ? 1 : 0);
          const vn = (walk(tx, ty - 1) ? 1 : 0) + (walk(tx, ty + 1) ? 1 : 0);
          let horizontal = hn > vn;
          if (hn === vn) horizontal = !(walk(tx, ty - 1) || walk(tx, ty + 1)) || (isK(tx - 1, ty, K.BRIDGE) || isK(tx + 1, ty, K.BRIDGE));
          if (level._bridgeDir && level._bridgeDir[ty * w + tx]) horizontal = level._bridgeDir[ty * w + tx] === 1;
          drawBridgeTile(ctx, dx, dy, horizontal, level, tx, ty);
        } else if (k === K.STAIRS) {
          drawStairTile(ctx, dx, dy, level, tx, ty);
        }
      }
    }
  }

  function drawBridgeTile(ctx, dx, dy, horizontal, level, tx, ty) {
    const w = level.w;
    const same = (x, y) => level.inb(x, y) && level.kind[y * w + x] === K.BRIDGE;
    const pw = RS.PAL;
    const planks = [pw.earth3, pw.earth4, pw.earth5, pw.earth4];
    if (horizontal) {
      // walking east-west: boards run vertically, rails on north & south edges
      const bridgeTop = !same(tx, ty - 1), bridgeBot = !same(tx, ty + 1);
      const y0 = bridgeTop ? 3 : 0, y1 = bridgeBot ? 13 : 16;
      for (let x = 0; x < TS; x++) {
        const bi = ((tx * TS + x) >> 2);
        const cc = x % 4 === 3 ? pw.earth2 : planks[RS.hash2(bi, ty, 7) & 3];
        ctx.fillStyle = cc; ctx.fillRect(dx + x, dy + y0, 1, y1 - y0);
        if (x % 4 === 0) { ctx.fillStyle = pw.earth6; ctx.fillRect(dx + x, dy + y0, 1, 1); }
      }
      if (bridgeTop) { ctx.fillStyle = pw.earth2; ctx.fillRect(dx, dy + 1, TS, 2); ctx.fillStyle = pw.earth5; ctx.fillRect(dx, dy + 1, TS, 1); }
      if (bridgeBot) { ctx.fillStyle = pw.ink1; ctx.fillRect(dx, dy + 13, TS, 1); ctx.fillStyle = pw.earth2; ctx.fillRect(dx, dy + 14, TS, 2); ctx.fillStyle = pw.earth4; ctx.fillRect(dx, dy + 14, TS, 1); ctx.fillStyle = 'rgba(8,10,24,0.35)'; ctx.fillRect(dx, dy + 16, TS, 2); }
      // posts at rail every 8px
      for (let x = 2; x < TS; x += 8) {
        if (bridgeTop) { ctx.fillStyle = pw.earth1; ctx.fillRect(dx + x, dy, 2, 4); ctx.fillStyle = pw.earth5; ctx.fillRect(dx + x, dy, 1, 1); }
        if (bridgeBot) { ctx.fillStyle = pw.earth1; ctx.fillRect(dx + x, dy + 12, 2, 4); ctx.fillStyle = pw.earth5; ctx.fillRect(dx + x, dy + 12, 1, 1); }
      }
    } else {
      const left = !same(tx - 1, ty), right = !same(tx + 1, ty);
      const x0 = left ? 3 : 0, x1 = right ? 13 : 16;
      for (let y = 0; y < TS; y++) {
        const bi = ((ty * TS + y) >> 2);
        const cc = y % 4 === 3 ? pw.earth2 : planks[RS.hash2(tx, bi, 9) & 3];
        ctx.fillStyle = cc; ctx.fillRect(dx + x0, dy + y, x1 - x0, 1);
        if (y % 4 === 0) { ctx.fillStyle = pw.earth6; ctx.fillRect(dx + x0, dy + y, 2, 1); }
      }
      if (left) { ctx.fillStyle = pw.earth2; ctx.fillRect(dx + 1, dy, 2, TS); ctx.fillStyle = pw.earth5; ctx.fillRect(dx + 1, dy, 1, TS); }
      if (right) { ctx.fillStyle = pw.earth2; ctx.fillRect(dx + 13, dy, 2, TS); ctx.fillStyle = pw.earth4; ctx.fillRect(dx + 13, dy, 1, TS); ctx.fillStyle = 'rgba(8,10,24,0.35)'; ctx.fillRect(dx + 15, dy + 1, 2, TS); }
    }
  }

  function drawStairTile(ctx, dx, dy, level, tx, ty) {
    const w = level.w;
    const pw = RS.PAL;
    const same = (x, y) => level.inb(x, y) && level.kind[y * w + x] === K.STAIRS;
    const f = level.face[ty * w + tx];
    const style = (f >> 4) & 7;
    const pal = style === 1 ? [pw.cany2, pw.cany3, pw.cany4, pw.cany5, pw.cany6] : style === 2 ? [pw.earth2, pw.earth3, pw.bone3, pw.bone4, pw.bone5] : [pw.rock1, pw.rock2, pw.bone3, pw.bone4, pw.bone5];
    const left = !same(tx - 1, ty), right = !same(tx + 1, ty);
    const x0 = left ? 2 : 0, x1 = right ? 14 : 16;
    for (let y = 0; y < TS; y++) {
      const s = (ty * TS + y) % 5;
      const col = s === 0 ? pal[4] : s === 1 ? pal[3] : s === 4 ? pal[0] : pal[2];
      ctx.fillStyle = col; ctx.fillRect(dx + x0, dy + y, x1 - x0, 1);
    }
    // worn centre and chipped edges
    ctx.fillStyle = pal[1];
    for (let y = 0; y < TS; y += 5) {
      const hsh = RS.hash2(tx, ty * 4 + y, 3);
      if (hsh & 1) ctx.fillRect(dx + x0 + (hsh >> 3) % 10, dy + y + 2, 2, 1);
    }
    if (left) { ctx.fillStyle = pal[0]; ctx.fillRect(dx, dy, 2, TS); ctx.fillStyle = pal[2]; ctx.fillRect(dx, dy, 1, TS); }
    if (right) { ctx.fillStyle = pal[0]; ctx.fillRect(dx + 14, dy, 2, TS); ctx.fillStyle = pw.ink1; ctx.fillRect(dx + 15, dy, 1, TS); }
  }

  // ---- decals baked into chunks ----------------------------------------------------
  function drawChunkDecals(level, chunk, ctx) {
    const x0 = chunk.cx * CP, y0 = chunk.cy * CP;
    const list = level._decalGrid ? level._decalGrid.get(chunk.cy * 4096 + chunk.cx) : null;
    if (!list) return;
    for (const dcl of list) {
      const spr = RS.Sprites.get(dcl.s);
      if (!spr) continue;
      const img = dcl.f ? spr.flip : spr.canvas;
      ctx.drawImage(img, Math.round(dcl.x - spr.ax - x0), Math.round(dcl.y - spr.ay - y0));
    }
  }
  function indexDecals(level) {
    const g = new Map();
    for (const dcl of level.decals) {
      const spr = RS.Sprites.get(dcl.s);
      const ww = spr ? spr.canvas.width : 16, hh = spr ? spr.canvas.height : 16;
      const ax = spr ? spr.ax : 0, ay = spr ? spr.ay : 0;
      const minx = Math.floor((dcl.x - ax) / CP), maxx = Math.floor((dcl.x - ax + ww) / CP);
      const miny = Math.floor((dcl.y - ay) / CP), maxy = Math.floor((dcl.y - ay + hh) / CP);
      for (let cy = miny; cy <= maxy; cy++) for (let cx = minx; cx <= maxx; cx++) {
        const k = cy * 4096 + cx;
        let b = g.get(k); if (!b) { b = []; g.set(k, b); }
        b.push(dcl);
      }
    }
    for (const b of g.values()) b.sort((a, b2) => (a.z || 0) - (b2.z || 0) || a.y - b2.y);
    level._decalGrid = g;
  }

  function getChunk(level, cx, cy) {
    const k = cy * 4096 + cx;
    let ch = level.chunks.get(k);
    if (!ch) {
      if (!level._decalGrid) indexDecals(level);
      ch = renderChunk(level, cx, cy);
      level.chunks.set(k, ch);
    }
    return ch;
  }
  function chunkCount(level) { return Math.ceil(level.w / CT) * Math.ceil(level.h / CT); }
  // Render up to `budgetMs` of missing chunks (for background pre-rendering)
  function prerender(level, budgetMs, centerX, centerY) {
    const t0 = performance.now();
    const cw = Math.ceil(level.w / CT), chh = Math.ceil(level.h / CT);
    if (!level._order) {
      const order = [];
      for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) order.push([x, y]);
      const ccx = (centerX || 0) / CP, ccy = (centerY || 0) / CP;
      order.sort((a, b) => Math.hypot(a[0] + 0.5 - ccx, a[1] + 0.5 - ccy) - Math.hypot(b[0] + 0.5 - ccx, b[1] + 0.5 - ccy));
      level._order = order;
      level._orderPos = 0;
    }
    while (level._orderPos < level._order.length) {
      const [x, y] = level._order[level._orderPos];
      getChunk(level, x, y);
      level._orderPos++;
      if (performance.now() - t0 > budgetMs) break;
    }
    return level._orderPos / level._order.length;
  }

  // Draw terrain for the camera rect
  function draw(ctx, level, camX, camY, vw, vh, time) {
    const cx0 = Math.floor(camX / CP), cy0 = Math.floor(camY / CP);
    const cx1 = Math.floor((camX + vw - 1) / CP), cy1 = Math.floor((camY + vh - 1) / CP);
    const r = ramps();
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cy < 0 || cx * CT >= level.w || cy * CT >= level.h) continue;
      const ch = getChunk(level, cx, cy);
      const dx = cx * CP - camX, dy = cy * CP - camY;
      ctx.drawImage(ch.canvas, dx, dy);
      // animated shoreline foam
      if (ch.foam.length) {
        const t = time;
        for (let i = 0; i < ch.foam.length; i++) {
          const v = ch.foam[i];
          const x = v & 255, y = (v >> 8) & 255, band = (v >> 16) & 1;
          const wx = cx * CP + x, wy = cy * CP + y;
          const ph = Math.sin(t * 1.7 + wx * 0.11 + wy * 0.07) + Math.sin(t * 0.9 - wx * 0.05 + wy * 0.13) * 0.6;
          if (band === 0) {
            if (ph > 0.2) { ctx.fillStyle = ph > 0.9 ? P.sea9 : P.sea8; ctx.fillRect(dx + x, dy + y, 1, 1); }
          } else if (ph > 0.95) { ctx.fillStyle = P.sea8; ctx.fillRect(dx + x, dy + y, 1, 1); }
        }
      }
    }
  }

  RS.Terrain = { prepare, getChunk, prerender, draw, chunkCount, shade, ramps, initNoise, CP, CT, indexDecals, floorColor, isWaterMat,
    noise: () => ({ NA, NB, NC, ND, NE }) };
})();
