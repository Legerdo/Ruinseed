// Development-only: free camera view of a generated world at a named spot
(function () {
  RS.Scenes = RS.Scenes || {};
  RS.Scenes.worldview = {
    enter() {
      const seed = +(RS.params.get('seed') || 1);
      const t0 = performance.now();
      this.w = RS.generateWorld(seed, { allowInvalid: true });
      this.genMs = performance.now() - t0;
      const L = this.w.level;
      RS.Terrain.prepare(L);
      const at = RS.params.get('at') || 'camp';
      let tx = this.w.camp.tx, ty = this.w.camp.ty;
      if (at.startsWith('d')) { const d = this.w.dungeons[+at.slice(1)]; if (d) { tx = d.entrance.tx; ty = d.entrance.ty; } }
      else if (at === 'lair') { tx = this.w.lairSite.gateX; ty = this.w.lairSite.gateY; }
      else if (at.startsWith('r')) { const r = this.w.regions[+at.slice(1)]; if (r) { tx = r.hub.x; ty = r.hub.y; } }
      else if (at.startsWith('l')) { const l = this.w.landmarks[+at.slice(1)]; if (l) { tx = l.tx; ty = l.ty; } }
      else if (at.includes(',')) { [tx, ty] = at.split(',').map(Number); }
      this.cx = tx * 16 + 8 - RS.App.W / 2;
      this.cy = ty * 16 + 8 - RS.App.H / 2;
      this.t = 0;
      const t1 = performance.now();
      RS.Terrain.prerender(L, 1e9, tx * 16, ty * 16);
      this.renderMs = performance.now() - t1;
      console.log('gen', this.genMs.toFixed(0), 'ms; chunks', this.renderMs.toFixed(0), 'ms; objects', L.objects.length, 'decals', L.decals.length, 'anim', L.anim.length);
      const missing = new Set();
      for (const o of L.objects) { const k = o.anim ? o.spr + '_0' : o.spr; if (!RS.Sprites.get(k)) missing.add(k); }
      for (const d of L.decals) if (!RS.Sprites.get(d.s)) missing.add(d.s);
      for (const a of L.anim) if (!RS.Sprites.get(a.s + '_0')) missing.add(a.s + '_0');
      if (missing.size) console.warn('missing sprites: ' + [...missing].join(', '));
      window.VIEW_DONE = true;
    },
    update(dt) {
      this.t += dt;
      const v = RS.Input.moveVector();
      this.cx += v.x * 200 * dt; this.cy += v.y * 200 * dt;
    },
    render(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, RS.App.W, RS.App.H);
      RS.WorldRender.drawWorld(ctx, this.w.level, this.cx, this.cy, RS.App.W, RS.App.H, this.t, [], null);
    }
  };
})();
