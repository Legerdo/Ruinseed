// Entities, tile collision with height levels & stairs, pickups, projectiles, particles, float text.
(function () {
  'use strict';
  const TS = RS.TS, K = RS.K, P = RS.PAL;

  class Entity {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.vx = 0; this.vy = 0; this.kx = 0; this.ky = 0;
      this.fw = 8; this.fh = 6;          // feet collision box
      this.bodyH = 12;                    // hurtbox height above feet
      this.level = 1; this.stair = null;
      this.hp = 1; this.maxHp = 1; this.dead = false;
      this.inv = 0; this.flash = 0;
      this.faction = 'neutral';
      this.shadow = 'shadow_m';
      this.flying = false;
      this.depthBias = 0;
      this.radius = 6;
    }
    get cx() { return this.x; }
    get cy() { return this.y - this.bodyH / 2; }
    hurtbox() { return { x: this.x - this.fw / 2 - 1, y: this.y - this.bodyH, w: this.fw + 2, h: this.bodyH }; }
    update() {}
    draw() {}
  }

  // ---- collision -----------------------------------------------------------------
  function boxFree(L, e, x, y) {
    const x0 = x - e.fw / 2, x1 = x + e.fw / 2 - 0.01, y0 = y - e.fh, y1 = y - 0.01;
    const tx0 = Math.floor(x0 / TS), tx1 = Math.floor(x1 / TS), ty0 = Math.floor(y0 / TS), ty1 = Math.floor(y1 / TS);
    // stairs touched by the box allow both of their levels
    let stair = e.stair;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (L.inb(tx, ty) && L.kind[ty * L.w + tx] === K.STAIRS) { stair = L.stairInfo(tx, ty); break; }
    }
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!L.passable(tx, ty, e.level, stair, e.flying)) return false;
    }
    if (e.extraBlock && e.extraBlock(x, y)) return false;
    return true;
  }

  function updateLevel(L, e) {
    if (e.flying) return;
    const x0 = e.x - e.fw / 2, x1 = e.x + e.fw / 2 - 0.01, y0 = e.y - e.fh, y1 = e.y - 0.01;
    let st = null;
    for (let ty = Math.floor(y0 / TS); ty <= Math.floor(y1 / TS); ty++) for (let tx = Math.floor(x0 / TS); tx <= Math.floor(x1 / TS); tx++) {
      if (L.inb(tx, ty) && L.kind[ty * L.w + tx] === K.STAIRS) st = L.stairInfo(tx, ty);
    }
    e.stair = st;
    if (!st) {
      const tx = Math.floor(e.x / TS), ty = Math.floor((e.y - 2) / TS);
      if (L.inb(tx, ty)) {
        const i = ty * L.w + tx;
        const k = L.kind[i];
        if ((k === K.FLOOR || k === K.BRIDGE) && L.solid[i] === 0) e.level = L.hgt[i];
      }
    }
  }

  // move with axis separation, sub-steps and optional corner sliding
  function moveEntity(L, e, dx, dy, slide) {
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    const steps = Math.max(1, Math.ceil(dist / 3));
    const sx = dx / steps, sy = dy / steps;
    let hitX = false, hitY = false;
    for (let s = 0; s < steps; s++) {
      if (sx !== 0) {
        if (boxFree(L, e, e.x + sx, e.y)) e.x += sx;
        else {
          hitX = true;
          if (slide) {
            // nudge around corners when mostly aligned with an opening
            for (let o = 1; o <= slide; o++) {
              let done = false;
              for (const d of [-o, o]) {
                if (boxFree(L, e, e.x, e.y + d) && boxFree(L, e, e.x + sx, e.y + d)) { e.y += Math.sign(d) * Math.min(Math.abs(d), 1); done = true; break; }
              }
              if (done) break;
            }
          }
        }
      }
      if (sy !== 0) {
        if (boxFree(L, e, e.x, e.y + sy)) e.y += sy;
        else {
          hitY = true;
          if (slide) {
            for (let o = 1; o <= slide; o++) {
              let done = false;
              for (const d of [-o, o]) {
                if (boxFree(L, e, e.x + d, e.y) && boxFree(L, e, e.x + d, e.y + sy)) { e.x += Math.sign(d) * Math.min(Math.abs(d), 1); done = true; break; }
              }
              if (done) break;
            }
          }
        }
      }
      updateLevel(L, e);
    }
    return { hitX, hitY };
  }

  function lineClear(L, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 6);
    for (let i = 1; i < n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
      if (!L.inb(tx, ty)) return false;
      const k = L.kind[ty * L.w + tx];
      if (k === K.WALL || k === K.FACE || k === K.DEEP) return false;
      if (L.solid[ty * L.w + tx] === 2) return false;
    }
    return true;
  }

  // ---- pickups ------------------------------------------------------------------------
  class Pickup extends Entity {
    constructor(x, y, type, value) {
      super(x, y);
      this.type = type; this.value = value || 1;
      this.z = 0; this.vz = 60 + Math.random() * 40;
      const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 30;
      this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp * 0.6;
      this.t = 0; this.life = 30;
      this.shadow = 'shadow_s';
      this.fw = 4; this.fh = 3; this.bodyH = 6;
      this.flying = false;
    }
    update(dt, g) {
      this.t += dt;
      if (this.t > this.life - 5 && this.type !== 'potion' && this.type !== 'key') { if (this.t > this.life) { this.dead = true; return; } }
      // bounce
      this.vz -= 300 * dt; this.z += this.vz * dt;
      if (this.z < 0) { this.z = 0; this.vz = -this.vz * 0.35; if (Math.abs(this.vz) < 20) this.vz = 0; this.vx *= 0.6; this.vy *= 0.6; }
      const p = g.player;
      const dx = p.x - this.x, dy = (p.y - 4) - this.y;
      const d = Math.hypot(dx, dy);
      const mag = g.stats.magnet;
      if (this.t > 0.35 && d < mag && !p.dead) {
        const pull = (1 - d / mag) * 260 + 60;
        this.vx = dx / d * pull; this.vy = dy / d * pull;
        this.x += this.vx * dt; this.y += this.vy * dt;
      } else {
        moveEntity(g.L, this, this.vx * dt, this.vy * dt);
        this.vx *= Math.pow(0.05, dt); this.vy *= Math.pow(0.05, dt);
      }
      if (d < 9 && this.t > 0.25 && !p.dead) { g.collect(this); this.dead = true; }
    }
    draw(ctx, cx, cy, t) {
      const blink = this.t > this.life - 5 && this.type !== 'potion' && Math.floor(this.t * 10) % 2 === 0;
      if (blink) return;
      let key;
      if (this.type === 'ember') key = 'pk_ember' + (Math.floor(t * 8 + this.x) & 3);
      else if (this.type === 'embers') key = 'pk_embers' + (Math.floor(t * 8 + this.x) & 3);
      else if (this.type === 'fruit') key = 'pk_fruit';
      else key = 'pk_potion';
      RS.Sprites.draw(ctx, key, this.x - cx, this.y - cy - this.z - Math.sin(t * 4 + this.x) * (this.z === 0 ? 1 : 0));
    }
  }

  // ---- projectiles --------------------------------------------------------------------
  class Projectile extends Entity {
    constructor(x, y, vx, vy, opts) {
      super(x, y);
      this.vx = vx; this.vy = vy;
      this.dmg = opts.dmg || 1;
      this.faction = opts.faction || 'enemy';
      this.spr = opts.spr || 'proj_seed';
      this.frames = opts.frames || 0;
      this.life = opts.life || 3;
      this.radius = opts.radius || 3;
      this.z = opts.z || 6;
      this.shadow = 'shadow_s';
      this.flying = true;
      this.fw = 2; this.fh = 2;
      this.t = 0;
      this.pierce = !!opts.pierce;
      this.onDie = opts.onDie || null;
      this.ignoreWalls = !!opts.ignoreWalls;
    }
    update(dt, g) {
      this.t += dt;
      if (this.t > this.life) { this.die(g); return; }
      this.x += this.vx * dt; this.y += this.vy * dt;
      const tx = Math.floor(this.x / TS), ty = Math.floor(this.y / TS);
      if (!this.ignoreWalls) {
        if (!g.L.inb(tx, ty)) { this.die(g); return; }
        const i = ty * g.L.w + tx;
        const k = g.L.kind[i];
        if (k === K.WALL || k === K.FACE || k === K.DEEP || g.L.solid[i] === 2) { this.die(g); return; }
      }
      if (this.faction === 'enemy') {
        const p = g.player;
        if (!p.dead && Math.hypot(p.x - this.x, (p.y - 6) - (this.y - this.z + 6)) < this.radius + 5) {
          if (g.damagePlayer(this.dmg, this.x, this.y, this)) { if (!this.pierce) this.die(g); }
        }
      }
    }
    die(g) {
      if (this.dead) return;
      this.dead = true;
      g.fx.burst(this.x, this.y - this.z, 5, this.spr.startsWith('proj_orb') ? [P.emb5, P.emb4] : this.spr === 'proj_wisp_0' ? [P.sea8, P.sea6] : [P.moss6, P.moss4], 40);
      if (this.onDie) this.onDie(g, this);
    }
    draw(ctx, cx, cy, t) {
      const key = this.frames ? this.spr + '_' + (Math.floor(t * 10) % this.frames) : this.spr;
      RS.Sprites.draw(ctx, key, this.x - cx, this.y - cy - this.z);
    }
  }

  // ---- particles & floating text --------------------------------------------------------
  class FX {
    constructor() { this.parts = []; this.sprites = []; this.texts = []; }
    clear() { this.parts.length = 0; this.sprites.length = 0; this.texts.length = 0; }
    burst(x, y, n, colors, speed, opts) {
      opts = opts || {};
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = (0.4 + Math.random() * 0.6) * (speed || 60);
        this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - (opts.up || 20), g: opts.grav === undefined ? 90 : opts.grav, life: 0, max: (opts.life || 0.5) * (0.6 + Math.random() * 0.6), c: colors[i % colors.length], s: opts.size || 1 });
      }
    }
    ember(x, y, c) { this.parts.push({ x, y, vx: (Math.random() - 0.5) * 12, vy: -12 - Math.random() * 18, g: -4, life: 0, max: 0.8 + Math.random() * 0.8, c: c || P.emb5, s: 1 }); }
    spr(key, frames, x, y, fps, opts) { this.sprites.push({ key, frames, x, y, fps: fps || 14, t: 0, flip: opts && opts.flip, front: opts && opts.front }); }
    text(x, y, str, color, opts) { this.texts.push({ x, y, str, color: color || P.white, t: 0, max: (opts && opts.life) || 0.8, font: (opts && opts.font) || 'small' }); }
    update(dt) {
      for (const p of this.parts) { p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(0.3, dt); }
      this.parts = this.parts.filter((p) => p.life < p.max);
      for (const s of this.sprites) s.t += dt;
      this.sprites = this.sprites.filter((s) => s.t * s.fps < s.frames);
      for (const t of this.texts) { t.t += dt; t.y -= dt * 18; }
      this.texts = this.texts.filter((t) => t.t < t.max);
    }
    draw(ctx, cx, cy) {
      for (const s of this.sprites) {
        const f = Math.min(s.frames - 1, Math.floor(s.t * s.fps));
        RS.Sprites.draw(ctx, s.key + f, s.x - cx, s.y - cy, { flip: s.flip });
      }
      for (const p of this.parts) {
        ctx.fillStyle = p.c;
        ctx.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), p.s, p.s);
      }
    }
    drawTexts(ctx, cx, cy) {
      for (const t of this.texts) {
        if (t.t > t.max - 0.2 && Math.floor(t.t * 20) % 2) continue;
        RS.Text.draw(ctx, t.str, t.x - cx, t.y - cy, { font: t.font, color: t.color, outline: P.ink0, align: 'center' });
      }
    }
  }

  RS.Entity = Entity;
  RS.Pickup = Pickup;
  RS.Projectile = Projectile;
  RS.FX = FX;
  RS.Phys = { boxFree, moveEntity, updateLevel, lineClear };
})();
