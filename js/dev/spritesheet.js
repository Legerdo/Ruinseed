// Development-only: sprite sheet inspector (?scene=sprites&prefix=hero_,blade_&zoom=4)
(function () {
  RS.Scenes = RS.Scenes || {};
  RS.Scenes.sprites = {
    enter() {
      const pre = (RS.params.get('prefix') || 'hero_').split(',');
      this.keys = [...RS.Sprites.map.keys()].filter((k) => pre.some((p) => k.startsWith(p)));
      this.zoom = +(RS.params.get('zoom') || 3);
      this.bg = RS.params.get('bg') || '#4f8446';
      window.VIEW_DONE = true;
    },
    update() {},
    render(ctx) {
      const W = RS.App.W, H = RS.App.H;
      ctx.fillStyle = this.bg; ctx.fillRect(0, 0, W, H);
      let x = 4, y = 4, rowH = 0;
      for (const k of this.keys) {
        const s = RS.Sprites.get(k);
        const w = s.w * this.zoom, h = s.h * this.zoom;
        const cellW = Math.max(w, RS.Text.measure(k, 'small')) + 6;
        if (x + cellW > W) { x = 4; y += rowH + 14; rowH = 0; }
        ctx.drawImage(s.canvas, x, y, w, h);
        RS.Text.draw(ctx, k, x, y + h + 1, { font: 'small', color: '#fff', outline: '#000' });
        x += cellW; rowH = Math.max(rowH, h);
      }
    }
  };
})();
