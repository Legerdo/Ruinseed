// Loading (world generation with progress) and play scenes.
(function () {
  'use strict';
  const P = RS.PAL, T = RS.T, UI = RS.UI;
  RS.Scenes = RS.Scenes || {};

  RS.Scenes.loading = {
    enter(p) {
      this.p = p; this.t = 0; this.step = 0; this.err = null; this.progress = 0;
      this.msg = T.loading[0];
    },
    update(dt) {
      this.t += dt;
      try {
        if (this.step === 0) { this.step = 1; return; }
        if (this.step === 1) {
          const t0 = performance.now();
          // a seed that cannot produce a valid world falls back to the next seeds (deterministically)
          let world = null, seed = this.p.seed;
          for (let k = 0; k < 4 && !world; k++) {
            try { world = RS.generateWorld(seed); } catch (e) { console.warn('[loading] seed failed', seed, e); seed = (seed + 1) % 1000000; }
          }
          if (!world) throw new Error('world');
          if (seed !== this.p.seed) { this.p.seed = seed; RS.Save.data.lastSeed = seed; RS.Save.save(); }
          this.world = world;
          this.genMs = performance.now() - t0;
          RS.Terrain.prepare(this.world.level);
          this.step = 2; this.msg = T.loading[5];
          return;
        }
        if (this.step === 2) {
          const L = this.world.level;
          const c = this.world.camp;
          // pre-render the chunks around the camp; the rest streams in during play
          this.progress = RS.Terrain.prerender(L, 24, c.tx * 16, c.ty * 16);
          this.msg = T.loading[Math.min(T.loading.length - 1, 1 + Math.floor(this.progress * 5))];
          if (this.progress >= 0.25 || this.t > 4) this.step = 3;
          return;
        }
        if (this.step === 3) {
          const g = new RS.Game({ seed: this.p.seed, attempt: this.p.attempt, world: this.world, resume: this.p.resume });
          RS.App.setScene('play', { game: g });
        }
      } catch (e) {
        console.error(e);
        this.err = T.loadingError;
        this.step = 99;
      }
      if (this.step === 99 && (RS.Input.uiPressed('confirm') || RS.Input.uiPressed('cancel') || RS.Input.mouse.pressed)) RS.App.setScene('title');
    },
    render(ctx) {
      const W = RS.App.W, H = RS.App.H;
      ctx.fillStyle = P.ink0; ctx.fillRect(0, 0, W, H);
      if (RS.Scenes.title && RS.Scenes.title.drawBackdrop) RS.Scenes.title.drawBackdrop(ctx, this.t, 0.5);
      RS.Text.draw(ctx, T.loadingTitle, W / 2, H / 2 - 26, { font: 'large', color: P.bone7, align: 'center', outline: P.ink0 });
      if (this.err) {
        const w = Math.min(W - 30, 360);
        RS.Text.drawWrapped(ctx, this.err, Math.round(W / 2 - w / 2), H / 2 + 40, w, { font: 'body', color: P.heartLight, outline: P.ink0 });
      } else RS.Text.draw(ctx, this.msg, W / 2, H / 2, { font: 'body', color: P.gold4, align: 'center', outline: P.ink0 });
      // ember progress bar
      const bw = Math.min(200, W - 60), bx = Math.round(W / 2 - bw / 2), by = H / 2 + 20;
      UI.panel(ctx, bx - 3, by - 3, bw + 6, 11, 'dark');
      const f = this.step >= 3 ? 1 : this.step === 2 ? 0.3 + this.progress * 2.8 : this.step === 1 ? 0.15 : 0.05;
      ctx.fillStyle = P.emb4; ctx.fillRect(bx, by, Math.round(bw * Math.min(1, f)), 5);
      ctx.fillStyle = P.emb6; ctx.fillRect(bx, by, Math.round(bw * Math.min(1, f)), 1);
      RS.Text.draw(ctx, T.title.seed + ' ' + this.p.seed, W / 2, by + 14, { font: 'small', color: P.bone4, align: 'center' });
    }
  };

  RS.Scenes.play = {
    enter(p) { this.g = p.game; RS.currentGame = this.g; },
    exit() { },
    update(dt, paused) {
      if (paused) return;
      this.g.update(dt);
      // stream remaining terrain chunks near the player
      if (this.g.level) RS.Terrain.prerender(this.g.level, 3, this.g.player.x, this.g.player.y);
    },
    render(ctx) { this.g.render(ctx); }
  };
})();
