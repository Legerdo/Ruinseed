// Development-only terrain renderer check on a synthetic map
(function () {
  const K = RS.K, MAT = RS.MAT;
  function buildTest() {
    const W = 64, H = 40;
    const L = new RS.Level('overworld', W, H, 1234);
    const set = (x, y, mat, kind, h) => { if (!L.inb(x, y)) return; const i = L.idx(x, y); L.mat[i] = mat; if (kind !== undefined) L.kind[i] = kind; if (h !== undefined) L.hgt[i] = h; };
    const vn = RS.makeValueNoise(5);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      set(x, y, MAT.GRASS, K.FLOOR, 1);
      const n = vn(x / 6, y / 6);
      if (x < 22 && y > 22 + n * 6) set(x, y, MAT.SAND);
      if (x < 18 && y > 27 + n * 5) set(x, y, MAT.SEA, K.WATER);
      if (x > 40 && y < 18) set(x, y, n > 0.45 ? MAT.FOREST : MAT.GRASS);
      if (x > 44 && y > 24) set(x, y, MAT.SWAMP);
      if (x > 48 && y > 28 && n > 0.5) set(x, y, MAT.MARSH, K.WATER);
    }
    // plateau
    for (let y = 3; y < 14; y++) for (let x = 6 + (y % 3 === 0 ? 1 : 0); x < 24 - (y > 10 ? 3 : 0); x++) set(x, y, MAT.GRASS, K.FLOOR, 2);
    for (let y = 5; y < 9; y++) for (let x = 10; x < 16; x++) set(x, y, MAT.MEADOW, K.FLOOR, 3);
    // river
    for (let y = 0; y < H; y++) { const cx = 30 + Math.round(Math.sin(y / 5) * 3); for (let x = cx; x < cx + 3; x++) set(x, y, MAT.WATER, K.WATER); }
    // path
    for (let x = 0; x < W; x++) { const cy = 18 + Math.round(Math.sin(x / 7) * 2); for (let y = cy; y < cy + 2; y++) { const i = L.idx(x, y); if (L.kind[i] === K.FLOOR && L.hgt[i] === 1) set(x, y, x > 34 && x < 42 ? MAT.COBBLE : MAT.DIRT); else if (L.kind[i] === K.WATER) { set(x, y, MAT.WATER, K.BRIDGE); } } }
    // chasm
    for (let y = 26; y < 32; y++) for (let x = 24; x < 29; x++) set(x, y, MAT.CHASM, K.CHASM);
    for (let y = 22; y < 26; y++) for (let x = 22; x < 30; x++) set(x, y, MAT.CANYON);
    // ruin floor patch
    for (let y = 30; y < 38; y++) for (let x = 32; x < 42; x++) set(x, y, MAT.RUIN);
    L.deriveFaces((x, y) => (x < 12 ? 0 : x < 18 ? 3 : 2));
    // stairs down the plateau face at x=14..15
    for (let y = 0; y < H; y++) for (let x = 14; x <= 15; x++) { const i = L.idx(x, y); if (L.kind[i] === K.FACE && y > 12) L.kind[i] = K.STAIRS; }
    L.rebuildSolid();
    // decals
    const rng = new RS.RNG(9);
    for (let i = 0; i < 400; i++) {
      const x = rng.int(0, W * 16 - 1), y = rng.int(0, H * 16 - 1);
      const t = L.idx(x >> 4, y >> 4);
      if (L.kind[t] !== K.FLOOR) continue;
      const m = L.mat[t];
      if (m === MAT.GRASS) L.decals.push({ s: rng.chance(0.2) ? 'flower_' + rng.pick(['w', 'y', 'r', 'b']) + rng.int(0, 2) : 'tuft_g' + rng.int(0, 4), x, y, f: rng.chance(0.5) });
      else if (m === MAT.FOREST) L.decals.push({ s: rng.chance(0.5) ? 'leaf' + rng.int(0, 3) : 'tuft_f' + rng.int(0, 4), x, y });
      else if (m === MAT.SAND) L.decals.push({ s: 'shell' + rng.int(0, 1), x, y });
      else if (m === MAT.DIRT) L.decals.push({ s: 'pebble' + rng.int(0, 5), x, y });
    }
    return L;
  }
  RS.Scenes = RS.Scenes || {};
  RS.Scenes.terraintest = {
    enter() { this.L = buildTest(); this.t = 0; this.cx = +(RS.params.get('cx') || 0); this.cy = +(RS.params.get('cy') || 0); },
    update(dt) { this.t += dt; },
    render(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, RS.App.W, RS.App.H);
      RS.Terrain.draw(ctx, this.L, this.cx, this.cy, RS.App.W, RS.App.H, this.t);
    }
  };
})();
