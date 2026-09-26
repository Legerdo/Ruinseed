// Development-only autopilot: plays a full run through real movement (pathfinding over the same
// height/stairs/bridge rules), cutting bushes, fighting, solving seals, taking sigils and the boss.
(function () {
  'use strict';
  const TS = RS.TS, K = RS.K, D4 = RS.DIRS4;

  function bfsPath(L, sx, sy, goal, cut) {
    const W = L.w, H = L.h, N = W * H;
    const from = new Int32Array(N).fill(-2);
    const walk = (i) => {
      const k = L.kind[i];
      if (!(k === K.FLOOR || k === K.BRIDGE || k === K.STAIRS)) return false;
      return L.solid[i] === 0 || (L.solid[i] === 2 && cut.has(i));
    };
    const s = sy * W + sx;
    from[s] = -1;
    const q = [s];
    let qi = 0, hit = -1;
    while (qi < q.length) {
      const c = q[qi++];
      if (goal(c)) { hit = c; break; }
      const cx = c % W, cy = (c / W) | 0;
      const cs = L.kind[c] === K.STAIRS;
      for (const [dx, dy] of D4) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (from[n] !== -2 || !walk(n)) continue;
        const ns = L.kind[n] === K.STAIRS;
        if (ns || cs) { if (dx !== 0 && !(ns && cs)) continue; }
        else if (L.hgt[n] !== L.hgt[c]) continue;
        from[n] = c; q.push(n);
      }
    }
    if (hit < 0) return null;
    const path = [];
    let c = hit;
    while (c !== -1) { path.push(c); c = from[c]; }
    return path.reverse();
  }

  const Auto = {
    on: false, tasks: [], log: [], t: 0,
    start() {
      const g = RS.currentGame;
      g.godMode = true;
      this.on = true; this.tasks = []; this.t = 0; this.log = [];
      const order = g.world.dungeons.slice().sort((a, b) => RS.M.dist2(a.approach.tx, a.approach.ty, g.world.camp.tx, g.world.camp.ty) - RS.M.dist2(b.approach.tx, b.approach.ty, g.world.camp.tx, g.world.camp.ty));
      this.tasks.push({ type: 'talk' });
      for (const dg of order) this.tasks.push({ type: 'dungeon', i: dg.index });
      this.tasks.push({ type: 'lair' });
      this.tasks.push({ type: 'boss' });
      this.say('start ' + order.map((d) => d.index + ':' + d.theme).join(','));
    },
    say(s) { this.log.push(Math.round(RS.currentGame ? RS.currentGame.runTime : 0) + 's ' + s); },
    // follow a tile path; returns true when reached
    walkTo(g, goalFn, label) {
      const L = g.level, p = g.player;
      const ptx = Math.floor(p.x / TS), pty = Math.floor((p.y - 3) / TS);
      if (goalFn(pty * L.w + ptx)) { RS.Input.override = { x: 0, y: 0 }; return true; }
      if (!this.path || this.pathLabel !== label || this.replan) {
        const cut = RS.WorldValidate.cuttableSet(L);
        this.path = bfsPath(L, ptx, pty, goalFn, cut);
        this.pathLabel = label; this.pi = 0; this.replan = false;
        if (!this.path) { this.say('no path ' + label); this.stuckT = 0; return false; }
      }
      // advance along the path
      while (this.pi < this.path.length - 1) {
        const c = this.path[this.pi];
        if (c === pty * L.w + ptx) { this.pi++; continue; }
        // skip ahead if we're already on a later node
        const idx = this.path.indexOf(pty * L.w + ptx, this.pi);
        if (idx >= 0) this.pi = idx + 1;
        break;
      }
      const tgt = this.path[Math.min(this.pi, this.path.length - 1)];
      const tx = (tgt % L.w) * TS + 8, ty = ((tgt / L.w) | 0) * TS + 11;
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
      RS.Input.override = { x: dx / d, y: dy / d };
      // cut through bushes on the path
      if (L.solid[tgt] === 2 && d < 20) { p.faceTo(dx, dy); p.buffer.attack = 0.14; }
      // stuck detection
      const moved = Math.hypot(p.x - (this.lx || 0), p.y - (this.ly || 0));
      this.lx = p.x; this.ly = p.y;
      if (moved < 0.2) this.stuckT = (this.stuckT || 0) + 1 / 60; else this.stuckT = 0;
      if (this.stuckT > 0.6) { p.buffer.attack = 0.14; RS.Input.override = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 }; }
      if (this.stuckT > 1.4) { this.replan = true; this.stuckT = 0; }
      return false;
    },
    fightNearby(g, radius) {
      const p = g.player;
      let best = null, bd = radius;
      for (const e of g.level.entities) {
        if (e.dead || !e.hittable || e.faction !== 'enemy') continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) return false;
      const dx = best.x - p.x, dy = best.y - p.y;
      if (bd > 18) { RS.Input.override = { x: dx / bd, y: dy / bd }; }
      else { RS.Input.override = { x: 0, y: 0 }; p.faceTo(dx, dy); p.buffer.attack = 0.14; }
      return true;
    },
    update() {
      if (!this.on) return;
      const g = RS.currentGame;
      if (!g || RS.App.sceneName !== 'play') { RS.Input.override = null; return; }
      if (RS.App.modals.length) { RS.App.modals.length = 0; g.dialog = null; }
      if (g.trans) return;
      this.t += 1 / 60;
      const task = this.tasks[0];
      if (!task) { RS.Input.override = null; return; }
      const L = g.level, W = L.w, p = g.player;
      const near = (tx, ty, r) => (i) => Math.abs((i % W) - tx) + Math.abs(((i / W) | 0) - ty) <= (r || 0);
      if (task.type === 'talk') {
        const k = g.keeper;
        if (this.walkTo(g, near(Math.floor(k.x / TS), Math.floor(k.y / TS) + 1, 1), 'keeper')) { g.interact(k); this.tasks.shift(); this.say('talked'); }
        return;
      }
      if (task.type === 'dungeon') {
        const dg = g.world.dungeons[task.i];
        if (g.levelName === 'overworld') {
          if (g.run.sigils.includes(task.i)) { this.tasks.shift(); return; }
          if (task.entering) {
            // keep walking into the entrance until the level changes
            const tx = dg.style === 'cave' ? (dg.site.mouthX + 1) * TS : dg.site.cx * TS + 8;
            RS.Input.override = { x: Math.abs(p.x - tx) > 2 ? Math.sign(tx - p.x) * 0.6 : 0, y: -1 };
            task.enterT = (task.enterT || 0) + 1 / 60;
            if (task.enterT > 3) { task.entering = false; task.enterT = 0; this.say('retry entrance ' + task.i); }
            return;
          }
          if (this.fightNearby(g, 30)) return;
          if (this.walkTo(g, near(dg.approach.tx, dg.approach.ty, 0), 'd' + task.i)) { task.entering = true; this.say('at entrance ' + task.i); }
          return;
        }
        const d = g.dungeonData[task.i];
        if (!d) return;
        if (d.sigilTaken) {
          if (task.leaving) { RS.Input.override = { x: Math.abs(p.x - (d.exit.tx + 1) * TS) > 2 ? Math.sign((d.exit.tx + 1) * TS - p.x) * 0.6 : 0, y: -1 }; return; }
          if (this.walkTo(g, near(d.exit.tx, d.exit.ty + 1, 0), 'exit' + task.i)) { task.leaving = true; this.say('leaving ' + task.i); }
          return;
        }
        if (this.fightNearby(g, d.trial && d.trial.started && !d.trial.done ? 400 : 26)) return;
        if (d.sealOpen) {
          if (this.walkTo(g, near(d.pedestal.tx, d.pedestal.ty, 1), 'ped' + task.i)) { g.interact(d.pedestalObj); this.say('sigil ' + task.i); }
          return;
        }
        if (d.trial) {
          const rm = d.rooms[d.trial.room];
          this.walkTo(g, (i) => rm.tiles.includes(i) && Math.hypot((i % W) - rm.cx, ((i / W) | 0) - rm.cy) < 2, 'trial' + task.i);
          return;
        }
        const a = d.activators.find((o) => !o.interact.done);
        if (a) {
          const ax = Math.floor(a.x / TS), ay = Math.floor((a.y - 2) / TS);
          if (this.walkTo(g, near(ax, ay, 1), 'act' + task.i + ':' + ax + ',' + ay)) { g.interact(a); }
        }
        return;
      }
      if (task.type === 'lair') {
        if (g.levelName === 'arena') { this.tasks.shift(); this.say('arena'); return; }
        const ls = g.world.lairSite;
        if (task.entering) { const tx = ls.gateX * TS + 8; RS.Input.override = { x: Math.abs(p.x - tx) > 2 ? Math.sign(tx - p.x) * 0.6 : 0, y: -1 }; return; }
        if (this.fightNearby(g, 30)) return;
        if (this.walkTo(g, near(ls.approachX, ls.approachY, 0), 'lair')) { task.entering = true; this.say('at lair gate'); }
        return;
      }
      if (task.type === 'boss') {
        const b = g.boss;
        if (!b || b.dead) { RS.Input.override = null; return; }
        if (!b.awake || !b.hittable) { RS.Input.override = { x: 0, y: -1 }; if (p.y < b.y + 60) RS.Input.override = { x: 0, y: 0 }; return; }
        // approach from our own side of the boss and swing toward it
        const bx = b.x, by = b.y - 8;
        const vx = p.x - bx, vy = p.y - by, vd = Math.hypot(vx, vy) || 1;
        const gx = bx + vx / vd * 22, gy = by + vy / vd * 22;
        const dx = gx - p.x, dy = gy - p.y, d = Math.hypot(dx, dy);
        if (d > 6 && vd > 24) RS.Input.override = { x: dx / d, y: dy / d };
        else { RS.Input.override = { x: 0, y: 0 }; p.faceTo(bx - p.x, by - p.y); p.buffer.attack = 0.14; }
      }
    }
  };
  RS.Auto = Auto;
  // hook into the fixed update
  const baseUpdate = RS.App.update.bind(RS.App);
  RS.App.update = function (dt) { Auto.update(); baseUpdate(dt); };
})();
