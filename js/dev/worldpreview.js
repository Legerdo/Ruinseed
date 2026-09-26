// Development-only: world layout preview for several seeds
(function () {
  RS.Scenes = RS.Scenes || {};
  RS.Scenes.worldpreview = {
    enter() {
      const seeds = (RS.params.get('seeds') || '1,2,3,4').split(',').map((s) => +s);
      this.items = [];
      for (const s of seeds) {
        const t0 = performance.now();
        let w = null, err = null;
        try { w = RS.generateWorld(s, { allowInvalid: true, tries: +(RS.params.get('tries') || 8) }); } catch (e) { err = String(e && e.message || e); console.error(e); }
        const ms = performance.now() - t0;
        let img = null;
        if (w) {
          img = RS.MapView.build(w.level);
          if (RS.params.get('reach')) {
            const c2 = img.getContext('2d');
            const L = w.level;
            for (let i = 0; i < L.w * L.h; i++) {
              const k = L.kind[i];
              if ((k === RS.K.FLOOR || k === RS.K.BRIDGE || k === RS.K.STAIRS) && L.solid[i] === 0 && !w.reach[i] && w.main[i]) { c2.fillStyle = 'rgba(255,0,60,0.8)'; c2.fillRect(i % L.w, (i / L.w) | 0, 1, 1); }
            }
          }
        }
        this.items.push({ seed: s, w, err, ms, img });
        if (w) console.log('seed', s, 'ms', ms.toFixed(0), 'layout', w.layout.sea.join(''), 'regions', w.regions.length, 'log', w.log.join(' | '), 'problems', w.problems.join(','));
      }
      window.PREVIEW_DONE = true;
    },
    update() {},
    render(ctx) {
      const W = RS.App.W, H = RS.App.H;
      ctx.fillStyle = RS.PAL.ink1; ctx.fillRect(0, 0, W, H);
      const n = this.items.length;
      const cols = n <= 1 ? 1 : 2, rows = Math.ceil(n / cols);
      const cw = Math.floor(W / cols), chh = Math.floor(H / rows);
      this.items.forEach((it, k) => {
        const ox = (k % cols) * cw, oy = Math.floor(k / cols) * chh;
        if (!it.img) { RS.Text.draw(ctx, '실패 ' + it.seed + ' ' + it.err, ox + 4, oy + 4, { font: 'small', color: '#f55' }); return; }
        const sc = Math.min((cw - 8) / it.img.width, (chh - 18) / it.img.height);
        const s = Math.max(1, Math.floor(sc * 2) / 2);
        const dw = Math.floor(it.img.width * s), dh = Math.floor(it.img.height * s);
        ctx.drawImage(it.img, ox + 4, oy + 14, dw, dh);
        const w = it.w;
        // markers
        const mk = (tx, ty, col, r) => { ctx.fillStyle = col; ctx.fillRect(ox + 4 + Math.floor(tx * s) - r, oy + 14 + Math.floor(ty * s) - r, r * 2 + 1, r * 2 + 1); };
        mk(w.camp.tx, w.camp.ty, '#ffffff', 2);
        const tc = { moss: RS.PAL.rootGlow, tide: RS.PAL.tideGlow, ember: RS.PAL.emberGlow };
        for (const d of w.dungeons) mk(d.entrance.tx, d.entrance.ty, tc[d.theme], 2);
        if (w.lairSite) mk(w.lairSite.gateX, w.lairSite.gateY, '#ff3030', 3);
        for (const r of w.regions) {
          RS.Text.draw(ctx, r.name, ox + 4 + Math.floor(r.hub.x * s), oy + 14 + Math.floor(r.hub.y * s) - 4, { font: 'small', color: '#fff', outline: '#000', align: 'center' });
        }
        RS.Text.draw(ctx, '시드 ' + it.seed + ' · ' + w.layout.sea.join('') + ' · ' + w.regions.length + '개 지역 · ' + it.ms.toFixed(0) + 'ms · ' + (w.valid ? '검증 통과' : '실패'), ox + 4, oy + 1, { font: 'small', color: RS.PAL.gold4 });
      });
    }
  };
})();
