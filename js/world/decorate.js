// World decoration: entrances & camp structures, barriers, vegetation, ruins, landmarks, decals, signs, secrets.
(function () {
  'use strict';
  const K = RS.K, MAT = RS.MAT;
  const TS = RS.TS;
  const D4 = RS.DIRS4;

  const DIRS_KO = ['동쪽', '남동쪽', '남쪽', '남서쪽', '서쪽', '북서쪽', '북쪽', '북동쪽'];
  function dirWord(dx, dy) {
    const a = Math.atan2(dy, dx);
    let k = Math.round(a / (Math.PI / 4));
    k = ((k % 8) + 8) % 8;
    return DIRS_KO[k];
  }
  RS.dirWord = dirWord;

  const LANDMARKS = {
    forest: { spr: 'lm_giant_tree', w: 3, h: 2, name: '천년 고목' },
    valley: { spr: 'lm_willow', w: 3, h: 2, name: '늘어진 버드나무' },
    meadow: { spr: 'lm_stones', w: 3, h: 2, name: '선돌 무리' },
    camp: null,
    coast: { spr: 'lm_lighthouse', w: 2, h: 2, name: '부서진 등대' },
    shore: { spr: 'lm_shipwreck', w: 4, h: 2, name: '난파선' },
    swamp: { spr: 'lm_dead_tree', w: 3, h: 2, name: '말라 죽은 거목' },
    marsh: { spr: 'lm_dead_tree', w: 3, h: 2, name: '말라 죽은 거목' },
    canyon: { spr: 'lm_arch', w: 3, h: 1, name: '바위 아치' },
    mountain: { spr: 'lm_cairn', w: 1, h: 1, name: '돌탑' },
    ruins: { spr: 'lm_tower', w: 2, h: 2, name: '무너진 종탑' },
    sunken: { spr: 'lm_statue_head', w: 3, h: 2, name: '거인의 석상' },
    bridge: { spr: 'lm_arch', w: 3, h: 1, name: '바위 아치' },
    sanctum: { spr: 'lm_obelisk', w: 1, h: 1, name: '검은 오벨리스크' }
  };

  class Decorator {
    constructor(g) {
      this.g = g; this.L = g.L; this.W = g.W; this.H = g.H; this.F = RS.TF;
      this.r = new RS.RNG('decor:' + g.seed);
      this.vn = RS.makeValueNoise(g.seed + 77);
      this.vn2 = RS.makeValueNoise(g.seed + 78);
      this.used = new Uint8Array(g.N); // tile already holds an object
    }
    i(x, y) { return y * this.W + x; }
    px(tx) { return tx * TS + 8; }
    py(ty) { return ty * TS + 14; }
    free(i, allowRoadMargin) {
      const L = this.L, F = this.F;
      if (L.kind[i] !== K.FLOOR || this.used[i] || L.solid[i]) return false;
      if (L.flags[i] & (F.ROAD | F.RES | F.ENTR)) return false;
      if (!allowRoadMargin && (L.flags[i] & F.ROADM)) return false;
      return true;
    }
    obj(o, tiles) {
      if (tiles) { o.block = tiles; for (const t of tiles) this.used[t] = 1; }
      return this.L.addObject(o);
    }
    decal(s, x, y, flip, z) { this.L.decals.push({ s, x: Math.round(x), y: Math.round(y), f: !!flip, z: z || 0 }); }

    run() {
      const g = this.g;
      this.structures();
      this.barriers();
      this.deepForest();
      this.rim();
      this.ruinBuildings();
      this.vegetation();
      this.faceDecor();
      this.waterDecor();
      this.landmarks();
      this.brokenBridges();
      this.signs();
      this.secrets();
      this.hiddenGates();
      this.L.rebuildSolid();
    }

    // ---------------------------------------------------------------------
    structures() {
      const g = this.g, L = this.L, W = this.W, F = this.F, r = this.r;
      // camp
      const c = g.camp;
      const cx = this.px(c.tx), cy = c.ty * TS + 12;
      this.obj({ kind: 'campfire', spr: 'campfire', anim: { frames: 4, fps: 8 }, x: cx, y: cy, light: { r: 60, color: '#ffb060' }, shadow: 0 }, [this.i(c.tx, c.ty)]);
      this.obj({ kind: 'deco', spr: 'tent', x: this.px(c.tx - 3) + 8, y: this.py(c.ty - 2) + 1, fade: true }, [this.i(c.tx - 4, c.ty - 2), this.i(c.tx - 3, c.ty - 2), this.i(c.tx - 4, c.ty - 3), this.i(c.tx - 3, c.ty - 3)]);
      this.obj({ kind: 'deco', spr: 'logseat', x: this.px(c.tx) + 8, y: this.py(c.ty + 2) - 2 }, [this.i(c.tx, c.ty + 2), this.i(c.tx + 1, c.ty + 2)]);
      this.obj({ kind: 'deco', spr: 'logseat_v', x: this.px(c.tx - 2), y: this.py(c.ty) }, [this.i(c.tx - 2, c.ty)]);
      this.obj({ kind: 'deco', spr: 'crate', x: this.px(c.tx + 3), y: this.py(c.ty - 3) }, [this.i(c.tx + 3, c.ty - 3)]);
      this.obj({ kind: 'deco', spr: 'barrel', x: this.px(c.tx + 4), y: this.py(c.ty - 3) }, [this.i(c.tx + 4, c.ty - 3)]);
      this.obj({ kind: 'deco', spr: 'bedroll', x: this.px(c.tx - 1), y: this.py(c.ty - 2) }, null);
      this.obj({ kind: 'lantern', spr: 'lantern', anim: { frames: 4, fps: 6 }, x: this.px(c.tx + 3), y: this.py(c.ty + 1), light: { r: 34, color: '#ffc070' } }, [this.i(c.tx + 3, c.ty + 1)]);
      for (let k = 0; k < 6; k++) this.used[this.i(c.tx + (k % 3) - 1, c.ty + ((k / 3) | 0) - 1)] = 1;
      this.campNpc = { tx: c.tx + 2, ty: c.ty - 1 };
      for (let yy = c.ty - 2; yy <= c.ty; yy++) for (let xx = c.tx + 1; xx <= c.tx + 2; xx++) this.used[this.i(xx, yy)] = 1;
      // camp tutorial tablet near the fire
      this.tutorialTablet = { tx: c.tx - 3, ty: c.ty + 2 };
      this.obj({ kind: 'tablet', spr: 'tablet', x: this.px(c.tx - 3), y: this.py(c.ty + 2), interact: { type: 'tablet', key: 'tutorial' } }, [this.i(c.tx - 3, c.ty + 2)]);

      // dungeon entrances
      for (const dg of g.dungeons) {
        const s = dg.site;
        if (dg.style === 'cave') {
          const x = (s.mouthX + 1) * TS, y = (s.mouthY + 1) * TS;
          const o = this.obj({ kind: 'entrance', spr: 'cave_' + dg.theme, x, y: y - 1, dungeon: dg.index, flat: false, depthBias: -4 }, null);
          o.trigger = { x0: s.mouthX * TS + 2, y0: s.mouthY * TS, x1: (s.mouthX + 2) * TS - 2, y1: s.mouthY * TS + 7 };
          o.prompt = { x: x, y: y - 20 };
          dg.obj = o;
          // rubble at the mouth
          this.decal('rubble' + r.int(0, 2), x - 18, y + 6);
          this.decal('pebble' + r.int(0, 5), x + 14, y + 4);
        } else {
          const tx = s.cx, ty = s.cy;
          const spr = dg.style === 'ruin' ? 'ruinstairs' : 'rootshrine';
          const tiles = [];
          for (let yy = ty - 1; yy <= ty + 1; yy++) for (let xx = tx - 1; xx <= tx + 1; xx++) {
            if (yy === ty + 1 && xx === tx) continue;          // walk-in slot
            if (yy === ty && xx === tx) continue;              // inner stairwell
            tiles.push(this.i(xx, yy));
          }
          const o = this.obj({ kind: 'entrance', spr: spr + '_' + dg.theme, x: this.px(tx), y: (ty + 2) * TS - 1, dungeon: dg.index }, tiles);
          o.trigger = { x0: tx * TS + 3, y0: ty * TS + 2, x1: tx * TS + 13, y1: ty * TS + 12 };
          o.prompt = { x: this.px(tx), y: ty * TS - 22 };
          dg.obj = o;
          this.used[this.i(tx, ty)] = 1; this.used[this.i(tx, ty + 1)] = 1;
        }
        // tablet describing the ruin nearby
        const ax = dg.approach.tx, ay = dg.approach.ty;
        for (const [ox, oy] of [[-2, 1], [2, 1], [-2, 0], [2, 0], [-3, 1], [3, 1]]) {
          const t = this.i(ax + ox, ay + oy);
          if (g.inb(ax + ox, ay + oy) && L.kind[t] === K.FLOOR && !(L.flags[t] & F.ROAD) && !this.used[t] && L.hgt[t] === L.hgt[this.i(ax, ay)]) {
            this.obj({ kind: 'tablet', spr: 'tablet', x: this.px(ax + ox), y: this.py(ay + oy), interact: { type: 'tablet', key: 'dungeon', dungeon: dg.index } }, [t]);
            break;
          }
        }
        // mark the whole entrance footprint so vegetation keeps clear
        for (let yy = dg.entrance.ty - 2; yy <= dg.entrance.ty + 3; yy++) for (let xx = dg.entrance.tx - 3; xx <= dg.entrance.tx + 4; xx++) if (g.inb(xx, yy)) this.used[this.i(xx, yy)] |= 0;
      }

      // lair gate (face row tiles stay solid while sealed)
      const ls = g.lairSite;
      if (ls) {
        const x = this.px(ls.gateX), y = (ls.gateY + 1) * TS;
        const gateTiles = [this.i(ls.gateX - 1, ls.gateY), this.i(ls.gateX, ls.gateY), this.i(ls.gateX + 1, ls.gateY)];
        for (const t of gateTiles) { L.kind[t] = K.FLOOR; L.flags[t] |= F.ENTR | F.RES; L.mat[t] = MAT.SANCTUM; }
        const o = this.obj({ kind: 'lairgate', spr: 'lairgate_closed', x, y: y - 1, sealed: true }, gateTiles);
        o.trigger = { x0: (ls.gateX - 1) * TS + 4, y0: ls.gateY * TS, x1: (ls.gateX + 2) * TS - 4, y1: ls.gateY * TS + 8 };
        o.prompt = { x, y: y - 40 };
        o.gateTiles = gateTiles;
        g.lairSite.obj = o;
        // braziers and obelisks flanking the gate
        for (const ox of [-3, 3]) {
          const t = this.i(ls.gateX + ox, ls.gateY + 2);
          if (g.inb(ls.gateX + ox, ls.gateY + 2) && L.kind[t] === K.FLOOR) this.obj({ kind: 'brazier', spr: 'brazier_lit', anim: { frames: 4, fps: 8 }, x: this.px(ls.gateX + ox), y: this.py(ls.gateY + 2), light: { r: 46, color: '#ff9a45' } }, [t]);
        }
      }
    }

    // ---------------------------------------------------------------------
    barriers() {
      const g = this.g, L = this.L, r = this.r;
      for (const b of g.barrierTiles || []) {
        const i = b.i;
        const x = i % this.W, y = (i / this.W) | 0;
        if (b.type === 'rock' || b.type === 'deco') {
          if (L.kind[i] !== K.FLOOR || this.used[i]) continue;
          if (b.type === 'deco' && r.chance(0.5)) continue;
          const reg = g.regions[L.region[i]];
          const big = r.chance(0.35);
          const red = reg && (reg.biome === 'canyon' || reg.biome === 'bridge');
          const pre = red ? 'rockC_' : 'rock_';
          let spr = (big ? pre + 'm_' : pre + 's_') + r.int(0, 3);
          if (reg && (reg.biome === 'canyon' || reg.biome === 'mountain' || reg.biome === 'bridge') && r.chance(0.25)) spr = (red ? 'spireC_' : 'spire_') + r.int(0, 2);
          this.obj({ kind: 'rock', spr, x: this.px(x) + r.int(-2, 2), y: this.py(y) + r.int(-1, 1), fade: spr.startsWith('spire') }, [i]);
        } else if (b.type === 'ruinwall') {
          if (L.kind[i] !== K.FLOOR || this.used[i]) continue;
          if (r.chance(0.7)) { this.used[i] = 1; L.flags[i] |= this.F.BARRIER; this.pendingWall = this.pendingWall || []; this.pendingWall.push(i); }
          else this.obj({ kind: 'bush', spr: 'bush_' + r.int(0, 3), x: this.px(x), y: this.py(y) }, [i]);
        } else if (b.type === 'marsh') {
          // reeds decorate marsh barrier water
          if (r.chance(0.5)) this.L.anim.push({ s: 'reeds_' + r.int(0, 2), x: this.px(x) + r.int(-4, 4), y: this.py(y) + r.int(-3, 2), ph: r.next() * 6 });
        }
      }
      this.buildWalls(this.pendingWall || [], 'rwall');
    }

    // autotiled ruin walls (4-neighbour mask chooses the piece)
    buildWalls(tiles, prefix) {
      const set = new Set(tiles);
      const W = this.W;
      for (const i of tiles) {
        const x = i % W, y = (i / W) | 0;
        let m = 0;
        if (set.has(i - W)) m |= 1;
        if (set.has(i + 1)) m |= 2;
        if (set.has(i + W)) m |= 4;
        if (set.has(i - 1)) m |= 8;
        const broken = (RS.hash2(x, y, 5) & 3) === 0 ? 1 : 0;
        this.L.addObject({ kind: 'wall', spr: prefix + '_' + m + '_' + broken, x: this.px(x), y: y * TS + 15, block: [i] });
        this.used[i] = 1;
      }
    }

    deepForest() {
      const g = this.g, L = this.L, W = this.W, r = this.r;
      // interior clusters inside forest-like regions
      for (const s of g.regions) {
        const b = s.def;
        if (!b.deepDensity) continue;
        for (const t of s.tiles) {
          if (L.kind[t] !== K.FLOOR || (L.flags[t] & (this.F.ROADM | this.F.RES | this.F.SAFE | this.F.ENTR)) || g.inner[t] < 2) continue;
          const x = t % W, y = (t / W) | 0;
          const n = this.vn.fbm(x / 6 + s.id * 3, y / 6, 3, 2, 0.5);
          if (n > 1 - b.deepDensity) { L.kind[t] = K.DEEP; L.mat[t] = MAT.DEEPFOREST; }
        }
      }
      // one canopy per deep tile; edge trees brighter than the interior
      for (let i = 0; i < g.N; i++) {
        if (L.kind[i] !== K.DEEP) continue;
        const x = i % W, y = (i / W) | 0;
        const reg = g.regions[L.region[i]];
        const sp = this.pickSpecies(reg, true);
        const southOpen = y + 1 < this.H && L.kind[i + W] !== K.DEEP;
        const v = sp === 'oak' ? (r.chance(0.04) ? 5 : r.int(0, 4)) : r.int(0, 5);
        const key = (southOpen ? 'tree_' : 'treeD_') + sp + '_' + (sp === 'oak' || sp === 'pine' ? v : v % 4);
        this.obj({ kind: 'tree', spr: key, x: this.px(x) + r.int(-5, 5), y: this.py(y) + r.int(-3, 2), fade: southOpen, deep: true }, null);
        this.used[i] = 1;
      }
    }

    pickSpecies(reg, deep) {
      const r = this.r;
      if (!reg) return 'oak';
      const t = reg.def.trees;
      const keys = Object.keys(t);
      let sp = r.weighted(keys, (k) => t[k]);
      if (deep && (sp === 'palm' || sp === 'dead' || sp === 'windswept')) sp = reg.biome === 'mountain' || reg.biome === 'coast' ? 'pine' : 'oak';
      return sp;
    }

    rim() {
      const g = this.g, L = this.L, W = this.W, r = this.r;
      for (let i = 0; i < g.N; i++) {
        if (L.kind[i] !== K.WALL) continue;
        const x = i % W, y = (i / W) | 0;
        // only near the playable land
        let near = false;
        for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) { if (g.inb(x + dx, y + dy) && g.main[(y + dy) * W + x + dx]) { near = true; break; } }
        if (!near) { if (r.chance(0.05)) this.obj({ kind: 'tree', spr: 'treeD_pine_' + r.int(0, 5), x: this.px(x), y: this.py(y) }, null); continue; }
        const n = this.vn2(x / 4, y / 4);
        if (n > 0.55 && r.chance(0.55)) this.obj({ kind: 'tree', spr: 'tree_pine_' + r.int(0, 5), x: this.px(x) + r.int(-4, 4), y: this.py(y) + r.int(-2, 2), fade: true }, null);
        else if (r.chance(0.12)) this.obj({ kind: 'rock', spr: 'spire_' + r.int(0, 2), x: this.px(x), y: this.py(y) }, null);
        else if (r.chance(0.18)) this.obj({ kind: 'rock', spr: 'rock_m_' + r.int(0, 3), x: this.px(x) + r.int(-3, 3), y: this.py(y) }, null);
      }
    }

    // ---------------------------------------------------------------------
    ruinBuildings() {
      const g = this.g, L = this.L, W = this.W, r = this.r, F = this.F;
      for (const s of g.regions) {
        if (s.biome !== 'ruins' && s.biome !== 'sunken') continue;
        const n = s.biome === 'ruins' ? r.int(3, 5) : r.int(1, 3);
        const walls = [];
        for (let k = 0; k < n * 6 && walls.length < n; k++) {
          const t = r.pick(s.tiles);
          const x0 = t % W, y0 = (t / W) | 0;
          const bw = r.int(5, 8), bh = r.int(4, 6);
          let ok = true;
          for (let y = y0 - 1; y <= y0 + bh && ok; y++) for (let x = x0 - 1; x <= x0 + bw; x++) {
            if (!g.inb(x, y)) { ok = false; break; }
            const i = this.i(x, y);
            if (L.region[i] !== s.id || L.kind[i] !== K.FLOOR || L.hgt[i] !== s.height || (L.flags[i] & (F.ROADM | F.RES | F.SAFE)) || this.used[i]) { ok = false; break; }
          }
          if (!ok) continue;
          walls.push({ x0, y0, bw, bh });
          // floor
          for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) L.mat[this.i(x, y)] = MAT.RUIN;
          const doorSide = r.int(0, 3);
          const doorPos = r.int(1, (doorSide % 2 === 0 ? bw : bh) - 2);
          const wt = [];
          for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) {
            const edge = y === y0 || y === y0 + bh - 1 || x === x0 || x === x0 + bw - 1;
            if (!edge) continue;
            // doorway
            if (doorSide === 0 && y === y0 + bh - 1 && (x - x0 === doorPos || x - x0 === doorPos + 1)) continue;
            if (doorSide === 1 && x === x0 + bw - 1 && (y - y0 === doorPos)) continue;
            if (doorSide === 2 && y === y0 && (x - x0 === doorPos || x - x0 === doorPos + 1)) continue;
            if (doorSide === 3 && x === x0 && (y - y0 === doorPos)) continue;
            // collapsed stretches
            if (r.chance(0.18)) { this.decal('rubble' + r.int(0, 2), this.px(x), this.py(y)); continue; }
            wt.push(this.i(x, y));
          }
          this.buildWalls(wt, 'rwall');
          for (let y = y0 - 1; y <= y0 + bh; y++) for (let x = x0 - 1; x <= x0 + bw; x++) this.used[this.i(x, y)] = this.used[this.i(x, y)] || 2;
          // interior details
          const ix = x0 + r.int(1, bw - 2), iy = y0 + r.int(1, bh - 2);
          const it = this.i(ix, iy);
          if (L.kind[it] === K.FLOOR && !L.solid[it]) {
            if (r.chance(0.5)) this.obj({ kind: 'pillar', spr: 'pillar_' + r.int(1, 2), x: this.px(ix), y: this.py(iy) }, [it]);
            else this.decal('rubble' + r.int(0, 2), this.px(ix), this.py(iy));
          }
        }
        s.buildings = walls;
      }
    }

    vegetation() {
      const g = this.g, L = this.L, W = this.W, r = this.r, F = this.F;
      for (const s of g.regions) {
        const b = s.def;
        const biome = s.biome;
        for (const t of s.tiles) {
          const x = t % W, y = (t / W) | 0;
          const k = L.kind[t];
          if (k !== K.FLOOR) continue;
          const onOut = (L.flags[t] & F.OUTCROP) > 0;
          const fl = L.flags[t];
          const nearRoad = (fl & F.ROADM) > 0;
          const onRoad = (fl & F.ROAD) > 0;
          const safeCore = (fl & F.SAFE) && Math.hypot(x - g.camp.tx, y - g.camp.ty) < 7;
          const n = this.vn.fbm(x / 7 + s.id * 5, y / 7, 2, 2, 0.5);
          const n2 = this.vn2(x / 3.5, y / 3.5);
          const px = this.px(x), py = this.py(y);
          // ground decals everywhere (cheap and flat)
          this.groundDecals(s, t, x, y, onRoad, n2);
          const red = biome === 'canyon' || biome === 'bridge';
          if (onOut && !(fl & F.ENTR) && !this.used[t]) {
            // outcrop tops: unreachable scenery, dressed densely
            if (r.chance(0.3)) this.obj({ kind: 'tree', spr: 'tree_' + this.pickSpecies(s) + '_' + r.int(0, 3), x: px + r.int(-3, 3), y: py, fade: true }, null);
            else if (r.chance(0.22)) this.obj({ kind: 'rock', spr: (red ? 'rockC_s_' : 'rock_s_') + r.int(0, 3), x: px, y: py }, null);
            else if (r.chance(0.3)) L.anim.push({ s: 'tgrass_' + r.int(0, 2), x: px + r.int(-4, 4), y: py, ph: r.next() * 6 });
            continue;
          }
          if (onRoad || this.used[t] || (fl & (F.RES | F.ENTR)) || safeCore) continue;
          // trees
          let tp = b.treeDensity * (0.35 + n * 1.3);
          if (nearRoad) tp *= 0.15;
          if (fl & F.SAFE) tp *= 0.3;
          if (r.chance(tp)) {
            const sp = this.pickSpecies(s);
            // golden oak (variant 5) is a rare accent
            const v = sp === 'oak' ? (r.chance(0.07) ? 5 : r.int(0, 4)) : sp === 'pine' ? r.int(0, 5) : r.int(0, 3);
            this.obj({ kind: 'tree', spr: 'tree_' + sp + '_' + v, x: px + r.int(-3, 3), y: py + r.int(-2, 1), fade: true }, [t]);
            continue;
          }
          // bushes (cuttable ones cluster near paths)
          let bp = b.bushes * (0.5 + n2);
          if (nearRoad) bp *= 0.6;
          if (r.chance(bp)) {
            const cut = r.chance(nearRoad || (fl & F.SAFE) ? 0.85 : 0.55);
            const spr = cut ? 'cbush_' + r.int(0, 2) : (biome === 'meadow' || biome === 'valley') && r.chance(0.3) ? 'bushF_' + r.int(0, 1) : 'bush_' + r.int(0, 3);
            this.obj({ kind: 'bush', spr, x: px + r.int(-1, 1), y: py, cut }, [t]);
            continue;
          }
          if (nearRoad) {
            // occasional roadside rocks and tall grass
            if (r.chance(0.02)) this.obj({ kind: 'rock', spr: 'rock_s_' + r.int(0, 3), x: px + r.int(-3, 3), y: py }, [t]);
            else if (r.chance(b.tall * 0.4)) L.anim.push({ s: 'tgrass_' + r.int(0, 2), x: px + r.int(-4, 4), y: py + r.int(-2, 2), ph: r.next() * 6, cut: true });
            continue;
          }
          if (fl & F.SAFE) { if (r.chance(0.04)) L.anim.push({ s: 'tgrass_' + r.int(0, 2), x: px, y: py, ph: r.next() * 6, cut: true }); continue; }
          // rocks
          if (r.chance(b.rocks * (0.6 + (1 - n)))) {
            const big = r.chance(0.3);
            const pre = red ? 'rockC_' : 'rock_';
            if (big && x + 1 < W && y - 1 >= 0 && this.free(t + 1) && this.free(t - W) && this.free(t - W + 1) && r.chance(0.5)) {
              this.obj({ kind: 'rock', spr: (red ? 'boulderC_' : 'boulder_') + r.int(0, 2), x: px + 8, y: py + 1, fade: false }, [t, t + 1, t - W, t - W + 1]);
            } else if ((biome === 'canyon' || biome === 'mountain') && r.chance(0.25)) {
              this.obj({ kind: 'rock', spr: (red ? 'spireC_' : 'spire_') + r.int(0, 2), x: px, y: py + 1, fade: true }, [t]);
            } else this.obj({ kind: 'rock', spr: (big ? pre + 'm_' : pre + 's_') + r.int(0, 3), x: px + r.int(-2, 2), y: py + r.int(-1, 1) }, [t]);
            continue;
          }
          // logs & stumps (forest-ish)
          if (b.logs && r.chance(b.logs) && x + 1 < W && this.free(t + 1)) {
            this.obj({ kind: 'log', spr: 'log_' + r.int(0, 1), x: px + 8, y: py }, [t, t + 1]);
            continue;
          }
          if ((biome === 'forest' || biome === 'valley') && r.chance(0.008)) { this.obj({ kind: 'stump', spr: 'stump_' + r.int(0, 1), x: px, y: py }, [t]); continue; }
          // non-blocking low objects
          if (b.mushrooms && r.chance(b.mushrooms)) { this.obj({ kind: 'deco', spr: (biome === 'swamp' || biome === 'marsh') && r.chance(0.6) ? 'gmush_' + r.int(0, 1) : 'mush_' + r.int(0, 2), x: px + r.int(-5, 5), y: py + r.int(-4, 1), low: true, light: biome === 'marsh' ? { r: 14, color: '#86e3f0' } : null }, null); continue; }
          if (b.ferns && r.chance(b.ferns)) { this.obj({ kind: 'deco', spr: 'fern_' + r.int(0, 2), x: px + r.int(-4, 4), y: py, low: true }, null); continue; }
          if (b.driftwood && r.chance(b.driftwood)) { this.obj({ kind: 'deco', spr: 'driftwood_' + r.int(0, 1), x: px, y: py, low: true }, null); continue; }
          if (r.chance(b.tall * (0.4 + n2))) {
            const cnt = r.int(1, 3);
            for (let q = 0; q < cnt; q++) L.anim.push({ s: 'tgrass_' + r.int(0, 2), x: px + r.int(-6, 6), y: py + r.int(-5, 2), ph: r.next() * 6, cut: true });
          }
        }
      }
      // reeds along water edges in wet biomes
      for (let i = 0; i < g.N; i++) {
        if (L.kind[i] !== K.WATER || L.mat[i] === MAT.SEA) continue;
        const x = i % W, y = (i / W) | 0;
        const reg = g.regions[L.region[i]];
        if (!reg) continue;
        const wet = reg.def.reeds || 0.03;
        let shore = false;
        for (const [dx, dy] of D4) { const j = (y + dy) * W + x + dx; if (g.inb(x + dx, y + dy) && L.kind[j] === K.FLOOR) shore = true; }
        if (shore && r.chance(wet * 2.2)) L.anim.push({ s: 'reeds_' + r.int(0, 2), x: this.px(x) + r.int(-5, 5), y: this.py(y) + r.int(-4, 1), ph: r.next() * 6 });
      }
    }

    groundDecals(s, t, x, y, onRoad, n2) {
      const r = this.r, L = this.L;
      const b = s.def, biome = s.biome, m = L.mat[t];
      const px = x * TS, py = y * TS;
      const place = (key, cnt) => { for (let k = 0; k < cnt; k++) this.decal(key(), px + r.int(1, 14), py + r.int(3, 15), r.chance(0.5)); };
      if (onRoad) {
        if (r.chance(0.18)) place(() => 'pebble' + r.int(0, 5), 1);
        if (m === MAT.DIRT && r.chance(0.05)) place(() => 'tuft_d' + r.int(0, 4), 1);
        return;
      }
      if (m === MAT.GRASS || m === MAT.MEADOW) {
        if (r.chance(0.35)) place(() => 'tuft_' + (m === MAT.MEADOW ? 'm' : 'g') + r.int(0, 4), r.int(1, 2));
        if (r.chance(b.flowers * (0.4 + n2 * 1.2))) { const c = r.pick(biome === 'meadow' ? ['w', 'y', 'y', 'r', 'b', 'p'] : ['w', 'y', 'b', 'p']); place(() => 'flower_' + c + r.int(0, 2), r.int(1, 3)); }
      } else if (m === MAT.FOREST) {
        if (r.chance(0.3)) place(() => 'leaf' + r.int(0, 3), r.int(1, 3));
        if (r.chance(0.25)) place(() => 'tuft_f' + r.int(0, 4), 1);
        if (r.chance(0.04)) place(() => 'roots' + r.int(0, 1), 1);
        if (r.chance(0.04)) place(() => 'twig' + r.int(0, 1), 1);
        if (r.chance(0.03)) place(() => 'mushtiny0', 1);
      } else if (m === MAT.SAND) {
        if (r.chance(0.08)) place(() => 'shell' + r.int(0, 1), 1);
        if (r.chance(0.05)) place(() => 'pebble' + r.int(0, 5), 1);
      } else if (m === MAT.SWAMP || m === MAT.MUD) {
        if (r.chance(0.25)) place(() => 'tuft_s' + r.int(0, 4), r.int(1, 2));
        if (r.chance(0.04)) place(() => 'puddle' + r.int(0, 1), 1);
        if (r.chance(0.03)) place(() => 'mushtiny1', 1);
      } else if (m === MAT.CANYON || m === MAT.GRAVEL || m === MAT.ROCK) {
        if (r.chance(0.1)) place(() => 'pebble' + r.int(3, 5), 1);
        if (biome === 'canyon' && r.chance(0.02)) place(() => (r.chance(0.3) ? 'skull0' : 'bones0'), 1);
        if (r.chance(0.04)) place(() => 'crack' + r.int(0, 2), 1);
        if (m === MAT.ROCK && r.chance(0.1)) place(() => 'tuft_d' + r.int(0, 4), 1);
      } else if (m === MAT.RUIN || m === MAT.COBBLE || m === MAT.SANCTUM) {
        if (r.chance(0.08)) place(() => 'crack' + r.int(0, 2), 1);
        if (r.chance(0.08)) place(() => 'mosspatch' + r.int(0, 2), 1);
        if (r.chance(0.05)) place(() => 'rubble' + r.int(0, 2), 1);
      }
    }

    // grass drips over plateau lips & vines hanging on faces
    faceDecor() {
      const g = this.g, L = this.L, W = this.W, r = this.r;
      for (let i = 0; i < g.N; i++) {
        if (L.kind[i] !== K.FACE) continue;
        const f = L.face[i];
        if ((f & 3) !== 0) continue;
        const x = i % W, y = (i / W) | 0;
        const above = i - W;
        if (y < 1) continue;
        const ma = L.mat[above];
        const grassy = ma === MAT.GRASS || ma === MAT.MEADOW || ma === MAT.FOREST || ma === MAT.SWAMP || ma === MAT.DEEPFOREST;
        if (grassy && r.chance(0.75)) this.decal('drip' + r.int(0, 3), this.px(x) + r.int(-3, 3), y * TS - 1, r.chance(0.5), 2);
        const style = (f >> 4) & 7;
        if ((style === 3 || grassy) && r.chance(style === 3 ? 0.35 : 0.12)) this.decal('vine' + r.int(0, 2), this.px(x) + r.int(-5, 5), y * TS + r.int(0, 3), false, 3);
      }
    }

    waterDecor() {
      const g = this.g, L = this.L, W = this.W, r = this.r;
      for (let i = 0; i < g.N; i++) {
        if (L.kind[i] !== K.WATER) continue;
        const m = L.mat[i];
        const x = i % W, y = (i / W) | 0;
        if (m === MAT.MARSH || (m === MAT.WATER && !(L.flags[i] & this.F.RIVER))) {
          if (r.chance(m === MAT.MARSH ? 0.2 : 0.1)) this.decal('lily' + r.int(0, 2), this.px(x) + r.int(-5, 5), this.py(y) + r.int(-6, 0), r.chance(0.5));
        }
        if (m === MAT.SEA && g.seaDist && L.flags) {
          // rocks poking out of the shallows
          let land = 0;
          for (const [dx, dy] of D4) { const j = (y + dy) * W + x + dx; if (g.inb(x + dx, y + dy) && L.kind[j] !== K.WATER) land++; }
          if (land && r.chance(0.035)) this.obj({ kind: 'deco', spr: 'wrock_' + r.int(0, 2), x: this.px(x), y: this.py(y), low: true }, null);
        }
      }
    }

    // ---------------------------------------------------------------------
    landmarks() {
      const g = this.g, L = this.L, W = this.W, r = this.r, F = this.F;
      g.landmarks = [];
      for (const s of g.regions) {
        const lm = LANDMARKS[s.biome];
        if (!lm) continue;
        let spot = null;
        for (let k = 0; k < 400 && !spot; k++) {
          const ang = r.range(0, Math.PI * 2), dist = r.range(3, 10);
          const cx = Math.round(s.hub.x + Math.cos(ang) * dist), cy = Math.round(s.hub.y + Math.sin(ang) * dist);
          let ok = true;
          for (let yy = cy - lm.h + 1; yy <= cy && ok; yy++) for (let xx = cx; xx < cx + lm.w; xx++) {
            if (!g.inb(xx, yy)) { ok = false; break; }
            const i = this.i(xx, yy);
            if (L.region[i] !== s.id || L.kind[i] !== K.FLOOR || (L.flags[i] & (F.ROADM | F.RES | F.ENTR)) || this.used[i] || L.hgt[i] !== L.hgt[this.i(cx, cy)]) ok = false;
          }
          // keep a free row in front
          if (ok && g.inb(cx, cy + 1) && L.kind[this.i(cx, cy + 1)] !== K.FLOOR) ok = false;
          if (ok) spot = { cx, cy };
        }
        if (!spot) continue;
        const tiles = [];
        for (let yy = spot.cy - lm.h + 1; yy <= spot.cy; yy++) for (let xx = spot.cx; xx < spot.cx + lm.w; xx++) tiles.push(this.i(xx, yy));
        if (lm.spr === 'lm_stones') {
          // standing stones ring
          const cx = spot.cx * TS + lm.w * 8, cy = spot.cy * TS + 4;
          for (let k = 0; k < 6; k++) {
            const a = k / 6 * Math.PI * 2;
            const sx = cx + Math.cos(a) * 26, sy = cy + Math.sin(a) * 16;
            const tt = this.i(Math.floor(sx / TS), Math.floor(sy / TS));
            if (L.kind[tt] === K.FLOOR && !this.used[tt] && !(L.flags[tt] & (F.ROADM | F.RES))) this.obj({ kind: 'rock', spr: 'standstone_' + (k % 3), x: sx, y: sy + 6 }, [tt]);
          }
          g.landmarks.push({ region: s.id, name: lm.name, tx: spot.cx + 1, ty: spot.cy, spr: lm.spr });
          continue;
        }
        const o = this.obj({ kind: 'landmark', spr: lm.spr, x: spot.cx * TS + lm.w * 8, y: (spot.cy + 1) * TS - 1, fade: true, big: true }, tiles);
        g.landmarks.push({ region: s.id, name: lm.name, tx: spot.cx + (lm.w >> 1), ty: spot.cy, spr: lm.spr, obj: o });
        // flavour tablet near some landmarks
        if (r.chance(0.6)) {
          const tx = spot.cx - 1, ty = spot.cy + 1;
          const tt = this.i(tx, ty);
          if (g.inb(tx, ty) && this.free(tt, true)) this.obj({ kind: 'tablet', spr: 'tablet', x: this.px(tx), y: this.py(ty), interact: { type: 'tablet', key: 'lore', biome: s.biome, idx: r.int(0, 99) } }, [tt]);
        }
      }
    }

    brokenBridges() {
      const g = this.g, L = this.L, W = this.W, r = this.r;
      for (const s of g.regions) {
        if (s.biome !== 'bridge' || !s.chasmPath) continue;
        // pick a chasm tile far from existing bridges, extend stubs from both banks
        let best = null;
        for (const t of s.chasmPath) {
          if (L.kind[t] !== K.CHASM) continue;
          const x = t % W, y = (t / W) | 0;
          let near = false;
          for (let dy = -6; dy <= 6 && !near; dy++) for (let dx = -6; dx <= 6; dx++) if (g.inb(x + dx, y + dy) && L.kind[(y + dy) * W + x + dx] === K.BRIDGE) { near = true; break; }
          if (near) continue;
          // horizontal crossing: floor at both ends within 4 tiles
          let lx = x, rx = x;
          while (lx > 0 && L.kind[y * W + lx - 1] === K.CHASM) lx--;
          while (rx < W - 1 && L.kind[y * W + rx + 1] === K.CHASM) rx++;
          if (rx - lx >= 2 && rx - lx <= 5 && L.kind[y * W + lx - 1] === K.FLOOR && L.kind[y * W + rx + 1] === K.FLOOR) { best = { y, lx, rx }; break; }
        }
        if (!best) continue;
        if (!L._bridgeDir) L._bridgeDir = new Uint8Array(g.N);
        const mid = (best.lx + best.rx) >> 1;
        for (let x = best.lx; x <= best.rx; x++) {
          if (Math.abs(x - mid) <= 0 || (x === mid + 1 && (best.rx - best.lx) >= 3)) continue; // collapsed middle
          const i = best.y * W + x;
          L.kind[i] = K.BRIDGE; L._bridgeDir[i] = 1;
        }
        this.decal('rubble0', mid * TS + 8, best.y * TS + 14);
        g.landmarks.push({ region: s.id, name: '무너진 다리', tx: mid, ty: best.y, spr: 'broken_bridge' });
      }
    }

    // ---------------------------------------------------------------------
    signs() {
      const g = this.g, L = this.L, W = this.W, r = this.r, F = this.F;
      g.signs = [];
      const placeNear = (tx, ty, lines, radius) => {
        for (let rad = 1; rad <= (radius || 3); rad++) {
          for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
            const x = tx + dx, y = ty + dy;
            if (!g.inb(x, y)) continue;
            const i = this.i(x, y);
            if (L.kind[i] !== K.FLOOR || (L.flags[i] & (F.ROAD | F.RES | F.ENTR)) || this.used[i] || L.solid[i]) continue;
            if (L.hgt[i] !== L.hgt[this.i(tx, ty)]) continue;
            const o = this.obj({ kind: 'sign', spr: 'signpost', x: this.px(x), y: this.py(y), interact: { type: 'sign', lines } }, [i]);
            g.signs.push({ tx: x, ty: y, lines, obj: o });
            return o;
          }
        }
        return null;
      };
      // at each road gate, a signpost on both sides naming the region beyond
      for (const e of g.connections) {
        if (!e.path || e.hidden) continue;
        const A = g.regions[e.a], B = g.regions[e.b];
        // find the first path tile inside B
        let crossA = null, crossB = null;
        for (let k = 0; k < e.path.length - 1; k++) {
          const i = e.path[k].i, j = e.path[k + 1].i;
          if (L.region[i] === e.a && L.region[j] === e.b) { crossA = e.path[Math.max(0, k - 3)].i; crossB = e.path[Math.min(e.path.length - 1, k + 4)].i; break; }
        }
        if (crossA === null) continue;
        const ax = crossA % W, ay = (crossA / W) | 0, bx = crossB % W, by = (crossB / W) | 0;
        placeNear(ax, ay, [{ dir: RS.dirWord(bx - ax, by - ay), name: B.name }, { dir: RS.dirWord(A.hub.x - ax, A.hub.y - ay), name: A.name, here: true }], 3);
        if (r.chance(0.6)) placeNear(bx, by, [{ dir: RS.dirWord(ax - bx, ay - by), name: A.name }, { dir: RS.dirWord(B.hub.x - bx, B.hub.y - by), name: B.name, here: true }], 3);
      }
      // camp signpost toward the first dungeon
      const c = g.camp;
      const d0 = g.dungeons[0];
      if (d0) {
        const reg = g.regions[d0.region];
        placeNear(c.tx + 1, c.ty + 4, [{ dir: RS.dirWord(d0.approach.tx - c.tx, d0.approach.ty - c.ty), name: reg.name, dungeon: 0 }], 4);
      }
      this.campNpcOut();
    }

    campNpcOut() { this.g.campNpc = this.campNpc; this.g.tutorialTablet = this.tutorialTablet; }

    secrets() {
      const g = this.g, L = this.L, W = this.W, r = this.r, F = this.F;
      g.secrets = [];
      // hollows carved inside dense forest clusters, reached through a cuttable bush
      const cands = [];
      for (let i = 0; i < g.N; i++) {
        if (L.kind[i] !== K.DEEP) continue;
        const x = i % W, y = (i / W) | 0;
        let solid = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (g.inb(x + dx, y + dy) && L.kind[(y + dy) * W + x + dx] === K.DEEP) solid++;
        if (solid >= 24) cands.push(i);
      }
      r.shuffle(cands);
      const want = r.int(2, 3);
      for (const c of cands) {
        if (g.secrets.length >= want) break;
        const x = c % W, y = (c / W) | 0;
        if (g.secrets.some((s) => Math.abs(s.tx - x) + Math.abs(s.ty - y) < 20)) continue;
        // tunnel south until open floor
        let ty = y + 1, len = 0;
        while (ty < this.H && L.kind[ty * W + x] === K.DEEP && len < 6) { ty++; len++; }
        if (ty >= this.H || L.kind[ty * W + x] !== K.FLOOR || len > 5) continue;
        if (L.hgt[ty * W + x] !== L.hgt[c]) continue;
        // carve 3x2 hollow + tunnel
        const carve = (xx, yy) => { const i = yy * W + xx; L.kind[i] = K.FLOOR; L.mat[i] = MAT.FOREST; L.flags[i] |= F.HIDDEN | F.NOSPAWN; };
        for (let yy = y - 1; yy <= y; yy++) for (let xx = x - 1; xx <= x + 1; xx++) carve(xx, yy);
        for (let yy = y + 1; yy < ty; yy++) carve(x, yy);
        // remove canopies on carved tiles
        for (const o of L.objects) {
          if (!o.deep || o.dead) continue;
          const ox = Math.floor(o.x / TS), oy = Math.floor((o.y - 2) / TS);
          if (L.kind[oy * W + ox] === K.FLOOR && (L.flags[oy * W + ox] & F.HIDDEN)) o.dead = true;
        }
        // cuttable bush plugs the tunnel mouth
        const bt = (ty - 1) * W + x;
        this.obj({ kind: 'bush', spr: 'cbush_' + r.int(0, 2), x: this.px(x), y: this.py(ty - 1), cut: true }, [bt]);
        g.secrets.push({ tx: x, ty: y, id: 's' + g.secrets.length });
        for (const t of [y * W + x]) this.used[t] = 1;
      }
    }

    hiddenGates() {
      const g = this.g, L = this.L, W = this.W, r = this.r;
      for (const e of g.hiddenGates || []) {
        let k0 = -1;
        for (let k = 0; k < e.path.length - 1; k++) if (L.region[e.path[k].i] !== L.region[e.path[k + 1].i]) { k0 = k; break; }
        if (k0 < 0) continue;
        for (let k = Math.max(0, k0 - 1); k <= Math.min(e.path.length - 1, k0 + 2); k++) {
          const i = e.path[k].i;
          if (L.kind[i] !== K.FLOOR) continue;
          this.L.flags[i] |= this.F.HIDDEN;
          this.obj({ kind: 'bush', spr: 'cbush_' + r.int(0, 2), x: this.px(i % W), y: this.py((i / W) | 0), cut: true, hidden: true }, [i]);
        }
      }
    }
  }

  RS.WorldDecor = { decorate: (g) => new Decorator(g).run(), dirWord };
})();
