// Enemy behaviours. Each type has its own silhouette, movement, telegraphed attack, HP and death.
(function () {
  'use strict';
  const P = RS.PAL, TS = RS.TS;
  const Phys = () => RS.Phys;

  const DEF = {
    slime: { hp: 4, contact: 1, speed: 0, radius: 6, bodyH: 9, fw: 10, fh: 6, drops: [1, 2], kb: 1.0 },
    beetle: { hp: 8, contact: 1, speed: 34, radius: 7, bodyH: 10, fw: 10, fh: 8, drops: [2, 3], kb: 0.7 },
    spitter: { hp: 6, contact: 1, speed: 0, radius: 7, bodyH: 16, fw: 10, fh: 6, drops: [2, 3], kb: 0 },
    bat: { hp: 3, contact: 1, speed: 60, radius: 6, bodyH: 8, fw: 8, fh: 5, drops: [1, 2], kb: 1.2, flying: true },
    sentry: { hp: 14, contact: 1, speed: 26, radius: 8, bodyH: 22, fw: 12, fh: 7, drops: [4, 6], kb: 0.35 },
    wisp: { hp: 5, contact: 1, speed: 30, radius: 6, bodyH: 12, fw: 8, fh: 6, drops: [2, 4], kb: 0.9, flying: true }
  };

  function dirOf(dx, dy) { return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }

  class Enemy extends RS.Entity {
    constructor(type, x, y, tier, theme) {
      super(x, y);
      const d = DEF[type];
      this.type = type; this.tier = tier || 1; this.theme = theme || 'moss';
      this.maxHp = this.hp = Math.round(d.hp * (1 + 0.28 * (this.tier - 1)));
      this.contact = d.contact;
      this.baseSpeed = d.speed * (1 + 0.1 * (this.tier - 1));
      this.radius = d.radius; this.bodyH = d.bodyH; this.fw = d.fw; this.fh = d.fh;
      this.kbMul = d.kb;
      this.flying = !!d.flying;
      this.faction = 'enemy';
      this.hittable = true;
      this.home = { x, y };
      this.state = 'idle'; this.t = Math.random() * 2; this.st = 0;
      this.dir = 'down';
      this.flashT = 0;
      this.aggro = false;
      this.shadow = type === 'sentry' ? 'shadow_m' : type === 'spitter' ? 'shadow_m' : 'shadow_s';
      this.z = 0;
      this.stuckT = 0;
      this.anim = Math.random() * 4;
      this.dropRange = d.drops;
      this.tele = 0;
    }
    get sprKey() { return null; }
    distTo(p) { return Math.hypot(p.x - this.x, p.y - this.y); }
    hurt(dmg, fx, fy, g) {
      if (this.dead) return;
      this.hp -= dmg;
      this.flashT = 0.14;
      const dx = this.x - fx, dy = this.y - fy;
      const d = Math.hypot(dx, dy) || 1;
      const kb = 170 * this.kbMul;
      this.kx = dx / d * kb; this.ky = dy / d * kb;
      this.aggro = true;
      g.hitStop(0.045);
      g.shake(1.5, 0.08);
      g.fx.spr('fx_hit_', 4, this.x, this.y - this.bodyH / 2, 20);
      g.fx.text(this.x, this.y - this.bodyH - 4, String(dmg), P.bone7);
      RS.Audio && RS.Audio.sfx('hit');
      this.onHurt && this.onHurt(g);
      if (this.hp <= 0) this.die(g);
    }
    die(g) {
      this.dead = true;
      g.fx.spr('fx_poof_', 5, this.x, this.y - this.bodyH / 2, 16);
      const cols = this.type === 'slime' ? (this.theme === 'tide' ? [P.sea7, P.sea5] : this.theme === 'ember' ? [P.emb5, P.emb3] : [P.moss7, P.moss5]) : this.type === 'wisp' ? [P.sea9, P.tideGlow] : this.type === 'sentry' ? [P.bone5, P.bone3, P.moss5] : [P.ink4, P.emb4, P.bone5];
      g.fx.burst(this.x, this.y - this.bodyH / 2, 16, cols, 90);
      RS.Audio && RS.Audio.sfx('kill');
      RS.Spawn.enemyDrop(g, this);
      g.onEnemyKilled && g.onEnemyKilled(this);
    }
    move(g, dx, dy) { return Phys().moveEntity(g.L, this, dx, dy, 2); }
    // steer toward player using the shared flow field when available
    chaseDir(g) {
      const p = g.player;
      const f = g.flowDir ? g.flowDir(this) : null;
      if (f) return f;
      const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
      return [dx / d, dy / d];
    }
    canSee(g, maxD) {
      const p = g.player;
      if (p.dead) return false;
      const d = this.distTo(p);
      if (d > maxD) return false;
      if (!this.flying && p.level !== this.level && !p.stair) return false;
      return Phys().lineClear(g.L, this.x, this.y - 4, p.x, p.y - 4);
    }
    baseUpdate(dt, g) {
      this.t += dt; this.st += dt; this.anim += dt;
      if (this.flashT > 0) this.flashT -= dt;
      if (this.kx || this.ky) {
        this.move(g, this.kx * dt, this.ky * dt);
        this.kx *= Math.pow(0.002, dt); this.ky *= Math.pow(0.002, dt);
        if (Math.abs(this.kx) < 3) this.kx = 0;
        if (Math.abs(this.ky) < 3) this.ky = 0;
      }
      // leash back home when the player is far
      const p = g.player;
      if (this.distTo(p) > 260) this.aggro = false;
    }
    contactCheck(g, dmg) {
      const p = g.player;
      if (p.dead || this.z > 6) return;
      const d = Math.hypot(p.x - this.x, (p.y - 6) - (this.y - this.bodyH / 2));
      if (d < this.radius + 5 && (this.flying || Math.abs((p.level || 1) - (this.level || 1)) === 0 || p.stair)) g.damagePlayer(dmg || this.contact, this.x, this.y);
    }
    separate(g) {
      for (const o of g.L.entities) {
        if (o === this || o.dead || !o.hittable || o.faction !== 'enemy' || o.isBoss) continue;
        const dx = this.x - o.x, dy = this.y - o.y;
        const d2 = dx * dx + dy * dy;
        const r = this.radius + o.radius - 2;
        if (d2 < r * r && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (r - d) * 0.5;
          this.move(g, dx / d * push, dy / d * push);
        }
      }
    }
    drawSpr(ctx, key, cx, cy, opts) {
      opts = opts || {};
      const x = this.x - cx, y = this.y - cy - (this.z || 0);
      RS.Sprites.draw(ctx, key, x, y, { flip: opts.flip, white: this.flashT > 0 && Math.floor(this.flashT * 30) % 2 === 0 });
    }
    drawTele(ctx, cx, cy, time) {
      // telegraph marker: blinking ember "!" spark above the head
      if (this.tele <= 0) return;
      const x = Math.round(this.x - cx), y = Math.round(this.y - cy - this.bodyH - 8 - (this.z || 0));
      if (Math.floor(time * 16) % 2 === 0) {
        ctx.fillStyle = P.emb6; ctx.fillRect(x - 1, y - 5, 2, 4); ctx.fillRect(x - 1, y, 2, 2);
        ctx.fillStyle = P.emb2; ctx.fillRect(x - 2, y - 6, 4, 1);
      }
    }
  }

  // ---- slime: hops toward the player after a squash telegraph -----------------------------
  class Slime extends Enemy {
    constructor(x, y, tier, theme) { super('slime', x, y, tier, theme); this.hopT = 0; this.vzz = 0; this.wait = 1 + Math.random(); }
    update(dt, g) {
      this.baseUpdate(dt, g);
      const p = g.player;
      if (this.state === 'idle') {
        this.wait -= dt;
        if (this.canSee(g, 90)) this.aggro = true;
        if (this.wait <= 0) { this.state = 'crouch'; this.st = 0; }
      } else if (this.state === 'crouch') {
        if (this.st > 0.32) {
          this.state = 'hop'; this.st = 0;
          let dx, dy;
          if (this.aggro) [dx, dy] = this.chaseDir(g);
          else { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); if (Math.hypot(this.x - this.home.x, this.y - this.home.y) > 40) { const hx = this.home.x - this.x, hy = this.home.y - this.y, hd = Math.hypot(hx, hy); dx = hx / hd; dy = hy / hd; } }
          const sp = (this.aggro ? 62 : 32) * (1 + 0.1 * (this.tier - 1));
          this.hvx = dx * sp; this.hvy = dy * sp;
          this.vzz = 70;
          RS.Audio && RS.Audio.sfx('slime');
        }
      } else if (this.state === 'hop') {
        this.move(g, this.hvx * dt, this.hvy * dt);
        this.vzz -= 380 * dt; this.z = Math.max(0, this.z + this.vzz * dt);
        if (this.st > 0.12 && this.z <= 0) { this.state = 'land'; this.st = 0; this.z = 0; }
      } else if (this.state === 'land') {
        if (this.st > 0.16) { this.state = 'idle'; this.wait = this.aggro ? 0.35 + Math.random() * 0.3 : 1 + Math.random() * 1.5; }
      }
      this.tele = this.state === 'crouch' && this.aggro ? 1 : 0;
      this.contactCheck(g);
      this.separate(g);
    }
    draw(ctx, cx, cy, time) {
      let k = 'idle_' + (Math.floor(this.anim * 2) & 1);
      if (this.state === 'crouch') k = 'crouch';
      else if (this.state === 'hop') k = this.z > 3 ? 'jump' : 'land';
      else if (this.state === 'land') k = 'land';
      this.drawSpr(ctx, 'slime_' + this.theme + '_' + k, cx, cy);
    }
  }

  // ---- thorn beetle: patrols, aligns, rears up, then charges in a straight line ---------------
  class Beetle extends Enemy {
    constructor(x, y, tier, theme) { super('beetle', x, y, tier, theme); this.pdx = 1; this.pdy = 0; this.turnT = 1 + Math.random() * 2; }
    update(dt, g) {
      this.baseUpdate(dt, g);
      const p = g.player;
      if (this.state === 'idle') {
        this.turnT -= dt;
        if (this.turnT <= 0) { this.turnT = 1.5 + Math.random() * 2; const d = RS.DIRS4[(Math.random() * 4) | 0]; this.pdx = d[0]; this.pdy = d[1]; }
        const r = this.move(g, this.pdx * this.baseSpeed * dt, this.pdy * this.baseSpeed * dt);
        if (r.hitX || r.hitY) { this.pdx = -this.pdx; this.pdy = -this.pdy; }
        this.dir = dirOf(this.pdx, this.pdy);
        if (this.canSee(g, 100)) {
          const dx = p.x - this.x, dy = p.y - this.y;
          if (Math.abs(dx) < 14 || Math.abs(dy) < 14 || this.aggro) {
            this.state = 'tele'; this.st = 0;
            const d = Math.hypot(dx, dy) || 1;
            this.cdx = dx / d; this.cdy = dy / d;
            this.dir = dirOf(dx, dy);
            RS.Audio && RS.Audio.sfx('telegraph');
          }
        }
      } else if (this.state === 'tele') {
        if (this.st > 0.55) { this.state = 'charge'; this.st = 0; this.run = 0; }
      } else if (this.state === 'charge') {
        const sp = 175 * (1 + 0.08 * (this.tier - 1));
        const r = this.move(g, this.cdx * sp * dt, this.cdy * sp * dt);
        this.run += sp * dt;
        if (Math.random() < 0.4) g.fx.burst(this.x, this.y - 2, 1, [P.bone4], 10, { up: 6, life: 0.3 });
        if (r.hitX || r.hitY) { this.state = 'stun'; this.st = 0; g.shake(2, 0.12); g.fx.spr('fx_dust_', 4, this.x + this.cdx * 6, this.y, 14); RS.Audio && RS.Audio.sfx('thud'); }
        else if (this.run > 150) { this.state = 'idle'; this.turnT = 0.6; }
        this.contactCheck(g, 2);
      } else if (this.state === 'stun') {
        if (this.st > 0.9) { this.state = 'idle'; this.turnT = 0.5; }
      }
      if (this.state !== 'charge' && this.state !== 'stun') this.contactCheck(g);
      this.tele = this.state === 'tele' ? 1 : 0;
      this.separate(g);
    }
    draw(ctx, cx, cy, time) {
      let k;
      if (this.state === 'tele') k = Math.floor(this.st * 12) % 2 ? 'tele' : 'walk_0';
      else if (this.state === 'stun') k = 'stun';
      else k = 'walk_' + (Math.floor(this.anim * (this.state === 'charge' ? 16 : 6)) & 1);
      this.drawSpr(ctx, 'beetle_' + this.dir + '_' + k, cx, cy);
      if (this.state === 'tele') this.drawTele(ctx, cx, cy, time);
    }
  }

  // ---- seed spitter: rooted plant, swells then fires seeds --------------------------------------
  class Spitter extends Enemy {
    constructor(x, y, tier, theme) { super('spitter', x, y, tier, theme); this.cd = 1.5 + Math.random(); this.depthBias = 0; }
    extraBlock() { return false; }
    update(dt, g) {
      this.baseUpdate(dt, g);
      this.kx = this.ky = 0;
      const p = g.player;
      if (this.state === 'idle') {
        this.cd -= dt;
        if (this.cd <= 0 && this.canSee(g, 120)) { this.state = 'tele'; this.st = 0; RS.Audio && RS.Audio.sfx('swell'); }
      } else if (this.state === 'tele') {
        if (this.st > 0.6) {
          this.state = 'shoot'; this.st = 0;
          const dx = p.x - this.x, dy = (p.y - 6) - (this.y - 12);
          const d = Math.hypot(dx, dy) || 1;
          const sp = 95 + this.tier * 8;
          const spread = this.tier >= 2 ? [-0.28, 0, 0.28] : [0];
          for (const a of spread) {
            const ca = Math.cos(a), sa = Math.sin(a);
            const vx = (dx * ca - dy * sa) / d * sp, vy = (dx * sa + dy * ca) / d * sp;
            g.addEntity(new RS.Projectile(this.x, this.y - 6, vx, vy, { dmg: 1, spr: 'proj_seed', z: 8 }));
          }
          RS.Audio && RS.Audio.sfx('spit');
        }
      } else if (this.state === 'shoot') {
        if (this.st > 0.35) { this.state = 'idle'; this.cd = 1.8 + Math.random() * 0.8 - this.tier * 0.15; }
      }
      this.tele = this.state === 'tele' ? 1 : 0;
      this.flipX = p.x < this.x;
      this.contactCheck(g);
    }
    draw(ctx, cx, cy, time) {
      let k = 'idle_' + (Math.floor(this.anim * 1.5) & 1);
      if (this.state === 'tele') k = 'tele_' + (this.st > 0.3 ? 1 : 0);
      else if (this.state === 'shoot') k = 'shoot';
      this.drawSpr(ctx, 'spitter_' + k, cx, cy, { flip: this.flipX });
      if (this.state === 'tele') this.drawTele(ctx, cx, cy, time);
    }
  }

  // ---- bat: rests, then swoops past the player after a hover telegraph ---------------------------
  class Bat extends Enemy {
    constructor(x, y, tier, theme) { super('bat', x, y, tier, theme); this.z = 10; this.phase = Math.random() * 6; }
    update(dt, g) {
      this.baseUpdate(dt, g);
      const p = g.player;
      this.z = 10 + Math.sin(this.t * 6) * 2;
      if (this.state === 'idle') {
        const hx = this.home.x + Math.cos(this.t * 0.8 + this.phase) * 14, hy = this.home.y + Math.sin(this.t * 1.1) * 8;
        this.move(g, (hx - this.x) * dt * 2, (hy - this.y) * dt * 2);
        if (this.canSee(g, 80)) { this.state = 'circle'; this.st = 0; this.aggro = true; }
      } else if (this.state === 'circle') {
        const a = this.t * 2.2 + this.phase;
        const tx = p.x + Math.cos(a) * 34, ty = p.y - 4 + Math.sin(a) * 22;
        this.move(g, (tx - this.x) * dt * 2.6, (ty - this.y) * dt * 2.6);
        if (this.st > 1.3 + Math.random() * 0.8) { this.state = 'hover'; this.st = 0; RS.Audio && RS.Audio.sfx('squeak'); }
        if (this.distTo(p) > 200) this.state = 'idle';
      } else if (this.state === 'hover') {
        if (this.st > 0.4) {
          this.state = 'swoop'; this.st = 0;
          const dx = p.x - this.x, dy = (p.y - 6) - this.y, d = Math.hypot(dx, dy) || 1;
          const sp = 150 * (1 + 0.08 * (this.tier - 1));
          this.svx = dx / d * sp; this.svy = dy / d * sp;
        }
      } else if (this.state === 'swoop') {
        const r = this.move(g, this.svx * dt, this.svy * dt);
        this.z = 4;
        if (this.st > 0.55 || r.hitX || r.hitY) { this.state = 'circle'; this.st = 0; }
        this.contactCheck(g);
      }
      this.tele = this.state === 'hover' ? 1 : 0;
      if (this.state !== 'swoop' && this.state !== 'idle') this.contactCheck(g);
    }
    draw(ctx, cx, cy, time) {
      const f = this.state === 'hover' ? (Math.floor(time * 24) % 3) : (Math.floor(this.anim * (this.state === 'swoop' ? 6 : 12)) % 3);
      this.drawSpr(ctx, 'bat_' + f, cx, cy);
      if (this.state === 'hover') this.drawTele(ctx, cx, cy, time);
    }
  }

  // ---- ruin sentry: slow stone guard, telegraphed overhead smash with a ground warning ---------
  class Sentry extends Enemy {
    constructor(x, y, tier, theme) { super('sentry', x, y, tier, theme); this.cd = 0; }
    update(dt, g) {
      this.baseUpdate(dt, g);
      const p = g.player;
      if (this.cd > 0) this.cd -= dt;
      if (this.state === 'idle' || this.state === 'walk') {
        if (this.canSee(g, 120)) this.aggro = true;
        if (this.aggro) {
          const d = this.distTo(p);
          if (d < 30 && this.cd <= 0) {
            this.state = 'windup'; this.st = 0;
            const dx = p.x - this.x, dy = p.y - this.y, dd = Math.hypot(dx, dy) || 1;
            this.sx = this.x + dx / dd * 16; this.sy = this.y + dy / dd * 12;
            this.dir = dy < 0 ? 'up' : 'down';
            RS.Audio && RS.Audio.sfx('telegraph');
          } else {
            const [fx, fy] = this.chaseDir(g);
            this.move(g, fx * this.baseSpeed * dt, fy * this.baseSpeed * dt);
            this.dir = fy < -0.3 ? 'up' : 'down';
            this.state = 'walk';
          }
        } else {
          const hx = this.home.x - this.x, hy = this.home.y - this.y, hd = Math.hypot(hx, hy);
          if (hd > 6) { this.move(g, hx / hd * this.baseSpeed * 0.6 * dt, hy / hd * this.baseSpeed * 0.6 * dt); this.state = 'walk'; }
          else this.state = 'idle';
        }
      } else if (this.state === 'windup') {
        if (this.st > 0.75) {
          this.state = 'smash'; this.st = 0;
          g.shake(3.5, 0.2);
          g.fx.spr('fx_dust_', 4, this.sx - 8, this.sy, 14); g.fx.spr('fx_dust_', 4, this.sx + 8, this.sy, 14);
          g.fx.burst(this.sx, this.sy, 14, [P.bone5, P.bone3, P.rock4], 90);
          RS.Audio && RS.Audio.sfx('smash');
          if (!p.dead && Math.hypot(p.x - this.sx, p.y - this.sy) < 21) g.damagePlayer(2, this.sx, this.sy, this, 200);
        }
      } else if (this.state === 'smash') {
        if (this.st > 0.85) { this.state = 'walk'; this.cd = 1.0; }
      }
      this.tele = this.state === 'windup' ? 1 : 0;
      if (this.state !== 'smash') this.contactCheck(g);
      this.separate(g);
    }
    draw(ctx, cx, cy, time) {
      if (this.state === 'windup') {
        // ground warning circle shrinking to impact
        const k = Math.min(1, this.st / 0.75);
        RS.UI.warnCircle(ctx, this.sx - cx, this.sy - cy, 21, k, time);
      }
      let k = 'walk_' + (this.state === 'walk' ? (Math.floor(this.anim * 3) & 1) : 0);
      if (this.state === 'windup') k = 'windup';
      else if (this.state === 'smash') k = this.st < 0.5 ? 'smash' : 'walk_0';
      this.drawSpr(ctx, 'sentry_' + this.dir + '_' + k, cx, cy);
      if (this.state === 'windup') this.drawTele(ctx, cx, cy, time);
    }
  }

  // ---- wisp: drifts, blinks next to the player, fires a slow homing orb ------------------------
  class Wisp extends Enemy {
    constructor(x, y, tier, theme) { super('wisp', x, y, tier, theme); this.z = 6; this.cd = 2 + Math.random(); this.alpha = 1; }
    update(dt, g) {
      this.baseUpdate(dt, g);
      const p = g.player;
      this.z = 6 + Math.sin(this.t * 3) * 2;
      if (this.state === 'idle') {
        const tx = this.home.x + Math.sin(this.t * 0.7) * 20, ty = this.home.y + Math.sin(this.t * 1.4) * 10;
        this.move(g, (tx - this.x) * dt, (ty - this.y) * dt);
        if (this.canSee(g, 110)) { this.aggro = true; this.cd -= dt; }
        if (this.aggro && this.cd <= 0) { this.state = 'fade'; this.st = 0; }
      } else if (this.state === 'fade') {
        this.alpha = 1 - this.st / 0.35;
        if (this.st > 0.35) {
          // reappear at a free spot near the player
          for (let k = 0; k < 12; k++) {
            const a = Math.random() * Math.PI * 2, r = 38 + Math.random() * 16;
            const nx = p.x + Math.cos(a) * r, ny = p.y + Math.sin(a) * r;
            if (RS.Phys.boxFree(g.L, this, nx, ny)) { this.x = nx; this.y = ny; break; }
          }
          this.state = 'appear'; this.st = 0;
          RS.Audio && RS.Audio.sfx('blink');
        }
      } else if (this.state === 'appear') {
        this.alpha = Math.min(1, this.st / 0.3);
        if (this.st > 0.75) {
          const dx = p.x - this.x, dy = (p.y - 6) - (this.y - 8), d = Math.hypot(dx, dy) || 1;
          const sp = 58 + this.tier * 6;
          const pr = new RS.Projectile(this.x, this.y - 6, dx / d * sp, dy / d * sp, { dmg: 1, spr: 'proj_wisp', frames: 2, z: 8, life: 3.2 });
          pr.home = true;
          const baseUpd = pr.update.bind(pr);
          pr.update = function (dt2, g2) {
            if (this.t < 0.9) {
              const qx = g2.player.x - this.x, qy = (g2.player.y - 6) - this.y, qd = Math.hypot(qx, qy) || 1;
              const s = Math.hypot(this.vx, this.vy);
              this.vx += (qx / qd * s - this.vx) * dt2 * 2.2; this.vy += (qy / qd * s - this.vy) * dt2 * 2.2;
            }
            baseUpd(dt2, g2);
          };
          g.addEntity(pr);
          RS.Audio && RS.Audio.sfx('orb');
          this.state = 'idle'; this.cd = 2.4 + Math.random() - this.tier * 0.2;
          this.home = { x: this.x, y: this.y };
        }
      }
      this.tele = this.state === 'appear' && this.st > 0.3 ? 1 : 0;
      this.hittable = this.state !== 'fade' || this.alpha > 0.3;
      if (this.alpha > 0.6) this.contactCheck(g);
    }
    draw(ctx, cx, cy, time) {
      ctx.globalAlpha = Math.max(0.05, this.alpha);
      this.drawSpr(ctx, 'wisp_' + (Math.floor(this.anim * 8) % 3), cx, cy);
      ctx.globalAlpha = 1;
      if (this.tele) this.drawTele(ctx, cx, cy, time);
    }
  }

  const CLASSES = { slime: Slime, beetle: Beetle, spitter: Spitter, bat: Bat, sentry: Sentry, wisp: Wisp };
  function create(type, x, y, tier, theme) { const C = CLASSES[type] || Slime; return new C(x, y, tier, theme); }

  RS.Enemies = { create, DEF, Enemy };
})();
