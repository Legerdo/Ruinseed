// World validation: height-aware reachability from the camp to every hub, dungeon and the lair,
// with deterministic repair (clear obstacles, bridge water, cut stairs) when something is cut off.
(function () {
  'use strict';
  const K = RS.K, MAT = RS.MAT;
  const D4 = RS.DIRS4;

  function cuttableSet(L) {
    const s = new Set();
    for (const o of L.objects) if (o.cut && o.block && !o.dead) for (const t of o.block) s.add(t);
    return s;
  }

  // Tile-graph reachability honouring heights, stairs and bridges.
  function reach(L, startIdx, cuttable) {
    const W = L.w, H = L.h, N = W * H;
    const seen = new Uint8Array(N);
    const walk = (i) => {
      const k = L.kind[i];
      if (!(k === K.FLOOR || k === K.BRIDGE || k === K.STAIRS)) return false;
      if (L.solid[i] === 0) return true;
      return L.solid[i] === 2 && cuttable.has(i);
    };
    if (!walk(startIdx)) return seen;
    const q = [startIdx];
    seen[startIdx] = 1;
    while (q.length) {
      const c = q.pop();
      const cx = c % W, cy = (c / W) | 0;
      const cs = L.kind[c] === K.STAIRS;
      for (const [dx, dy] of D4) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (seen[n] || !walk(n)) continue;
        const ns = L.kind[n] === K.STAIRS;
        if (ns || cs) {
          if (dx !== 0 && !(ns && cs)) continue;
        } else if (L.hgt[n] !== L.hgt[c]) continue;
        seen[n] = 1;
        q.push(n);
      }
    }
    return seen;
  }

  // Dijkstra from target to the reached set through carvable terrain; returns list of tile moves
  function carvePath(g, target, reached) {
    const L = g.L, W = L.w, H = L.h, N = W * H;
    // never tunnel into the sealed lair region unless the target lies inside it
    const lairR = g.lair;
    const sources = Array.isArray(target) ? target : [target];
    const targetInLair = L.region[sources[0]] === lairR;
    const dist = new Float32Array(N).fill(Infinity);
    const from = new Int32Array(N).fill(-1);
    const jump = new Uint8Array(N);
    const heap = new RS.MinHeap();
    const srcSet = new Set(sources);
    for (const s of sources) { dist[s] = 0; heap.push(0, s); }
    const cost = (i) => {
      const k = L.kind[i];
      if (k === K.FLOOR) return L.solid[i] ? 4 : 1;
      if (k === K.BRIDGE || k === K.STAIRS) return 1;
      if (k === K.DEEP) return 5;
      if (k === K.WATER) return L.mat[i] === MAT.SEA ? Infinity : 8;
      if (k === K.CHASM) return 9;
      return Infinity;
    };
    let found = -1;
    let iter = 0;
    while (heap.size && iter++ < N * 6) {
      const c = heap.pop();
      if (reached[c]) { found = c; break; }
      const cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of D4) {
        let nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        let n = ny * W + nx;
        let extra = 0, jumped = 0;
        if (!targetInLair && L.region[n] === lairR && !reached[n]) continue;
        if (targetInLair && L.region[n] !== lairR) continue;
        if ((L.kind[n] === K.FACE) && dx === 0) {
          const f = L.face[n];
          const row = f & 3, depth = Math.max(1, (f >> 2) & 3);
          if (dy === 1 && row !== 0) continue;
          if (dy === -1 && row !== depth - 1) continue;
          const ly = dy === 1 ? ny + depth : ny - depth;
          if (ly < 0 || ly >= H) continue;
          const li = ly * W + nx;
          if (L.kind[li] !== K.FLOOR && L.kind[li] !== K.BRIDGE) continue;
          n = li; ny = ly; extra = 10 + depth * 2; jumped = 1;
        } else {
          const c1 = cost(n);
          if (!(c1 < Infinity)) continue;
          if (L.kind[n] !== K.STAIRS && L.kind[c] !== K.STAIRS && L.hgt[n] !== L.hgt[c] && L.kind[n] !== K.WATER && L.kind[n] !== K.CHASM && L.kind[c] !== K.WATER && L.kind[c] !== K.CHASM) continue;
          if ((L.kind[n] === K.WATER || L.kind[n] === K.CHASM || L.kind[c] === K.WATER || L.kind[c] === K.CHASM) && L.hgt[n] !== L.hgt[c]) continue;
        }
        const nd = dist[c] + (jumped ? 0 : cost(n)) + extra;
        if (nd < dist[n]) { dist[n] = nd; from[n] = c; jump[n] = jumped; heap.push(nd, n); }
      }
    }
    if (found < 0) return null;
    const path = [];
    let c = found;
    while (c !== -1) { path.push({ i: c, jump: jump[c] }); if (srcSet.has(c)) break; c = from[c]; }
    return path; // from reached -> target
  }

  function applyCarve(g, path) {
    const L = g.L, W = L.w;
    for (let p = 0; p < path.length; p++) {
      const { i } = path[p];
      const k = L.kind[i];
      if (k === K.DEEP) { L.kind[i] = K.FLOOR; L.mat[i] = MAT.FOREST; }
      if (k === K.WATER || k === K.CHASM) {
        L.kind[i] = K.BRIDGE;
        if (!L._bridgeDir) L._bridgeDir = new Uint8Array(L.w * L.h);
        const a = path[Math.max(0, p - 1)].i, b = path[Math.min(path.length - 1, p + 1)].i;
        L._bridgeDir[i] = Math.abs((a % W) - (b % W)) >= Math.abs(((a / W) | 0) - ((b / W) | 0)) ? 1 : 2;
      }
      // remove blocking objects
      for (const o of L.objects) if (o.block && !o.dead && o.block.includes(i) && o.kind !== 'entrance' && o.kind !== 'lairgate' && o.kind !== 'campfire') o.dead = true;
      // canopies standing on carved deep tiles
      for (const o of L.objects) if (o.deep && !o.dead && Math.floor(o.x / 16) === i % W && Math.floor((o.y - 2) / 16) === ((i / W) | 0)) o.dead = true;
      // stairs through faces between consecutive nodes
      const nxt = path[p + 1];
      if (nxt && (nxt.jump || path[p].jump)) {
        const a = i, b = nxt.i;
        const ax = a % W, ay = (a / W) | 0, by = (b / W) | 0;
        if (ax === b % W && Math.abs(by - ay) > 1) {
          for (let y = Math.min(ay, by) + 1; y < Math.max(ay, by); y++) { const q = y * W + ax; if (L.kind[q] === K.FACE) L.kind[q] = K.STAIRS; }
        }
      }
      L.flags[i] |= RS.TF.ROAD;
    }
    L.objects = L.objects.filter((o) => !o.dead);
    // rebuild object grid
    L.objGrid = new Map();
    const objs = L.objects; L.objects = [];
    for (const o of objs) L.addObject(o);
    L.rebuildSolid();
  }

  function validateAndRepair(g) {
    const L = g.L, W = L.w;
    L.rebuildSolid();
    const problems = [];
    const startIdx = (g.camp.ty + 1) * W + g.camp.tx;
    const targets = [];
    for (const s of g.regions) targets.push({ name: 'hub' + s.id, i: s.hub.y * W + s.hub.x, required: true });
    for (const dg of g.dungeons) {
      targets.push({ name: 'dungeon' + dg.index, i: dg.approach.ty * W + dg.approach.tx, required: true });
    }
    if (g.lairSite) targets.push({ name: 'lair', i: g.lairSite.approachY * W + g.lairSite.approachX, required: true });
    if (g.campNpc) targets.push({ name: 'npc', i: (g.campNpc.ty + 1) * W + g.campNpc.tx, required: false });
    let cut = cuttableSet(L);
    // targets must be standable tiles: nudge any that sit on faces/obstacles to the nearest floor
    const standable = (i) => (L.kind[i] === K.FLOOR || L.kind[i] === K.BRIDGE) && (L.solid[i] === 0 || cut.has(i));
    for (const t of targets) {
      if (standable(t.i)) continue;
      const x0 = t.i % W, y0 = (t.i / W) | 0;
      let best = -1, bd = 1e9;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = x0 + dx, y = y0 + dy;
        if (!L.inb(x, y)) continue;
        const i = y * W + x;
        if (standable(i) && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = i; }
      }
      if (best >= 0) {
        t.i = best;
        if (t.name.startsWith('hub')) { const s = g.regions[+t.name.slice(3)]; s.hub = { x: best % W, y: (best / W) | 0 }; }
      }
    }
    let r = reach(L, startIdx, cut);
    for (let pass = 0; pass < 12; pass++) {
      const missing = targets.filter((t) => !r[t.i]);
      if (!missing.length) break;
      const t = missing[0];
      const path = carvePath(g, t.i, r);
      if (!path) { problems.push('unreachable ' + t.name); t.i = -1; targets.splice(targets.indexOf(t), 1); continue; }
      applyCarve(g, path);
      g.log.push('repaired ' + t.name + ' (' + path.length + ' tiles)');
      cut = cuttableSet(L);
      r = reach(L, startIdx, cut);
    }
    // optional: link sizeable unreachable pockets (chasm-split halves, hilltops) for exploration
    {
      const N = W * L.h;
      const seen = new Uint8Array(N);
      const F = RS.TF;
      const walkable = (i) => (L.kind[i] === K.FLOOR || L.kind[i] === K.BRIDGE) && L.solid[i] === 0;
      const pockets = [];
      for (let i = 0; i < N; i++) {
        if (seen[i] || r[i] || !walkable(i) || !g.main[i] || (L.flags[i] & (F.OUTCROP | F.ISLET))) continue;
        const comp = [];
        const q = [i]; seen[i] = 1;
        while (q.length) {
          const c = q.pop(); comp.push(c);
          const cx = c % W, cy = (c / W) | 0;
          for (const [dx, dy] of D4) {
            const nx = cx + dx, ny = cy + dy;
            if (!L.inb(nx, ny)) continue;
            const n = ny * W + nx;
            if (seen[n] || r[n] || !walkable(n) || L.hgt[n] !== L.hgt[c] || (L.flags[n] & F.OUTCROP)) continue;
            seen[n] = 1; q.push(n);
          }
        }
        if (comp.length >= 24) pockets.push(comp);
      }
      pockets.sort((a, b) => b.length - a.length);
      let linked = 0;
      for (const comp of pockets.slice(0, 10)) {
        if (r[comp[0]]) continue;
        const path = carvePath(g, comp, r);
        if (!path || path.length > 30) continue;
        applyCarve(g, path);
        linked++;
        cut = cuttableSet(L);
        r = reach(L, startIdx, cut);
      }
      if (linked) g.log.push('linked ' + linked + ' pockets');
    }
    const fails = targets.filter((t) => t.required && t.i >= 0 && !r[t.i]).map((t) => t.name);
    for (const f of fails) problems.push('unreachable ' + f);
    if (g.dungeons.length < 3) problems.push('only ' + g.dungeons.length + ' dungeons');
    if (!g.lairSite) problems.push('no lair');
    // start must be safe: no hazards inside the camp ring (enforced by flags) and walkable
    if (!r[startIdx]) problems.push('camp not walkable');
    g.reach = r;
    g.problems = problems;
    g.valid = problems.filter((p) => !p.startsWith('unreachable npc')).length === 0;
    g.startIdx = startIdx;
    return g.valid;
  }

  RS.WorldValidate = { validateAndRepair, reach, cuttableSet };
})();
