// Lighting: dark ambient multiplied over the scene with banded (pixel-art) radial lights.
(function () {
  'use strict';
  const P = RS.PAL;
  const cache = new Map();
  let lc = null, lctx = null;

  function lightSprite(color, r) {
    r = Math.max(4, Math.round(r / 2) * 2);
    const key = color + '|' + r;
    let cv = cache.get(key);
    if (cv) return cv;
    cv = RS.Art.makeCanvas(r * 2, r * 2);
    const c = cv.getContext('2d');
    const [R, G, B] = RS.Color.hexToRgb(color);
    const g = c.createRadialGradient(r, r, 0, r, r, r);
    // hard steps give a pixel-art banded falloff
    const bands = [[0, 1], [0.34, 1], [0.35, 0.72], [0.58, 0.72], [0.59, 0.42], [0.8, 0.42], [0.81, 0.16], [0.99, 0.16], [1, 0]];
    for (const [s, a] of bands) g.addColorStop(s, 'rgba(' + R + ',' + G + ',' + B + ',' + a + ')');
    c.fillStyle = g;
    c.fillRect(0, 0, r * 2, r * 2);
    cache.set(key, cv);
    return cv;
  }

  function render(ctx, g, cx, cy) {
    const L = g.level;
    let ambient = L.ambient;
    let strength = 1;
    if (!ambient) {
      if (!(g.dusk > 0.02)) return;
      ambient = '#6e6488';
      strength = g.dusk;
    }
    const W = RS.App.W, H = RS.App.H;
    if (!lc || lc.width !== W || lc.height !== H) { lc = RS.Art.makeCanvas(W, H); lctx = lc.getContext('2d'); }
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = strength < 1 ? RS.Color.mix('#ffffff', ambient, strength) : ambient;
    lctx.fillRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'lighter';
    const t = g.time;
    const add = (x, y, r, color, flicker, alpha) => {
      if (x < -r || y < -r || x > W + r || y > H + r) return;
      let rr = r;
      if (flicker) rr += Math.sin(t * 17 + x * 0.3) * 1.5 + Math.sin(t * 7.3 + y) * 1.5;
      const s = lightSprite(color, rr);
      lctx.globalAlpha = (alpha === undefined ? 1 : alpha) * strength;
      lctx.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2));
    };
    // player carries a small ember lantern
    const p = g.player;
    add(p.x - cx, p.y - 10 - cy, L.type === 'overworld' ? 70 : 80, '#ffe2b8', true, 0.9);
    const objs = L.objectsNear(cx - 80, cy - 80, cx + W + 80, cy + H + 80);
    for (const o of objs) {
      if (!o.light || o.dead) continue;
      add(o.x - cx, o.y - 14 - cy, o.light.r, o.light.color, o.light.flicker, 0.95);
    }
    for (const e of L.entities) {
      if (e.dead) continue;
      if (e instanceof RS.Projectile) add(e.x - cx, e.y - e.z - cy, 26, e.spr.startsWith('proj_orb') ? '#ff9a45' : '#86e3f0', false, 0.7);
      else if (e.type === 'wisp') add(e.x - cx, e.y - 10 - cy, 34, '#86e3f0', true, 0.8);
      else if (e.isBoss && e.awake && !e.dead) add(e.x - cx, e.y - 30 - cy, e.exposed ? 90 : 60, '#ff7a3a', true, 0.9);
    }
    // lava glows
    if (L.type !== 'overworld') {
      const tx0 = Math.max(0, Math.floor(cx / 16)), ty0 = Math.max(0, Math.floor(cy / 16));
      const tx1 = Math.min(L.w - 1, Math.floor((cx + W) / 16)), ty1 = Math.min(L.h - 1, Math.floor((cy + H) / 16));
      for (let ty = ty0; ty <= ty1; ty += 1) for (let tx = tx0; tx <= tx1; tx += 1) {
        const i = ty * L.w + tx;
        if (L.kind[i] === RS.K.LAVA && ((tx + ty) & 1) === 0) add(tx * 16 + 8 - cx, ty * 16 + 8 - cy, 34, '#ff6a20', true, 0.55);
        else if (L.kind[i] === RS.K.WATER && ((tx * 3 + ty) % 5) === 0) add(tx * 16 + 8 - cx, ty * 16 + 8 - cy, 20, '#3a7a9a', false, 0.35);
      }
    }
    // particles glow faintly
    for (const pt of g.fx.parts) if (pt.c === P.emb5 || pt.c === P.emb6 || pt.c === P.emb7) add(pt.x - cx, pt.y - cy, 8, '#ff9a45', false, 0.5);
    lctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(lc, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  RS.Light = { render };
})();
