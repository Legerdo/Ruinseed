// Pixel map image of a level (1px per tile) used by the minimap, world map and dev previews.
(function () {
  'use strict';
  const K = RS.K, MAT = RS.MAT, P = RS.PAL;
  const MATC = {};
  MATC[MAT.GRASS] = P.moss5; MATC[MAT.MEADOW] = P.moss6; MATC[MAT.FOREST] = P.moss3; MATC[MAT.DEEPFOREST] = P.moss1;
  MATC[MAT.DIRT] = P.earth5; MATC[MAT.COBBLE] = P.bone4; MATC[MAT.SAND] = P.sand3; MATC[MAT.MUD] = P.earth3;
  MATC[MAT.ROCK] = P.rock4; MATC[MAT.CANYON] = P.cany4; MATC[MAT.RUIN] = P.bone5; MATC[MAT.SWAMP] = P.swamp4;
  MATC[MAT.GRAVEL] = P.rock5; MATC[MAT.SANCTUM] = P.rock3; MATC[MAT.MOUNT] = P.rock3; MATC[MAT.PLANK] = P.earth5;
  MATC[MAT.CAVE] = P.rock3; MATC[MAT.TEMPLE] = P.bone3; MATC[MAT.ROOTS] = P.earth4; MATC[MAT.MOSSCAVE] = P.moss3; MATC[MAT.ARENA] = P.bone3;

  function tileColor(L, i) {
    const k = L.kind[i], m = L.mat[i];
    if (k === K.WATER) return m === MAT.SEA ? P.sea3 : m === MAT.MARSH ? P.swamp2 : P.sea5;
    if (k === K.CHASM || k === K.PIT) return P.ink0;
    if (k === K.WALL) return L.type === 'overworld' ? P.rock2 : P.ink2;
    if (k === K.DEEP) return P.moss1;
    if (k === K.FACE) return P.rock1;
    if (k === K.FALLS) return P.sea7;
    if (k === K.STAIRS) return P.bone5;
    if (k === K.BRIDGE) return P.earth6;
    if (k === K.LAVA) return P.emb3;
    return MATC[m] || P.moss5;
  }

  function build(L, opts) {
    opts = opts || {};
    const W = L.w, H = L.h;
    const cv = RS.Art.makeCanvas(W, H);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    const u = new Uint32Array(img.data.buffer);
    const F = RS.TF || {};
    for (let i = 0; i < W * H; i++) {
      let col = tileColor(L, i);
      let c32 = RS.Color.c32(col);
      const k = L.kind[i];
      if (k === K.FLOOR || k === K.DEEP) {
        const h = L.hgt[i];
        const f = h >= 3 ? 1.12 : h === 2 ? 1.05 : 0.96;
        c32 = RS.Terrain.shade(c32, f);
        if ((L.flags[i] & (F.ROAD || 0)) && opts.roads !== false) c32 = RS.Terrain.shade(RS.Color.c32(P.earth6), 1.08);
      }
      u[i] = c32;
    }
    // objects: trees darken
    if (opts.objects !== false) {
      for (const o of L.objects) {
        if (o.dead) continue;
        const tx = Math.floor(o.x / 16), ty = Math.floor((o.y - 3) / 16);
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        if (o.kind === 'tree') u[ty * W + tx] = RS.Terrain.shade(u[ty * W + tx], 0.7);
        else if (o.kind === 'rock' || o.kind === 'wall') u[ty * W + tx] = RS.Color.c32(P.bone3);
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  RS.MapView = { build, tileColor };
})();
