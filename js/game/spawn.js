// Per-attempt population (attempt salt): enemies, patrol anchors, hazards, reward/chest contents,
// ember caches. The terrain itself stays fixed per world seed. Also drops and onboarding hints.
(function () {
  'use strict';
  const TS = RS.TS, K = RS.K, P = RS.PAL, T = RS.T;

  // ---- NPC -------------------------------------------------------------------------------
  class Keeper extends RS.Entity {
    constructor(x, y) {
      super(x, y);
      this.interact = { type: 'npc' };
      this.shadow = 'shadow_s';
      this.fw = 10; this.fh = 6; this.bodyH = 16;
      this.t = 0;
    }
    update(dt, g) { this.t += dt; this.flipX = g.player.x < this.x; }
    draw(ctx, cx, cy, time) {
      RS.Sprites.draw(ctx, 'keeper_' + (Math.floor(this.t * 1.2) & 1), this.x - cx, this.y - cy, { flip: this.flipX });
      if (this.g && !this.g.run.talked) {
        const y = this.y - cy - 26 + Math.round(Math.sin(time * 5) * 2);
        RS.Sprites.draw(ctx, 'marker', this.x - cx, y);
      }
    }
  }

  // ---- hazards ---------------------------------------------------------------------------
  class Hazard extends RS.Entity {
    constructor(x, y, type) {
      super(x, y);
      this.type = type;
      this.shadow = null;
      this.fw = 12; this.fh = 10;
      this.t = Math.random() * 3;
      this.depthBias = -6;
    }
    update(dt, g) {
      this.t += dt;
      const p = g.player;
      if (p.dead) return;
      const inside = Math.abs(p.x - this.x) < 8 && Math.abs(p.y - 2 - (this.y - 4)) < 6 && p.level === this.level;
      if (!inside) return;
      if (this.type === 'thorns') { if (g.damagePlayer(1, this.x, this.y + 6, this, 110)) g.fx.burst(p.x, p.y - 4, 6, [P.moss3, P.earth4], 50); }
      else if (this.type === 'poison') { if (g.damagePlayer(1, this.x, this.y + 4, this, 90)) g.fx.burst(p.x, p.y - 2, 6, [P.moss7, P.swamp5], 40); }
      else if (this.type === 'spikes') {
        const up = (this.t % 2.4) > 1.5;
        if (up) g.damagePlayer(1, this.x, this.y + 4, this, 120);
      }
    }
    draw(ctx, cx, cy, time) {
      let key = this.type + '_0';
      if (this.type === 'poison') key = 'poison_' + (Math.floor(this.t * 3) % 3);
      else if (this.type === 'spikes') { const ph = this.t % 2.4; key = ph > 1.5 ? 'spikes_2' : ph > 1.1 ? 'spikes_1' : 'spikes_0'; }
      else key = 'thorns_' + (Math.floor(this.t * 1.5) & 1);
      RS.Sprites.draw(ctx, key, this.x - cx, this.y - cy);
    }
  }

  function placedEmber(g, L, x, y, v) {
    const pk = new RS.Pickup(x, y, v > 1 ? 'embers' : 'ember', v);
    pk.vx = pk.vy = 0; pk.vz = 0; pk.life = Infinity; pk.t = 1;
    L.entities.push(pk);
    return pk;
  }

  function chestContents(r, tier) {
    const roll = r.next();
    if (roll < 0.62) return { type: 'embers', value: 12 + r.int(0, 8) + tier * 6 };
    if (roll < 0.82) return { type: 'potion' };
    return { type: 'fruit' };
  }

  function freeTile(L, i) {
    const k = L.kind[i];
    return (k === K.FLOOR) && L.solid[i] === 0;
  }

  function populateOverworld(g) {
    const w = g.world, L = w.level, W = L.w, F = RS.TF;
    const r = new RS.RNG('attempt:' + g.seed + ':' + g.attempt);
    L.entities = [];
    // camp keeper
    const kp = w.campNpc || { tx: w.camp.tx + 2, ty: w.camp.ty - 1 };
    const keeper = new Keeper(kp.tx * TS + 8, kp.ty * TS + 13);
    keeper.g = g;
    keeper.level = L.hgt[kp.ty * W + kp.tx];
    L.entities.push(keeper);
    L.solid[kp.ty * W + kp.tx] = 2;
    g.keeper = keeper;
    // chests at secret hollows (contents vary per attempt)
    for (const s of w.secrets || []) {
      const i = s.ty * W + s.tx;
      const opened = g.run.opened.has('c' + s.id);
      const o = L.addObject({ kind: 'chest', spr: opened ? 'chest_open' : 'chest_closed', x: s.tx * TS + 8, y: s.ty * TS + 14, interact: { type: 'chest', done: opened }, contents: chestContents(r, 2), chestId: 'c' + s.id, block: [i] });
      void o;
    }
    const inner = w.inner;
    const regTier = (rg) => { const d = w.regions[rg] ? (g.startDist ? g.startDist[rg] : null) : null; return d; };
    void regTier;
    // tiers by graph distance from the start region
    const dist = regionDist(w);
    const candidate = (i, min) => {
      if (!w.reach[i] || !freeTile(L, i)) return false;
      const f = L.flags[i];
      if (f & (F.SAFE | F.NOSPAWN | F.RES | F.ENTR)) return false;
      const x = i % W, y = (i / W) | 0;
      if (Math.hypot(x - w.camp.tx, y - w.camp.ty) < (min || 14)) return false;
      return true;
    };
    // first gentle fight: two slimes along the first road beyond the safe ring
    const firstSpots = [];
    for (let i = 0; i < L.w * L.h; i++) {
      if (!(L.flags[i] & F.ROAD) || !candidate(i, 14)) continue;
      const x = i % W, y = (i / W) | 0;
      const d = Math.hypot(x - w.camp.tx, y - w.camp.ty);
      if (d < 18 && L.region[i] === w.start) firstSpots.push(i);
    }
    if (firstSpots.length) {
      const s = r.pick(firstSpots);
      const sx = s % W, sy = (s / W) | 0;
      let n = 0;
      for (let k = 0; k < 30 && n < 2; k++) {
        const x = sx + r.int(-2, 2), y = sy + r.int(-2, 2);
        const i = y * W + x;
        if (!L.inb(x, y) || !candidate(i, 12)) continue;
        const e = RS.Enemies.create('slime', x * TS + 8, y * TS + 12, 1, 'moss');
        e.level = L.hgt[i]; L.entities.push(e); n++;
      }
    }
    // regions
    for (const reg of w.regions) {
      const d = dist[reg.id];
      const tier = d <= 1 ? 1 : d <= 3 ? 2 : 3;
      const types = reg.def.enemies || [];
      if (!types.length) continue;
      const cands = reg.tiles.filter((i) => candidate(i) && inner[i] >= 1);
      if (!cands.length) continue;
      const groups = Math.max(1, Math.round(reg.area / 150) + (tier - 1));
      const anchors = [];
      for (let k = 0; k < groups * 8 && anchors.length < groups; k++) {
        const a = r.pick(cands);
        const ax = a % W, ay = (a / W) | 0;
        if (anchors.some((b) => Math.hypot((b % W) - ax, ((b / W) | 0) - ay) < 8)) continue;
        anchors.push(a);
      }
      for (const a of anchors) {
        const ax = a % W, ay = (a / W) | 0;
        const type = r.pick(types);
        const size = type === 'sentry' ? 1 : type === 'spitter' ? r.int(1, 2) : r.int(1, 3);
        let placed = 0;
        for (let k = 0; k < 25 && placed < size; k++) {
          const x = ax + r.int(-3, 3), y = ay + r.int(-3, 3);
          if (!L.inb(x, y)) continue;
          const i = y * W + x;
          if (!candidate(i)) continue;
          if (type === 'spitter' && (L.flags[i] & F.ROAD)) continue;
          const e = RS.Enemies.create(type, x * TS + 8, y * TS + 12, tier, 'moss');
          e.level = L.hgt[i];
          L.entities.push(e);
          placed++;
        }
      }
      // hazards: thorns in green regions, poison pools in wetlands
      const hz = reg.biome === 'swamp' || reg.biome === 'marsh' ? 'poison' : (reg.biome === 'forest' || reg.biome === 'valley' || reg.biome === 'meadow' || reg.biome === 'ruins') ? 'thorns' : null;
      if (hz) {
        let left = r.int(2, 4);
        for (let k = 0; k < 30 && left > 0; k++) {
          const i = r.pick(cands);
          if (L.flags[i] & (F.ROAD | F.ROADM)) continue;
          const x = i % W, y = (i / W) | 0;
          const h = new Hazard(x * TS + 8, y * TS + 12, hz);
          h.level = L.hgt[i];
          L.entities.push(h);
          left--;
        }
      }
      // ember caches tucked away from the roads
      if (r.chance(0.7)) {
        for (let k = 0; k < 20; k++) {
          const i = r.pick(cands);
          if (L.flags[i] & F.ROADM) continue;
          const x = i % W, y = (i / W) | 0;
          const n = r.int(3, 5);
          for (let q = 0; q < n; q++) placedEmber(g, L, x * TS + 4 + r.int(0, 8), y * TS + 6 + r.int(0, 8), 1);
          break;
        }
      }
    }
    for (const e of L.entities) if (e.level === undefined || e.level === 1) { const i = Math.floor((e.y - 2) / TS) * W + Math.floor(e.x / TS); if (L.inb(i % W, (i / W) | 0)) e.level = L.hgt[i]; }
    g.startDist = dist;
  }

  function regionDist(w) {
    const n = w.regions.length;
    const dist = new Array(n).fill(99);
    dist[w.start] = 0;
    const q = [w.start];
    const adj = new Map();
    for (const e of w.connections) {
      if (!adj.has(e.a)) adj.set(e.a, []);
      if (!adj.has(e.b)) adj.set(e.b, []);
      adj.get(e.a).push(e.b); adj.get(e.b).push(e.a);
    }
    while (q.length) {
      const c = q.shift();
      for (const nb of adj.get(c) || []) if (dist[nb] > dist[c] + 1) { dist[nb] = dist[c] + 1; q.push(nb); }
    }
    return dist;
  }

  // ---- drops -----------------------------------------------------------------------------
  function scatterEmbers(g, x, y, total) {
    let left = total;
    while (left > 0) {
      const v = left >= 5 && Math.random() < 0.5 ? 5 : 1;
      g.spawnPickup(x, y, v > 1 ? 'embers' : 'ember', v);
      left -= v;
    }
  }
  function enemyDrop(g, e) {
    const [a, b] = e.dropRange || [1, 2];
    scatterEmbers(g, e.x, e.y - 4, a + Math.floor(Math.random() * (b - a + 1)) + (e.tier - 1));
    const hurt = g.player.hp < g.player.maxHp;
    if (hurt && Math.random() < 0.16) g.spawnPickup(e.x, e.y - 4, 'fruit', 1);
    if (e.type === 'sentry' && Math.random() < 0.12) g.spawnPickup(e.x, e.y - 4, 'potion', 1);
  }
  function grassDrop(g, x, y) {
    const r = Math.random();
    if (r < 0.1) g.spawnPickup(x, y, 'ember', 1);
    else if (r < 0.14 && g.player.hp < g.player.maxHp) g.spawnPickup(x, y, 'fruit', 1);
  }
  function bushDrop(g, x, y, hidden) {
    if (hidden) { scatterEmbers(g, x, y, 3); return; }
    const r = Math.random();
    if (r < 0.3) scatterEmbers(g, x, y, 1 + (Math.random() < 0.3 ? 1 : 0));
    else if (r < 0.4 && g.player.hp < g.player.maxHp) g.spawnPickup(x, y, 'fruit', 1);
  }

  function openLairGate(g, lo) {
    if (!lo.sealed) return;
    lo.sealed = false;
    lo.spr = 'lairgate_open';
    const L = g.world.level;
    if (lo.gateTiles) for (const t of lo.gateTiles) if (L.solid[t] === 2) L.solid[t] = 0;
    lo.block = null;
    lo.interact = null;
  }

  // ---- onboarding -------------------------------------------------------------------------
  function onboarding(g, dt) {
    const p = g.player;
    if (g.levelName !== 'overworld') return;
    const I = RS.Input;
    if (!g.run.talked && g.keeper && Math.hypot(p.x - g.keeper.x, p.y - g.keeper.y) < 44) g.showHint('talk', T.fmt(T.hint.talk, { key: I.keyLabel('interact') }), 8);
    if (g.run.talked && !g.hintsShown.has('map') && !g.dialog) g.showHint('map', T.fmt(T.hint.map, { key: I.keyLabel('map') }), 7);
    g._obT = (g._obT || 0) - dt;
    if (g._obT > 0) return;
    g._obT = 0.25;
    if (!g.hintsShown.has('attack')) {
      for (const e of g.level.entities) if (e.faction === 'enemy' && !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 90) { g.showHint('attack', T.fmt(T.hint.attack, { key: I.keyLabel('attack') }), 6); break; }
    } else if (!g.hintsShown.has('cut') && (!g.hint || g.hint.t > 3)) {
      g.showHint('cut', T.hint.cut, 5);
    }
    if (!g.hintsShown.has('potion') && p.hp <= p.maxHp - 2 && g.run.potions > 0 && (!g.hint || g.hint.t > 2)) g.showHint('potion', T.fmt(T.hint.potion, { key: I.keyLabel('potion') }), 6);
    for (const dg of g.world.dungeons) {
      if (Math.hypot(dg.approach.tx * TS - p.x, dg.approach.ty * TS - p.y) < 56) { g.showHint('entrance', T.hint.entrance, 6); break; }
    }
  }

  RS.Spawn = { populateOverworld, enemyDrop, grassDrop, bushDrop, openLairGate, onboarding, Keeper, Hazard, placedEmber, chestContents, regionDist, scatterEmbers };
})();
