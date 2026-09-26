// The Ruin Guardian arena and the multi-phase boss fight.
(function () {
  'use strict';
  const TS = RS.TS, K = RS.K, MAT = RS.MAT, P = RS.PAL, T = RS.T;

  // ---- arena map ------------------------------------------------------------------------------
  function generateArena(seed) {
    const W = 34, H = 30;
    const L = new RS.Level('arena', W, H, (seed * 13 + 5) | 0);
    for (let i = 0; i < W * H; i++) { L.kind[i] = K.WALL; L.mat[i] = MAT.DWALL; L.hgt[i] = 2; }
    const cx = 17, cy = 12;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const dx = (x + 0.5 - cx) / 13.5, dy = (y + 0.5 - cy) / 9.5;
      if (dx * dx + dy * dy < 1) { const i = y * W + x; L.kind[i] = K.FLOOR; L.mat[i] = MAT.ARENA; L.hgt[i] = 1; }
    }
    // entry corridor from the south
    for (let y = cy + 8; y < H - 2; y++) for (let x = cx - 1; x <= cx + 1; x++) { const i = y * W + x; L.kind[i] = K.FLOOR; L.mat[i] = MAT.ARENA; L.hgt[i] = 1; }
    // lava moat crescents along the rim (visual + hazard, solid)
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const dx = (x + 0.5 - cx) / 13.5, dy = (y + 0.5 - cy) / 9.5;
      const d = dx * dx + dy * dy;
      const i = y * W + x;
      if (d > 0.8 && d < 1 && y < cy + 3 && L.kind[i] === K.FLOOR && Math.abs(x - cx) > 3) { L.kind[i] = K.LAVA; L.mat[i] = MAT.LAVA; }
    }
    // faces
    for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (L.kind[i] !== K.WALL) continue;
      if (y + 1 < H && L.kind[i + W] !== K.WALL && L.kind[i + W] !== K.FACE) { L.kind[i] = K.FACE; L.hgt[i] = 1; L.face[i] = 0 | (1 << 2) | (4 << 4); }
    }
    L.rebuildSolid();
    L.theme = 'arena';
    L.ambient = '#54404c';
    L.name = 'arena';
    // pillars at diagonals (cover from projectiles)
    const pil = [[cx - 7, cy - 3], [cx + 7, cy - 3], [cx - 8, cy + 4], [cx + 8, cy + 4]];
    const pillars = [];
    for (const [x, y] of pil) {
      const i = y * W + x;
      pillars.push(L.addObject({ kind: 'pillar', spr: 'pillar_0', x: x * TS + 8, y: y * TS + 15, block: [i] }));
    }
    // braziers around
    for (const [x, y] of [[cx - 11, cy], [cx + 11, cy], [cx - 4, cy - 8], [cx + 4, cy - 8]]) {
      const i = y * W + x;
      if (L.kind[i] === K.FLOOR) L.addObject({ kind: 'brazier', spr: 'brazier_lit', anim: { frames: 4, fps: 8 }, x: x * TS + 8, y: y * TS + 14, block: [i], light: { r: 58, color: '#ff9a45', flicker: true } });
    }
    for (let i = 0; i < W * H; i++) {
      if (L.kind[i] !== K.FLOOR) continue;
      const h = RS.hash2(i, 3, 5) & 255;
      if (h < 12) L.decals.push({ s: ['crack0', 'crack1', 'rubble0', 'bones0'][h % 4], x: (i % W) * TS + 4 + (h % 8), y: ((i / W) | 0) * TS + 6 + (h % 7) });
    }
    const gateTiles = [(cy + 9) * W + cx - 1, (cy + 9) * W + cx, (cy + 9) * W + cx + 1];
    return {
      level: L, center: { x: cx * TS + 8, y: cy * TS + 8 }, entryPos: { x: cx * TS + 8, y: (H - 3) * TS + 12 },
      bossPos: { x: cx * TS + 8, y: (cy - 3) * TS + 12 }, gateTiles, pillars, started: false
    };
  }

  function populateArena(g, a) {
    const L = a.level;
    L.entities = [];
    const b = new Guardian(a.bossPos.x, a.bossPos.y, a);
    b.level = 1;
    L.entities.push(b);
    a.boss = b;
    g.boss = b;
  }

  // ---- runtime ----------------------------------------------------------------------------------
  const ArenaRuntime = {
    update(g, a, dt) {
      const p = g.player;
      RS.Terrain.arenaCenter = a.center;
      if (!a.started && p.y < a.center.y + 7.5 * TS) {
        a.started = true;
        // seal the way back
        const L = a.level;
        for (const t of a.gateTiles) L.solid[t] = 2;
        a.gateObj = L.addObject({ kind: 'seal', spr: 'dseal_ember_h_3', x: 17 * TS + 8, y: 22 * TS - 1, block: a.gateTiles.slice(), light: { r: 30, color: '#ff9a45' } });
        g.toast(T.toast.arenaSealed, P.emb5);
        g.shake(3, 0.5);
        RS.Audio && RS.Audio.sfx('slam');
        a.boss.wake(g);
      }
      if (g.boss && g.boss.awake && !g.boss.dead && Math.random() < 0.25) g.fx.ember(a.center.x + (Math.random() - 0.5) * 380, a.center.y + 150 * Math.random() - 40, Math.random() < 0.5 ? P.emb5 : P.emb4);
    }
  };

  // ---- guardian ---------------------------------------------------------------------------------
  class Guardian extends RS.Entity {
    constructor(x, y, arena) {
      super(x, y);
      this.arena = arena;
      this.isBoss = true;
      this.maxHp = this.hp = 96;
      this.faction = 'enemy';
      this.hittable = false;
      this.radius = 16; this.bodyH = 40; this.fw = 24; this.fh = 12;
      this.shadow = 'shadow_xl';
      this.state = 'dormant'; this.st = 0; this.t = 0;
      this.awake = false; this.exposed = false;
      this.phase = 1; this.cool = 1.2;
      this.flashT = 0; this.shakeT = 0;
      this.rings = []; this.rocks = []; this.lastAtk = '';
      this.depthBias = 2;
      this.keep = true;
    }
    wake(g) {
      this.state = 'intro'; this.st = 0;
      g.showBanner(T.boss.intro, T.boss.introSub);
      RS.Audio && RS.Audio.playMusic('boss');
      RS.Audio && RS.Audio.sfx('roar');
    }
    get phaseNow() { const f = this.hp / this.maxHp; return f > 0.6 ? 1 : f > 0.3 ? 2 : 3; }
    hurt(dmg, fx, fy, g) {
      if (this.dead || !this.hittable || this.state === 'rage' || this.state === 'dying') return;
      let d = this.exposed ? Math.round(dmg * 2.2) : Math.max(1, Math.floor(dmg * 0.5));
      this.hp -= d;
      this.flashT = 0.14; this.shakeT = 0.15;
      g.hitStop(this.exposed ? 0.09 : 0.05);
      g.shake(this.exposed ? 3 : 1.5, 0.12);
      g.fx.spr('fx_hit_', 4, this.x + (Math.random() - 0.5) * 16, this.y - 22 + (Math.random() - 0.5) * 12, 20);
      g.fx.text(this.x, this.y - 50, String(d), this.exposed ? P.emb6 : P.bone5, { font: this.exposed ? 'bold' : 'small' });
      if (!this.exposed) { g.fx.burst(fx, fy - 4, 5, [P.bone6, P.white], 60); RS.Audio && RS.Audio.sfx('clink'); if (!this.armorHint) { this.armorHint = true; g.toast(T.boss.armored, P.bone5); } }
      else { g.fx.burst(this.x, this.y - 30, 12, [P.emb6, P.emb5, P.white], 90); RS.Audio && RS.Audio.sfx('bosshit'); }
      if (this.hp <= 0) { this.hp = 0; this.startDeath(g); return; }
      const ph = this.phaseNow;
      if (ph > this.phase) { this.phase = ph; this.state = 'rage'; this.st = 0; this.exposed = false; this.rings.push({ r: 0, max: 90, dmg: 1, push: true }); RS.Audio && RS.Audio.sfx('roar'); g.toast(ph === 2 ? T.boss.phase2 : T.boss.phase3, P.emb6); g.shake(5, 0.8); }
    }
    startDeath(g) {
      this.state = 'dying'; this.st = 0; this.hittable = false; this.exposed = false;
      g.toast(T.boss.defeated, P.gold5);
      RS.Audio && RS.Audio.stopMusic(0.3);
      RS.Audio && RS.Audio.sfx('bossdie');
      // clear hostile leftovers
      for (const e of g.level.entities) if (e !== this && (e.faction === 'enemy')) { if (e.hurt && e.hp) { e.hp = 0; e.die && e.die(g); } else e.dead = true; }
      this.rocks = []; this.rings = [];
    }
    pickAttack() {
      const ph = this.phase;
      const opts = [
        ['slam', 3], ['charge', 2.4],
        ['volley', ph >= 2 ? 2.2 : 0.8], ['rocks', ph >= 2 ? 2 : 0], ['summon', ph >= 3 ? 1.2 : 0]
      ].filter((o) => o[1] > 0 && o[0] !== this.lastAtk);
      let tot = 0; for (const o of opts) tot += o[1];
      let rr = Math.random() * tot;
      for (const o of opts) { rr -= o[1]; if (rr <= 0) return o[0]; }
      return 'slam';
    }
    update(dt, g) {
      this.t += dt; this.st += dt;
      if (this.flashT > 0) this.flashT -= dt;
      if (this.shakeT > 0) this.shakeT -= dt;
      const p = g.player;
      const L = g.level;
      // shockwave rings
      for (const rg of this.rings) {
        rg.r += dt * 120;
        if (rg.r <= 0) continue;
        if (!rg.hit && !p.dead) {
          const d = Math.hypot(p.x - this.x, (p.y - this.y) * 1.4);
          if (Math.abs(d - rg.r) < 7) {
            rg.hit = true;
            if (rg.push) { const dx = p.x - this.x, dy = p.y - this.y, dd = Math.hypot(dx, dy) || 1; p.kx = dx / dd * 220; p.ky = dy / dd * 220; }
            if (rg.dmg) g.damagePlayer(rg.dmg, this.x, this.y, this, 220);
          }
        }
      }
      this.rings = this.rings.filter((rg) => rg.r < rg.max);
      // falling rocks
      for (const rk of this.rocks) {
        rk.t += dt;
        if (!rk.landed && rk.t >= rk.delay) {
          rk.landed = true;
          g.shake(2, 0.15);
          g.fx.spr('fx_dust_', 4, rk.x, rk.y, 14);
          g.fx.burst(rk.x, rk.y - 4, 10, [P.rock5, P.rock3, P.bone4], 80);
          RS.Audio && RS.Audio.sfx('thud');
          if (!p.dead && Math.hypot(p.x - rk.x, (p.y - rk.y) * 1.3) < 15) g.damagePlayer(2, rk.x, rk.y, this, 160);
        }
      }
      this.rocks = this.rocks.filter((rk) => rk.t < rk.delay + 0.5);
      switch (this.state) {
        case 'dormant': return;
        case 'intro':
          this.awake = true;
          if (this.st > 2.2) { this.state = 'idle'; this.st = 0; this.hittable = true; this.cool = 0.8; }
          return;
        case 'rage':
          this.hittable = false;
          if (this.st > 1.6) { this.state = 'idle'; this.st = 0; this.hittable = true; this.cool = 0.5; }
          return;
        case 'dying':
          this.shakeT = 0.1;
          if (Math.random() < 0.5) g.fx.burst(this.x + (Math.random() - 0.5) * 40, this.y - Math.random() * 50, 6, [P.emb7, P.emb5, P.white], 90);
          if (Math.floor(this.st * 6) !== Math.floor((this.st - dt) * 6)) { g.shake(3, 0.2); RS.Audio && RS.Audio.sfx('crumble'); }
          if (this.st > 3.0 && !this.dead) {
            this.dead = true;
            g.flashScreen(P.white, 1.0);
            g.fx.burst(this.x, this.y - 30, 80, [P.emb7, P.emb6, P.gold5, P.white, P.bone5], 160, { up: 50, life: 1.2 });
            g.fx.spr('fx_poof_', 5, this.x, this.y - 30, 8);
            L.addObject({ kind: 'deco', spr: 'guardian_dead', x: this.x, y: this.y, depthBias: -10 });
          }
          return;
      }
      if (p.dead) return;
      const dx = p.x - this.x, dy = p.y - this.y, dist = Math.hypot(dx, dy) || 1;
      const speedMul = this.phase === 3 ? 1.3 : this.phase === 2 ? 1.12 : 1;
      if (this.state === 'idle' || this.state === 'walk') {
        this.exposed = false;
        this.cool -= dt;
        if (dist > 44) {
          RS.Phys.moveEntity(L, this, dx / dist * 28 * speedMul * dt, dy / dist * 28 * speedMul * dt);
          this.state = 'walk';
        } else this.state = 'idle';
        if (this.cool <= 0) {
          const atk = this.pickAttack();
          this.lastAtk = atk;
          this.st = 0;
          if (atk === 'slam') { this.state = 'slamWind'; this.tx = p.x; this.ty = p.y; RS.Audio && RS.Audio.sfx('telegraph'); }
          else if (atk === 'charge') { this.state = 'chargeWind'; this.cdx = dx / dist; this.cdy = dy / dist; RS.Audio && RS.Audio.sfx('charge'); }
          else if (atk === 'volley') { this.state = 'volleyWind'; RS.Audio && RS.Audio.sfx('swell'); }
          else if (atk === 'rocks') { this.state = 'rocksWind'; RS.Audio && RS.Audio.sfx('roar'); }
          else { this.state = 'summonWind'; }
        }
      } else if (this.state === 'slamWind') {
        const dur = this.phase === 3 ? 0.7 : 0.9;
        if (this.st < dur * 0.6) { this.tx = p.x; this.ty = p.y; }
        // hop toward the target during wind-up
        const hx = this.tx - this.x, hy = this.ty - this.y, hd = Math.hypot(hx, hy) || 1;
        if (hd > 26) RS.Phys.moveEntity(L, this, hx / hd * 60 * dt, hy / hd * 60 * dt);
        if (this.st > dur) {
          this.state = 'slam'; this.st = 0;
          g.shake(6, 0.4);
          RS.Audio && RS.Audio.sfx('smash');
          this.rings.push({ r: 8, max: this.phase >= 2 ? 110 : 80, dmg: 1 });
          // phase 3: a second, delayed ring (negative radius = delay)
          if (this.phase === 3) this.rings.push({ r: -44, max: 90, dmg: 1 });
          if (!p.dead && Math.hypot(p.x - this.x, (p.y - this.y) * 1.3) < 30) g.damagePlayer(2, this.x, this.y, this, 260);
          g.fx.spr('fx_dust_', 4, this.x - 18, this.y, 12); g.fx.spr('fx_dust_', 4, this.x + 18, this.y, 12);
        }
      } else if (this.state === 'slam') {
        if (this.st > 0.35) { this.state = 'recover'; this.st = 0; this.exposed = true; if (!this.exposeHint) { this.exposeHint = true; g.toast(T.boss.exposed, P.emb6); } }
      } else if (this.state === 'recover') {
        this.exposed = true;
        if (this.st > (this.phase === 3 ? 1.2 : 1.6)) { this.state = 'idle'; this.exposed = false; this.cool = 0.9 / speedMul; }
      } else if (this.state === 'chargeWind') {
        const dur = this.phase === 3 ? 0.55 : 0.75;
        if (this.st < dur * 0.7) { this.cdx = dx / dist; this.cdy = dy / dist; }
        if (this.st > dur) { this.state = 'charge'; this.st = 0; this.run = 0; RS.Audio && RS.Audio.sfx('dash'); }
      } else if (this.state === 'charge') {
        const sp = 230 * speedMul;
        const r = RS.Phys.moveEntity(L, this, this.cdx * sp * dt, this.cdy * sp * dt);
        this.run += sp * dt;
        if (Math.random() < 0.6) g.fx.spr('fx_dust_', 4, this.x - this.cdx * 10, this.y, 16);
        if (!p.dead && Math.hypot(p.x - this.x, (p.y - 8) - (this.y - 16)) < 22) g.damagePlayer(2, this.x, this.y, this, 260);
        if (r.hitX || r.hitY) {
          this.state = 'stunned'; this.st = 0; this.exposed = true;
          g.shake(7, 0.5); RS.Audio && RS.Audio.sfx('crash');
          g.fx.burst(this.x + this.cdx * 18, this.y - 16, 20, [P.rock5, P.bone5, P.emb5], 110);
          // knock rocks loose from the ceiling
          for (let k = 0; k < (this.phase >= 2 ? 4 : 2); k++) this.rocks.push({ x: p.x + (Math.random() - 0.5) * 90, y: p.y + (Math.random() - 0.5) * 60, t: 0, delay: 0.6 + k * 0.2 });
        } else if (this.run > 240) { this.state = 'recover'; this.st = 0.6; this.exposed = true; }
      } else if (this.state === 'stunned') {
        this.exposed = true;
        if (this.st > 2.0) { this.state = 'idle'; this.exposed = false; this.cool = 0.7; }
      } else if (this.state === 'volleyWind') {
        if (this.st > 0.65) {
          this.state = 'volley'; this.st = 0;
          const n = this.phase >= 3 ? 16 : this.phase === 2 ? 12 : 8;
          const off = Math.random() * Math.PI;
          for (let k = 0; k < n; k++) {
            const a = off + k / n * Math.PI * 2;
            g.addEntity(new RS.Projectile(this.x, this.y - 30, Math.cos(a) * 74, Math.sin(a) * 60, { dmg: 1, spr: 'proj_orb', frames: 2, z: 10, life: 3, ignoreWalls: false, radius: 4 }));
          }
          RS.Audio && RS.Audio.sfx('volley');
          if (this.phase >= 2) this.volleys = 1;
        }
      } else if (this.state === 'volley') {
        if (this.volleys > 0 && this.st > 0.45) {
          this.volleys--;
          const a0 = Math.atan2(dy, dx);
          for (const da of [-0.25, 0, 0.25]) g.addEntity(new RS.Projectile(this.x, this.y - 30, Math.cos(a0 + da) * 110, Math.sin(a0 + da) * 110, { dmg: 1, spr: 'proj_orb', frames: 2, z: 10, life: 3, radius: 4 }));
          RS.Audio && RS.Audio.sfx('orb');
        }
        if (this.st > 0.9) { this.state = 'recover'; this.st = 0.8; this.exposed = true; }
      } else if (this.state === 'rocksWind') {
        if (this.st > 0.5) {
          this.state = 'rocks'; this.st = 0;
          const n = this.phase >= 3 ? 8 : 5;
          for (let k = 0; k < n; k++) {
            const a = Math.random() * Math.PI * 2, rr = k === 0 ? 0 : 20 + Math.random() * 60;
            this.rocks.push({ x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr * 0.7, t: 0, delay: 0.85 + k * 0.12 });
          }
          g.shake(3, 0.6);
        }
      } else if (this.state === 'rocks') {
        if (this.st > 1.4) { this.state = 'recover'; this.st = 0.6; this.exposed = true; }
      } else if (this.state === 'summonWind') {
        if (this.st > 0.8) {
          this.state = 'recover'; this.st = 0.3; this.exposed = true;
          for (let k = 0; k < 2; k++) {
            const sx = this.x + (k ? 40 : -40), sy = this.y + 24;
            const e = RS.Enemies.create('slime', sx, sy, 3, 'ember');
            e.level = 1; e.aggro = true;
            g.addEntity(e);
            g.fx.spr('fx_poof_', 5, sx, sy - 6, 14);
          }
          RS.Audio && RS.Audio.sfx('summon');
        }
      }
      // body contact
      if (this.state !== 'charge' && !p.dead && Math.hypot(p.x - this.x, (p.y - 6) - (this.y - 10)) < 18) g.damagePlayer(1, this.x, this.y, this, 200);
    }
    pose() {
      switch (this.state) {
        case 'slamWind': return 'windup';
        case 'slam': return 'slam';
        case 'recover': return this.lastAtk === 'slam' ? 'slam' : 'stun';
        case 'stunned': return 'stun';
        case 'chargeWind': case 'charge': return 'charge';
        case 'volleyWind': case 'rocksWind': case 'summonWind': case 'rage': return 'windup';
        case 'walk': return Math.floor(this.t * 3) % 2 ? 'walk1' : 'walk2';
        case 'dying': return 'stun';
        case 'dormant': return 'stun';
        case 'intro': return this.st < 1.2 ? 'stun' : 'windup';
        default: return Math.floor(this.t * 1.5) % 2 ? 'idle1' : 'idle0';
      }
    }
    draw(ctx, cx, cy, time) {
      // telegraphs under the boss
      if (this.state === 'slamWind') {
        const dur = this.phase === 3 ? 0.7 : 0.9;
        RS.UI.warnCircle(ctx, this.x - cx, this.y - cy, 30, Math.min(1, this.st / dur), time);
      }
      if (this.state === 'chargeWind') {
        // dashed lane toward the player
        ctx.fillStyle = P.emb4;
        for (let k = 1; k < 16; k++) {
          if ((k + Math.floor(time * 12)) % 3 === 0) continue;
          const x = this.x + this.cdx * k * 14 - cx, y = this.y + this.cdy * k * 14 - cy;
          ctx.globalAlpha = 0.8 - k * 0.04; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1, 4, 2);
        }
        ctx.globalAlpha = 1;
      }
      for (const rk of this.rocks) {
        if (!rk.landed) {
          RS.UI.warnCircle(ctx, rk.x - cx, rk.y - cy, 14, Math.min(1, rk.t / rk.delay), time);
          const fall = 1 - rk.t / rk.delay;
          RS.Sprites.draw(ctx, 'proj_rock', rk.x - cx, rk.y - cy - fall * 150);
        } else if (rk.t < rk.delay + 0.5) RS.Sprites.draw(ctx, 'rock_s_1', rk.x - cx, rk.y - cy);
      }
      for (const rg of this.rings) {
        if (rg.r <= 0) continue;
        const n = Math.max(20, Math.round(rg.r * 0.9));
        ctx.fillStyle = rg.push ? P.gold5 : P.emb5;
        for (let k = 0; k < n; k++) {
          const a = k / n * Math.PI * 2;
          const x = this.x + Math.cos(a) * rg.r - cx, y = this.y + Math.sin(a) * rg.r / 1.4 - cy;
          ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
        }
        ctx.fillStyle = P.emb3;
        for (let k = 0; k < n; k += 2) {
          const a = k / n * Math.PI * 2;
          ctx.fillRect(Math.round(this.x + Math.cos(a) * (rg.r - 3) - cx), Math.round(this.y + Math.sin(a) * (rg.r - 3) / 1.4 - cy), 1, 1);
        }
      }
      if (this.dead) return;
      const sx = this.shakeT > 0 ? Math.round(Math.sin(time * 90) * 2) : 0;
      const pose = this.pose();
      RS.Sprites.draw(ctx, 'guardian_' + pose, this.x - cx + sx, this.y - cy, { white: this.flashT > 0 && Math.floor(this.flashT * 30) % 2 === 0 });
      if (this.exposed && Math.floor(time * 6) % 2 === 0) {
        // glowing weak point
        const ox = pose === 'charge' ? 3 : 0, oy = pose === 'stun' ? 6 : pose === 'slam' ? 5 : 0;
        ctx.globalAlpha = 0.6; ctx.fillStyle = P.emb7;
        ctx.fillRect(Math.round(this.x - cx + ox - 3), Math.round(this.y - cy - 63 + 34 + oy - 3), 6, 6);
        ctx.globalAlpha = 1;
      }
      if (this.state === 'dying') {
        for (let k = 0; k < 6; k++) {
          const a = k * 1.1 + this.st;
          ctx.fillStyle = k % 2 ? P.emb7 : P.white;
          ctx.fillRect(Math.round(this.x - cx + Math.cos(a) * 12 * this.st), Math.round(this.y - cy - 30 + Math.sin(a) * 8 * this.st), 2, 8);
        }
      }
    }
  }

  RS.generateArena = generateArena;
  RS.Spawn.populateArena = populateArena;
  RS.ArenaRuntime = ArenaRuntime;
  RS.Guardian = Guardian;
})();
