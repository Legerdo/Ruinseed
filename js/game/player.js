// The hero: movement, relic-blade swings, dodge roll with i-frames, hurt/death, potions, interaction.
(function () {
  'use strict';
  const P = RS.PAL;
  const DIRV = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
  const DIRANG = { down: Math.PI / 2, up: -Math.PI / 2, left: Math.PI, right: 0 };
  const SLASHDIR = { down: 0, left: 1, up: 2, right: 3 };

  const ATK_TOTAL = 0.26, ATK_ON = 0.055, ATK_OFF = 0.165;
  const ROLL_TIME = 0.28;

  class Player extends RS.Entity {
    constructor(x, y) {
      super(x, y);
      this.faction = 'player';
      this.fw = 8; this.fh = 5; this.bodyH = 13;
      this.dir = 'down';
      this.state = 'idle';
      this.t = 0; this.anim = 0;
      this.atkT = 0; this.atkCd = 0; this.swing = 0; this.hitSet = new Set();
      this.rollT = 0; this.rollCd = 0; this.rollVx = 0; this.rollVy = 0;
      this.hurtT = 0; this.drinkT = 0; this.cheerT = 0; this.deathT = 0;
      this.buffer = { attack: 0, dodge: 0 };
      this.shadow = 'shadow_hero';
      this.ghosts = [];
      this.blinkT = 2 + Math.random() * 2;
      this.stepT = 0;
      this.locked = false;
      this.moveAmount = 0;
    }
    get stats() { return this.g.stats; }

    faceTo(dx, dy) {
      if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? 'right' : 'left';
      else if (dy !== 0) this.dir = dy > 0 ? 'down' : 'up';
    }

    update(dt, g) {
      this.g = g;
      this.t += dt;
      if (this.inv > 0) this.inv -= dt;
      if (this.atkCd > 0) this.atkCd -= dt;
      if (this.rollCd > 0) this.rollCd -= dt;
      this.buffer.attack = Math.max(0, this.buffer.attack - dt);
      this.buffer.dodge = Math.max(0, this.buffer.dodge - dt);
      this.ghosts = this.ghosts.filter((gh) => (gh.t += dt) < 0.18);
      if (this.state === 'dead') { this.deathT += dt; return; }

      const I = RS.Input;
      const canAct = !this.locked && !g.inputLocked;
      if (canAct) {
        if (I.pressed('attack') || (I.mouse.pressed && g.mouseCombat)) this.buffer.attack = 0.14;
        if (I.pressed('dodge') || (I.mouse.rpressed && g.mouseCombat)) this.buffer.dodge = 0.14;
      }
      let mv = canAct ? I.moveVector() : { x: 0, y: 0 };
      const ml = Math.hypot(mv.x, mv.y);
      if (ml > 1) { mv.x /= ml; mv.y /= ml; }
      this.moveAmount = ml;
      const L = g.L;
      const speed = this.stats.speed;

      // knockback always applies
      if (this.kx || this.ky) {
        RS.Phys.moveEntity(L, this, this.kx * dt, this.ky * dt);
        this.kx *= Math.pow(0.001, dt); this.ky *= Math.pow(0.001, dt);
        if (Math.abs(this.kx) < 4) this.kx = 0;
        if (Math.abs(this.ky) < 4) this.ky = 0;
      }

      switch (this.state) {
        case 'hurt':
          this.hurtT -= dt;
          if (this.hurtT <= 0) this.state = 'idle';
          break;
        case 'drink':
          this.drinkT -= dt;
          if (this.drinkT <= 0) {
            this.hp = Math.min(this.maxHp, this.hp + 4);
            g.fx.burst(this.x, this.y - 10, 14, [P.emb6, P.emb5, P.heartLight], 50, { up: 30 });
            g.fx.text(this.x, this.y - 22, '+2', P.heartLight);
            RS.Audio && RS.Audio.sfx('heal');
            this.state = 'idle';
          }
          break;
        case 'cheer':
          this.cheerT -= dt;
          if (this.cheerT <= 0) this.state = 'idle';
          break;
        case 'roll': {
          this.rollT += dt;
          const r = RS.Phys.moveEntity(L, this, this.rollVx * dt, this.rollVy * dt, 3);
          if (Math.floor(this.rollT / 0.045) !== Math.floor((this.rollT - dt) / 0.045)) this.ghosts.push({ x: this.x, y: this.y, f: Math.floor(this.rollT * 16) & 3, t: 0 });
          if (this.rollT >= ROLL_TIME || (r.hitX && r.hitY)) {
            this.state = 'idle';
            this.rollCd = this.stats.dodgeCd;
            g.fx.spr('fx_dust_', 4, this.x, this.y, 16);
          }
          break;
        }
        case 'attack': {
          const prev = this.atkT;
          this.atkT += dt;
          // slight lunge during the strike
          const [fx, fy] = DIRV[this.dir];
          const lunge = this.atkT > ATK_ON && this.atkT < ATK_OFF ? 26 : 0;
          RS.Phys.moveEntity(L, this, (mv.x * speed * 0.25 + fx * lunge) * dt, (mv.y * speed * 0.25 + fy * lunge) * dt, 2);
          if (this.atkT >= ATK_ON && this.atkT <= ATK_OFF + 0.01) g.playerStrike(this);
          if (prev < ATK_ON && this.atkT >= ATK_ON) { RS.Audio && RS.Audio.sfx('swing'); }
          // dodge may cancel the follow-through
          if (this.atkT > ATK_OFF && this.buffer.dodge > 0 && this.rollCd <= 0) { this.startRoll(mv, g); break; }
          if (this.atkT >= ATK_TOTAL) this.state = 'idle';
          break;
        }
        default: {
          // idle / walk
          if (this.buffer.dodge > 0 && this.rollCd <= 0) { this.startRoll(mv, g); break; }
          if (this.buffer.attack > 0 && this.atkCd <= 0) { this.startAttack(mv); break; }
          if (canAct && RS.Input.pressed('potion')) this.tryPotion(g);
          if (ml > 0.1) {
            this.faceTo(mv.x, mv.y);
            RS.Phys.moveEntity(L, this, mv.x * speed * dt, mv.y * speed * dt, 5);
            this.state = 'walk';
            this.anim += dt * (speed / 70) * 8;
            this.stepT -= dt;
            if (this.stepT <= 0) { this.stepT = 0.3; g.onStep(this); }
          } else {
            this.state = 'idle';
            this.anim += dt * 1.6;
          }
        }
      }
      this.blinkT -= dt;
      if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3;
    }

    startAttack(mv) {
      if (mv && Math.hypot(mv.x, mv.y) > 0.3) this.faceTo(mv.x, mv.y);
      this.state = 'attack';
      this.atkT = 0;
      this.atkCd = this.stats.atkCd;
      this.swing++;
      this.hitSet.clear();
      this.buffer.attack = 0;
    }
    startRoll(mv, g) {
      let dx = mv.x, dy = mv.y;
      if (Math.hypot(dx, dy) < 0.2) [dx, dy] = DIRV[this.dir];
      const l = Math.hypot(dx, dy) || 1;
      dx /= l; dy /= l;
      this.faceTo(dx, dy);
      const sp = this.stats.dodgeDist / ROLL_TIME;
      this.rollVx = dx * sp; this.rollVy = dy * sp;
      this.state = 'roll'; this.rollT = 0;
      this.buffer.dodge = 0;
      this.inv = Math.max(this.inv, ROLL_TIME + 0.04);
      g.fx.spr('fx_dust_', 4, this.x - dx * 4, this.y, 16);
      RS.Audio && RS.Audio.sfx('dodge');
      g.onFirstDodge && g.onFirstDodge();
    }
    tryPotion(g) {
      if (g.run.potions <= 0) { g.toast(RS.T.hud.noPotion, P.bone5); return; }
      if (this.hp >= this.maxHp) { g.toast(RS.T.hud.fullHp, P.bone5); return; }
      g.run.potions--;
      this.state = 'drink';
      this.drinkT = 0.45;
      RS.Audio && RS.Audio.sfx('drink');
    }
    hurt(dmg, fromX, fromY, g, knock) {
      if (this.dead || this.state === 'dead') return false;
      if (this.inv > 0 || g.godMode) {
        return false;
      }
      this.hp -= dmg;
      this.inv = 1.0;
      const dx = this.x - fromX, dy = this.y - fromY;
      const d = Math.hypot(dx, dy) || 1;
      const kb = knock === undefined ? 150 : knock;
      this.kx = dx / d * kb; this.ky = dy / d * kb;
      if (this.state !== 'roll') { this.state = 'hurt'; this.hurtT = 0.22; }
      g.hitStop(0.07);
      g.shake(3, 0.2);
      g.flashScreen(P.heart, 0.18);
      g.fx.burst(this.x, this.y - 8, 8, [P.heartLight, P.heart, P.white], 70);
      RS.Audio && RS.Audio.sfx('hurt');
      if (this.hp <= 0) {
        this.hp = 0;
        this.state = 'dead';
        this.deathT = 0;
        this.kx = this.ky = 0;
        g.onPlayerDeath();
      }
      return true;
    }
    cheer(t) { this.state = 'cheer'; this.cheerT = t || 1.4; this.dir = 'down'; }

    // blade angle during the swing (screen radians)
    bladeAngle() {
      const base = DIRANG[this.dir];
      const side = (this.swing % 2) ? 1 : -1;
      const t = this.atkT;
      let k;
      if (t < ATK_ON) k = -1.0 - (t / ATK_ON) * 0.25;
      else if (t < ATK_OFF) k = -1.25 + ((t - ATK_ON) / (ATK_OFF - ATK_ON)) * 2.4;
      else k = 1.15 + Math.min(1, (t - ATK_OFF) / 0.1) * 0.1;
      return base + side * k * 1.05;
    }

    draw(ctx, cx, cy, time) {
      const g = this.g;
      const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
      // roll afterimages
      for (const gh of this.ghosts) {
        ctx.globalAlpha = 0.35 * (1 - gh.t / 0.18);
        RS.Sprites.draw(ctx, 'hero_roll_' + gh.f, gh.x - cx, gh.y - cy);
      }
      ctx.globalAlpha = 1;
      if (this.state === 'dead') {
        const f = this.deathT < 0.35 ? 0 : this.deathT < 1.2 ? 1 : 2;
        if (this.deathT < 2.2) RS.Sprites.draw(ctx, 'hero_death_' + f, x, y);
        return;
      }
      const flashing = this.inv > 0 && this.state !== 'roll' && Math.floor(this.inv * 18) % 2 === 0;
      const dirKey = this.dir === 'left' || this.dir === 'right' ? 'side' : this.dir;
      const flip = this.dir === 'left';
      let key;
      switch (this.state) {
        case 'roll': key = 'hero_roll_' + (Math.floor(this.rollT * 16) & 3); break;
        case 'attack': key = 'hero_' + dirKey + '_atk_' + (this.atkT < ATK_ON ? 0 : 1); break;
        case 'hurt': key = 'hero_' + dirKey + '_hurt'; break;
        case 'cheer': key = 'hero_cheer'; break;
        case 'drink': key = 'hero_down_idle_1'; break;
        case 'walk': key = 'hero_' + dirKey + '_walk_' + (Math.floor(this.anim) & 3); break;
        default:
          key = 'hero_' + dirKey + '_idle_' + (Math.floor(this.anim) & 1);
          if (dirKey === 'down' && this.blinkT < 0) key = 'hero_down_blink';
      }
      const bladeBehind = this.state === 'attack' && (this.dir === 'up' || (this.dir !== 'down' && this.bladeAngle() < -0.3));
      if (this.state === 'attack' && bladeBehind) this.drawBlade(ctx, x, y);
      RS.Sprites.draw(ctx, key, x, y, { flip, white: flashing && this.state === 'hurt' });
      if (flashing && this.state !== 'hurt') {
        ctx.globalAlpha = 0.5;
        RS.Sprites.draw(ctx, key, x, y, { flip, white: true });
        ctx.globalAlpha = 1;
      }
      if (this.state === 'attack' && !bladeBehind) this.drawBlade(ctx, x, y);
      if (this.state === 'cheer' && g && g.cheerSigil) {
        RS.Sprites.draw(ctx, 'sigil_' + g.cheerSigil, x - 7, y - 36 + Math.sin(time * 4) * 1.5 - 0);
      }
      if (this.state === 'drink') {
        RS.Sprites.draw(ctx, 'icon_potion', x - 4, y - 24);
      }
    }
    drawBlade(ctx, x, y) {
      const a = this.bladeAngle();
      const k = ((Math.round(a / (Math.PI * 2) * 16) % 16) + 16) % 16;
      const active = this.atkT >= ATK_ON && this.atkT <= ATK_OFF;
      const [fx, fy] = DIRV[this.dir];
      const hx = x + fx * 3, hy = y - 7 + fy * 2;
      // smear arc
      if (this.atkT >= ATK_ON - 0.01) {
        const st = this.atkT < ATK_ON + 0.04 ? 0 : this.atkT < ATK_OFF ? 1 : 2;
        const flipArc = (this.swing % 2) === 0 && (this.dir === 'up' || this.dir === 'down');
        RS.Sprites.draw(ctx, 'slash_' + SLASHDIR[this.dir] + '_' + st, hx + fx * 2, hy + fy * 2, { flip: flipArc, alpha: st === 2 ? 0.7 : 0.95 });
      }
      RS.Sprites.draw(ctx, (active ? 'bladeG_' : 'blade_') + k, hx, hy);
    }
  }

  RS.Player = Player;
  RS.PlayerConst = { ATK_TOTAL, ATK_ON, ATK_OFF, DIRV, DIRANG };
})();
