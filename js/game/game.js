// A single run: world + dungeons + arena, player, combat resolution, interaction, objectives,
// transitions, camera and render orchestration.
(function () {
  'use strict';
  const TS = RS.TS, K = RS.K, P = RS.PAL, T = RS.T;
  const THEMES = ['moss', 'tide', 'ember'];

  function computeStats(up) {
    return {
      maxHp: 6 + up.hp * 2,
      damage: 2 + up.blade,
      speed: 76 * (1 + 0.08 * up.speed),
      dodgeDist: 60 * (1 + 0.18 * up.dodgeDist),
      dodgeCd: 0.78 * (1 - 0.15 * up.dodgeCd),
      atkCd: 0.34,
      magnet: 30 + 18 * up.magnet,
      potions: 1 + up.potion
    };
  }

  class Game {
    constructor(opts) {
      this.seed = opts.seed;
      this.attempt = opts.attempt || 1;
      this.world = opts.world;
      this.save = RS.Save.data;
      this.stats = computeStats(this.save.upgrades);
      this.godMode = !!this.save.cheats.godMode;
      this.fx = new RS.FX();
      this.time = 0; this.runTime = 0;
      this.camX = 0; this.camY = 0; this.shakeA = 0; this.shakeT = 0; this.stopT = 0;
      this.flash = null;
      this.toasts = [];
      this.banner = null;
      this.hint = null; this.hintsShown = new Set();
      this.dialog = null;
      this.trans = null;
      this.inputLocked = false;
      this.mouseCombat = true;
      this.levels = { overworld: this.world.level };
      this.dungeonData = [null, null, null];
      this.arena = null;
      const resume = opts.resume || null;
      this.run = {
        sigils: resume ? resume.sigils.slice() : [],
        earned: resume ? resume.earned : 0,
        potions: resume ? resume.potions : this.stats.potions,
        opened: new Set(resume ? resume.opened : []),
        talked: resume ? true : false,
        tipIdx: 0
      };
      this.runTime = resume ? resume.time : 0;
      this.player = new RS.Player(0, 0);
      this.player.g = this;
      this.player.maxHp = this.stats.maxHp;
      this.player.hp = resume ? Math.min(this.stats.maxHp, Math.max(2, resume.hp)) : this.stats.maxHp;
      this.over = false;
      this.victory = false;
      RS.Spawn.populateOverworld(this);
      this.explored = { overworld: new Uint8Array(this.world.level.w * this.world.level.h) };
      if (resume && resume.explored) this.decodeExplored(resume.explored);
      this.enterLevel('overworld', this.campSpawn(), true);
      this.lastRegion = -1;
      this.regionSeen = new Set();
      this.checkpoint = 'camp';
      if (!resume) this.showHint('move', T.fmt(T.hint.move, { keys: 'WASD/방향키' }), 7);
      RS.Audio && RS.Audio.playMusic('overworld');
      this.saveRun();
    }

    get L() { return this.level; }

    campSpawn() {
      const c = this.world.camp;
      const L = this.world.level;
      const t = this.findFree(L, c.tx, c.ty + 1, L.hgt[(c.ty + 1) * L.w + c.tx]);
      return { x: t.x * TS + 8, y: t.y * TS + 12 };
    }
    // nearest walkable tile (spiral search) at a given height
    findFree(L, tx, ty, h) {
      for (let r = 0; r < 8; r++) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = tx + dx, y = ty + dy;
          if (!L.inb(x, y)) continue;
          const i = y * L.w + x;
          if (L.solid[i] === 0 && (L.kind[i] === K.FLOOR || L.kind[i] === K.BRIDGE) && (h === undefined || L.hgt[i] === h)) return { x, y };
        }
      }
      return { x: tx, y: ty };
    }

    // ---- level management ----------------------------------------------------------
    enterLevel(name, pos, instant) {
      let L;
      if (name === 'overworld') L = this.world.level;
      else if (name.startsWith('dungeon')) L = this.getDungeon(+name.slice(7)).level;
      else if (name === 'arena') L = this.getArena().level;
      this.levelName = name;
      this.level = L;
      if (!L.entities) L.entities = [];
      if (!this.explored[name]) this.explored[name] = new Uint8Array(L.w * L.h);
      RS.Terrain.prepare(L);
      const p = this.player;
      p.x = pos.x; p.y = pos.y;
      p.kx = p.ky = 0;
      p.stair = null;
      const ti = Math.floor((p.y - 2) / TS) * L.w + Math.floor(p.x / TS);
      p.level = L.hgt[ti] || 1;
      RS.Phys.updateLevel(L, p);
      this.fx.clear();
      this.hint = null;
      this.snapCamera();
      if (!instant) RS.Audio && RS.Audio.sfx('enter');
      if (name === 'overworld') RS.Audio && RS.Audio.playMusic(this.run.sigils.length >= 3 ? 'overworld2' : 'overworld');
      else if (name === 'arena') RS.Audio && RS.Audio.playMusic('lair');
      else RS.Audio && RS.Audio.playMusic('dungeon');
      RS.Audio && RS.Audio.setAmbient(name === 'overworld' ? 'overworld' : 'dungeon');
    }

    getDungeon(i) {
      if (!this.dungeonData[i]) {
        const dg = this.world.dungeons[i];
        const d = RS.generateDungeon(this.seed, i, dg.theme, dg.tier);
        RS.Spawn.populateDungeon(this, d, i);
        this.dungeonData[i] = d;
        if (this.run.sigils.includes(i)) { d.sigilTaken = true; d.sealOpen = true; RS.DungeonRuntime.openSeal(this, d, true); }
      }
      return this.dungeonData[i];
    }
    getArena() {
      if (!this.arena) { this.arena = RS.generateArena(this.seed); RS.Spawn.populateArena(this, this.arena); }
      return this.arena;
    }

    transition(fn, color) {
      if (this.trans) return;
      this.trans = { t: 0, dur: 0.9, fn, done: false, color: color || P.black };
      this.inputLocked = true;
    }

    enterDungeon(i) {
      const dg = this.world.dungeons[i];
      this.transition(() => {
        const d = this.getDungeon(i);
        this.enterLevel('dungeon' + i, d.entryPos);
        this.checkpoint = 'd' + i;
        const name = T.dungeons[dg.theme].name;
        this.showBanner(name, this.run.sigils.includes(i) ? T.dungeonState.cleared : T.dungeons[dg.theme].sigil);
        this.showHint('exit', T.hint.exit, 6);
        this.saveRun();
      });
    }
    exitDungeon() {
      const i = +this.levelName.slice(7);
      const dg = this.world.dungeons[i];
      this.transition(() => {
        this.enterLevel('overworld', { x: dg.approach.tx * TS + 8 + (dg.style === 'cave' ? 8 : 0), y: dg.approach.ty * TS + 14 });
        this.player.dir = 'down';
        this.checkpoint = 'camp';
        this.saveRun();
        if (this.run.sigils.length >= 3) this.showBanner(T.lairName, T.fmt(T.obj.toLair, { region: this.world.regions[this.world.lair].name }));
      });
    }
    enterArena() {
      this.transition(() => {
        const a = this.getArena();
        this.enterLevel('arena', a.entryPos);
        this.showBanner(T.lairName, T.guardian);
      });
    }

    // ---- camera & effects -----------------------------------------------------------
    snapCamera() {
      const W = RS.App.W, H = RS.App.H;
      this.camX = this.player.x - W / 2; this.camY = this.player.y - 8 - H / 2;
      this.clampCamera();
    }
    clampCamera() {
      const W = RS.App.W, H = RS.App.H, L = this.level;
      const mw = L.w * TS, mh = L.h * TS;
      if (mw <= W) this.camX = (mw - W) / 2; else this.camX = RS.M.clamp(this.camX, 0, mw - W);
      if (mh <= H) this.camY = (mh - H) / 2; else this.camY = RS.M.clamp(this.camY, 0, mh - H);
    }
    shake(a, t) { if (!this.save.settings.shake) return; this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, t); }
    hitStop(t) { this.stopT = Math.max(this.stopT, t); }
    flashScreen(color, t) { this.flash = { color, t, max: t }; }
    toast(text, color, sub) {
      this.toasts.push({ text, color: color || P.gold4, sub, t: 0, max: 2.6 });
      if (this.toasts.length > 4) this.toasts.shift();
    }
    showBanner(title, sub) { this.banner = { title, sub, t: 0, max: 3.6 }; }
    showHint(id, text, dur) {
      if (!this.save.settings.hints) return;
      if (this.hintsShown.has(id)) return;
      this.hintsShown.add(id);
      this.hint = { id, text, t: 0, max: dur || 6 };
    }
    clearHint(id) { if (this.hint && this.hint.id === id) this.hint.t = Math.max(this.hint.t, this.hint.max - 0.4); }

    // ---- combat ---------------------------------------------------------------------
    playerStrike(p) {
      const [fx, fy] = RS.PlayerConst.DIRV[p.dir];
      const ax = p.x + fx * 9, ay = p.y - 7 + fy * 8;
      const reach = 17;
      const ents = this.level.entities;
      for (const e of ents) {
        if (e.dead || !e.hittable || p.hitSet.has(e)) continue;
        const ex = e.x, ey = e.y - (e.bodyH || 10) / 2;
        const dx = ex - (p.x), dy = ey - (p.y - 7);
        const d = Math.hypot(ex - ax, ey - ay);
        const rad = e.radius || 6;
        if (d > reach + rad) continue;
        const along = dx * fx + dy * fy;
        if (along < -4 && Math.hypot(dx, dy) > 8) continue;
        p.hitSet.add(e);
        const dmg = this.stats.damage;
        e.hurt(dmg, p.x, p.y - 6, this);
      }
      // cut bushes, tall grass and breakable objects
      const objs = this.level.objectsNear(ax - 24, ay - 24, ax + 24, ay + 24);
      for (const o of objs) {
        if (!o.cut || o.dead || p.hitSet.has(o)) continue;
        if (Math.hypot(o.x - ax, (o.y - 6) - ay) > reach + 5) continue;
        p.hitSet.add(o);
        this.cutObject(o);
      }
      const anim = this.level.anim;
      if (anim && this.level._animGrid) {
        const k = ((ay / 128) | 0) * 4096 + ((ax / 128) | 0);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const b = this.level._animGrid.get(k + oy * 4096 + ox);
          if (!b) continue;
          for (const a of b) {
            if (a.dead || !a.cut) continue;
            if (Math.hypot(a.x - ax, (a.y - 4) - ay) > reach + 3) continue;
            a.dead = true;
            this.fx.burst(a.x, a.y - 5, 7, [P.moss6, P.moss5, P.moss7], 60);
            for (let q = 0; q < 3; q++) this.fx.spr('fx_leaf_', 3, a.x + (Math.random() * 8 - 4), a.y - 6 - Math.random() * 4, 6);
            RS.Audio && RS.Audio.sfx('grass');
            RS.Spawn.grassDrop(this, a.x, a.y - 3);
            this.clearHint('cut');
          }
        }
      }
    }
    cutObject(o) {
      this.level.removeObject(o);
      this.fx.burst(o.x, o.y - 8, 14, [P.moss6, P.moss4, P.moss7, P.moss3], 80);
      for (let q = 0; q < 5; q++) this.fx.spr('fx_leaf_', 3, o.x + Math.random() * 12 - 6, o.y - 10 - Math.random() * 6, 5);
      RS.Audio && RS.Audio.sfx('bush');
      RS.Spawn.bushDrop(this, o.x, o.y - 4, !!o.hidden);
    }
    damagePlayer(dmg, x, y, src, knock) {
      const ok = this.player.hurt(dmg, x, y, this, knock);
      if (ok && !this.hintsShown.has('dodge')) this.showHint('dodge', T.fmt(T.hint.dodge, { key: RS.Input.keyLabel('dodge') }), 6);
      return ok;
    }
    collect(pk) {
      if (pk.type === 'ember' || pk.type === 'embers') {
        const v = pk.value;
        this.run.earned += v;
        this.save.currency += v;
        this.save.totalEarned += v;
        RS.Save.save();
        this.fx.text(pk.x, pk.y - 10, '+' + v, P.emb6);
        RS.Audio && RS.Audio.sfx(v > 1 ? 'coins' : 'coin');
      } else if (pk.type === 'fruit') {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
        this.fx.text(pk.x, pk.y - 10, T.hud.gotFruit, P.heartLight);
        this.fx.burst(pk.x, pk.y - 6, 8, [P.heartLight, P.heart], 50);
        RS.Audio && RS.Audio.sfx('heal');
      } else if (pk.type === 'potion') {
        this.run.potions = Math.min(5, this.run.potions + 1);
        this.toast(T.hud.gotPotion, P.emb5);
        RS.Audio && RS.Audio.sfx('pickup');
      }
    }
    spawnPickup(x, y, type, value) {
      const pk = new RS.Pickup(x, y, type, value);
      pk.level = this.player.level;
      this.level.entities.push(pk);
      return pk;
    }
    addEntity(e) { this.level.entities.push(e); return e; }

    // BFS flow field toward the player (shared by chasing enemies), refreshed a few times per second
    computeFlow() {
      const L = this.level, p = this.player, W = L.w, N = L.w * L.h;
      if (!this.flowD || this.flowD.length !== N) { this.flowD = new Int16Array(N); this.flowG = new Int32Array(N); this.flowGen = 0; this.flowQ = new Int32Array(N); }
      const gen = ++this.flowGen;
      const sx = Math.floor(p.x / TS), sy = Math.floor((p.y - 3) / TS);
      if (!L.inb(sx, sy)) return;
      const R = 22, q = this.flowQ;
      let h = 0, t = 0;
      const s0 = sy * W + sx;
      this.flowG[s0] = gen; this.flowD[s0] = 0; q[t++] = s0;
      const lvl = p.level;
      while (h < t) {
        const c = q[h++];
        const d = this.flowD[c];
        if (d >= R) continue;
        const cx = c % W, cy = (c / W) | 0;
        for (let k = 0; k < 4; k++) {
          const nx = cx + RS.DIRS4[k][0], ny = cy + RS.DIRS4[k][1];
          if (!L.inb(nx, ny)) continue;
          const n = ny * W + nx;
          if (this.flowG[n] === gen) continue;
          if (L.solid[n]) continue;
          const kk = L.kind[n];
          if (kk !== K.FLOOR && kk !== K.BRIDGE && kk !== K.STAIRS) continue;
          if (kk !== K.STAIRS && L.kind[c] !== K.STAIRS && L.hgt[n] !== L.hgt[c]) continue;
          this.flowG[n] = gen; this.flowD[n] = d + 1; q[t++] = n;
        }
      }
      void lvl;
    }
    flowDir(e) {
      if (!this.flowD || e.flying) return null;
      const L = this.level, W = L.w;
      const tx = Math.floor(e.x / TS), ty = Math.floor((e.y - 3) / TS);
      if (!L.inb(tx, ty)) return null;
      const i = ty * W + tx;
      if (this.flowG[i] !== this.flowGen) return null;
      const d0 = this.flowD[i];
      const p = this.player;
      if (d0 <= 1) { const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; }
      let best = -1, bd = d0;
      for (let k = 0; k < 4; k++) {
        const nx = tx + RS.DIRS4[k][0], ny = ty + RS.DIRS4[k][1];
        if (!L.inb(nx, ny)) continue;
        const n = ny * W + nx;
        if (this.flowG[n] === this.flowGen && this.flowD[n] < bd) { bd = this.flowD[n]; best = n; }
      }
      if (best < 0) return null;
      const bx = (best % W) * TS + 8, by = ((best / W) | 0) * TS + 12;
      const dx = bx - e.x, dy = by - e.y, d = Math.hypot(dx, dy) || 1;
      return [dx / d, dy / d];
    }

    onStep(p) {
      // dust on paths, splashes near water are cheap flavour
      if (Math.random() < 0.3) this.fx.burst(p.x, p.y - 1, 1, [P.bone4], 8, { up: 4, grav: 10, life: 0.3 });
    }
    onFirstDodge() { this.clearHint('dodge'); }

    onPlayerDeath() {
      if (this.over) return;
      this.over = true;
      this.save.stats.defeats++;
      RS.Save.save();
      RS.Audio && RS.Audio.stopMusic(0.6);
      RS.Audio && RS.Audio.sfx('death');
      this.deathTimer = 2.4;
    }

    // ---- interaction ----------------------------------------------------------------
    findInteract() {
      const p = this.player;
      const [fx, fy] = RS.PlayerConst.DIRV[p.dir];
      const px = p.x + fx * 6, py = p.y - 4 + fy * 6;
      let best = null, bd = 22;
      for (const e of this.level.entities) {
        if (!e.interact || e.dead) continue;
        const d = Math.hypot(e.x - px, (e.y - 4) - py);
        if (d < bd) { bd = d; best = e; }
      }
      const objs = this.level.objectsNear(p.x - 40, p.y - 40, p.x + 40, p.y + 40);
      for (const o of objs) {
        if (!o.interact || o.dead) continue;
        const d = Math.hypot(o.x - px, (o.y - 6) - py);
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    }
    promptFor(t) {
      if (!t) return null;
      const it = t.interact;
      const pr = T.prompt;
      switch (it.type) {
        case 'sign': case 'tablet': return pr.read;
        case 'npc': return pr.talk;
        case 'chest': return pr.open;
        case 'brazier': return it.done ? null : pr.light;
        case 'lever': return it.done ? null : pr.pull;
        case 'pedestal': return it.done ? null : pr.take;
        case 'exit': return pr.exit;
        case 'lairgate': return pr.inspect;
        default: return pr.inspect;
      }
    }
    interact(t) {
      const it = t.interact;
      if (it.type === 'sign') this.openSign(it);
      else if (it.type === 'tablet') this.openTablet(it);
      else if (it.type === 'npc') this.talkKeeper(t);
      else if (it.type === 'chest') this.openChest(t);
      else if (it.type === 'lairgate') this.inspectGate(t);
      else if (RS.DungeonRuntime && RS.DungeonRuntime.interact(this, t)) { /* handled */ }
    }
    openSign(it) {
      const lines = it.lines.map((l) => {
        const arrow = T.dirs[l.dir] || '';
        if (l.here) return T.fmt(T.sign.here, { name: l.name });
        return arrow + ' ' + T.fmt(l.dungeon !== undefined ? T.sign.dungeon : T.sign.toward, { dir: l.dir, name: l.name });
      });
      this.openDialog(T.sign.title, [lines.join('\n')]);
    }
    openTablet(it) {
      if (it.key === 'tutorial') this.openDialog(T.tablet.tutorialTitle, T.tablet.tutorial);
      else if (it.key === 'dungeon') {
        const dg = this.world.dungeons[it.dungeon];
        const D = T.dungeons[dg.theme];
        const pages = this.run.sigils.includes(it.dungeon) ? [T.fmt(T.tablet.dungeonDone, { sigil: D.sigil })] : [T.fmt(T.tablet.dungeon, { dungeon: D.name, sigil: D.sigil, mech: D.mech }), T.tablet.dungeonExit];
        this.openDialog(T.tablet.dungeonTitle, pages);
      } else {
        const arr = T.tablet.lore[it.biome] || T.tablet.lore.camp;
        this.openDialog(T.tablet.loreTitle, [arr[it.idx % arr.length]]);
      }
    }
    talkKeeper(npc) {
      const K2 = T.keeper;
      const near = this.nearestDungeon(npc.x, npc.y);
      const dirInfo = near ? { dir: RS.dirWord(near.approach.tx * TS - npc.x, near.approach.ty * TS - npc.y), region: this.world.regions[near.region].name, dungeon: T.dungeons[near.theme].name } : {};
      const keys = { map: RS.Input.keyLabel('map'), atk: RS.Input.keyLabel('attack'), dodge: RS.Input.keyLabel('dodge'), potion: RS.Input.keyLabel('potion') };
      let pages;
      const n = this.run.sigils.length;
      if (!this.run.talked) {
        pages = K2.first.map((s) => T.fmt(s, Object.assign({}, dirInfo, keys)));
        this.run.talked = true;
        this.clearHint('talk');
      } else if (n >= 3) {
        pages = [T.fmt(K2.afterAll, { region: this.world.regions[this.world.lair].name })];
      } else if (n >= 1 && !this.run.saidAfter) {
        this.run.saidAfter = true;
        pages = [T.fmt(K2.afterOne, Object.assign({ n: 3 - n }, dirInfo))];
      } else {
        pages = [T.fmt(K2.tips[this.run.tipIdx % K2.tips.length], keys)];
        this.run.tipIdx++;
      }
      this.openDialog(K2.name, pages);
      RS.Audio && RS.Audio.sfx('talk');
    }
    openChest(o) {
      if (o.interact.done) return;
      o.interact.done = true;
      o.spr = 'chest_open';
      this.run.opened.add(o.chestId);
      const c = o.contents || { type: 'embers', value: 20 };
      RS.Audio && RS.Audio.sfx('chest');
      this.fx.burst(o.x, o.y - 10, 16, [P.gold5, P.gold4, P.emb6], 70, { up: 40 });
      if (c.type === 'embers') {
        let left = c.value;
        while (left > 0) { const v = left >= 5 ? 5 : 1; this.spawnPickup(o.x, o.y - 6, v > 1 ? 'embers' : 'ember', v); left -= v; }
        this.toast(T.fmt(T.toast.chest, { n: c.value }), P.gold4);
      } else if (c.type === 'fruit') { this.spawnPickup(o.x, o.y - 6, 'fruit', 1); this.toast(T.toast.chestFruit, P.heartLight); }
      else { this.spawnPickup(o.x, o.y - 6, 'potion', 1); this.toast(T.toast.chestPotion, P.emb5); }
      this.saveRun();
    }
    inspectGate(o) {
      const n = this.run.sigils.length;
      if (n < 3) this.openDialog(T.lairName, [T.fmt(T.toast.gateSealed, { n })]);
    }
    openDialog(name, pages, onClose) {
      this.dialog = { name, pages, page: 0, chars: 0, onClose };
      RS.App.pushModal(new RS.UI.DialogModal(this));
    }

    nearestDungeon(x, y) {
      let best = null, bd = 1e18;
      for (const dg of this.world.dungeons) {
        if (this.run.sigils.includes(dg.index)) continue;
        const d = RS.M.dist2(x, y, dg.approach.tx * TS, dg.approach.ty * TS);
        if (d < bd) { bd = d; best = dg; }
      }
      return best;
    }

    // current objective {text, x, y}
    objective() {
      const p = this.player;
      const n = this.run.sigils.length;
      if (this.levelName === 'arena') return { text: T.obj.fight, x: null, y: null };
      if (this.levelName.startsWith('dungeon')) {
        const i = +this.levelName.slice(7);
        const d = this.dungeonData[i];
        return RS.DungeonRuntime.objective(this, d, i);
      }
      if (!this.run.talked && this.keeper) return { text: T.obj.talkKeeper, x: this.keeper.x, y: this.keeper.y - 8 };
      if (n >= 3) {
        const ls = this.world.lairSite;
        return { text: T.fmt(T.obj.toLair, { region: this.world.regions[this.world.lair].name }), x: ls.gateX * TS + 8, y: ls.gateY * TS + 8 };
      }
      const dg = this.nearestDungeon(p.x, p.y);
      if (!dg) return { text: '', x: null, y: null };
      const D = T.dungeons[dg.theme];
      return { text: T.fmt(T.obj.findSigil, { dungeon: D.name, sigil: D.sigil }), sub: T.fmt(T.obj.remain, { n: 3 - n }), x: dg.approach.tx * TS + 8, y: dg.approach.ty * TS };
    }

    collectSigil(i) {
      if (this.run.sigils.includes(i)) return;
      this.run.sigils.push(i);
      const theme = this.world.dungeons[i].theme;
      const D = T.dungeons[theme];
      this.cheerSigil = theme;
      this.player.cheer(1.8);
      this.flashScreen(P.white, 0.5);
      this.shake(4, 0.4);
      this.toast(T.fmt(T.toast.sigil, { sigil: D.sigil }), P.gold5, T.fmt(T.toast.sigilCount, { n: this.run.sigils.length }));
      RS.Audio && RS.Audio.sfx('sigil');
      RS.Audio && RS.Audio.duckMusic(2.2);
      this.fx.burst(this.player.x, this.player.y - 16, 40, theme === 'moss' ? [P.rootGlow, P.moss7, P.white] : theme === 'tide' ? [P.tideGlow, P.sea8, P.white] : [P.emberGlow, P.emb6, P.white], 110, { up: 40, life: 0.9 });
      if (this.run.sigils.length >= 3) {
        const lo = this.world.lairSite.obj;
        if (lo) RS.Spawn.openLairGate(this, lo);
      }
      this.saveRun();
    }

    // ---- save checkpoint ---------------------------------------------------------------
    encodeExplored() {
      const ex = this.explored.overworld;
      // run-length encode of 4x4 blocks
      const L = this.world.level;
      const bw = Math.ceil(L.w / 4), bh = Math.ceil(L.h / 4);
      let s = '';
      for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
        let any = 0;
        for (let y = by * 4; y < Math.min(L.h, by * 4 + 4) && !any; y++) for (let x = bx * 4; x < Math.min(L.w, bx * 4 + 4); x++) if (ex[y * L.w + x]) { any = 1; break; }
        s += any ? '1' : '0';
      }
      return s.replace(/(0+|1+)/g, (m) => m[0] + m.length.toString(36) + '.');
    }
    decodeExplored(str) {
      try {
        const L = this.world.level;
        const bw = Math.ceil(L.w / 4);
        let bits = '';
        for (const part of str.split('.')) { if (!part) continue; const c = part[0]; const n = parseInt(part.slice(1), 36); if (!(n > 0 && n < 100000)) continue; bits += c.repeat(n); }
        const ex = this.explored.overworld;
        for (let k = 0; k < bits.length; k++) {
          if (bits[k] !== '1') continue;
          const bx = k % bw, by = (k / bw) | 0;
          for (let y = by * 4; y < Math.min(L.h, by * 4 + 4); y++) for (let x = bx * 4; x < Math.min(L.w, bx * 4 + 4); x++) ex[y * L.w + x] = 1;
        }
      } catch (e) { /* ignore corrupt explored data */ }
    }
    saveRun() {
      if (this.over) { this.save.run = null; RS.Save.save(); return; }
      this.save.run = {
        seed: this.seed, attempt: this.attempt, sigils: this.run.sigils.slice(), time: this.runTime, earned: this.run.earned,
        hp: this.player.hp, potions: this.run.potions, checkpoint: this.checkpoint, opened: [...this.run.opened], explored: this.encodeExplored()
      };
      RS.Save.save();
    }

    // ---- update -------------------------------------------------------------------------
    update(dt) {
      this.time += dt;
      if (this.trans) {
        const tr = this.trans;
        tr.t += dt;
        if (!tr.done && tr.t >= tr.dur / 2) { tr.done = true; tr.fn(); }
        if (tr.t >= tr.dur) { this.trans = null; this.inputLocked = false; }
        if (!tr.done) { this.fx.update(dt); return; }
      }
      if (this.over) {
        this.deathTimer -= dt;
        this.player.update(dt, this);
        this.fx.update(dt);
        if (this.deathTimer <= 0 && !this.defeatShown) {
          this.defeatShown = true;
          this.save.run = null;
          RS.Save.saveNow();
          RS.App.setScene('defeat', { game: this });
        }
        return;
      }
      if (this.stopT > 0) { this.stopT -= dt; this.fx.update(dt * 0.3); return; }
      if (!this.victory) this.runTime += dt;
      const L = this.level;
      const p = this.player;
      this.flowT = (this.flowT || 0) - dt;
      if (this.flowT <= 0) { this.flowT = 0.3; this.computeFlow(); }
      p.update(dt, this);
      for (const e of L.entities) if (!e.dead) e.update(dt, this);
      L.entities = L.entities.filter((e) => !e.dead || e.keep);
      // decay object hit flashes
      this.fx.update(dt);
      // triggers
      this.checkTriggers();
      // interaction
      this.target = this.inputLocked ? null : this.findInteract();
      if (this.target && RS.Input.pressed('interact') && !this.inputLocked && p.state !== 'dead') this.interact(this.target);
      if (RS.Input.pressed('map') && !this.inputLocked) RS.App.pushModal(new RS.UI.MapModal(this));
      if (RS.Input.pressed('pause') && !this.inputLocked) RS.App.pushModal(new RS.UI.PauseModal(this));
      // exploration & regions
      this.updateExplore();
      // HUD timers
      for (const t of this.toasts) t.t += dt;
      this.toasts = this.toasts.filter((t) => t.t < t.max);
      if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.max) this.banner = null; }
      if (this.hint) {
        this.hint.t += dt;
        if (this.hint.id === 'move' && p.moveAmount > 0.1 && this.hint.t > 1.5) this.hint.t = Math.max(this.hint.t, this.hint.max - 0.5);
        if (this.hint.t > this.hint.max) this.hint = null;
      }
      if (this.flash) { this.flash.t -= dt; if (this.flash.t <= 0) this.flash = null; }
      if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeA = 0; }
      // onboarding
      RS.Spawn.onboarding(this, dt);
      if (this.levelName.startsWith('dungeon')) RS.DungeonRuntime.update(this, this.dungeonData[+this.levelName.slice(7)], dt);
      if (this.levelName === 'arena' && RS.ArenaRuntime) RS.ArenaRuntime.update(this, this.arena, dt);
      // autosave every 20 s
      this.saveTimer = (this.saveTimer || 0) + dt;
      if (this.saveTimer > 20) { this.saveTimer = 0; this.saveRun(); }
      // camera follow
      const W = RS.App.W, H = RS.App.H;
      const [fx, fy] = RS.PlayerConst.DIRV[p.dir];
      const tx = p.x + fx * 14 - W / 2, ty = p.y - 10 + fy * 10 - H / 2;
      const k = 1 - Math.pow(0.0008, dt);
      this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k;
      this.clampCamera();
      if (this.boss && this.boss.dead && !this.victory) this.onBossDefeated();
    }

    checkTriggers() {
      const p = this.player;
      if (p.state === 'dead') return;
      const L = this.level;
      const objs = L.objectsNear(p.x - 40, p.y - 40, p.x + 40, p.y + 40);
      for (const o of objs) {
        if (!o.trigger || o.dead) continue;
        const tr = o.trigger;
        if (p.x >= tr.x0 && p.x <= tr.x1 && p.y - 2 >= tr.y0 && p.y - 2 <= tr.y1) {
          if (o.kind === 'entrance' && this.levelName === 'overworld') { this.enterDungeon(o.dungeon); return; }
          if (o.kind === 'lairgate' && !o.sealed) { this.enterArena(); return; }
          if (o.kind === 'exit') { this.exitDungeon(); return; }
        }
      }
    }

    updateExplore() {
      const L = this.level, p = this.player;
      const ex = this.explored[this.levelName];
      const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS);
      const R = this.levelName === 'overworld' ? 10 : 7;
      if (this._exT !== tx + ty * 9999) {
        this._exT = tx + ty * 9999;
        for (let y = ty - R; y <= ty + R; y++) for (let x = tx - R; x <= tx + R; x++) {
          if (!L.inb(x, y)) continue;
          if ((x - tx) * (x - tx) + (y - ty) * (y - ty) <= R * R) ex[y * L.w + x] = 1;
        }
      }
      if (this.levelName === 'overworld') {
        const i = ty * L.w + tx;
        const rg = L.inb(tx, ty) ? L.region[i] : 255;
        if (rg < 254 && rg !== this.lastRegion) {
          this.lastRegion = rg;
          const R2 = this.world.regions[rg];
          const first = !this.regionSeen.has(rg);
          this.regionSeen.add(rg);
          if (first || (this.time - (this.lastBannerT || -99)) > 12) {
            this.lastBannerT = this.time;
            this.showBanner(R2.name, (first && rg !== this.world.start ? T.hud.discovered + ' · ' : '') + R2.def.label);
          }
        }
      }
    }

    abandon() {
      this.over = true;
      this.save.run = null;
      this.save.stats.defeats++;
      RS.Save.saveNow();
      RS.Audio && RS.Audio.stopMusic(0.4);
      RS.App.setScene('camp', { from: 'abandon', seed: this.seed, earned: this.run.earned });
    }

    onBossDefeated() {
      this.victory = true;
      this.over = true;
      const t = this.runTime;
      const s = this.save;
      s.stats.wins++;
      const record = !s.best || t < s.best.time;
      if (record) s.best = { time: t, seed: String(this.seed), date: new Date().toISOString().slice(0, 10) };
      s.run = null;
      RS.Save.saveNow();
      this.victoryInfo = { time: t, record };
      setTimeout(() => {}, 0);
      this.victoryTimer = 0;
      this.update = (dt) => {
        this.victoryTimer += dt;
        this.fx.update(dt);
        for (const e of this.level.entities) if (!e.dead && e.isBoss) e.update(dt, this);
        if (this.victoryTimer > 3.2 && !this.victoryShown) { this.victoryShown = true; RS.App.setScene('victory', { game: this }); }
      };
      RS.Audio && RS.Audio.playMusic('victory');
    }

    // ---- render -------------------------------------------------------------------------
    render(ctx) {
      const W = RS.App.W, H = RS.App.H;
      let cx = this.camX, cy = this.camY;
      if (this.shakeA > 0) { cx += (Math.random() * 2 - 1) * this.shakeA; cy += (Math.random() * 2 - 1) * this.shakeA; }
      cx = Math.round(cx); cy = Math.round(cy);
      ctx.fillStyle = this.level.type === 'overworld' ? P.sea1 : P.black;
      ctx.fillRect(0, 0, W, H);
      const ents = this.level.entities.slice();
      ents.push(this.player);
      RS.WorldRender.drawWorld(ctx, this.level, cx, cy, W, H, this.time, ents, this.player);
      this.fx.draw(ctx, cx, cy);
      // atmosphere
      if (this.levelName === 'overworld') {
        const tx = Math.floor(this.player.x / TS), ty = Math.floor(this.player.y / TS);
        const rg = this.level.inb(tx, ty) ? this.world.regions[this.level.region[ty * this.level.w + tx]] : null;
        const mistT = rg && rg.def.mist ? 1 : 0;
        this.mist = (this.mist || 0) + (mistT - (this.mist || 0)) * 0.02;
        RS.WorldRender.drawMist(ctx, cx, cy, W, H, this.time, this.mist);
        const lairT = rg && rg.biome === 'sanctum' ? 1 : 0;
        this.dusk = (this.dusk || 0) + (lairT - (this.dusk || 0)) * 0.02;
      }
      if (RS.Light) RS.Light.render(ctx, this, cx, cy);
      this.fx.drawTexts(ctx, cx, cy);
      RS.HUD.draw(ctx, this, cx, cy);
      if (this.flash) {
        ctx.globalAlpha = Math.min(0.55, this.flash.t / this.flash.max * 0.55);
        ctx.fillStyle = this.flash.color; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      if (this.trans) {
        const tr = this.trans;
        const a = tr.t < tr.dur / 2 ? tr.t / (tr.dur / 2) : 1 - (tr.t - tr.dur / 2) / (tr.dur / 2);
        RS.UI.pixelFade(ctx, W, H, RS.M.clamp(a, 0, 1), tr.color);
      }
    }
  }

  RS.Game = Game;
  RS.computeStats = computeStats;
  RS.THEMES = THEMES;
})();
