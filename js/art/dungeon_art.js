// Dungeon materials (per-pixel shaders) and dungeon props.
(function () {
  'use strict';
  const P = RS.PAL, A = RS.Art, S = RS.Sprites, MAT = RS.MAT;
  const c32 = (h) => RS.Color.c32(h);
  let R = null;
  function ramps() {
    if (R) return R;
    const m = (a) => a.map(c32);
    R = {
      moss: m([P.ink0, P.ink1, '#16242a', '#1d3033', '#243b3a', '#2e4a42']),
      mossTint: m([P.moss1, P.moss2, P.moss3, P.moss4]),
      temple: m([P.bone0, '#3f3e46', P.bone1, '#56555c', P.bone2, P.bone3]),
      roots: m(['#170d0b', '#241411', '#321c16', '#40261c', '#523223', '#653f2b']),
      wallMoss: m([P.ink0, P.ink1, '#142226', '#1b2d30']),
      wallTide: m([P.ink1, P.ink2, '#2a2b36', '#34353f']),
      wallEmber: m(['#0f0706', '#1b0d0a', '#2a1510', '#361b13']),
      lava: m([P.emb1, P.emb2, P.emb3, P.emb4, P.emb5, P.emb6]),
      ember: m([P.emb2, P.emb3, P.emb4]),
      arena: m([P.ink1, P.ink2, P.rock1, P.rock2, P.bone1, P.bone2])
    };
    return R;
  }
  const pick = (ramp, v) => ramp[v <= 0 ? 0 : v >= 0.9999 ? ramp.length - 1 : (v * ramp.length) | 0];

  function nz() { return RS.Terrain.noise(); }

  const SH = {};
  SH[MAT.MOSSCAVE] = (x, y, i, lf) => {
    const r = ramps(), N = nz();
    let v = 0.45 + (N.NA[i] - 0.5) * 0.5 + (N.NB[i] - 0.5) * 0.3 + lf * 0.2;
    if (N.NE[i] > 0.6 && N.NC[i] > 0.45) return pick(r.mossTint, v);
    if ((RS.hash2(x >> 1, y >> 1, 41) & 511) < 6) return r.moss[5];
    return pick(r.moss, v);
  };
  SH[MAT.TEMPLE] = (x, y, i, lf) => {
    const r = ramps(), N = nz();
    const row = Math.floor(y / 16), off = (row % 2) * 8;
    const lx = (x + off) % 16, ly = y % 16;
    const slab = RS.hash2(Math.floor((x + off) / 16), row, 61);
    if (lx === 0 || ly === 0) return r.temple[0];
    let v = 0.5 + (((slab >> 8) & 255) / 255 - 0.5) * 0.3 + (N.NB[i] - 0.5) * 0.2 + lf * 0.1;
    if (lx === 1 || ly === 1) v += 0.14;
    if (lx === 15 || ly === 15) v -= 0.1;
    const crack = Math.abs(N.NB[((y * 2) & 511) * 512 + ((x * 2 + 17) & 511)] - 0.5);
    if (crack < 0.018 && (slab & 3) === 0) return r.temple[0];
    if (N.NE[i] > 0.66 && N.NC[i] > 0.5) return c32(P.moss2);
    return pick(r.temple, v);
  };
  SH[MAT.ROOTS] = (x, y, i, lf) => {
    const r = ramps(), N = nz();
    let v = 0.42 + (N.NA[i] - 0.5) * 0.5 + (N.NB[i] - 0.5) * 0.3 + lf * 0.2;
    // ember seams glowing through cracks
    const crack = Math.abs(N.NB[((y + 30) & 511) * 512 + ((x * 1 + 70) & 511)] - 0.5);
    if (crack < 0.012 && N.NA[i] > 0.4) return r.ember[(RS.hash2(x, y, 4) % 2)];
    // roots
    const rootN = Math.abs(N.NC[((y >> 1) & 511) * 512 + ((x * 3) & 511)] - 0.5);
    if (rootN < 0.03 && N.NE[i] > 0.5) return r.roots[5];
    return pick(r.roots, v);
  };
  SH[MAT.DWALL] = (x, y, i, lf) => {
    const r = ramps(), N = nz();
    const th = RS.Terrain.currentTheme;
    const ramp = th === 'tide' ? r.wallTide : th === 'ember' ? r.wallEmber : r.wallMoss;
    let v = 0.4 + (N.NA[i] - 0.5) * 0.6 + (N.NC[i] - 0.5) * 0.3;
    if (th === 'ember' && N.NB[i] > 0.78 && N.NC[i] > 0.6) return c32(P.emb1);
    return pick(ramp, v);
  };
  SH[MAT.LAVA] = (x, y, i, lf) => {
    const r = ramps(), N = nz();
    let v = 0.55 + (N.NA[i] - 0.5) * 0.6 + (N.NB[i] - 0.5) * 0.5;
    if (N.NC[i] > 0.72) return c32(P.emb1); // cooling crust
    return pick(r.lava, v);
  };
  SH[MAT.ARENA] = (x, y, i, lf) => {
    const r = ramps(), N = nz();
    // concentric carved rings of the guardian's arena
    const cx = RS.Terrain.arenaCenter ? RS.Terrain.arenaCenter.x : 0, cy = RS.Terrain.arenaCenter ? RS.Terrain.arenaCenter.y : 0;
    const d = Math.hypot(x - cx, (y - cy) * 1.25);
    const ring = Math.floor(d / 18);
    const inRing = d % 18;
    const ang = Math.atan2(y - cy, x - cx);
    const seg = Math.floor((ang + Math.PI) / (Math.PI * 2) * (8 + ring * 4));
    const h = RS.hash2(ring, seg, 9);
    if (inRing < 1 || (Math.abs(((ang + Math.PI) / (Math.PI * 2) * (8 + ring * 4)) - Math.round((ang + Math.PI) / (Math.PI * 2) * (8 + ring * 4))) < 0.04 && d > 12)) return r.arena[0];
    let v = 0.5 + ((h & 255) / 255 - 0.5) * 0.3 + (N.NB[i] - 0.5) * 0.2;
    if (inRing < 2) v += 0.15;
    if (ring === 2 && inRing > 7 && inRing < 10) return c32(P.gold1);
    const crack = Math.abs(N.NB[((y + 11) & 511) * 512 + ((x + 7) & 511)] - 0.5);
    if (crack < 0.006 && N.NA[i] > 0.5) return c32(P.emb2);
    return pick(r.arena, v);
  };
  RS.DungeonShaders = SH;

  // ---- props ----------------------------------------------------------------------------------
  function torch(f) {
    const b = new A.PixBuf(10, 16);
    b.rect(4, 8, 2, 7, P.earth3); b.set(4, 8, P.earth5);
    b.rect(3, 7, 4, 2, P.rock3);
    const h = [5, 6, 4, 6][f];
    for (let y = 0; y < h; y++) { const w = y < 2 ? 1 : 2; for (let x = 5 - w; x < 5 + w; x++) b.set(x + (f === 2 && y > 2 ? 1 : 0), 6 - y, y < 2 ? P.emb4 : y < h - 1 ? P.emb5 : P.emb7); }
    b.set(4, 6, P.emb7);
    A.outline(b, P.ink0);
    return b;
  }
  function exitStairs(theme) {
    const W = 36, H = 38;
    const b = new A.PixBuf(W, H);
    const stone = theme === 'tide' ? [P.bone1, P.bone2, P.bone3, P.bone4, P.bone5] : theme === 'ember' ? [P.cany1, P.cany2, P.cany3, P.cany4, P.cany5] : [P.rock1, P.rock2, P.rock3, P.rock4, P.rock5];
    // arch opening with daylight
    for (let y = 2; y < H - 2; y++) for (let x = 4; x < W - 4; x++) {
      const inner = ((x - 18) / 11) ** 2 + ((y - (H - 2)) / 30) ** 2;
      const outer = ((x - 18) / 14) ** 2 + ((y - (H - 2)) / 34) ** 2;
      if (outer > 1) continue;
      if (inner < 1) {
        const step = Math.floor((H - 2 - y) / 4);
        const t = step / 8;
        let c = (H - 2 - y) % 4 === 0 ? stone[4] : stone[3];
        if (t > 0.45) c = (H - 2 - y) % 4 === 0 ? P.sea8 : P.sea7;
        if (t > 0.7) c = P.bone7;
        b.set(x, y, c);
      } else b.set(x, y, x < 18 ? stone[2] : stone[1]);
    }
    // light rays
    for (let k = 0; k < 4; k++) b.line(12 + k * 4, 4, 10 + k * 5, H - 4, P.sea9);
    A.outline(b, P.ink0);
    return b;
  }
  function sealDoor(theme, horizontal, span) {
    const glow = { moss: P.rootGlow, tide: P.tideGlow, ember: P.emberGlow }[theme];
    const stone = [P.rock1, P.rock2, P.rock3, P.rock4, P.rock5];
    if (horizontal) {
      const W = span * 16, H = 30;
      const b = new A.PixBuf(W, H);
      for (let y = 4; y < H; y++) for (let x = 0; x < W; x++) {
        let c = y < 7 ? stone[4] : x % 16 === 0 ? stone[1] : x % 16 === 15 ? stone[1] : stone[2 + ((x >> 3) + (y >> 3)) % 2];
        if (y === H - 1) c = P.ink1;
        b.set(x, y, c);
      }
      // rune bars
      for (let k = 0; k < span; k++) { const cx = k * 16 + 8; b.rect(cx - 2, 12, 4, 10, P.ink1); b.vline(cx, 13, 20, glow); b.set(cx - 1, 16, glow); b.set(cx + 1, 16, glow); }
      A.outline(b, P.ink0);
      return b;
    }
    const W = 16, H = span * 16 + 14;
    const b = new A.PixBuf(W, H);
    for (let y = 0; y < H; y++) for (let x = 3; x < 13; x++) {
      let c = x < 5 ? stone[4] : x > 10 ? stone[1] : stone[3];
      if (y % 16 === 0) c = stone[1];
      b.set(x, y, c);
    }
    for (let k = 0; k < span; k++) { const cy = k * 16 + 12; b.rect(6, cy - 3, 4, 7, P.ink1); b.vline(8, cy - 2, cy + 2, glow); }
    A.outline(b, P.ink0);
    return b;
  }
  function pedestal(theme, empty) {
    const b = new A.PixBuf(22, 22);
    const stone = theme === 'tide' ? [P.bone2, P.bone3, P.bone4, P.bone5, P.bone6] : theme === 'ember' ? [P.cany2, P.cany3, P.cany4, P.cany5, P.cany6] : [P.rock2, P.rock3, P.rock4, P.rock5, P.rock6];
    // base steps
    b.rect(1, 16, 20, 5, stone[1]); b.hline(1, 20, 16, stone[3]);
    b.rect(4, 11, 14, 5, stone[2]); b.hline(4, 17, 11, stone[4]);
    b.rect(7, 5, 8, 6, stone[3]); b.hline(7, 14, 5, stone[4]); b.vline(7, 5, 10, stone[4]);
    const glow = { moss: P.rootGlow, tide: P.tideGlow, ember: P.emberGlow }[theme];
    if (!empty) { b.hline(8, 13, 4, glow); b.set(10, 3, glow); b.set(11, 3, glow); }
    // carved rune
    b.set(10, 13, P.gold3); b.set(11, 14, P.gold3); b.set(12, 13, P.gold3);
    A.outline(b, P.ink0);
    return b;
  }
  function lever(on) {
    const b = new A.PixBuf(16, 18);
    b.rect(2, 12, 12, 5, P.bone2); b.hline(2, 13, 12, P.bone4);
    b.rect(6, 10, 4, 3, P.rock2);
    // handle
    if (on) { b.line(8, 11, 13, 4, P.earth4); b.line(9, 11, 14, 4, P.earth2); b.ellipse(13.5, 3.5, 2, 2, P.tideGlow); }
    else { b.line(8, 11, 3, 4, P.earth4); b.line(9, 11, 4, 4, P.earth2); b.ellipse(3, 3.5, 2, 2, P.bone5); }
    b.set(5, 14, on ? P.tideGlow : P.ink2); b.set(10, 14, on ? P.tideGlow : P.ink2);
    A.outline(b, P.ink0);
    return b;
  }
  function crystal(v, ember) {
    const b = new A.PixBuf(12, 14);
    const cols = ember ? [P.emb2, P.emb3, P.emb5, P.emb7] : [P.sea4, P.sea6, P.sea8, P.sea9];
    const shards = [[6, 13, 2, 9], [3, 13, 1.5, 5], [9, 13, 1.5, 6]];
    shards.slice(0, 2 + (v % 2)).forEach(([x, by, w, h]) => {
      for (let y = 0; y < h; y++) { const hw = w * (1 - y / h * 0.7); for (let xx = Math.floor(x - hw); xx <= Math.ceil(x + hw) - 1; xx++) b.set(xx, by - y, xx < x ? cols[2] : cols[1]); }
      b.set(Math.round(x) - 1, by - h + 1, cols[3]);
    });
    A.outline(b, P.ink0);
    return b;
  }
  function stalag(v) {
    const b = new A.PixBuf(14, 18);
    const cols = [P.rock1, P.rock2, P.rock3, P.rock4];
    const h = 11 + v * 2;
    for (let y = 0; y < h; y++) { const hw = 1 + (y / h) * 4.5; for (let x = Math.floor(7 - hw); x <= Math.ceil(7 + hw); x++) b.set(x, 17 - h + y, x < 6 ? cols[3] : x > 8 ? cols[0] : cols[2]); }
    b.set(7, 17 - h, P.moss5);
    A.outline(b, P.ink0);
    return b;
  }

  function build() {
    for (let f = 0; f < 4; f++) S.add('torch_' + f, torch(f), 5, 15);
    for (const th of ['moss', 'tide', 'ember']) {
      S.add('dexit_' + th, exitStairs(th), 18, 37);
      for (let sp = 1; sp <= 3; sp++) {
        S.add('dseal_' + th + '_h_' + sp, sealDoor(th, true, sp), sp * 8, 29);
        S.add('dseal_' + th + '_v_' + sp, sealDoor(th, false, sp), 8, sp * 16 + 13);
      }
      S.add('pedestal_' + th, pedestal(th, false), 11, 21);
      S.add('pedestal_' + th + '_empty', pedestal(th, true), 11, 21);
    }
    S.add('lever_0', lever(false), 8, 17); S.add('lever_1', lever(true), 8, 17);
    for (let v = 0; v < 3; v++) { S.add('dcrystal_' + v, crystal(v, false), 6, 13); S.add('stalag_' + v, stalag(v), 7, 17); }
    for (let v = 0; v < 2; v++) S.add('dcrystal_e' + v, crystal(v, true), 6, 13);
  }

  RS.DungeonArt = { build, ramps };
})();
