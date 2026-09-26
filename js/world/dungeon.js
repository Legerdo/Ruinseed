// Dungeon generator: themed irregular rooms, room graph (MST + loops), corridors, cellular smoothing,
// sealed sigil chamber (leaf), activators / trial room, exit stairs, decoration and validation.
// Layout is deterministic per world seed + dungeon index; population is per attempt (RS.Spawn).
(function () {
  'use strict';
  const K = RS.K, MAT = RS.MAT, TS = RS.TS;
  const D4 = RS.DIRS4, D8 = RS.DIRS8;
  const FLOORMAT = { moss: MAT.MOSSCAVE, tide: MAT.TEMPLE, ember: MAT.ROOTS };
  const FACESTYLE = { moss: 3, tide: 5, ember: 6 };

  function generateDungeon(worldSeed, index, theme, tier, sub) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const d = tryGenerate(worldSeed, index, theme, tier, attempt);
      if (d && d.valid) return d;
      if (d) console.info('[dungeon] retry', index, d.problems);
    }
    throw new Error('dungeon generation failed');
  }

  function tryGenerate(worldSeed, index, theme, tier, attempt) {
    const r = new RS.RNG('dungeon:' + worldSeed + ':' + index + ':' + attempt);
    const W = 52 + tier * 6, H = 40 + tier * 4;
    const L = new RS.Level('dungeon', W, H, (worldSeed * 31 + index * 7 + 1) | 0);
    const N = W * H;
    for (let i = 0; i < N; i++) { L.kind[i] = K.WALL; L.mat[i] = MAT.DWALL; L.hgt[i] = 2; }
    const sx = RS.makeSimplex(worldSeed + index * 101 + attempt);
    const protect = new Uint8Array(N);
    const roomOf = new Int16Array(N).fill(-1);

    // ---- rooms -------------------------------------------------------------------------
    const rooms = [];
    const want = 7 + tier;
    for (let k = 0; k < 500 && rooms.length < want + 1; k++) {
      const rx = r.int(4, 7), ry = r.int(3, 5);
      const cx = r.int(rx + 3, W - rx - 4), cy = r.int(ry + 4, H - ry - 4);
      let ok = true;
      for (const o of rooms) {
        if (Math.abs(cx - o.cx) < rx + o.rx + 4 && Math.abs(cy - o.cy) < ry + o.ry + 4) { ok = false; break; }
      }
      if (ok) rooms.push({ id: rooms.length, cx, cy, rx, ry, tiles: [], role: 'normal', nb: [] });
    }
    if (rooms.length < 6) return null;
    // entry = lowest room; carve shapes
    rooms.sort((a, b) => a.cy - b.cy);
    rooms.forEach((rm, i) => (rm.id = i));
    const entry = rooms[rooms.length - 1];
    entry.role = 'entry';

    const carve = (x, y, rid, prot) => {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return;
      const i = y * W + x;
      L.kind[i] = K.FLOOR; L.mat[i] = FLOORMAT[theme]; L.hgt[i] = 1;
      if (rid !== undefined && rid >= 0 && roomOf[i] < 0) roomOf[i] = rid;
      if (prot) protect[i] = 1;
    };
    const carveRoom = (rm) => {
      for (let y = rm.cy - rm.ry - 2; y <= rm.cy + rm.ry + 2; y++) for (let x = rm.cx - rm.rx - 2; x <= rm.cx + rm.rx + 2; x++) {
        const dx = (x - rm.cx) / rm.rx, dy = (y - rm.cy) / rm.ry;
        let inside;
        if (theme === 'tide') {
          // halls: rectangles with chamfered corners
          inside = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && Math.abs(dx) + Math.abs(dy) < 1.75;
        } else {
          const a = Math.atan2(dy, dx);
          const n = sx(Math.cos(a) * 1.3 + rm.id * 7, Math.sin(a) * 1.3) * 0.28;
          inside = dx * dx + dy * dy < 1 + n;
        }
        if (inside) carve(x, y, rm.id, Math.abs(dx) < 0.55 && Math.abs(dy) < 0.55);
      }
    };
    rooms.forEach(carveRoom);

    // ---- room graph --------------------------------------------------------------------
    const edges = [];
    for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) edges.push({ a: i, b: j, d: Math.hypot(rooms[i].cx - rooms[j].cx, (rooms[i].cy - rooms[j].cy) * 1.2) });
    edges.sort((a, b) => a.d - b.d);
    const par = rooms.map((_, i) => i);
    const find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
    const mst = [];
    for (const e of edges) { const ra = find(e.a), rb = find(e.b); if (ra !== rb) { par[ra] = rb; mst.push(e); } }
    const adj = rooms.map(() => []);
    for (const e of mst) { adj[e.a].push(e.b); adj[e.b].push(e.a); }
    const graphDist = (from) => {
      const d = rooms.map(() => -1); d[from] = 0; const q = [from];
      while (q.length) { const c = q.shift(); for (const n of adj[c]) if (d[n] < 0) { d[n] = d[c] + 1; q.push(n); } }
      return d;
    };
    // sigil room: farthest leaf from the entry (bigger room preferred)
    let dE = graphDist(entry.id);
    let sigil = null, best = -1;
    for (const rm of rooms) {
      if (rm === entry) continue;
      const v = dE[rm.id] * 10 + rm.rx * rm.ry * 0.2 + (adj[rm.id].length === 1 ? 6 : 0);
      if (v > best) { best = v; sigil = rm; }
    }
    // make the sigil room a leaf: keep only its edge toward the entry
    if (adj[sigil.id].length > 1) {
      const keepN = adj[sigil.id].reduce((a, n) => (dE[n] < dE[a] ? n : a), adj[sigil.id][0]);
      for (const n of adj[sigil.id].slice()) {
        if (n === keepN) continue;
        // reconnect the orphaned subtree elsewhere (nearest room not the sigil)
        adj[sigil.id] = adj[sigil.id].filter((x) => x !== n);
        adj[n] = adj[n].filter((x) => x !== sigil.id);
        const reach = graphDist(entry.id);
        if (reach[n] < 0) {
          let bn = -1, bd = 1e9;
          for (const o of rooms) { if (o === sigil || o.id === n || reach[o.id] < 0) continue; const dd = Math.hypot(o.cx - rooms[n].cx, o.cy - rooms[n].cy); if (dd < bd) { bd = dd; bn = o.id; } }
          if (bn >= 0) { adj[n].push(bn); adj[bn].push(n); }
        }
      }
    }
    sigil.role = 'sigil';
    // extra loops (never touching the sigil room)
    for (const e of edges) {
      if (e.a === sigil.id || e.b === sigil.id) continue;
      if (adj[e.a].includes(e.b)) continue;
      if (e.d > 26) continue;
      if (r.chance(0.28)) { adj[e.a].push(e.b); adj[e.b].push(e.a); }
    }
    dE = graphDist(entry.id);

    // ---- corridors -----------------------------------------------------------------------
    const done = new Set();
    const corridor = (A, B) => {
      const key = Math.min(A.id, B.id) + ':' + Math.max(A.id, B.id);
      if (done.has(key)) return; done.add(key);
      if (theme === 'tide') {
        // straight L-shaped halls, 2 wide
        let x = A.cx, y = A.cy;
        const hFirst = r.chance(0.5);
        const stepTo = (tx, ty) => {
          while (x !== tx || y !== ty) {
            if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y);
            carve(x, y, -1, true); carve(x + 1, y, -1, false); carve(x, y + 1, -1, false);
          }
        };
        if (hFirst) { stepTo(B.cx, A.cy); stepTo(B.cx, B.cy); } else { stepTo(A.cx, B.cy); stepTo(B.cx, B.cy); }
        return;
      }
      const cost = (nx, ny) => {
        if (nx < 2 || ny < 2 || nx >= W - 2 || ny >= H - 2) return Infinity;
        const i = ny * W + nx;
        const rr = roomOf[i];
        if (rr >= 0 && rr !== A.id && rr !== B.id) return 30;
        if (rr === sigil.id && A !== sigil && B !== sigil) return Infinity;
        return (L.kind[i] === K.FLOOR ? 1 : 3.5) + (sx(nx * 0.18 + 40, ny * 0.18) * 0.5 + 0.5) * 3;
      };
      const path = RS.astar(W, H, A.cx, A.cy, B.cx, B.cy, cost, { maxIter: W * H * 3 });
      if (!path) return;
      for (const i of path) {
        const x = i % W, y = (i / W) | 0;
        carve(x, y, -1, true);
        carve(x + 1, y, -1, false); carve(x, y + 1, -1, false);
      }
    };
    for (const rm of rooms) for (const n of adj[rm.id]) corridor(rm, rooms[n]);

    // ---- cellular smoothing for caves ---------------------------------------------------
    if (theme !== 'tide') {
      for (let pass = 0; pass < 2; pass++) {
        const next = L.kind.slice();
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          if (protect[i]) continue;
          let walls = 0;
          for (const [dx, dy] of D8) if (L.kind[(y + dy) * W + x + dx] === K.WALL) walls++;
          if (L.kind[i] === K.WALL && walls <= 3 && roomOf[i] < 0) next[i] = K.FLOOR;
          else if (L.kind[i] === K.FLOOR && walls >= 6) next[i] = K.WALL;
        }
        for (let i = 0; i < N; i++) if (next[i] !== L.kind[i]) { L.kind[i] = next[i]; if (next[i] === K.FLOOR) { L.mat[i] = FLOORMAT[theme]; L.hgt[i] = 1; } else { L.mat[i] = MAT.DWALL; L.hgt[i] = 2; } }
      }
    }
    // remove 1-tile wall pillars/spikes (they read as noise) except in the temple
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (L.kind[i] !== K.WALL) continue;
      let f = 0;
      for (const [dx, dy] of D4) if (L.kind[(y + dy) * W + x + dx] === K.FLOOR) f++;
      if (f >= 3) { L.kind[i] = K.FLOOR; L.mat[i] = FLOORMAT[theme]; L.hgt[i] = 1; }
    }
    // assign room ids to all floor tiles near rooms (for spawn logic)
    for (const rm of rooms) rm.tiles = [];
    for (let i = 0; i < N; i++) if (L.kind[i] === K.FLOOR && roomOf[i] >= 0) rooms[roomOf[i]].tiles.push(i);

    // ---- exit stairs in the entry room's north wall ---------------------------------------
    let exit = null;
    {
      let bestD = 1e9;
      for (const i of entry.tiles) {
        const x = i % W, y = (i / W) | 0;
        if (y < 3) continue;
        const n1 = (y - 1) * W + x, n2 = (y - 2) * W + x, n1b = (y - 1) * W + x + 1, n2b = (y - 2) * W + x + 1;
        if (L.kind[n1] !== K.WALL || L.kind[n2] !== K.WALL || L.kind[n1b] !== K.WALL || L.kind[n2b] !== K.WALL) continue;
        if (L.kind[i + 1] !== K.FLOOR) continue;
        const d = Math.abs(x - entry.cx) + Math.abs(y - (entry.cy - entry.ry)) * 0.5;
        if (d < bestD) { bestD = d; exit = { tx: x, ty: y - 1 }; }
      }
      if (!exit) {
        // carve a notch upward from the room top
        const x = entry.cx, y = entry.cy - entry.ry;
        for (let yy = y; yy <= entry.cy; yy++) { carve(x, yy, entry.id, true); carve(x + 1, yy, entry.id, true); }
        L.kind[(y - 1) * W + x] = K.WALL; L.kind[(y - 1) * W + x + 1] = K.WALL;
        exit = { tx: x, ty: y - 1 };
      }
      // the stair tiles themselves are walkable, the trigger sits at their top half
      for (const xx of [exit.tx, exit.tx + 1]) { const i = exit.ty * W + xx; L.kind[i] = K.FLOOR; L.mat[i] = FLOORMAT[theme]; L.hgt[i] = 1; protect[i] = 1; }
    }

    // ---- derive wall faces (inside the wall tile directly north of open ground) ------------
    for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, up = (y - 1) * W + x;
      if (L.kind[i] !== K.WALL) continue;
      if (y + 1 < H && L.kind[i + W] !== K.WALL && L.kind[i + W] !== K.FACE) {
        L.kind[i] = K.FACE; L.hgt[i] = 1;
        L.face[i] = 0 | (1 << 2) | (FACESTYLE[theme] << 4);
        void up;
      }
    }
    L.rebuildSolid();

    const d = {
      theme, tier, index, level: L, rooms, entry, sigilRoom: sigil, adj,
      objs: [], activators: [], needed: 0, lit: 0, trial: null, sealOpen: false, sigilTaken: false
    };
    L.name = 'dungeon' + index;
    L.theme = theme;
    L.ambient = theme === 'moss' ? '#3e5058' : theme === 'tide' ? '#384664' : '#4a3432';

    // exit object & entry position
    d.exitObj = L.addObject({ kind: 'exit', spr: 'dexit_' + theme, x: (exit.tx + 1) * TS, y: (exit.ty + 1) * TS - 1, depthBias: -8,
      trigger: { x0: exit.tx * TS + 2, y0: exit.ty * TS, x1: (exit.tx + 2) * TS - 2, y1: exit.ty * TS + 8 }, light: { r: 70, color: '#bcd8ff' } });
    d.entryPos = { x: (exit.tx + 1) * TS, y: (exit.ty + 3) * TS + 4 };
    d.exit = exit;

    // ---- seal door on the corridor into the sigil room -------------------------------------
    placeSeal(d, r);
    if (!d.seal) return { valid: false, problems: ['no seal'] };

    // ---- pedestal ---------------------------------------------------------------------------
    {
      let bi = -1, bd = 1e9;
      for (const i of sigil.tiles) {
        const x = i % W, y = (i / W) | 0;
        if (L.kind[i] !== K.FLOOR || L.solid[i]) continue;
        const dd = Math.abs(x - sigil.cx) + Math.abs(y - sigil.cy);
        if (dd < bd) { bd = dd; bi = i; }
      }
      const px = bi % W, py = (bi / W) | 0;
      d.pedestal = { tx: px, ty: py };
      d.pedestalObj = L.addObject({ kind: 'pedestal', spr: 'pedestal_' + theme, x: px * TS + 8, y: py * TS + 15, block: [bi],
        interact: { type: 'pedestal' }, light: { r: 84, color: RS.UI.THEME_COL ? RS.UI.THEME_COL[theme] : '#ffffff' }, sigilGlow: true });
    }

    // ---- roles: activators / trial, treasure, hazards ----------------------------------------
    const others = rooms.filter((rm) => rm !== entry && rm !== sigil && rm.tiles.length > 6);
    const sealRoomId = d.sealFromRoom;
    if (theme === 'moss' || theme === 'tide') {
      // two activator rooms spread apart
      const byDist = others.slice().sort((a, b) => dE[b.id] - dE[a.id]);
      const picks = [];
      for (const rm of byDist) {
        if (picks.length >= 2) break;
        if (picks.some((p) => Math.hypot(p.cx - rm.cx, p.cy - rm.cy) < 12)) continue;
        picks.push(rm);
      }
      for (const rm of byDist) if (picks.length < 2 && !picks.includes(rm)) picks.push(rm);
      for (const rm of picks) {
        rm.role = theme === 'moss' ? 'brazier' : 'lever';
        const t = centreTile(L, rm);
        if (t < 0) continue;
        const x = t % W, y = (t / W) | 0;
        const o = L.addObject({ kind: theme === 'moss' ? 'brazier' : 'lever', spr: theme === 'moss' ? 'brazier_unlit' : 'lever_0', x: x * TS + 8, y: y * TS + 14, block: [t],
          interact: { type: theme === 'moss' ? 'brazier' : 'lever', done: false }, light: theme === 'moss' ? null : { r: 22, color: '#86e3f0' } });
        d.activators.push(o);
      }
      d.needed = d.activators.length;
    } else {
      // trial room: the room right before the sigil chamber
      let trial = rooms[sealRoomId];
      if (!trial || trial === entry) trial = others.sort((a, b) => dE[b.id] - dE[a.id])[0];
      trial.role = 'trial';
      d.trial = { room: trial.id, started: false, done: false, remaining: 0, total: 0 };
      d.needed = 1;
    }
    // treasure in dead ends
    const leaves = others.filter((rm) => rm.role === 'normal' && adj[rm.id].length === 1);
    const tre = leaves.length ? leaves : others.filter((rm) => rm.role === 'normal');
    r.shuffle(tre);
    d.chests = [];
    for (const rm of tre.slice(0, 1 + (tier >= 2 ? 1 : 0))) {
      rm.role = 'treasure';
      const t = centreTile(L, rm);
      if (t < 0) continue;
      d.chests.push({ tx: t % W, ty: (t / W) | 0, id: 'd' + index + 'c' + rm.id });
    }
    // hazard rooms
    d.hazards = [];
    const hz = others.filter((rm) => rm.role === 'normal');
    r.shuffle(hz);
    for (const rm of hz.slice(0, 2)) {
      rm.role = 'hazard';
      const n = Math.min(6, Math.floor(rm.tiles.length / 10));
      for (let k = 0; k < n; k++) {
        const t = r.pick(rm.tiles);
        if (L.solid[t] || protect[t] && theme !== 'tide') continue;
        d.hazards.push({ tx: t % W, ty: (t / W) | 0, type: theme === 'moss' ? 'poison' : 'spikes' });
      }
    }
    // theme features: pools, lava, pillars
    features(d, r, protect);
    decorate(d, r);
    L.rebuildSolid();
    for (const o of L.objects) if (o.block) for (const t of o.block) L.solid[t] = 2;
    if (!d.sealOpen && d.seal) for (const t of d.seal.tiles) L.solid[t] = 2;
    validate(d);
    return d;
  }

  function centreTile(L, rm) {
    const W = L.w;
    let bi = -1, bd = 1e9;
    for (const i of rm.tiles) {
      if (L.kind[i] !== K.FLOOR || L.solid[i]) continue;
      const x = i % W, y = (i / W) | 0;
      // need open neighbours so it never blocks a passage
      let open = 0;
      for (const [dx, dy] of D8) { const j = (y + dy) * W + x + dx; if (L.kind[j] === K.FLOOR && !L.solid[j]) open++; }
      if (open < 8) continue;
      const dd = Math.abs(x - rm.cx) + Math.abs(y - rm.cy);
      if (dd < bd) { bd = dd; bi = i; }
    }
    return bi;
  }

  // BFS over walkable floor; blocked = Set of tiles treated as walls
  function flood(L, start, blocked) {
    const W = L.w, N = L.w * L.h;
    const seen = new Uint8Array(N);
    const q = [start]; seen[start] = 1;
    while (q.length) {
      const c = q.pop();
      const x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of D4) {
        const n = (y + dy) * W + x + dx;
        if (seen[n]) continue;
        const k = L.kind[n];
        if (k !== K.FLOOR && k !== K.BRIDGE) continue;
        if (blocked && blocked.has(n)) continue;
        if (L.solid[n] === 2 && !(blocked && blocked.allowObj)) continue;
        seen[n] = 1; q.push(n);
      }
    }
    return seen;
  }

  function placeSeal(d, r) {
    const L = d.level, W = L.w;
    const startI = Math.floor(d.entryPos.y / TS) * W + Math.floor(d.entryPos.x / TS);
    const sig = d.sigilRoom;
    const sigSet = new Set(sig.tiles);
    // BFS parents from the start to the sigil room
    const N = W * L.h;
    const from = new Int32Array(N).fill(-1);
    const seen = new Uint8Array(N);
    const q = [startI]; seen[startI] = 1;
    let hit = -1;
    while (q.length && hit < 0) {
      const c = q.shift();
      if (sigSet.has(c)) { hit = c; break; }
      const x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of D4) {
        const n = (y + dy) * W + x + dx;
        if (seen[n] || (L.kind[n] !== K.FLOOR)) continue;
        seen[n] = 1; from[n] = c; q.push(n);
      }
    }
    if (hit < 0) return;
    // path back from the sigil room edge
    const path = [];
    let c = hit;
    while (c !== -1) { path.push(c); c = from[c]; }
    // walk 3 steps back from the chamber into the corridor and cut a cross-section
    for (let back = 2; back < Math.min(10, path.length - 1); back++) {
      const i = path[back], j = path[back + 1];
      if (sigSet.has(i)) continue;
      const x = i % W, y = (i / W) | 0;
      const dx = (i % W) - (j % W), dy = ((i / W) | 0) - ((j / W) | 0);
      // perpendicular sweep
      const px = dy !== 0 ? 1 : 0, py = dx !== 0 ? 1 : 0;
      const tiles = [i];
      for (const s of [-1, 1]) {
        for (let k = 1; k <= 3; k++) {
          const xx = x + px * s * k, yy = y + py * s * k;
          const q2 = yy * W + xx;
          if (L.kind[q2] !== K.FLOOR) break;
          tiles.push(q2);
        }
      }
      if (tiles.length > 4) continue;
      const blocked = new Set(tiles);
      const reach = flood(L, startI, blocked);
      let leak = false;
      for (const t of sig.tiles) if (reach[t]) { leak = true; break; }
      if (leak) continue;
      // success: door across the corridor
      const minx = Math.min(...tiles.map((t) => t % W)), maxx = Math.max(...tiles.map((t) => t % W));
      const miny = Math.min(...tiles.map((t) => (t / W) | 0)), maxy = Math.max(...tiles.map((t) => (t / W) | 0));
      const horizontal = maxx > minx; // door spans horizontally (corridor runs N-S)
      const o = L.addObject({ kind: 'seal', spr: 'dseal_' + d.theme + (horizontal ? '_h' : '_v') + '_' + Math.min(3, tiles.length), x: (minx + maxx + 1) * TS / 2, y: (maxy + 1) * TS - 1, block: tiles.slice(),
        light: { r: 40, color: RS.UI.THEME_COL[d.theme] }, sealDoor: true, horizontal, span: tiles.length });
      d.seal = { tiles, obj: o };
      // which room the door is entered from
      let fromRoom = -1;
      for (let k = back; k < path.length; k++) { const rr = d.rooms.findIndex((rm) => rm.tiles.includes(path[k]) && rm !== sig); if (rr >= 0) { fromRoom = rr; break; } }
      d.sealFromRoom = fromRoom;
      return;
    }
  }

  function features(d, r, protect) {
    const L = d.level, W = L.w, th = d.theme;
    for (const rm of d.rooms) {
      if (rm.role === 'entry' || rm.role === 'sigil') continue;
      const big = rm.tiles.length > 40;
      if (th === 'tide' && big && r.chance(0.6)) {
        // central pool with a rim walkway
        const rx = Math.max(1, rm.rx - 3), ry = Math.max(1, rm.ry - 2);
        for (const i of rm.tiles) {
          const x = i % W, y = (i / W) | 0;
          if (Math.abs(x - rm.cx) <= rx && Math.abs(y - rm.cy) <= ry && !protect[i] && !L.solid[i]) { L.kind[i] = K.WATER; L.mat[i] = MAT.DWATER; }
        }
      }
      if (th === 'tide' && big) {
        // pillar rows
        for (const i of rm.tiles) {
          const x = i % W, y = (i / W) | 0;
          if ((x - rm.cx) % 4 === 0 && Math.abs(y - rm.cy) === rm.ry - 1 && L.kind[i] === K.FLOOR && !protect[i] && !L.solid[i]) {
            L.addObject({ kind: 'pillar', spr: r.chance(0.3) ? 'pillar_1' : 'pillar_0', x: x * TS + 8, y: y * TS + 15, block: [i] });
          }
        }
      }
      if (th === 'moss' && r.chance(0.45)) {
        // small cave pond
        const t = r.pick(rm.tiles);
        const cx = t % W, cy = (t / W) | 0;
        for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 3; x <= cx + 3; x++) {
          const i = y * W + x;
          if (!L.inb(x, y) || L.kind[i] !== K.FLOOR || protect[i] || L.solid[i]) continue;
          if (((x - cx) / 3) ** 2 + ((y - cy) / 2) ** 2 + RS.rand2(x, y, 3) * 0.3 < 1) { L.kind[i] = K.WATER; L.mat[i] = MAT.DWATER; }
        }
      }
      if (th === 'ember' && r.chance(0.55)) {
        // lava seams along the room edge
        for (const i of rm.tiles) {
          const x = i % W, y = (i / W) | 0;
          const dx = (x - rm.cx) / rm.rx, dy = (y - rm.cy) / rm.ry;
          const dd = dx * dx + dy * dy;
          if (dd > 0.55 && dd < 0.85 && !protect[i] && !L.solid[i] && RS.rand2(x, y, rm.id) < 0.55) { L.kind[i] = K.LAVA; L.mat[i] = MAT.LAVA; }
        }
      }
    }
    // keep every room connected after features: undo features that cut paths
    const startI = Math.floor(d.entryPos.y / TS) * W + Math.floor(d.entryPos.x / TS);
    const blockedSeal = new Set(d.seal ? d.seal.tiles : []);
    blockedSeal.allowObj = true;
    const reach = flood(L, startI, blockedSeal);
    for (const rm of d.rooms) {
      if (rm === d.sigilRoom) continue;
      const ok = rm.tiles.some((t) => reach[t]);
      if (!ok) {
        for (const i of rm.tiles) if (L.kind[i] === K.WATER || L.kind[i] === K.LAVA) { L.kind[i] = K.FLOOR; L.mat[i] = FLOORMAT[th]; }
      }
    }
  }

  function decorate(d, r) {
    const L = d.level, W = L.w, H = L.h, th = d.theme;
    // wall torches on faces facing rooms
    let last = -99;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (L.kind[i] !== K.FACE) continue;
      if (RS.hash2(x, y, 11) % 9 !== 0) continue;
      if (Math.abs(x - last) < 4 && y === (last >> 16)) continue;
      const below = i + W;
      if (L.kind[below] !== K.FLOOR) continue;
      if (Math.abs(x - d.exit.tx) < 3 && Math.abs(y - d.exit.ty) < 2) continue;
      L.addObject({ kind: 'torch', spr: 'torch', anim: { frames: 4, fps: 8 }, x: x * TS + 8, y: y * TS + 12, depthBias: -4, light: { r: 50, color: th === 'moss' ? '#9ef07f' : th === 'tide' ? '#ffd08a' : '#ff9a45', flicker: true } });
      last = x;
    }
    // floor decals & props
    const deco = {
      moss: ['mosspatch0', 'mosspatch1', 'mosspatch2', 'mushtiny1', 'pebble3', 'pebble4', 'roots0', 'crack0'],
      tide: ['crack0', 'crack1', 'rubble0', 'puddle0', 'puddle1', 'mosspatch0', 'rubble1'],
      ember: ['crack0', 'crack1', 'crack2', 'bones0', 'skull0', 'pebble5', 'roots1', 'rubble2']
    }[th];
    for (let i = 0; i < W * H; i++) {
      if (L.kind[i] !== K.FLOOR || L.solid[i]) continue;
      const x = i % W, y = (i / W) | 0;
      const h = RS.hash2(x, y, 5 + d.index) & 255;
      if (h < 26) L.decals.push({ s: deco[h % deco.length], x: x * TS + 2 + (h % 12), y: y * TS + 4 + ((h >> 3) % 11), f: h & 1 });
      else if (h < 32) {
        // props that do not block: glowing mushrooms, crystals, bones, roots
        const spr = th === 'moss' ? 'gmush_' + (h & 1) : th === 'tide' ? 'dcrystal_' + (h % 3) : 'dcrystal_e' + (h % 2);
        L.addObject({ kind: 'deco', spr, x: x * TS + 4 + (h % 9), y: y * TS + 8 + (h % 6), low: true, light: { r: 18, color: th === 'moss' ? '#86e3f0' : th === 'tide' ? '#86e3f0' : '#ff9a45' } });
      } else if (h < 35 && th !== 'tide') {
        // rubble / stalagmite blocking props away from paths
        let open = 0;
        for (const [dx, dy] of D8) { const j = (y + dy) * W + x + dx; if (L.kind[j] === K.FLOOR && !L.solid[j]) open++; }
        if (open === 8) L.addObject({ kind: 'rock', spr: th === 'ember' ? 'rockC_s_' + (h % 4) : 'stalag_' + (h % 3), x: x * TS + 8, y: y * TS + 14, block: [i] });
      }
    }
    // statues flanking the sigil pedestal
    const p = d.pedestal;
    for (const ox of [-3, 3]) {
      const x = p.tx + ox, y = p.ty - 1;
      const i = y * W + x;
      if (L.inb(x, y) && L.kind[i] === K.FLOOR && !L.solid[i]) L.addObject({ kind: 'pillar', spr: th === 'tide' ? 'statue_0' : 'pillar_1', x: x * TS + 8, y: y * TS + 15, block: [i] });
    }
  }

  function validate(d) {
    const L = d.level, W = L.w;
    const problems = [];
    const startI = Math.floor(d.entryPos.y / TS) * W + Math.floor(d.entryPos.x / TS);
    if (L.solid[startI] || L.kind[startI] !== K.FLOOR) problems.push('entry blocked');
    // with the seal open everything (incl. pedestal neighbourhood) must be reachable
    const openSet = new Set(); openSet.allowObj = false;
    const sealTiles = new Set(d.seal ? d.seal.tiles : []);
    const saved = d.seal ? d.seal.tiles.map((t) => L.solid[t]) : [];
    if (d.seal) for (const t of d.seal.tiles) L.solid[t] = 0;
    const reachOpen = flood(L, startI, openSet);
    const pi = d.pedestal.ty * W + d.pedestal.tx;
    let pedOk = false;
    for (const [dx, dy] of D4) if (reachOpen[pi + dy * W + dx]) pedOk = true;
    if (!pedOk) problems.push('pedestal unreachable');
    if (d.seal) d.seal.tiles.forEach((t, k) => (L.solid[t] = saved[k]));
    // with the seal closed: activators & exit reachable, sigil chamber not
    const reachClosed = flood(L, startI, sealTiles);
    for (const a of d.activators) {
      const ai = Math.floor((a.y - 2) / TS) * W + Math.floor(a.x / TS);
      let ok = false;
      for (const [dx, dy] of D4) if (reachClosed[ai + dy * W + dx]) ok = true;
      if (!ok) problems.push('activator unreachable');
    }
    if (d.trial) { const rm = d.rooms[d.trial.room]; if (!rm.tiles.some((t) => reachClosed[t])) problems.push('trial unreachable'); }
    const exitI = d.exit.ty * W + d.exit.tx;
    if (!reachClosed[exitI]) problems.push('exit unreachable');
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (reachClosed[pi + dy * W + dx]) problems.push('seal leaks');
    d.problems = problems;
    d.valid = problems.length === 0;
    d.reach = reachOpen;
  }

  RS.generateDungeon = generateDungeon;
  RS.DungeonGen = { flood };
})();
