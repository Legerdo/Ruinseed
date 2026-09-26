// Overworld generator: macro coastline/mountains -> warped regions -> biome & height network ->
// rivers/pools/chasms -> planned sites (camp, dungeons, lair) -> cliffs -> roads/bridges/stairs -> barriers.
(function () {
  'use strict';
  const K = RS.K, MAT = RS.MAT, FS = RS.FACE_STYLE;
  const F = { ROAD: 1, ROADM: 2, SAFE: 4, RES: 8, BARRIER: 16, OUTCROP: 32, ISLET: 64, NOSPAWN: 128, HIDDEN: 256, BEACH: 512, RIVER: 1024, LAIR: 2048, ENTR: 4096, MAINROAD: 8192, GATEZ: 16384 };
  RS.TF = F;
  const D4 = RS.DIRS4;

  const LAYOUTS = [
    { sea: ['S'], w: 3 }, { sea: ['E'], w: 2 }, { sea: ['W'], w: 2 }, { sea: ['N'], w: 1 },
    { sea: ['S', 'E'], w: 3 }, { sea: ['S', 'W'], w: 3 }, { sea: ['N', 'E'], w: 2 }, { sea: ['N', 'W'], w: 2 },
    { sea: ['W', 'E'], w: 2 }, { sea: ['N', 'S'], w: 2 },
    { sea: ['W', 'S', 'E'], w: 2 }, { sea: ['N', 'W', 'S'], w: 1 }, { sea: ['N', 'E', 'S'], w: 1 }
  ];

  class WorldGen {
    constructor(seed, sub) {
      this.seed = seed;
      this.rng = new RS.RNG('world:' + seed + (sub ? ':' + sub : ''));
      this.log = [];
    }

    run() {
      this.setup();
      this.macro();
      this.makeRegions();
      this.pickStartLair();
      this.assignBiomes();
      this.assignHeights();
      this.computeHubs();
      this.waterFeatures();
      this.computeHubs();
      this.baseMaterials();
      this.planConnections();
      this.computeHubs();
      this.reserveGates();
      this.planSites();
      this.computeHubs();
      this.L.deriveFaces((x, y) => this.faceStyleAt(x, y));
      this.markFalls();
      this.L.rebuildSolid();
      this.buildRoads();
      this.connectSites();
      this.buildBarriers();
      RS.WorldDecor.decorate(this);
      RS.WorldValidate.validateAndRepair(this);
      return this.result();
    }

    // ------------------------------------------------------------------------
    setup() {
      const r = this.rng;
      this.layout = r.weighted(LAYOUTS, (l) => l.w);
      this.W = r.int(150, 174);
      this.H = r.int(104, 120);
      this.L = new RS.Level('overworld', this.W, this.H, this.seed);
      this.sx = RS.makeSimplex(this.seed);
      this.sx2 = RS.makeSimplex(this.seed + 101);
      this.vn = RS.makeValueNoise(this.seed + 5);
      this.N = this.W * this.H;
      this.landT = new Uint8Array(this.N);   // 0 sea, 1 land, 2 rim
      this.main = new Uint8Array(this.N);    // main connected land
    }
    idx(x, y) { return y * this.W + x; }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }

    macro() {
      const { W, H, rng: r, sx } = this;
      const sea = new Set(this.layout.sea);
      this.seaSides = sea;
      const prm = {};
      for (const s of ['N', 'E', 'S', 'W']) {
        prm[s] = { base: r.range(9, 19), amp: r.range(5, 10), off: r.range(0, 500), rim: r.range(2.5, 4.5), rimAmp: r.range(2, 5) };
      }
      const bays = [];
      for (const s of sea) if (r.chance(0.7)) bays.push({ side: s, t: r.range(0.22, 0.78), depth: r.range(16, 32), width: r.range(6, 12) });
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let isSea = false, isRim = false;
        for (const s of ['N', 'E', 'S', 'W']) {
          const d = s === 'N' ? y : s === 'S' ? H - 1 - y : s === 'W' ? x : W - 1 - x;
          const t = (s === 'N' || s === 'S') ? x : y;
          const p = prm[s];
          if (sea.has(s)) {
            const depth = p.base + sx(t * 0.035 + p.off, p.off) * p.amp + sx(t * 0.12, p.off + 3) * p.amp * 0.35;
            if (d < depth) isSea = true;
          } else {
            const rd = p.rim + (sx(t * 0.08 + p.off, 7) * 0.5 + 0.5) * p.rimAmp;
            if (d < rd) isRim = true;
          }
        }
        for (const b of bays) {
          let cx, cy, rx, ry;
          if (b.side === 'S') { cx = b.t * W; cy = H - 1 - b.depth * 0.5; rx = b.width; ry = b.depth * 0.6; }
          else if (b.side === 'N') { cx = b.t * W; cy = b.depth * 0.5; rx = b.width; ry = b.depth * 0.6; }
          else if (b.side === 'W') { cx = b.depth * 0.5; cy = b.t * H; rx = b.depth * 0.6; ry = b.width; }
          else { cx = W - 1 - b.depth * 0.5; cy = b.t * H; rx = b.depth * 0.6; ry = b.width; }
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          const n = sx(x * 0.1 + 40, y * 0.1 + 40) * 0.35;
          if (dx * dx + dy * dy < 1 + n) isSea = true;
        }
        this.landT[y * W + x] = isSea ? 0 : isRim ? 2 : 1;
      }
      // mountain spurs reaching inland from rim sides
      const rimSides = ['N', 'E', 'S', 'W'].filter((s) => !sea.has(s));
      const nSpurs = rimSides.length ? r.int(1, 3) : 0;
      for (let k = 0; k < nSpurs; k++) {
        const s = r.pick(rimSides);
        const t = r.range(0.2, 0.8);
        let x, y, a;
        if (s === 'N') { x = t * W; y = 3; a = Math.PI / 2; }
        else if (s === 'S') { x = t * W; y = H - 4; a = -Math.PI / 2; }
        else if (s === 'W') { x = 3; y = t * H; a = 0; }
        else { x = W - 4; y = t * H; a = Math.PI; }
        const len = r.int(10, 24);
        const rad = r.range(1.2, 2.1);
        for (let i = 0; i < len; i++) {
          a += r.range(-0.4, 0.4);
          x += Math.cos(a); y += Math.sin(a);
          const rr = rad * (1 - i / len * 0.5);
          for (let yy = Math.floor(y - rr); yy <= Math.ceil(y + rr); yy++) for (let xx = Math.floor(x - rr); xx <= Math.ceil(x + rr); xx++) {
            if (!this.inb(xx, yy)) continue;
            if ((xx - x) * (xx - x) + (yy - y) * (yy - y) <= rr * rr && this.landT[yy * W + xx] === 1) this.landT[yy * W + xx] = 2;
          }
        }
      }
      // main land = largest 4-connected land component
      const comp = new Int32Array(this.N).fill(-1);
      let best = -1, bestSize = 0;
      const sizes = [];
      for (let i = 0; i < this.N; i++) {
        if (this.landT[i] !== 1 || comp[i] >= 0) continue;
        const id = sizes.length;
        const q = [i]; comp[i] = id; let n = 0;
        while (q.length) {
          const c = q.pop(); n++;
          const cx = c % W, cy = (c / W) | 0;
          for (const [dx, dy] of D4) {
            const nx = cx + dx, ny = cy + dy;
            if (!this.inb(nx, ny)) continue;
            const j = ny * W + nx;
            if (this.landT[j] === 1 && comp[j] < 0) { comp[j] = id; q.push(j); }
          }
        }
        sizes.push(n);
        if (n > bestSize) { bestSize = n; best = id; }
      }
      const L = this.L;
      for (let i = 0; i < this.N; i++) {
        const t = this.landT[i];
        if (t === 1 && comp[i] === best) this.main[i] = 1;
        else if (t === 1 && sizes[comp[i]] < 40) this.landT[i] = 0;
        else if (t === 1) L.flags[i] |= F.ISLET;
      }
      for (let i = 0; i < this.N; i++) {
        const t = this.landT[i];
        if (t === 0) { L.kind[i] = K.WATER; L.mat[i] = MAT.SEA; L.hgt[i] = 1; }
        else if (t === 2) { L.kind[i] = K.WALL; L.mat[i] = MAT.MOUNT; L.hgt[i] = 4; }
        else { L.kind[i] = K.FLOOR; L.mat[i] = MAT.GRASS; L.hgt[i] = 1; }
      }
      // distance of main land tiles from anything that is not main land
      const starts = [];
      for (let i = 0; i < this.N; i++) if (!this.main[i]) starts.push(i);
      this.edgeDist = RS.bfs(W, H, starts, (j) => this.main[j] === 1);
      this.mainCount = 0;
      for (let i = 0; i < this.N; i++) if (this.main[i]) this.mainCount++;
      // distance to sea (through anything)
      const seaStarts = [];
      for (let i = 0; i < this.N; i++) if (this.landT[i] === 0) seaStarts.push(i);
      this.seaDist = RS.bfs(W, H, seaStarts, () => true);
    }

    // ------------------------------------------------------------------------
    makeRegions() {
      const { W, H, rng: r, sx, sx2, L } = this;
      const target = r.int(13, 17);
      let minD = Math.sqrt(this.mainCount / target) * 0.92;
      let sites = [];
      for (let attempt = 0; attempt < 5; attempt++) {
        sites = RS.poisson(r, W, H, minD, (x, y) => {
          const i = (y | 0) * W + (x | 0);
          return this.main[i] === 1 && this.edgeDist[i] >= 4;
        }, 40);
        if (sites.length >= 9) break;
        minD *= 0.85;
      }
      const reg = L.region;
      reg.fill(255);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!this.main[i]) continue;
        const wx = x + sx(x * 0.045, y * 0.045) * 9 + sx2(x * 0.11, y * 0.11) * 2.5;
        const wy = y + sx(x * 0.045 + 31, y * 0.045 + 17) * 9 + sx2(x * 0.11 + 9, y * 0.11 + 4) * 2.5;
        let bd = 1e9, bi = 0;
        for (let s = 0; s < sites.length; s++) {
          const d = (wx - sites[s].x) * (wx - sites[s].x) + (wy - sites[s].y) * (wy - sites[s].y);
          if (d < bd) { bd = d; bi = s; }
        }
        reg[i] = bi;
      }
      this.fixRegionFragments(sites.length);
      // merge small regions
      for (let guard = 0; guard < 40; guard++) {
        const st = this.regionStats();
        let small = -1, smallA = 1e9;
        for (const s of st) if (s.area > 0 && s.area < 190 && s.area < smallA) { small = s.id; smallA = s.area; }
        if (small < 0) break;
        const nb = st[small].nb;
        let tgt = -1, bl = -1;
        for (const k of Object.keys(nb)) if (nb[k] > bl) { bl = nb[k]; tgt = +k; }
        if (tgt < 0) break;
        for (let i = 0; i < this.N; i++) if (reg[i] === small) reg[i] = tgt;
      }
      // reindex
      const remap = new Map();
      for (let i = 0; i < this.N; i++) {
        const v = reg[i];
        if (v === 255) continue;
        if (!remap.has(v)) remap.set(v, remap.size);
        reg[i] = remap.get(v);
      }
      this.R = remap.size;
      this.regions = this.regionStats();
    }

    fixRegionFragments(n) {
      const { W, H, L } = this;
      const reg = L.region;
      const seen = new Uint8Array(this.N);
      for (let id = 0; id < n; id++) {
        const comps = [];
        for (let i = 0; i < this.N; i++) {
          if (reg[i] !== id || seen[i]) continue;
          const q = [i]; seen[i] = 1; const list = [];
          while (q.length) {
            const c = q.pop(); list.push(c);
            const cx = c % W, cy = (c / W) | 0;
            for (const [dx, dy] of D4) {
              const nx = cx + dx, ny = cy + dy;
              if (!this.inb(nx, ny)) continue;
              const j = ny * W + nx;
              if (reg[j] === id && !seen[j]) { seen[j] = 1; q.push(j); }
            }
          }
          comps.push(list);
        }
        comps.sort((a, b) => b.length - a.length);
        for (let k = 1; k < comps.length; k++) for (const t of comps[k]) reg[t] = 254;
      }
      // flood orphans into neighbours
      for (let pass = 0; pass < 200; pass++) {
        let changed = 0, left = 0;
        for (let i = 0; i < this.N; i++) {
          if (reg[i] !== 254) continue;
          left++;
          const x = i % W, y = (i / W) | 0;
          for (const [dx, dy] of D4) {
            const nx = x + dx, ny = y + dy;
            if (!this.inb(nx, ny)) continue;
            const v = reg[ny * W + nx];
            if (v < 254) { reg[i] = v; changed++; break; }
          }
        }
        if (!left || !changed) break;
      }
      for (let i = 0; i < this.N; i++) if (reg[i] === 254) reg[i] = 255;
    }

    regionStats() {
      const { W, L } = this;
      const reg = L.region;
      const st = [];
      const get = (id) => { while (st.length <= id) st.push({ id: st.length, area: 0, sx: 0, sy: 0, coastal: 0, rim: 0, nb: {}, tiles: [] }); return st[id]; };
      for (let i = 0; i < this.N; i++) {
        const v = reg[i];
        if (v >= 254) continue;
        const s = get(v);
        const x = i % W, y = (i / W) | 0;
        s.area++; s.sx += x; s.sy += y; s.tiles.push(i);
        for (const [dx, dy] of D4) {
          const nx = x + dx, ny = y + dy;
          if (!this.inb(nx, ny)) continue;
          const j = ny * W + nx;
          const t = this.landT[j];
          if (t === 0) s.coastal++;
          else if (t === 2) s.rim++;
          const u = reg[j];
          if (u < 254 && u !== v) s.nb[u] = (s.nb[u] || 0) + 1;
        }
      }
      for (const s of st) { s.cx = s.area ? s.sx / s.area : 0; s.cy = s.area ? s.sy / s.area : 0; }
      return st;
    }

    regionGraphDist(from) {
      const dist = new Array(this.R).fill(-1);
      dist[from] = 0;
      const q = [from];
      while (q.length) {
        const c = q.shift();
        for (const k of Object.keys(this.regions[c].nb)) {
          const n = +k;
          if (this.regions[c].nb[k] < 3) continue;
          if (dist[n] < 0) { dist[n] = dist[c] + 1; q.push(n); }
        }
      }
      return dist;
    }

    pickStartLair() {
      const r = this.rng;
      const ecc = this.regions.map((s) => {
        const d = this.regionGraphDist(s.id);
        return { id: s.id, ecc: Math.max(...d), area: s.area };
      });
      const cands = ecc.filter((e) => e.area >= 260).sort((a, b) => b.ecc - a.ecc || b.area - a.area);
      const pool = cands.slice(0, Math.min(3, cands.length));
      const start = (pool.length ? r.pick(pool) : ecc[0]).id;
      const d = this.regionGraphDist(start);
      let lair = -1, bestScore = -1;
      for (const s of this.regions) {
        if (s.id === start || d[s.id] < 0) continue;
        const eu = Math.hypot(s.cx - this.regions[start].cx, s.cy - this.regions[start].cy);
        const score = d[s.id] * 100 + eu + (s.rim > 0 ? 40 : 0) + (s.area > 300 ? 20 : 0);
        if (score > bestScore) { bestScore = score; lair = s.id; }
      }
      this.start = start;
      this.lair = lair;
      this.startDist = d;
    }

    assignBiomes() {
      const r = this.rng;
      const regs = this.regions;
      const elev = (s) => this.sx(s.cx * 0.02 + 70, s.cy * 0.02 + 70) * 0.5 + 0.5;
      for (const s of regs) {
        const per = Object.values(s.nb).reduce((a, b) => a + b, 0) + s.coastal + s.rim;
        s.coastFrac = s.coastal / Math.max(1, per);
        s.rimFrac = s.rim / Math.max(1, per);
        s.elev = elev(s);
        s.biome = null;
      }
      regs[this.start].biome = 'camp';
      regs[this.lair].biome = 'sanctum';
      const order = ['forest', 'meadow', 'ruins', 'swamp', 'canyon', 'coast', 'sunken', 'mountain', 'valley', 'shore', 'bridge', 'marsh', 'forest', 'meadow', 'forest', 'valley', 'ruins', 'mountain', 'swamp'];
      const score = (s, b) => {
        let v = r.next() * 0.8;
        const coastal = s.coastal > 4;
        switch (b) {
          case 'coast': if (!coastal) return -99; v += s.coastFrac * 5 + s.elev; break;
          case 'shore': if (!coastal) return -99; v += s.coastFrac * 5 - s.elev; break;
          case 'mountain': v += s.rimFrac * 4 + s.elev * 1.5; break;
          case 'canyon': v += s.rimFrac * 2 + s.elev; break;
          case 'swamp': case 'marsh': v += (1 - s.elev) * 1.5 + s.coastFrac; break;
          case 'forest': v += (1 - s.coastFrac) * 1.2; break;
          case 'meadow': v += (1 - s.rimFrac) + (1 - s.coastFrac) * 0.5; break;
          case 'sunken': v += (1 - s.elev) + s.coastFrac * 0.8; break;
          default: v += (1 - s.coastFrac) * 0.6;
        }
        // keep neighbouring regions varied
        for (const k of Object.keys(s.nb)) if (regs[+k].biome === b) v -= 1.6;
        if (this.startDist[s.id] === 1 && (b === 'marsh' || b === 'canyon')) v -= 0.8;
        return v;
      };
      const free = () => regs.filter((s) => !s.biome);
      for (const b of order) {
        const f = free();
        if (!f.length) break;
        let best = null, bs = -50;
        for (const s of f) { const v = score(s, b); if (v > bs) { bs = v; best = s; } }
        if (best && bs > -50) best.biome = b;
      }
      const fallback = ['forest', 'meadow', 'valley', 'ruins', 'marsh', 'mountain'];
      for (const s of free()) s.biome = r.pick(fallback);
      const usedNames = new Set();
      for (const s of regs) {
        const names = RS.BIOME_NAMES[s.biome];
        let name = r.pick(names);
        for (let k = 0; k < 8 && usedNames.has(name); k++) name = r.pick(names);
        if (usedNames.has(name)) name = name + ' 동쪽';
        usedNames.add(name);
        s.name = name;
        s.def = RS.BIOMES[s.biome];
      }
    }

    assignHeights() {
      const { W, H, L, rng: r } = this;
      for (const s of this.regions) {
        const b = s.def;
        let h = b.height[0];
        if (b.height[1] > b.height[0]) h = (s.elev > 0.52 || r.chance(0.3)) ? b.height[1] : b.height[0];
        if (s.biome === 'camp') h = r.chance(0.5) ? 1 : 2;
        s.height = h;
        for (const t of s.tiles) L.hgt[t] = h;
      }
      // hills and hollows inside regions
      const inner = this.innerDist();
      this.inner = inner;
      for (const s of this.regions) {
        if (['swamp', 'marsh', 'shore', 'sunken', 'sanctum', 'camp'].includes(s.biome)) continue;
        const n = r.int(0, s.area > 500 ? 2 : 1);
        for (let k = 0; k < n; k++) {
          const cands = s.tiles.filter((t) => inner[t] >= 6);
          if (!cands.length) break;
          const c = r.pick(cands);
          const cx = c % W, cy = (c / W) | 0;
          const rad = r.range(2.6, 5.2);
          const up = s.height < 3 ? 1 : (s.biome === 'mountain' ? -1 : 0);
          if (!up) continue;
          for (let y = Math.floor(cy - rad - 3); y <= cy + rad + 3; y++) for (let x = Math.floor(cx - rad - 3); x <= cx + rad + 3; x++) {
            if (!this.inb(x, y)) continue;
            const i = y * W + x;
            if (L.region[i] !== s.id || inner[i] < 3) continue;
            const d = Math.hypot(x - cx, (y - cy) * 1.2) / rad + this.sx(x * 0.3, y * 0.3) * 0.3;
            if (d < 1) L.hgt[i] = s.height + up;
          }
        }
      }
      this.smoothHeights(3);
    }

    // distance from region border (inside each region)
    innerDist() {
      const { W, H, L } = this;
      const starts = [];
      for (let i = 0; i < this.N; i++) {
        if (!this.main[i]) { starts.push(i); continue; }
        const x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of D4) {
          const nx = x + dx, ny = y + dy;
          if (!this.inb(nx, ny) || L.region[ny * W + nx] !== L.region[i]) { starts.push(i); break; }
        }
      }
      const d = RS.bfs(W, H, starts, (j, c) => L.region[j] === L.region[c] && this.main[j] === 1);
      return d;
    }

    smoothHeights(passes) {
      const { W, H, L } = this;
      for (let p = 0; p < passes; p++) {
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          if (!this.main[i]) continue;
          const h = L.hgt[i];
          let ge = 0, gt = 0, minUp = 9, maxDown = 0;
          const hs = [];
          for (const [dx, dy] of D4) {
            const j = (y + dy) * W + x + dx;
            const hn = this.main[j] ? L.hgt[j] : (this.landT[j] === 2 ? h : 1);
            hs.push(hn);
            if (hn >= h) ge++;
            if (hn > h) { gt++; minUp = Math.min(minUp, hn); }
            if (hn < h) maxDown = Math.max(maxDown, hn);
          }
          if (ge <= 1 && maxDown > 0) L.hgt[i] = maxDown;
          else if (gt >= 3) L.hgt[i] = minUp;
          // thin horizontal slivers: avoid 1-row plateaus (faces would swallow them)
          else if (hs[0] < h && hs[2] < h) L.hgt[i] = Math.max(hs[0], hs[2]);
        }
      }
    }

    // true when a higher tile within 3 rows above would turn this tile into a cliff face
    faceRisk(x, y) {
      const { W, L } = this;
      const h = L.hgt[y * W + x];
      for (let k = 1; k <= 3; k++) {
        if (y - k < 0) break;
        const j = (y - k) * W + x;
        if (L.hgt[j] > h && this.landT[j] !== 0) return true;
      }
      return false;
    }

    computeHubs() {
      const { W, L } = this;
      const inner = this.innerDist();
      this.inner = inner;
      for (const s of this.regions) {
        let best = -1, bs = -1e9;
        const want = s.id === this.start ? 7 : 9;
        if (s.id === this.start && this.camp) { s.hub = { x: this.camp.tx, y: this.camp.ty }; continue; }
        for (const t of s.tiles) {
          if (L.hgt[t] !== s.height || L.kind[t] !== K.FLOOR) continue;
          if (L.flags[t] & (F.RES | F.OUTCROP)) continue;
          const x = t % W, y = (t / W) | 0;
          if (this.faceRisk(x, y) || (y + 1 < this.H && this.faceRisk(x, y + 1))) continue;
          const v = Math.min(inner[t], want) * 1.0 - Math.hypot(x - s.cx, y - s.cy) * 0.18;
          if (v > bs) { bs = v; best = t; }
        }
        if (best < 0) best = s.tiles.find((t) => L.kind[t] === K.FLOOR) || s.tiles[0];
        s.hub = { x: best % W, y: (best / W) | 0 };
      }
    }

    // ------------------------------------------------------------------------
    waterFeatures() {
      const { W, H, L, rng: r } = this;
      // rivers
      const nR = r.int(1, 2);
      this.rivers = [];
      const regOf = (i) => L.region[i];
      for (let k = 0; k < nR; k++) {
        const cands = [];
        for (let i = 0; i < this.N; i++) {
          if (!this.main[i] || this.seaDist[i] < 22 || this.edgeDist[i] < 2) continue;
          const rg = regOf(i);
          if (rg === this.start || rg === this.lair) continue;
          const x = i % W, y = (i / W) | 0;
          let rimAdj = 0;
          for (const [dx, dy] of D4) if (this.inb(x + dx, y + dy) && this.landT[(y + dy) * W + x + dx] === 2) rimAdj = 1;
          if (!rimAdj && L.hgt[i] < 2) continue;
          cands.push({ i, w: rimAdj * 3 + L.hgt[i] + this.seaDist[i] / 15 });
        }
        if (!cands.length) break;
        let path = null;
        for (let attempt = 0; attempt < 6 && !path; attempt++) {
          const src = r.weighted(cands, (c) => c.w).i;
          path = this.riverPath(src);
        }
        if (!path) continue;
        this.rivers.push(path);
        const n = path.length;
        path.forEach((t, j) => {
          const x = t % W, y = (t / W) | 0;
          const wide = j > n * 0.65 ? 1 : 0;
          const h = L.hgt[t];
          for (let dy = 0; dy <= 1 + wide; dy++) for (let dx = 0; dx <= 1 + wide; dx++) {
            const xx = x + dx - wide, yy = y + dy - wide;
            if (!this.inb(xx, yy)) continue;
            const q = yy * W + xx;
            if (!this.main[q] || L.hgt[q] !== h) continue;
            L.kind[q] = K.WATER; L.mat[q] = MAT.WATER; L.flags[q] |= F.RIVER;
          }
        });
      }
      // ponds, pools and marsh water
      for (const s of this.regions) {
        const b = s.biome;
        if (b === 'forest' || b === 'valley' || b === 'meadow') {
          if (r.chance(b === 'valley' ? 0.9 : 0.5)) this.pond(s, r.range(2, 3.8), MAT.WATER);
        }
        if (b === 'sunken') { const n = r.int(3, 5); for (let k = 0; k < n; k++) this.pond(s, r.range(1.8, 3.2), MAT.WATER); }
        if (b === 'shore' && r.chance(0.6)) this.pond(s, r.range(1.2, 2), MAT.WATER);
        if (b === 'swamp' || b === 'marsh') {
          const frac = s.def.pools;
          for (const t of s.tiles) {
            if (this.inner[t] < 3 || L.kind[t] !== K.FLOOR || L.hgt[t] !== s.height) continue;
            const x = t % W, y = (t / W) | 0;
            const hx = s.hub.x, hy = s.hub.y;
            if (Math.hypot(x - hx, y - hy) < 5) continue;
            const n = this.sx2(x * 0.16 + 13, y * 0.16 + 7) * 0.5 + 0.5;
            if (n > 1 - frac * 1.35) { L.kind[t] = K.WATER; L.mat[t] = MAT.MARSH; }
          }
        }
        if (b === 'canyon' || b === 'bridge') this.chasm(s);
      }
    }

    riverPath(src) {
      const { W, H, L } = this;
      // goal: nearest sea tile
      let goal = -1, gd = 1e9;
      const sxp = src % W, syp = (src / W) | 0;
      for (let i = 0; i < this.N; i++) {
        if (this.landT[i] !== 0) continue;
        const x = i % W, y = (i / W) | 0;
        const d = Math.abs(x - sxp) + Math.abs(y - syp);
        if (d < gd) { gd = d; goal = i; }
      }
      if (goal < 0) return null;
      const gx = goal % W, gy = (goal / W) | 0;
      const cost = (nx, ny, cx, cy) => {
        const j = ny * W + nx, c = cy * W + cx;
        if (this.landT[j] === 2) return Infinity;
        if (this.landT[j] === 0) return 1;
        const hj = L.hgt[j], hc = L.hgt[c];
        if (hj > hc) return Infinity;
        if (hj < hc && ny !== cy + 1) return Infinity;   // only descend southward (waterfalls)
        const rg = L.region[j];
        let v = 1 + (this.sx(nx * 0.12, ny * 0.12) * 0.5 + 0.5) * 2.5;
        if (rg === this.start || rg === this.lair) v += 40;
        if (L.kind[j] === K.WATER && L.mat[j] === MAT.WATER) v = 0.4;
        if (this.edgeDist[j] < 2 && this.landT[j] === 1) v += 3;
        return v;
      };
      const path = RS.astar(W, H, sxp, syp, gx, gy, cost, { heurWeight: 1.2, maxIter: this.N * 3 });
      if (!path) return null;
      // stop at first sea tile
      const out = [];
      for (const t of path) { if (this.landT[t] === 0) break; out.push(t); }
      return out.length > 10 ? out : null;
    }

    pond(s, rad, mat) {
      const { W, L, rng: r } = this;
      const cands = s.tiles.filter((t) => this.inner[t] >= Math.ceil(rad) + 3 && L.hgt[t] === s.height && L.kind[t] === K.FLOOR);
      if (!cands.length) return;
      const c = r.pick(cands);
      const cx = c % W, cy = (c / W) | 0;
      if (Math.hypot(cx - s.hub.x, cy - s.hub.y) < rad + 4) return;
      for (let y = Math.floor(cy - rad - 2); y <= cy + rad + 2; y++) for (let x = Math.floor(cx - rad - 2); x <= cx + rad + 2; x++) {
        if (!this.inb(x, y)) continue;
        const i = y * W + x;
        if (L.region[i] !== s.id || L.hgt[i] !== s.height || L.kind[i] !== K.FLOOR) continue;
        const d = Math.hypot(x - cx, (y - cy) * 1.15) / rad + this.sx(x * 0.35, y * 0.35) * 0.3;
        if (d < 1) { L.kind[i] = K.WATER; L.mat[i] = mat; }
      }
    }

    chasm(s) {
      const { W, H, L, rng: r } = this;
      const edge = s.tiles.filter((t) => this.inner[t] === 3 && L.hgt[t] === s.height);
      if (edge.length < 2) return;
      const a = r.pick(edge);
      let b = -1, bd = -1;
      for (const t of edge) {
        const d = Math.hypot((t % W) - (a % W), ((t / W) | 0) - ((a / W) | 0));
        if (d > bd) { bd = d; b = t; }
      }
      if (bd < 12) return;
      const cost = (nx, ny) => {
        const j = ny * W + nx;
        if (L.region[j] !== s.id || this.inner[j] < 2 || L.hgt[j] !== s.height) return Infinity;
        return 1 + (this.sx2(nx * 0.2, ny * 0.2) * 0.5 + 0.5) * 3;
      };
      const path = RS.astar(W, H, a % W, (a / W) | 0, b % W, (b / W) | 0, cost, { maxIter: this.N });
      if (!path) return;
      const hubD = (x, y) => Math.hypot(x - s.hub.x, y - s.hub.y);
      for (const t of path) {
        const x = t % W, y = (t / W) | 0;
        if (hubD(x, y) < 3) continue;
        for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
          const q = (y + dy) * W + x + dx;
          if (!this.inb(x + dx, y + dy) || L.region[q] !== s.id || L.hgt[q] !== s.height || L.kind[q] !== K.FLOOR) continue;
          L.kind[q] = K.CHASM; L.mat[q] = MAT.CHASM;
        }
      }
      s.chasmPath = path;
    }

    baseMaterials() {
      const { W, H, L } = this;
      for (const s of this.regions) {
        const b = s.def;
        for (const t of s.tiles) {
          if (L.kind[t] !== K.FLOOR) continue;
          const x = t % W, y = (t / W) | 0;
          const n = this.vn.fbm(x / 9 + s.id * 7, y / 9, 3, 2, 0.5);
          let m = b.ground;
          if (n > 0.6) m = b.alt;
          if (s.biome === 'ruins' && n > 0.56 && n < 0.64) m = MAT.RUIN;
          if (s.biome === 'coast' && this.seaDist[t] < 5 && n > 0.45) m = MAT.ROCK;
          L.mat[t] = m;
        }
      }
      // beaches along low coasts
      for (let i = 0; i < this.N; i++) {
        if (!this.main[i] || L.kind[i] !== K.FLOOR || L.hgt[i] !== 1) continue;
        const rg = this.regions[L.region[i]];
        if (!rg || rg.biome === 'coast' || rg.biome === 'sanctum') continue;
        const x = i % W, y = (i / W) | 0;
        const lim = 1.5 + (this.sx(x * 0.09, y * 0.09) * 0.5 + 0.5) * 2.6;
        if (this.seaDist[i] <= lim) { L.mat[i] = rg.biome === 'swamp' || rg.biome === 'marsh' ? MAT.MUD : MAT.SAND; L.flags[i] |= F.BEACH; }
      }
    }

    // ------------------------------------------------------------------------
    // Camp, dungeon sites and the guardian lair (outcrops are raised before cliffs are derived)
    planSites() {
      const { W, L, rng: r } = this;
      // camp
      const sr = this.regions[this.start];
      const c = sr.hub;
      this.flatten(c.x, c.y, 6.5, sr.height, sr.id, MAT.GRASS);
      for (let y = c.y - 12; y <= c.y + 12; y++) for (let x = c.x - 12; x <= c.x + 12; x++) {
        if (!this.inb(x, y)) continue;
        const d = Math.hypot(x - c.x, y - c.y);
        const i = y * W + x;
        if (d <= 12) L.flags[i] |= F.SAFE | F.NOSPAWN;
        if (d <= 6) L.flags[i] |= F.RES;
        if (d <= 2.6 && L.region[i] === sr.id) L.mat[i] = MAT.DIRT;
      }
      this.camp = { tx: c.x, ty: c.y };

      // dungeons: near / middle / far by graph distance from start
      const d = this.startDist;
      const cands = this.regions.filter((s) => s.id !== this.start && s.id !== this.lair && d[s.id] > 0 && s.area >= 220);
      cands.sort((a, b) => d[a.id] - d[b.id] || a.id - b.id);
      const picks = [];
      const adj = (a, b) => (this.regions[a].nb[b] || 0) >= 3;
      const thirds = [cands.slice(0, Math.max(1, Math.ceil(cands.length / 3))), cands.slice(Math.floor(cands.length / 3), Math.ceil(cands.length * 2 / 3)), cands.slice(Math.floor(cands.length * 2 / 3))];
      for (let k = 0; k < 3; k++) {
        let pool = thirds[k].filter((s) => !picks.includes(s) && !picks.some((p) => adj(p.id, s.id)));
        if (!pool.length) pool = cands.filter((s) => !picks.includes(s));
        if (!pool.length) break;
        if (k === 0) pool.sort((a, b) => d[a.id] - d[b.id]);
        picks.push(k === 0 ? pool[0] : r.pick(pool));
      }
      // themes: moss / tide / ember with style compatibility
      const pref = {
        moss: { forest: 3, valley: 3, swamp: 2, marsh: 2, meadow: 2, coast: 1, mountain: 1, ruins: 1 },
        tide: { sunken: 4, ruins: 3, shore: 3, swamp: 2, coast: 2, marsh: 2, meadow: 1 },
        ember: { canyon: 4, mountain: 3, bridge: 3, ruins: 2, forest: 1, meadow: 1, coast: 1 }
      };
      const perms = [['moss', 'tide', 'ember'], ['moss', 'ember', 'tide'], ['tide', 'moss', 'ember'], ['tide', 'ember', 'moss'], ['ember', 'moss', 'tide'], ['ember', 'tide', 'moss']];
      let bestP = perms[0], bestS = -1;
      for (const p of perms) {
        let s = 0;
        p.forEach((th, i) => { if (picks[i]) s += (pref[th][picks[i].biome] || 0); });
        if (p[0] === 'moss') s += 0.5; // the gentle cave tends to come first
        if (s > bestS) { bestS = s; bestP = p; }
      }
      this.dungeons = [];
      picks.forEach((s, i) => {
        const theme = bestP[i];
        const style = theme === 'tide' ? 'ruin' : theme === 'ember' ? 'cave' : (s.biome === 'forest' || s.biome === 'valley' || s.biome === 'swamp' || s.biome === 'marsh' ? 'root' : 'cave');
        this.dungeons.push({ index: i, theme, style, region: s.id, tier: i + 1 });
      });
      // guarantee one cliff cave and one ground-level entrance
      if (!this.dungeons.some((dg) => dg.style === 'cave')) { const m = this.dungeons.find((dg) => dg.theme === 'moss'); if (m) m.style = 'cave'; }
      for (const dg of this.dungeons) this.placeDungeonSite(dg);
      this.dungeons = this.dungeons.filter((dg) => dg.site);
      this.placeLairSite();
    }

    flatten(cx, cy, rad, h, rid, mat) {
      const { W, L } = this;
      for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
        if (!this.inb(x, y)) continue;
        const i = y * W + x;
        if (!this.main[i]) continue;
        if (Math.hypot(x - cx, y - cy) > rad) continue;
        if (rid !== undefined && L.region[i] !== rid) continue;
        L.hgt[i] = h;
        if (L.kind[i] !== K.FLOOR) { L.kind[i] = K.FLOOR; L.flags[i] &= ~F.RIVER; }
        if (mat !== undefined) L.mat[i] = mat;
      }
    }

    // find a tile in region s satisfying fn with inner distance >= minInner
    findSpot(s, minInner, fn) {
      const { W, rng: r } = this;
      const list = s.tiles.filter((t) => this.inner[t] >= minInner && fn(t % W, (t / W) | 0, t));
      if (!list.length) return null;
      return r.pick(list);
    }

    areaClear(x0, y0, x1, y1, h, rid) {
      const { W, L } = this;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!this.inb(x, y)) return false;
        const i = y * W + x;
        if (!this.main[i] || L.region[i] !== rid || L.hgt[i] !== h || L.kind[i] !== K.FLOOR) return false;
        if (L.flags[i] & (F.RES | F.RIVER | F.GATEZ)) return false;
      }
      return true;
    }

    // keep dungeon/lair sites away from planned region gates and hubs
    reserveGates() {
      const { W, L } = this;
      const mark = (x, y, rad) => {
        for (let yy = y - rad; yy <= y + rad; yy++) for (let xx = x - rad; xx <= x + rad; xx++) if (this.inb(xx, yy)) L.flags[yy * W + xx] |= F.GATEZ;
      };
      for (const e of this.connections) if (e.gate) { mark(e.gate.ax, e.gate.ay, 3); mark(e.gate.bx, e.gate.by, 3 + (e.gate.depth || 0)); }
      for (const s of this.regions) mark(s.hub.x, s.hub.y, 2);
    }

    placeDungeonSite(dg) {
      const { W, L, rng: r } = this;
      const s = this.regions[dg.region];
      const h = s.height;
      const hubFar = (x, y) => Math.hypot(x - s.hub.x, y - s.hub.y) >= 6;
      if (dg.style === 'cave') {
        // outcrop 7 wide x 5 tall above the cave, face rows below, 3 rows of open ground in front
        const t = this.findSpot(s, 5, (x, y) => hubFar(x, y) && this.areaClear(x - 4, y - 6, x + 5, y + 4, h, s.id));
        if (t === null) return this.fallbackGround(dg, s);
        const x = t % W, y = (t / W) | 0;
        const up = h + 1;
        // outcrop symmetric around the mouth (columns x, x+1)
        for (let yy = y - 6; yy <= y - 1; yy++) for (let xx = x - 4; xx <= x + 5; xx++) {
          const i = yy * W + xx;
          const edgeX = xx <= x ? x - xx : xx - (x + 1);
          const top = yy === y - 6;
          const jag = this.sx(xx * 0.5, yy * 0.5) > 0.25;
          if (yy === y - 1 && edgeX <= 3) { L.hgt[i] = up; L.flags[i] |= F.OUTCROP | F.RES; continue; }
          if (edgeX === 4 && jag) continue;
          if (top && (edgeX >= 3 || jag)) continue;
          L.hgt[i] = up; L.flags[i] |= F.OUTCROP | F.RES;
        }
        // face rows are y and y+1; the 2-wide cave mouth is cut into the lower face row at columns x, x+1
        dg.site = { mouthX: x, mouthY: y + 1, approachX: x, approachY: y + 2 };
        for (let yy = y; yy <= y + 4; yy++) for (let xx = x - 3; xx <= x + 3; xx++) L.flags[yy * W + xx] |= F.RES | F.NOSPAWN;
        dg.entrance = { tx: x, ty: y + 1 };
      } else {
        const t = this.findSpot(s, 4, (x, y) => hubFar(x, y) && this.areaClear(x - 2, y - 2, x + 2, y + 3, h, s.id));
        if (t === null) return this.fallbackGround(dg, s);
        const x = t % W, y = (t / W) | 0;
        for (let yy = y - 2; yy <= y + 3; yy++) for (let xx = x - 2; xx <= x + 2; xx++) L.flags[yy * W + xx] |= F.RES | F.NOSPAWN;
        dg.site = { cx: x, cy: y, approachX: x, approachY: y + 2 };
        dg.entrance = { tx: x, ty: y };
      }
      dg.approach = { tx: dg.site.approachX, ty: dg.site.approachY };
    }

    fallbackGround(dg, s) {
      const { W } = this;
      // relax constraints: any clear 3x4 area
      const t = this.findSpot(s, 2, (x, y) => this.areaClear(x - 1, y - 1, x + 1, y + 2, s.height, s.id));
      if (t === null) { dg.site = null; return; }
      const x = t % W, y = (t / W) | 0;
      dg.style = dg.theme === 'tide' ? 'ruin' : 'root';
      for (let yy = y - 1; yy <= y + 2; yy++) for (let xx = x - 1; xx <= x + 1; xx++) this.L.flags[yy * W + xx] |= F.RES | F.NOSPAWN;
      dg.site = { cx: x, cy: y, approachX: x, approachY: y + 2 };
      dg.entrance = { tx: x, ty: y };
      dg.approach = { tx: x, ty: y + 2 };
    }

    placeLairSite() {
      const { W, L, rng: r } = this;
      const s = this.regions[this.lair];
      const h = s.height;
      // prefer the spot deepest inside the region and far from the region's neighbours toward start
      const sr = this.regions[this.start];
      let best = null, bs = -1e9;
      for (const t of s.tiles) {
        const x = t % W, y = (t / W) | 0;
        if (this.inner[t] < 4) continue;
        if (!this.areaClear(x - 5, y - 6, x + 5, y + 4, h, s.id)) continue;
        const v = Math.hypot(x - sr.cx, y - sr.cy) * 0.6 + this.inner[t] * 0.5 - Math.abs(y - s.cy) * 0.1;
        if (v > bs) { bs = v; best = t; }
      }
      if (best === null) {
        // relax: flatten an area around the hub
        const hx = s.hub.x, hy = s.hub.y;
        this.flatten(hx, hy - 2, 6, h, s.id);
        best = hy * W + hx;
      }
      const x = best % W, y = (best / W) | 0;
      const up = h + 1;
      for (let yy = y - 7; yy <= y - 1; yy++) for (let xx = x - 5; xx <= x + 5; xx++) {
        if (!this.inb(xx, yy)) continue;
        const i = yy * W + xx;
        if (!this.main[i] || L.region[i] !== s.id) continue;
        const ex = Math.abs(xx - x);
        if (yy === y - 7 && ex > 3) continue;
        if (ex === 5 && this.sx(xx * 0.4, yy * 0.4) > 0.3 && yy !== y - 1) continue;
        L.hgt[i] = up; L.kind[i] = K.FLOOR; L.flags[i] |= F.OUTCROP | F.RES | F.LAIR;
      }
      for (let yy = y; yy <= y + 4; yy++) for (let xx = x - 4; xx <= x + 4; xx++) if (this.inb(xx, yy)) L.flags[yy * W + xx] |= F.RES | F.NOSPAWN | F.LAIR;
      // gate occupies the lower face row (y+1), 3 columns centred on x
      this.lairSite = { gateX: x, gateY: y + 1, approachX: x, approachY: y + 3, region: s.id };
    }

    // ------------------------------------------------------------------------
    // Region connection graph: spanning tree over feasible borders + loops; heights equalised when needed
    planConnections() {
      const r = this.rng;
      const { W, L } = this;
      for (let iter = 0; iter < 12; iter++) {
        const edges = [];
        for (const s of this.regions) for (const k of Object.keys(s.nb)) {
          const o = +k;
          if (o <= s.id || s.nb[k] < 3) continue;
          const gates = this.gateCandidates(s.id, o);
          edges.push({ a: s.id, b: o, gates, feasible: gates.length > 0, border: s.nb[k] });
        }
        // Kruskal on feasible edges; the lair only joins through a single edge
        const parent = this.regions.map((s) => s.id);
        const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
        const feas = edges.filter((e) => e.feasible);
        feas.forEach((e) => { e.w = r.range(0.5, 1.5) / Math.sqrt(e.border) + (e.a === this.lair || e.b === this.lair ? 0.6 : 0); });
        feas.sort((x, y) => x.w - y.w);
        const chosen = [];
        let lairEdges = 0;
        for (const e of feas) {
          const isLair = e.a === this.lair || e.b === this.lair;
          if (isLair && lairEdges >= 1) continue;
          const ra = find(e.a), rb = find(e.b);
          if (ra !== rb) { parent[ra] = rb; chosen.push(e); if (isLair) lairEdges++; }
        }
        const roots = new Set(this.regions.map((s) => find(s.id)));
        if (roots.size > 1) {
          // equalise one infeasible edge bridging two components
          const bad = edges.find((e) => !e.feasible && find(e.a) !== find(e.b) && !(lairEdges >= 1 && (e.a === this.lair || e.b === this.lair)));
          if (!bad) { this.log.push('connections: unresolvable components'); this.connections = chosen; break; }
          const ra = this.regions[bad.a], rb = this.regions[bad.b];
          const lower = ra.height < rb.height ? ra : rb, higher = lower === ra ? rb : ra;
          const target = lower.biome === 'sanctum' ? higher : lower;
          const other = target === lower ? higher : lower;
          const hNew = other.height;
          const delta = hNew - target.height;
          for (const t of target.tiles) L.hgt[t] = Math.max(1, Math.min(4, L.hgt[t] + delta));
          target.height = hNew;
          this.log.push('equalised region ' + target.id + ' to ' + hNew);
          continue;
        }
        // extra loops
        const extras = [];
        for (const e of feas) {
          if (chosen.includes(e)) continue;
          if (e.a === this.lair || e.b === this.lair) continue;
          if (r.chance(0.34)) { e.extra = true; e.hidden = r.chance(0.3); extras.push(e); }
        }
        this.connections = chosen.concat(extras);
        break;
      }
      // choose a gate for each connection
      for (const e of this.connections) {
        const ha = this.regions[e.a].hub, hb = this.regions[e.b].hub;
        let best = null, bs = 1e9;
        for (const g of e.gates) {
          const v = Math.hypot(g.ax - ha.x, g.ay - ha.y) + Math.hypot(g.bx - hb.x, g.by - hb.y) + r.next() * 8 + (g.water ? 6 : 0) + (g.stairs ? 4 : 0);
          if (v < bs) { bs = v; best = g; }
        }
        e.gate = best;
        e.open = !e.hidden && this.regions[e.a].height === this.regions[e.b].height && r.chance(0.28) && e.a !== this.lair && e.b !== this.lair;
      }
    }

    // gate candidates between region a and b: adjacent tile pairs usable for a road crossing
    gateCandidates(a, b) {
      const { W, H, L } = this;
      const out = [];
      const ra = this.regions[a];
      const okFloor = (i) => this.main[i] && (L.kind[i] === K.FLOOR || (L.kind[i] === K.WATER && L.mat[i] !== MAT.SEA)) && !(L.flags[i] & (F.RES | F.OUTCROP));
      for (const t of ra.tiles) {
        const x = t % W, y = (t / W) | 0;
        for (const [dx, dy] of D4) {
          const nx = x + dx, ny = y + dy;
          if (!this.inb(nx, ny)) continue;
          const j = ny * W + nx;
          if (L.region[j] !== b) continue;
          if (!okFloor(t) || !okFloor(j)) continue;
          const ha = L.hgt[t], hb = L.hgt[j];
          const water = L.kind[t] === K.WATER || L.kind[j] === K.WATER;
          const rb = this.regions[b];
          if (ha === hb) {
            // both sides must sit at their region's base height and stay clear of future cliff faces
            if (ha !== ra.height || hb !== rb.height) continue;
            if (this.faceRisk(x, y) || this.faceRisk(nx, ny)) continue;
            out.push({ ax: x, ay: y, bx: nx, by: ny, water, stairs: false });
          } else if (dx === 0 && !water) {
            // higher must be north of lower; lower side needs room for the face + landing
            const hiT = dy === 1 ? t : j, loT = dy === 1 ? j : t;
            if (L.hgt[hiT] <= L.hgt[loT]) continue;
            const hiR = this.regions[L.region[hiT]], loR = this.regions[L.region[loT]];
            if (L.hgt[hiT] !== hiR.height || L.hgt[loT] !== loR.height) continue;
            const depth = Math.min(3, (L.hgt[hiT] - L.hgt[loT]) * 2);
            const lx = loT % W, ly = (loT / W) | 0;
            let ok = true;
            for (let k = 0; k <= depth; k++) {
              if (!this.inb(lx, ly + k)) { ok = false; break; }
              const q = (ly + k) * W + lx;
              if (!this.main[q] || L.hgt[q] !== L.hgt[loT] || L.kind[q] !== K.FLOOR || L.region[q] !== L.region[loT]) { ok = false; break; }
            }
            // second column for 2-wide stairs
            if (ok) {
              for (let k = -1; k <= depth; k++) {
                const q = (ly + k) * W + lx + 1;
                if (!this.inb(lx + 1, ly + k)) { ok = false; break; }
                const want = k < 0 ? L.hgt[hiT] : L.hgt[loT];
                if (!this.main[q] || L.hgt[q] !== want || L.kind[q] !== K.FLOOR) { ok = false; break; }
              }
            }
            if (ok) out.push({ ax: x, ay: y, bx: nx, by: ny, water: false, stairs: true, depth });
          }
        }
      }
      return out;
    }

    faceStyleAt(x, y) {
      const { W, L } = this;
      // style of the region above the face
      for (let k = 1; k <= 4; k++) {
        if (y - k < 0) break;
        const i = (y - k) * W + x;
        if (L.kind[i] === K.WALL) return FS.ROCK;
        const rg = L.region[i];
        if (rg < 254 && L.kind[i] !== K.FACE) return this.regions[rg].def.face;
      }
      return FS.ROCK;
    }

    markFalls() {
      const { W, H, L } = this;
      for (let i = 0; i < this.N; i++) {
        if (L.kind[i] !== K.FACE) continue;
        const x = i % W, y = (i / W) | 0;
        const f = L.face[i];
        const row = f & 3;
        const top = (y - row - 1) * W + x;
        if (y - row - 1 < 0) continue;
        if (L.kind[top] === K.WATER && L.mat[top] === MAT.WATER) {
          L.kind[i] = K.FALLS;
          L.flags[i] |= F.RIVER;
        }
      }
      // water directly under a waterfall column
      for (let i = 0; i < this.N; i++) {
        if (L.kind[i] !== K.FALLS) continue;
        const x = i % W, y = (i / W) | 0;
        const below = (y + 1) * W + x;
        if (y + 1 < H && L.kind[below] === K.FLOOR) { L.kind[below] = K.WATER; L.mat[below] = MAT.WATER; L.flags[below] |= F.RIVER; }
      }
    }

    // ------------------------------------------------------------------------
    // Roads: A* with region gating, bridges over rivers/marsh/chasms, stairs through N-S cliff faces
    roadAstar(sx, sy, goalFn, heur, allowed, gatePairs) {
      const { W, H, L } = this;
      const N = this.N;
      const g = new Float32Array(N).fill(Infinity);
      const from = new Int32Array(N).fill(-1);
      const via = new Uint8Array(N);  // 1 = arrived by face jump
      const closed = new Uint8Array(N);
      const heap = new RS.MinHeap();
      const si = sy * W + sx;
      g[si] = 0; heap.push(heur(sx, sy), si);
      let found = -1, iter = 0;
      const walkKind = (i) => {
        const k = L.kind[i];
        return k === K.FLOOR || k === K.BRIDGE || k === K.STAIRS || (k === K.WATER && L.mat[i] !== MAT.SEA) || k === K.CHASM;
      };
      const tileCost = (i) => {
        const k = L.kind[i];
        const x = i % W, y = (i / W) | 0;
        // two noise scales make roads bend around soft "hills" of cost
        let c = 1 + (this.sx2(x * 0.13, y * 0.13) * 0.5 + 0.5) * 1.4 + (this.sx(x * 0.045 + 90, y * 0.045 + 30) * 0.5 + 0.5) * 3.2;
        if (L.flags[i] & F.ROAD) c = 0.35;
        if (k === K.WATER) c = L.mat[i] === MAT.MARSH ? 3.5 : 11;
        if (k === K.CHASM) c = 12;
        if (k === K.BRIDGE || k === K.STAIRS) c = 0.4;
        if (this.inner[i] <= 1) c += 1.5;
        if (L.flags[i] & F.RES) c += 25;
        return c;
      };
      while (heap.size && iter++ < N * 4) {
        const cur = heap.pop();
        if (closed[cur]) continue;
        closed[cur] = 1;
        const cx = cur % W, cy = (cur / W) | 0;
        if (goalFn(cx, cy, cur)) { found = cur; break; }
        const ch = L.hgt[cur];
        for (let d = 0; d < 4; d++) {
          const dx = D4[d][0], dy = D4[d][1];
          let nx = cx + dx, ny = cy + dy;
          if (!this.inb(nx, ny)) continue;
          let ni = ny * W + nx;
          let extra = 0, jumped = 0;
          const nk = L.kind[ni];
          if (nk === K.FACE && dx === 0) {
            // jump through the whole face column
            const f = L.face[ni];
            const row = f & 3, depth = Math.max(1, (f >> 2) & 3);
            if (dy === 1 && row !== 0) continue;
            if (dy === -1 && row !== depth - 1) continue;
            const ly = dy === 1 ? ny + depth : ny - depth;
            if (!this.inb(nx, ly)) continue;
            const li = ly * W + nx;
            if (!walkKind(li) || L.kind[li] === K.WATER || L.kind[li] === K.CHASM) continue;
            if (dy === 1 && L.hgt[li] !== L.hgt[ni]) continue;
            if (dy === -1 && L.hgt[li] <= L.hgt[ni]) continue;
            // stair column must stay in allowed regions and be a single contiguous face
            let okc = true;
            for (let k = 0; k < depth; k++) { const q = (dy === 1 ? ny + k : ny - k) * W + nx; if (L.kind[q] !== K.FACE && L.kind[q] !== K.STAIRS) okc = false; }
            if (!okc) continue;
            ni = li; ny = ly; extra = 7 + depth * 2; jumped = 1;
          } else if (nk === K.STAIRS) {
            if (dx !== 0) continue;
          } else {
            if (!walkKind(ni)) continue;
            if (L.hgt[ni] !== ch && L.kind[cur] !== K.STAIRS) continue;
            if (L.kind[cur] === K.STAIRS && dx !== 0) continue;
          }
          if (closed[ni]) continue;
          const rg = L.region[ni], rc = L.region[cur];
          if (!allowed(rg)) continue;
          if (rg !== rc && gatePairs && !jumped) {
            let ok = false;
            for (const gp of gatePairs) if ((gp[0] === cur && gp[1] === ni) || (gp[1] === cur && gp[0] === ni)) ok = true;
            if (!ok) continue;
          }
          const ng = g[cur] + tileCost(ni) + extra;
          if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; via[ni] = jumped; heap.push(ng + heur(nx, ny), ni); }
        }
      }
      if (found < 0) return null;
      const path = [];
      let c = found;
      while (c !== -1) { path.push({ i: c, jump: via[c] }); if (c === si) break; c = from[c]; }
      path.reverse();
      return path;
    }

    applyRoad(path, brush, rid) {
      const { W, H, L } = this;
      for (let p = 0; p < path.length; p++) {
        const { i, jump } = path[p];
        const x = i % W, y = (i / W) | 0;
        if (jump && p > 0) {
          // convert the face column between previous tile and this landing into stairs (2 wide when possible)
          const prev = path[p - 1].i;
          const py = (prev / W) | 0;
          const y0 = Math.min(py, y) + 1, y1 = Math.max(py, y) - 1;
          const colOk = (xx) => {
            if (!this.inb(xx, y0 - 1) || !this.inb(xx, y1 + 1)) return false;
            if (L.hgt[(y0 - 1) * W + xx] !== L.hgt[(y0 - 1) * W + x] || L.hgt[(y1 + 1) * W + xx] !== L.hgt[(y1 + 1) * W + x]) return false;
            const ka = L.kind[(y0 - 1) * W + xx], kb = L.kind[(y1 + 1) * W + xx];
            if (ka !== K.FLOOR || kb !== K.FLOOR) return false;
            for (let yy = y0; yy <= y1; yy++) { const k = L.kind[yy * W + xx]; if (k !== K.FACE && k !== K.STAIRS) return false; }
            return true;
          };
          const cols = [x];
          if (colOk(x + 1)) cols.push(x + 1); else if (colOk(x - 1)) cols.push(x - 1);
          for (const xx of cols) {
            for (let yy = y0; yy <= y1; yy++) { const q = yy * W + xx; L.kind[q] = K.STAIRS; L.flags[q] |= F.ROAD | F.ROADM; }
            for (const yy of [y0 - 1, y1 + 1]) { const q = yy * W + xx; if (L.kind[q] === K.FLOOR) { L.flags[q] |= F.ROAD; this.setRoadMat(q); } }
          }
        }
        const k = L.kind[i];
        if (k === K.WATER || k === K.CHASM) {
          L.kind[i] = K.BRIDGE;
          L.flags[i] |= F.ROAD | F.ROADM;
          if (!L._bridgeDir) L._bridgeDir = new Uint8Array(this.N);
          const pr = path[Math.max(0, p - 1)].i, nx = path[Math.min(path.length - 1, p + 1)].i;
          const horiz = Math.abs((nx % W) - (pr % W)) >= Math.abs(((nx / W) | 0) - ((pr / W) | 0));
          L._bridgeDir[i] = horiz ? 1 : 2;
          // widen bridge perpendicular
          if (brush > 1) {
            const q = horiz ? i + W : i + 1;
            if (q < this.N && (L.kind[q] === K.WATER || L.kind[q] === K.CHASM) && L.hgt[q] === L.hgt[i]) { L.kind[q] = K.BRIDGE; L._bridgeDir[q] = horiz ? 1 : 2; L.flags[q] |= F.ROAD | F.ROADM; }
          }
          continue;
        }
        if (k === K.STAIRS) continue;
        L.flags[i] |= F.ROAD;
        this.setRoadMat(i);
      }
      // smoothed centre line rasterised with a round brush: curving roads instead of stair-steps
      const R = brush > 1 ? 1.05 : 0.62;
      const win = brush > 1 ? 3 : 2;
      for (let p = 0; p < path.length; p++) {
        const i0 = path[p].i;
        const k0 = L.kind[i0];
        if (k0 !== K.FLOOR) continue;
        let sx = 0, sy = 0, n = 0;
        for (let q = Math.max(0, p - win); q <= Math.min(path.length - 1, p + win); q++) {
          const iq = path[q].i;
          if (L.kind[iq] !== K.FLOOR || L.hgt[iq] !== L.hgt[i0] || path[q].jump) continue;
          sx += iq % W; sy += (iq / W) | 0; n++;
        }
        if (!n) continue;
        const cx = sx / n, cy = sy / n;
        for (let yy = Math.floor(cy - R - 1); yy <= Math.ceil(cy + R + 1); yy++) for (let xx = Math.floor(cx - R - 1); xx <= Math.ceil(cx + R + 1); xx++) {
          if (!this.inb(xx, yy)) continue;
          const q = yy * W + xx;
          if ((xx - cx) * (xx - cx) + (yy - cy) * (yy - cy) > (R + 0.35) * (R + 0.35)) continue;
          if (L.kind[q] !== K.FLOOR || L.hgt[q] !== L.hgt[i0] || (L.flags[q] & (F.OUTCROP | F.ENTR))) continue;
          if (this.faceRisk(xx, yy)) continue;
          L.flags[q] |= F.ROAD; this.setRoadMat(q);
        }
      }
    }

    setRoadMat(i) {
      const L = this.L;
      const rg = this.regions[L.region[i]];
      if (!rg) return;
      let m = rg.def.path;
      if (m === MAT.PLANK) m = MAT.MUD; // swamp roads: mud paths with plank bridges
      if (rg.biome === 'camp') m = MAT.DIRT;
      L.mat[i] = m;
      if (L.flags[i] & F.MAINROAD) return;
    }

    buildRoads() {
      const { W, H, L } = this;
      L.rebuildSolid();
      const hubIdx = (s) => s.hub.y * W + s.hub.x;
      this.roads = [];
      for (const e of this.connections) {
        if (!e.gate) continue;
        const A = this.regions[e.a], B = this.regions[e.b];
        const gp = [[e.gate.ay * W + e.gate.ax, e.gate.by * W + e.gate.bx]];
        // stairs gate: allow the jump across the face that sits in the lower region
        const goal = hubIdx(B);
        const gx = B.hub.x, gy = B.hub.y;
        const path = this.roadAstar(A.hub.x, A.hub.y, (x, y, i) => i === goal, (x, y) => (Math.abs(x - gx) + Math.abs(y - gy)) * 0.9,
          (rg) => rg === e.a || rg === e.b, e.gate.stairs ? null : gp);
        if (!path) {
          const gi = e.gate.ay * W + e.gate.ax, gj = e.gate.by * W + e.gate.bx;
          if (e.gate.stairs) {
            const hiT = L.hgt[gi] > L.hgt[gj] ? gi : gj;
            const hx = hiT % W, hy = (hiT / W) | 0;
            const col = [];
            for (let k = -1; k <= 4; k++) { const q = (hy + k) * W + hx; col.push(L.kind[q] + ':' + L.hgt[q] + ':' + (L.face[q] & 15) + ':r' + L.region[q]); }
            this.log.push('stairs col ' + col.join(' ') + ' A=' + e.a + ' B=' + e.b);
          }
          this.log.push('road failed ' + A.name + '(h' + A.height + ',hubk' + L.kind[hubIdx(A)] + ')-' + B.name + '(h' + B.height + ',hubk' + L.kind[hubIdx(B)] + ') gate stairs=' + e.gate.stairs + ' kinds=' + L.kind[gi] + '/' + L.kind[gj] + ' hg=' + L.hgt[gi] + '/' + L.hgt[gj]);
          e.failed = true; continue;
        }
        this.applyRoad(path, e.extra ? 1 : 2);
        e.path = path;
        this.roads.push(path);
      }
      // mark road margins
      this.markRoadMargins();
    }

    markRoadMargins() {
      const { W, H, L } = this;
      for (let i = 0; i < this.N; i++) {
        if (!(L.flags[i] & F.ROAD)) continue;
        const x = i % W, y = (i / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (this.inb(x + dx, y + dy)) L.flags[(y + dy) * W + x + dx] |= F.ROADM;
        }
      }
    }

    // Carve entrance mouths and link every site (dungeons, lair) to the road network
    connectSites() {
      const { W, L } = this;
      for (const dg of this.dungeons) {
        const s = dg.site;
        if (dg.style === 'cave') {
          // mouth tiles (lower face row) become walkable floor leading into the dark
          for (let xx = s.mouthX; xx <= s.mouthX + 1; xx++) {
            const i = s.mouthY * W + xx;
            L.kind[i] = K.FLOOR; L.flags[i] |= F.ENTR | F.RES;
            L.mat[i] = this.regions[dg.region].def.path === MAT.PLANK ? MAT.MUD : MAT.GRAVEL;
          }
        }
        L.rebuildSolid();
        const p = this.connectToRoad(dg.approach.tx, dg.approach.ty, dg.region, 1);
        if (!p) this.log.push('dungeon ' + dg.index + ' path failed');
        dg.path = p;
      }
      if (this.lairSite) {
        const s = this.lairSite;
        const p = this.connectToRoad(s.approachX, s.approachY, s.region, 2);
        if (!p) this.log.push('lair path failed');
        this.lairSite.path = p;
      }
    }

    // side path from a tile to the nearest road tile inside the same region(s)
    connectToRoad(tx, ty, rid, brush) {
      const { W, L } = this;
      const path = this.roadAstar(tx, ty, (x, y, i) => (L.flags[i] & F.ROAD) > 0 && L.kind[i] === K.FLOOR, () => 0, (rg) => rg === rid, null);
      if (path) { this.applyRoad(path, brush || 1); this.markRoadMargins(); return path; }
      return null;
    }

    // ------------------------------------------------------------------------
    // Natural barriers on region borders (except along roads and open connections)
    buildBarriers() {
      const { W, H, L, rng: r } = this;
      const openPairs = new Set();
      for (const e of this.connections) if (e.open) { openPairs.add(e.a + ':' + e.b); openPairs.add(e.b + ':' + e.a); }
      // distance to border with a different region (per tile, which neighbour region)
      const borderNb = new Int16Array(this.N).fill(-1);
      for (let i = 0; i < this.N; i++) {
        if (!this.main[i]) continue;
        const x = i % W, y = (i / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (!this.inb(nx, ny)) continue;
          const j = ny * W + nx;
          const u = L.region[j];
          if (u < 254 && u !== L.region[i] && this.main[j]) { borderNb[i] = u; }
        }
      }
      const bw = (x, y) => 1 + (this.sx(x * 0.17 + 5, y * 0.17 + 9) > 0.1 ? 1 : 0);
      const toBar = [];
      for (let i = 0; i < this.N; i++) {
        if (!this.main[i]) continue;
        const x = i % W, y = (i / W) | 0;
        // find nearest foreign region within 2 tiles
        let nb = -1, nd = 9;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx, ny = y + dy;
          if (!this.inb(nx, ny)) continue;
          const j = ny * W + nx;
          const u = L.region[j];
          if (u < 254 && u !== L.region[i] && this.main[j]) { const d = Math.max(Math.abs(dx), Math.abs(dy)); if (d < nd) { nd = d; nb = u; } }
        }
        if (nb < 0 || nd > bw(x, y)) continue;
        const me = L.region[i];
        if (openPairs.has(me + ':' + nb)) continue;
        if (L.kind[i] !== K.FLOOR) continue;
        if (L.flags[i] & (F.ROADM | F.RES | F.SAFE | F.OUTCROP)) continue;
        // different heights: the cliff already separates the regions
        const hn = this.regions[nb].height, hm = L.hgt[i];
        if (hn !== hm && this.regions[me].height !== this.regions[nb].height) {
          if (r.chance(0.25)) toBar.push({ i, type: 'deco' });
          continue;
        }
        toBar.push({ i, type: this.regions[me].def.barrier });
      }
      this.barrierTiles = toBar;
      for (const b of toBar) {
        const i = b.i;
        L.flags[i] |= F.BARRIER;
        if (b.type === 'forest' || b.type === 'hedge') { L.kind[i] = K.DEEP; L.mat[i] = MAT.DEEPFOREST; }
        else if (b.type === 'marsh') { L.kind[i] = K.WATER; L.mat[i] = MAT.MARSH; }
        // rock / ruinwall / deco are realised as blocking objects by the decorator
      }
      // hidden connections: cuttable bush line across the gate
      this.hiddenGates = this.connections.filter((e) => e.hidden && e.path);
    }

    result() {
      const L = this.L;
      L.name = 'overworld';
      return {
        seed: this.seed, level: L, regions: this.regions, connections: this.connections, start: this.start, lair: this.lair,
        camp: this.camp, dungeons: this.dungeons, lairSite: this.lairSite, landmarks: this.landmarks || [], signs: this.signs || [],
        secrets: this.secrets || [], reach: this.reach, log: this.log, layout: this.layout, rivers: this.rivers,
        valid: this.valid, problems: this.problems || [], campNpc: this.campNpc, tutorialTablet: this.tutorialTablet, startIdx: this.startIdx,
        main: this.main, inner: this.inner
      };
    }
  }

  RS.WorldGen = WorldGen;
  RS.generateWorld = function (seed, opts) {
    let lastErr = null, lastRes = null;
    const tries = (opts && opts.tries) || 8;
    for (let attempt = 0; attempt < tries; attempt++) {
      try {
        const g = new WorldGen(seed, attempt ? 'retry' + attempt : '');
        const res = g.run();
        res.attempt = attempt;
        if (res.valid) return res;
        lastRes = res;
        lastErr = new Error('validation failed: ' + (res.problems || []).join(', '));
        // handled: the next attempt uses a sub-seed, so this is informational rather than a warning
        console.info('[worldgen] seed', seed, 'attempt', attempt, lastErr.message, '| log:', res.log.join(' | '));
      } catch (e) {
        lastErr = e;
        console.error('[worldgen] seed', seed, 'attempt', attempt, e);
      }
    }
    if (opts && opts.allowInvalid && lastRes) return lastRes;
    throw lastErr || new Error('world generation failed');
  };
})();
