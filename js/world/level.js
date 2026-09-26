// Level data model shared by the overworld, dungeons and the guardian arena.
(function () {
  'use strict';
  const TS = 16;
  // structural kinds
  const K = { FLOOR: 0, WATER: 1, FACE: 2, CHASM: 3, WALL: 4, DEEP: 5, BRIDGE: 6, STAIRS: 7, FALLS: 8, PIT: 9, LAVA: 10 };
  // ground materials
  const MAT = {
    NONE: 0, GRASS: 1, MEADOW: 2, FOREST: 3, DIRT: 4, COBBLE: 5, SAND: 6, MUD: 7, ROCK: 8, CANYON: 9,
    RUIN: 10, SWAMP: 11, GRAVEL: 12, WATER: 13, SEA: 14, MARSH: 15, CHASM: 16, CLIFF: 17, MOUNT: 18, SANCTUM: 19,
    DEEPFOREST: 20, PLANK: 21,
    // dungeon materials
    CAVE: 30, TEMPLE: 31, ROOTS: 32, DWALL: 33, DWATER: 34, DPIT: 35, LAVA: 36, ARENA: 37, MOSSCAVE: 38
  };
  // face styles for cliffs
  const FACE_STYLE = { ROCK: 0, SANDSTONE: 1, EARTH: 2, MOSSY: 3, DARK: 4 };

  class Level {
    constructor(type, w, h, seed) {
      this.type = type; this.w = w; this.h = h; this.seed = seed;
      const n = w * h;
      this.mat = new Uint8Array(n);
      this.hgt = new Uint8Array(n).fill(1);
      this.kind = new Uint8Array(n);
      this.solid = new Uint8Array(n);
      this.region = new Uint8Array(n).fill(255);
      this.flags = new Uint16Array(n);
      this.face = new Uint8Array(n);   // bits: row(0..1) | depth<<2 | style<<4
      this.objects = [];
      this.decals = [];
      this.anim = [];       // animated low decor (grass tufts, reeds, flowers)
      this.lights = [];
      this.triggers = [];
      this.chunks = new Map();
      this.objGrid = new Map();
      this.explored = null;
      this.ambient = null;  // lighting ambient colour or null for daylight
      this.name = '';
    }
    idx(x, y) { return y * this.w + x; }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    tileOf(px) { return Math.floor(px / TS); }
    isSolid(tx, ty) { return !this.inb(tx, ty) || this.solid[ty * this.w + tx] > 0; }
    // Can an entity standing at `level` (height) occupy tile? onStair = {lo,hi} or null
    passable(tx, ty, level, stair, flying) {
      if (!this.inb(tx, ty)) return false;
      const i = ty * this.w + tx;
      if (flying) return this.solid[i] === 0 || this.kind[i] === K.WATER || this.kind[i] === K.CHASM || this.kind[i] === K.PIT;
      if (this.solid[i]) return false;
      const k = this.kind[i];
      if (k === K.STAIRS) return true;
      const h = this.hgt[i];
      if (h === level) return true;
      if (stair && (h === stair.lo || h === stair.hi)) return true;
      return false;
    }
    stairInfo(tx, ty) {
      if (!this.inb(tx, ty)) return null;
      const i = ty * this.w + tx;
      if (this.kind[i] !== K.STAIRS) return null;
      // stairs connect their own (low) height to the height of the first non-stair tile above
      let y = ty - 1;
      while (y >= 0 && this.kind[y * this.w + tx] === K.STAIRS) y--;
      const hi = y >= 0 ? this.hgt[y * this.w + tx] : this.hgt[i];
      let yb = ty + 1;
      while (yb < this.h && this.kind[yb * this.w + tx] === K.STAIRS) yb++;
      const lo = yb < this.h ? this.hgt[yb * this.w + tx] : this.hgt[i];
      return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
    }
    addObject(o) {
      o.id = o.id || ('o' + this.objects.length);
      this.objects.push(o);
      const key = ((o.y / 256) | 0) * 4096 + ((o.x / 256) | 0);
      let b = this.objGrid.get(key);
      if (!b) { b = []; this.objGrid.set(key, b); }
      b.push(o);
      if (o.block) for (const t of o.block) { if (t >= 0 && t < this.solid.length) this.solid[t] = 2; }
      return o;
    }
    removeObject(o) {
      o.dead = true;
      if (o.block) for (const t of o.block) if (this.solid[t] === 2) this.solid[t] = 0;
    }
    objectsNear(x0, y0, x1, y1) {
      const out = [];
      const cx0 = Math.floor((x0 - 96) / 256), cx1 = Math.floor((x1 + 96) / 256);
      const cy0 = Math.floor((y0 - 32) / 256), cy1 = Math.floor((y1 + 160) / 256);
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const b = this.objGrid.get(cy * 4096 + cx);
        if (b) for (const o of b) if (!o.dead) out.push(o);
      }
      return out;
    }
    // recompute solidity from kinds (objects re-apply their blocks)
    rebuildSolid() {
      const n = this.w * this.h;
      for (let i = 0; i < n; i++) {
        const k = this.kind[i];
        this.solid[i] = (k === K.WATER || k === K.FACE || k === K.CHASM || k === K.WALL || k === K.DEEP || k === K.FALLS || k === K.PIT || k === K.LAVA) ? 1 : 0;
      }
      for (const o of this.objects) if (o.block && !o.dead) for (const t of o.block) this.solid[t] = 2;
    }
    // Derive cliff faces from the height map. Scanning each column downward, a drop from a higher
    // tile to a lower one produces a face of 2 rows per level (max 3) in the lower tiles.
    // face byte: row(2 bits) | depth(2 bits)<<2 | style(3 bits)<<4 | overWater<<7
    deriveFaces(styleFn) {
      const w = this.w, h = this.h;
      for (let x = 0; x < w; x++) {
        let y = 1;
        while (y < h) {
          const i = y * w + x;
          const above = (y - 1) * w + x;
          const hu = this.hgt[above], hl = this.hgt[i];
          const ka = this.kind[above];
          if (hu > hl && ka !== K.FACE && ka !== K.CHASM && this.kind[i] !== K.WALL) {
            const depth = Math.min(3, (hu - hl) * 2);
            const st = styleFn ? styleFn(x, y) : 0;
            let r = 0;
            while (r < depth && y + r < h) {
              const j = (y + r) * w + x;
              if (this.hgt[j] !== hl || this.kind[j] === K.WALL) break;
              const wasWater = this.kind[j] === K.WATER || this.kind[j] === K.CHASM;
              if (this.kind[j] === K.CHASM) break;
              this.kind[j] = K.FACE;
              this.face[j] = r | (depth << 2) | (st << 4) | (wasWater ? 128 : 0);
              r++;
            }
            y += Math.max(1, r);
          } else y++;
        }
      }
    }
  }

  RS.TS = TS;
  RS.K = K;
  RS.MAT = MAT;
  RS.FACE_STYLE = FACE_STYLE;
  RS.Level = Level;
})();
