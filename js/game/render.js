// World rendering: terrain chunks, animated water/waterfalls, low animated decor, shadows,
// y-sorted objects and entities, canopy fading, atmospheric overlays and lighting.
(function () {
  'use strict';
  const K = RS.K, MAT = RS.MAT, P = RS.PAL, TS = RS.TS;
  const SHADOW = { tree: 'shadow_l', rock: 'shadow_m', bush: 'shadow_m', log: 'shadow_l', stump: 'shadow_s', wall: null, landmark: 'shadow_xl', sign: 'shadow_s', tablet: 'shadow_s', pillar: 'shadow_m', lantern: 'shadow_s', brazier: 'shadow_s', chest: 'shadow_m', deco: null, campfire: null, entrance: null, lairgate: null };

  let fogPuffs = null;
  function makeFog() {
    fogPuffs = [];
    for (let v = 0; v < 3; v++) {
      const w = 64 + v * 16, h = 26 + v * 6;
      const b = new RS.Art.PixBuf(w, h);
      const vn = RS.makeValueNoise(400 + v);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (x - w / 2) / (w / 2), dy = (y - h / 2) / (h / 2);
        const d = dx * dx + dy * dy + (vn(x / 7, y / 7) - 0.5) * 0.7;
        if (d < 0.55) b.set(x, y, P.bone6);
        else if (d < 0.9 && RS.rand2(x, y, v) < 0.5) b.set(x, y, P.bone5);
      }
      fogPuffs.push(b.toCanvas());
    }
  }

  function objFrame(o, time) {
    if (!o.anim) return o.spr;
    const f = Math.floor(time * o.anim.fps + (o.phase || (o.x * 0.37 + o.y * 0.11))) % o.anim.frames;
    return o.spr + '_' + f;
  }

  // draw animated water glints and waterfalls on visible tiles
  function drawWaterFx(ctx, L, camX, camY, vw, vh, time) {
    const tx0 = Math.max(0, Math.floor(camX / TS)), ty0 = Math.max(0, Math.floor(camY / TS));
    const tx1 = Math.min(L.w - 1, Math.floor((camX + vw) / TS)), ty1 = Math.min(L.h - 1, Math.floor((camY + vh) / TS));
    const wd = L._wdepth;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * L.w + tx;
      const k = L.kind[i];
      if (k === K.WATER && wd && wd[i] >= 2 && L.mat[i] !== MAT.MARSH) {
        const h = RS.hash2(tx, ty, 71);
        if ((h & 255) < 60) {
          const ph = ((h >> 8) & 255) / 255 * 8;
          const f = Math.floor(time * 2.4 + ph) % 10;
          if (f < 4) {
            const ox = 3 + ((h >> 16) & 7), oy = 4 + ((h >> 20) & 7);
            RS.Sprites.draw(ctx, 'glint_' + f, tx * TS + ox - camX, ty * TS + oy - camY);
          }
        }
      } else if (k === K.FALLS) {
        const x0 = tx * TS - camX, y0 = ty * TS - camY;
        for (let x = 0; x < TS; x += 2) {
          const h = RS.hash2(tx * 16 + x, 0, 9);
          const sp = 40 + (h & 31);
          const off = (time * sp + (h >> 5) % 16) % 16;
          ctx.fillStyle = (h & 1) ? P.sea9 : P.sea8;
          ctx.fillRect(x0 + x + ((h >> 3) & 1), y0 + Math.floor(off), 1, 3 + ((h >> 7) & 3));
        }
        // splash below the fall
        if (ty + 1 < L.h && L.kind[i + L.w] === K.WATER) {
          const sy = y0 + TS;
          for (let k2 = 0; k2 < 5; k2++) {
            const a = time * 5 + k2 * 1.7 + tx;
            const px = x0 + ((k2 * 3.3 + Math.sin(a) * 2) | 0) + 2, py = sy + ((Math.abs(Math.sin(a * 0.7)) * 4) | 0);
            ctx.fillStyle = k2 % 2 ? P.sea9 : P.sea8;
            ctx.fillRect(px, py, 2, 1);
          }
        }
      }
    }
  }

  function drawLowDecor(ctx, L, camX, camY, vw, vh, time) {
    if (!L._animGrid) {
      const g = new Map();
      for (const a of L.anim) { const k = ((a.y / 128) | 0) * 4096 + ((a.x / 128) | 0); let b = g.get(k); if (!b) { b = []; g.set(k, b); } b.push(a); }
      for (const b of g.values()) b.sort((p, q) => p.y - q.y);
      L._animGrid = g;
    }
    const cx0 = Math.floor((camX - 16) / 128), cx1 = Math.floor((camX + vw + 16) / 128);
    const cy0 = Math.floor((camY - 16) / 128), cy1 = Math.floor((camY + vh + 24) / 128);
    const wind = Math.sin(time * 0.7) * 0.5;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const b = L._animGrid.get(cy * 4096 + cx);
      if (!b) continue;
      for (const a of b) {
        if (a.dead) continue;
        let f = Math.floor(time * 3 + a.ph + a.x * 0.02 + wind) & 3;
        if (a.bend > 0) { f = a.bendDir > 0 ? 1 : 3; a.bend -= 1 / 60; }
        RS.Sprites.draw(ctx, a.s + '_' + f, a.x - camX, a.y - camY);
      }
    }
  }

  // Main draw: returns list of drawn sorted items (for debugging)
  function drawWorld(ctx, L, camX, camY, vw, vh, time, entities, player) {
    camX = Math.round(camX); camY = Math.round(camY);
    RS.Terrain.draw(ctx, L, camX, camY, vw, vh, time);
    drawWaterFx(ctx, L, camX, camY, vw, vh, time);
    drawLowDecor(ctx, L, camX, camY, vw, vh, time);
    const objs = L.objectsNear(camX, camY, camX + vw, camY + vh);
    // shadows first
    ctx.globalAlpha = 0.28;
    for (const o of objs) {
      const sk = o.shadowKey !== undefined ? o.shadowKey : SHADOW[o.kind];
      if (!sk || o.deep) continue;
      if (o.x < camX - 40 || o.x > camX + vw + 40 || o.y < camY - 10 || o.y > camY + vh + 20) continue;
      RS.Sprites.draw(ctx, o.big ? 'shadow_xl' : sk, o.x - camX, o.y - camY - 1);
    }
    for (const e of entities) if (e.shadow && !e.dead && e.visible !== false) RS.Sprites.draw(ctx, e.shadow, e.x - camX, e.y - camY - 1 + (e.shadowOy || 0));
    ctx.globalAlpha = 1;
    // y-sorted list
    const list = [];
    for (const o of objs) {
      const spr = RS.Sprites.get(objFrame(o, time));
      if (!spr) continue;
      const x0 = o.x - spr.ax, y0 = o.y - spr.ay;
      if (x0 > camX + vw || x0 + spr.w < camX || y0 > camY + vh || y0 + spr.h < camY) continue;
      list.push({ y: o.y + (o.depthBias || 0), o, spr });
    }
    for (const e of entities) if (!e.dead && e.visible !== false) list.push({ y: e.y + (e.depthBias || 0), e });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.e) { it.e.draw(ctx, camX, camY, time); continue; }
      const o = it.o, spr = it.spr;
      let alpha = 1;
      if (o.fade && player) {
        const x0 = o.x - spr.ax, y0 = o.y - spr.ay;
        if (player.y < o.y - 2 && player.y > y0 + 4 && player.x > x0 + 2 && player.x < x0 + spr.w - 2) alpha = 0.45;
      }
      if (o.hitFlash > 0) {
        RS.Sprites.draw(ctx, spr, o.x - camX + (o.shake ? Math.round(Math.sin(time * 80) * o.shake) : 0), o.y - camY, { white: true });
        continue;
      }
      RS.Sprites.draw(ctx, spr, o.x - camX, o.y - camY, { alpha, flip: !!o.flip });
      if (o.sigilGlow && !(o.interact && o.interact.done)) drawFloatingSigil(ctx, L, o, camX, camY, time);
    }
  }

  // the sigil hovers over its altar inside a pulsing beam of light
  function drawFloatingSigil(ctx, L, o, camX, camY, time) {
    const key = { moss: 'root', tide: 'tide', ember: 'ember' }[L.theme] || 'root';
    const col = RS.UI.THEME_COL[L.theme] || P.gold4;
    const x = Math.round(o.x - camX), y = Math.round(o.y - camY);
    const pulse = 0.18 + Math.sin(time * 3) * 0.06;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = col;
    ctx.fillRect(x - 5, y - 70, 10, 52);
    ctx.globalAlpha = pulse * 1.6;
    ctx.fillRect(x - 2, y - 76, 4, 58);
    ctx.globalAlpha = 1;
    const bob = Math.round(Math.sin(time * 2.5) * 2);
    RS.Sprites.draw(ctx, 'sigil_' + key, x - 7, y - 42 + bob);
    if (Math.floor(time * 5) % 3 === 0) { ctx.fillStyle = P.white; ctx.fillRect(x - 1 + Math.round(Math.sin(time * 7) * 5), y - 36 + bob, 1, 1); }
  }

  function drawMist(ctx, camX, camY, vw, vh, time, amount) {
    if (!fogPuffs) makeFog();
    if (amount <= 0) return;
    ctx.globalAlpha = 0.16 * amount;
    for (let k = 0; k < 9; k++) {
      const img = fogPuffs[k % 3];
      const sx = ((k * 173.3 + time * (6 + k)) % (vw + 200)) - 100;
      const sy = ((k * 97.1) % (vh + 60)) - 30 + Math.sin(time * 0.3 + k) * 6;
      ctx.drawImage(img, Math.round(sx), Math.round(sy));
    }
    ctx.globalAlpha = 1;
  }

  RS.WorldRender = { drawWorld, drawMist, objFrame };
})();
