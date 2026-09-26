// Dungeon gameplay: seal mechanics (braziers / levers / trial), sigil pedestal, objectives, population.
(function () {
  'use strict';
  const TS = RS.TS, P = RS.PAL, T = RS.T, K = RS.K;

  const ENEMIES = {
    moss: ['slime', 'slime', 'bat', 'spitter'],
    tide: ['slime', 'wisp', 'sentry', 'bat'],
    ember: ['beetle', 'bat', 'sentry', 'slime']
  };

  function populateDungeon(g, d, idx) {
    const L = d.level, W = L.w;
    const r = new RS.RNG('attempt:' + g.seed + ':' + g.attempt + ':d' + idx);
    L.entities = [];
    const tier = d.tier;
    const types = ENEMIES[d.theme];
    const free = (i) => L.kind[i] === K.FLOOR && L.solid[i] === 0;
    const entryTx = Math.floor(d.entryPos.x / TS), entryTy = Math.floor(d.entryPos.y / TS);
    for (const rm of d.rooms) {
      if (rm.role === 'entry' || rm.role === 'sigil') continue;
      const cands = rm.tiles.filter((i) => free(i) && Math.hypot((i % W) - entryTx, ((i / W) | 0) - entryTy) > 9);
      if (!cands.length) continue;
      let n = rm.role === 'trial' ? 0 : Math.max(1, Math.round(rm.tiles.length / 38)) + (tier >= 3 ? 1 : 0);
      if (rm.role === 'treasure') n += 1;
      for (let k = 0; k < n; k++) {
        const i = r.pick(cands);
        const type = r.pick(types);
        const e = RS.Enemies.create(type, (i % W) * TS + 8, ((i / W) | 0) * TS + 12, tier, d.theme);
        e.level = L.hgt[i];
        L.entities.push(e);
      }
    }
    // chests (contents per attempt)
    for (const c of d.chests || []) {
      const i = c.ty * W + c.tx;
      const opened = g.run.opened.has(c.id);
      L.addObject({ kind: 'chest', spr: opened ? 'chest_open' : 'chest_closed', x: c.tx * TS + 8, y: c.ty * TS + 14, interact: { type: 'chest', done: opened }, contents: RS.Spawn.chestContents(r, tier), chestId: c.id, block: [i] });
    }
    // hazards
    for (const h of d.hazards || []) {
      const hz = new RS.Spawn.Hazard(h.tx * TS + 8, h.ty * TS + 12, h.type);
      hz.level = 1;
      hz.t = r.next() * 2.4;
      L.entities.push(hz);
    }
    // a few ember caches
    for (let k = 0; k < 3; k++) {
      const rm = r.pick(d.rooms);
      if (rm.role === 'entry' || !rm.tiles.length) continue;
      const i = r.pick(rm.tiles);
      if (!free(i)) continue;
      for (let q = 0; q < 3; q++) RS.Spawn.placedEmber(g, L, (i % W) * TS + 4 + r.int(0, 8), ((i / W) | 0) * TS + 5 + r.int(0, 8), 1);
    }
  }

  function openSeal(g, d, silent) {
    if (d.sealOpen && !silent) return;
    d.sealOpen = true;
    const L = d.level;
    if (d.seal) {
      for (const t of d.seal.tiles) if (L.solid[t] === 2) L.solid[t] = 0;
      d.seal.obj.block = null;
      d.seal.obj.dead = true;
      if (!silent) {
        g.fx.burst(d.seal.obj.x, d.seal.obj.y - 12, 30, [RS.UI.THEME_COL[d.theme], P.white, P.gold4], 90, { up: 30 });
        g.shake(3, 0.35);
      }
    }
    for (const a of d.activators) { a.interact.done = true; if (a.kind === 'brazier') { a.spr = 'brazier_lit'; a.anim = { frames: 4, fps: 8 }; a.light = { r: 60, color: '#ff9a45', flicker: true }; } else a.spr = 'lever_1'; }
    if (!silent) {
      g.toast(T.toast.sealOpen, P.gold5);
      RS.Audio && RS.Audio.sfx('seal');
    }
  }

  function interact(g, t) {
    const i = +g.levelName.slice(7);
    const d = g.dungeonData[i];
    if (!d) return false;
    const it = t.interact;
    if (it.type === 'brazier' || it.type === 'lever') {
      if (it.done) return true;
      it.done = true;
      d.lit++;
      if (it.type === 'brazier') {
        t.spr = 'brazier_lit'; t.anim = { frames: 4, fps: 8 }; t.light = { r: 60, color: '#ff9a45', flicker: true };
        g.fx.burst(t.x, t.y - 16, 18, [P.emb6, P.emb5, P.emb4], 60, { up: 40 });
        RS.Audio && RS.Audio.sfx('ignite');
        g.toast(T.fmt(T.toast.brazier, { n: d.lit, m: d.needed }), P.emb6);
      } else {
        t.spr = 'lever_1'; t.light = { r: 34, color: '#86e3f0' };
        g.fx.burst(t.x, t.y - 10, 12, [P.tideGlow, P.sea8], 50);
        RS.Audio && RS.Audio.sfx('lever');
        g.toast(T.fmt(T.toast.lever, { n: d.lit, m: d.needed }), P.tideGlow);
      }
      if (d.lit >= d.needed) openSeal(g, d);
      return true;
    }
    if (it.type === 'pedestal') {
      if (it.done || !d.sealOpen) return true;
      it.done = true;
      d.sigilTaken = true;
      t.spr = 'pedestal_' + d.theme + '_empty';
      t.light = { r: 30, color: RS.UI.THEME_COL[d.theme] };
      g.collectSigil(i);
      return true;
    }
    return false;
  }

  function update(g, d, dt) {
    if (!d) return;
    // the trial: sealed arena fight in the room before the sigil chamber
    if (d.trial && !d.trial.done) {
      const rm = d.rooms[d.trial.room];
      const p = g.player;
      const L = d.level, W = L.w;
      const ti = Math.floor((p.y - 3) / TS) * W + Math.floor(p.x / TS);
      if (!d.trial.started && rm.tiles.includes(ti)) {
        const inner = Math.hypot(p.x / TS - rm.cx, p.y / TS - rm.cy) < Math.max(rm.rx, rm.ry) - 1;
        if (inner) startTrial(g, d, rm);
      }
      if (d.trial.started) {
        // trial foes that stray out of the room (or get stuck) are pulled back so the trial can always end
        d.trial.pullT = (d.trial.pullT || 0) + dt;
        if (d.trial.pullT > 2) {
          d.trial.pullT = 0;
          const set = d.trial.roomSet || (d.trial.roomSet = new Set(rm.tiles));
          for (const e of d.trial.list) {
            if (e.dead) continue;
            const ei = Math.floor((e.y - 3) / TS) * W + Math.floor(e.x / TS);
            const far = Math.hypot(e.x / TS - rm.cx, e.y / TS - rm.cy) > Math.max(rm.rx, rm.ry) + 3;
            e.strayT = (!set.has(ei) || far) ? (e.strayT || 0) + 2 : 0;
            if (e.strayT >= 4) {
              const free = rm.tiles.filter((i) => L.kind[i] === K.FLOOR && L.solid[i] === 0);
              if (free.length) {
                const i = free[Math.floor(Math.random() * free.length)];
                g.fx.spr('fx_poof_', 5, e.x, e.y - 8, 14);
                e.x = (i % W) * TS + 8; e.y = ((i / W) | 0) * TS + 12; e.level = L.hgt[i];
                e.home = { x: e.x, y: e.y }; e.aggro = true; e.strayT = 0;
                g.fx.spr('fx_poof_', 5, e.x, e.y - 8, 14);
              }
            }
          }
        }
        d.trial.remaining = d.trial.list.filter((e) => !e.dead).length;
        if (d.trial.remaining === 0) {
          d.trial.done = true;
          g.toast(T.toast.trialDone, P.gold5);
          openSeal(g, d);
        }
      }
    }
    // pedestal sparkle
    if (d.pedestalObj && !d.sigilTaken && Math.random() < (d.sealOpen ? 0.5 : 0.1)) {
      const o = d.pedestalObj;
      g.fx.ember(o.x + (Math.random() - 0.5) * 12, o.y - 18, RS.UI.THEME_COL[d.theme]);
    }
    // ember dungeon ambience
    if (d.theme === 'ember' && Math.random() < 0.3) {
      const p = g.player;
      g.fx.ember(p.x + (Math.random() - 0.5) * RS.App.W, p.y + RS.App.H * 0.4 * Math.random(), Math.random() < 0.5 ? P.emb5 : P.emb4);
    }
  }

  function startTrial(g, d, rm) {
    d.trial.started = true;
    const L = d.level, W = L.w;
    const r = new RS.RNG('trial:' + g.seed + ':' + g.attempt);
    const list = [];
    const count = 4 + d.tier;
    const types = ['beetle', 'slime', 'bat', 'sentry'];
    // only tiles the hero can actually reach
    const pi = Math.floor((g.player.y - 3) / TS) * W + Math.floor(g.player.x / TS);
    const reach = RS.DungeonGen.flood(L, pi, null);
    let cands = rm.tiles.filter((i) => reach[i] && L.kind[i] === K.FLOOR && L.solid[i] === 0 && Math.hypot((i % W) * TS - g.player.x, ((i / W) | 0) * TS - g.player.y) > 48);
    if (!cands.length) cands = rm.tiles.filter((i) => reach[i] && L.kind[i] === K.FLOOR && L.solid[i] === 0);
    for (let k = 0; k < count && cands.length; k++) {
      const i = r.pick(cands);
      const e = RS.Enemies.create(types[k % types.length], (i % W) * TS + 8, ((i / W) | 0) * TS + 12, d.tier, 'ember');
      e.level = L.hgt[i]; e.aggro = true;
      L.entities.push(e);
      list.push(e);
      g.fx.spr('fx_poof_', 5, e.x, e.y - 8, 14);
    }
    d.trial.list = list; d.trial.total = list.length; d.trial.remaining = list.length;
    g.toast(T.toast.trial, P.emb6);
    g.shake(2, 0.3);
    RS.Audio && RS.Audio.sfx('trial');
  }

  function objective(g, d, i) {
    const D = T.dungeons[d.theme];
    const ped = d.pedestalObj;
    if (d.sigilTaken) return { text: T.obj.leaveDungeon, x: d.exitObj.x, y: d.exitObj.y - 8 };
    if (d.sealOpen) return { text: T.fmt(T.obj.takeSigil, { sigil: D.sigil }), x: ped.x, y: ped.y - 8 };
    const p = g.player;
    if (d.theme === 'ember') {
      const rm = d.rooms[d.trial.room];
      const n = d.trial.started ? d.trial.total - d.trial.remaining : 0;
      const m = d.trial.started ? d.trial.total : 4 + d.tier;
      return { text: T.fmt(T.obj.sealEmber, { n, m }), x: d.trial.started ? null : rm.cx * TS + 8, y: d.trial.started ? null : rm.cy * TS + 8 };
    }
    let best = null, bd = 1e18;
    for (const a of d.activators) {
      if (a.interact.done) continue;
      const dd = RS.M.dist2(a.x, a.y, p.x, p.y);
      if (dd < bd) { bd = dd; best = a; }
    }
    const txt = T.fmt(d.theme === 'moss' ? T.obj.sealMoss : T.obj.sealTide, { n: d.lit, m: d.needed });
    return { text: txt, x: best ? best.x : null, y: best ? best.y - 8 : null };
  }

  RS.DungeonRuntime = { populateDungeon, openSeal, interact, update, objective };
  RS.Spawn.populateDungeon = populateDungeon;
})();
