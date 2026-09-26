// In-game HUD. Everything sizes itself to its Korean text so nothing overflows at any resolution.
(function () {
  'use strict';
  const P = RS.PAL, T = RS.T, UI = RS.UI, TS = RS.TS;
  let arrows = null;

  function buildArrows() {
    arrows = [];
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2;
      const b = new RS.Art.PixBuf(15, 15);
      const cx = 7, cy = 7;
      // triangle pointing along angle a
      const tip = [cx + Math.cos(a) * 6, cy + Math.sin(a) * 6];
      const l = [cx + Math.cos(a + 2.5) * 5, cy + Math.sin(a + 2.5) * 5];
      const r = [cx + Math.cos(a - 2.5) * 5, cy + Math.sin(a - 2.5) * 5];
      const inside = (px, py) => {
        const s = (p0, p1) => (p1[0] - p0[0]) * (py - p0[1]) - (p1[1] - p0[1]) * (px - p0[0]);
        const d1 = s(tip, l), d2 = s(l, r), d3 = s(r, tip);
        return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
      };
      for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) if (inside(x + 0.5, y + 0.5)) b.set(x, y, P.gold4);
      for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) if (b.opaque(x, y) && (x + 0.5 - cx) * Math.cos(a) + (y + 0.5 - cy) * Math.sin(a) > 2) b.set(x, y, P.gold5);
      RS.Art.outline(b, P.ink0);
      arrows.push(b.toCanvas());
    }
  }

  function hearts(ctx, g) {
    const p = g.player;
    const n = Math.ceil(p.maxHp / 2);
    for (let i = 0; i < n; i++) {
      const v = p.hp - i * 2;
      const key = v >= 2 ? 'heart_full' : v === 1 ? 'heart_half' : 'heart_empty';
      let dy = 0;
      if (p.hp <= 2 && v > 0 && Math.floor(g.time * 4) % 2 === 0) dy = -1;
      RS.Sprites.draw(ctx, key, 6 + i * 10, 6 + dy);
    }
    // potions
    const px = 8 + n * 10;
    RS.Sprites.draw(ctx, 'icon_potion', px, 5);
    const pot = '×' + g.run.potions;
    RS.Text.draw(ctx, pot, px + 10, 4, { font: 'small', color: g.run.potions ? P.bone7 : P.bone3, outline: P.ink0 });
    return px + 10 + RS.Text.measure(pot, 'small');
  }

  // cheat indicator: a small chip right after the hearts, clear of hints and the boss bar
  function godChip(ctx, x, y) {
    const label = T.hud.godMode;
    const w = RS.Text.measure(label, 'small') + 10;
    UI.panel(ctx, x, y, w, 14, 'ember', 0.92);
    RS.Text.draw(ctx, label, x + 5, y + 1, { font: 'small', color: P.emb6 });
  }

  // returns the panel's bottom-right corner so the banner can stay clear of it
  function objective(ctx, g, y) {
    const W = RS.App.W;
    const ob = g.objective();
    if (!ob || !ob.text) return { bottom: y, right: 0 };
    const maxW = Math.min(250, Math.floor(W * 0.46));
    const lines = RS.Text.wrap(ob.text, 'body', maxW - 14);
    const subLines = ob.sub ? RS.Text.wrap(ob.sub, 'small', maxW - 14) : [];
    const lw = Math.max(...lines.map((l) => RS.Text.measure(l, 'body')), ...subLines.map((l) => RS.Text.measure(l, 'small')), RS.Text.measure(T.hud.objective, 'small'));
    const w = lw + 16;
    const h = 14 + lines.length * 15 + subLines.length * 12 + 4;
    UI.panel(ctx, 3, y, w, h, 'dark', 0.88);
    RS.Text.draw(ctx, T.hud.objective, 9, y + 3, { font: 'small', color: P.gold3 });
    lines.forEach((l, i) => RS.Text.draw(ctx, l, 9, y + 14 + i * 15, { font: 'body', color: P.bone7, shadow: P.ink0 }));
    subLines.forEach((l, i) => RS.Text.draw(ctx, l, 9, y + 14 + lines.length * 15 + i * 12, { font: 'small', color: P.bone4 }));
    return { bottom: y + h, right: 3 + w };
  }

  function compass(ctx, g, cx, cy) {
    const ob = g.objective();
    if (!ob || ob.x === null || ob.x === undefined) return;
    const p = g.player;
    const dx = ob.x - p.x, dy = ob.y - p.y;
    const d = Math.hypot(dx, dy);
    const W = RS.App.W, H = RS.App.H;
    const sx = ob.x - cx, sy = ob.y - cy;
    const onScreen = sx > 8 && sy > 8 && sx < W - 8 && sy < H - 8;
    if (!arrows) buildArrows();
    if (onScreen && d < 140) {
      // bouncing marker over the target
      const bob = Math.round(Math.sin(g.time * 5) * 2);
      RS.Sprites.draw(ctx, 'marker', Math.round(sx), Math.round(sy) - 16 + bob);
      return;
    }
    const a = Math.atan2(dy, dx);
    const k = ((Math.round(a / (Math.PI * 2) * 16) % 16) + 16) % 16;
    const r = 30 + Math.sin(g.time * 4) * 2;
    const ax = p.x - cx + Math.cos(a) * r, ay = p.y - 8 - cy + Math.sin(a) * r * 0.8;
    ctx.drawImage(arrows[k], Math.round(ax - 7), Math.round(ay - 7));
  }

  function topRight(ctx, g) {
    const W = RS.App.W;
    const cur = String(RS.Save.data.currency);
    const tw = RS.Text.measure(cur, 'bold');
    const bw = tw + 22;
    UI.panel(ctx, W - bw - 3, 3, bw, 16, 'dark', 0.88);
    RS.Sprites.draw(ctx, 'icon_ember', W - bw + 3, 6);
    RS.Text.draw(ctx, cur, W - 8, 5, { font: 'bold', color: P.emb6, align: 'right', shadow: P.ink0 });
    // sigils
    const sx = W - 3 - 3 * 17 - 4;
    UI.panel(ctx, sx - 2, 21, 3 * 17 + 8, 21, 'dark', 0.88);
    const order = ['root', 'tide', 'ember'];
    const themeMap = { moss: 'root', tide: 'tide', ember: 'ember' };
    const have = new Set(g.run.sigils.map((i) => themeMap[g.world.dungeons[i].theme]));
    order.forEach((k, i) => {
      const got = have.has(k);
      const x = sx + 2 + i * 17, y = 24;
      RS.Sprites.draw(ctx, 'sigil_' + k + (got ? '' : '_empty'), x, y);
      if (got && Math.floor(g.time * 2 + i) % 6 === 0) { ctx.fillStyle = P.white; ctx.fillRect(x + 4, y + 3, 1, 1); }
    });
    RS.Text.draw(ctx, T.hud.sigils + ' ' + g.run.sigils.length + '/3', W - 6, 44, { font: 'small', color: P.gold4, align: 'right', outline: P.ink0 });
  }

  function cooldowns(ctx, g) {
    const H = RS.App.H;
    const p = g.player;
    const items = [
      { icon: 'icon_blade', key: RS.Input.keyLabel('attack'), label: T.hud.attack, frac: p.atkCd > 0 ? p.atkCd / g.stats.atkCd : 0 },
      { icon: 'icon_dodge', key: RS.Input.keyLabel('dodge'), label: T.hud.dodge, frac: p.rollCd > 0 ? p.rollCd / g.stats.dodgeCd : (p.state === 'roll' ? 1 : 0) }
    ];
    let x = 4;
    const y = H - 26;
    for (const it of items) {
      const lbl = it.key + ' ' + it.label;
      const w = Math.max(24, RS.Text.measure(lbl, 'small') + 10);
      UI.panel(ctx, x, y, w, 23, it.frac > 0 ? 'dark' : 'gold', 0.9);
      RS.Sprites.draw(ctx, it.icon, x + Math.round(w / 2) - 5, y + 2);
      if (it.frac > 0) {
        const hh = Math.ceil(10 * it.frac);
        ctx.globalAlpha = 0.65; ctx.fillStyle = P.ink0; ctx.fillRect(x + Math.round(w / 2) - 5, y + 2 + 10 - hh, 10, hh); ctx.globalAlpha = 1;
      }
      RS.Text.draw(ctx, lbl, x + w / 2, y + 12, { font: 'small', color: it.frac > 0 ? P.bone3 : P.gold5, align: 'center' });
      x += w + 3;
    }
    return x;
  }

  function minimap(ctx, g, cx, cy) {
    const W = RS.App.W, H = RS.App.H;
    const mw = W < 380 ? 56 : 72, mh = W < 380 ? 40 : 50;
    const x = W - mw - 6, y = H - mh - 6;
    g._mmT = (g._mmT || 0) - 1;
    if (!g._mm || g._mm.name !== g.levelName || g._mmT <= 0) { g._mm = UI.mapCanvases(g, g.levelName); if (g._mm) g._mm.name = g.levelName; g._mmT = 20; }
    const mc = g._mm;
    UI.panel(ctx, x - 3, y - 3, mw + 6, mh + 6, 'stone');
    if (mc) {
      const ptx = Math.floor(g.player.x / TS), pty = Math.floor(g.player.y / TS);
      let sx = ptx - (mw >> 1), sy = pty - (mh >> 1);
      sx = RS.M.clamp(sx, 0, Math.max(0, mc.L.w - mw)); sy = RS.M.clamp(sy, 0, Math.max(0, mc.L.h - mh));
      ctx.fillStyle = P.ink1; ctx.fillRect(x, y, mw, mh);
      const dw = Math.min(mw, mc.L.w), dh = Math.min(mh, mc.L.h);
      const ox = x + ((mw - dw) >> 1), oy = y + ((mh - dh) >> 1);
      ctx.drawImage(mc.img, sx, sy, dw, dh, ox, oy, dw, dh);
      ctx.drawImage(mc.fog, sx, sy, dw, dh, ox, oy, dw, dh);
      for (const m of UI.mapMarkers(g, g.levelName)) {
        const mx = m.tx - sx, my = m.ty - sy;
        if (mx < 1 || my < 1 || mx >= dw - 1 || my >= dh - 1) continue;
        UI.drawMarker(ctx, m.type, ox + mx, oy + my, g.time, m.col);
      }
      const ob = g.objective();
      if (ob && ob.x !== null && ob.x !== undefined) {
        const tx = ob.x / TS - sx, ty = ob.y / TS - sy;
        if (tx >= 0 && ty >= 0 && tx < dw && ty < dh) UI.drawMarker(ctx, 'target', ox + tx, oy + ty, g.time);
        else {
          // clamp to the edge as a gold pip
          const ex = RS.M.clamp(tx, 1, dw - 2), ey = RS.M.clamp(ty, 1, dh - 2);
          ctx.fillStyle = P.gold4; ctx.fillRect(ox + Math.round(ex) - 1, oy + Math.round(ey) - 1, 2, 2);
        }
      }
      UI.drawMarker(ctx, 'player', ox + ptx - sx, oy + pty - sy, g.time);
    }
    // location caption
    let cap = '';
    if (g.levelName === 'overworld') {
      const L = g.level, tx = Math.floor(g.player.x / TS), ty = Math.floor(g.player.y / TS);
      const rg = L.inb(tx, ty) ? g.world.regions[L.region[ty * L.w + tx]] : null;
      cap = rg ? rg.name : '';
    } else if (g.levelName === 'arena') cap = T.lairName;
    else { const d = g.dungeonData[+g.levelName.slice(7)]; cap = d ? T.dungeons[d.theme].name : ''; }
    if (cap) {
      const cw = RS.Text.measure(cap, 'small') + 10;
      UI.panel(ctx, W - cw - 3, y - 18, cw, 14, 'dark', 0.88);
      RS.Text.draw(ctx, cap, W - 8, y - 17, { font: 'small', color: P.bone6, align: 'right' });
    }
    return { x: x - 3, y: y - 18 };
  }

  // region/dungeon title card; drops below the objective panel whenever they would overlap
  function banner(ctx, g, obj) {
    const b = g.banner;
    if (!b || g.dialog) return 0;
    const W = RS.App.W;
    const a = b.t < 0.4 ? b.t / 0.4 : b.t > b.max - 0.6 ? (b.max - b.t) / 0.6 : 1;
    ctx.globalAlpha = RS.M.clamp(a, 0, 1);
    const tw = RS.Text.measure(b.title, 'large');
    const sw = b.sub ? RS.Text.measure(b.sub, 'small') : 0;
    const w = Math.max(tw, sw) + 40;
    // top centre by default; below the objective panel if they would overlap; and if that would
    // cover the hero in the middle of the screen, just under the hero instead
    const bh = b.sub ? 36 : 24;
    let y = 50;
    if (obj && obj.right > W / 2 - w / 2 && obj.bottom + 6 > y) {
      y = obj.bottom + 6;
      if (y + bh > RS.App.H / 2 - 26) y = Math.round(RS.App.H / 2 + 14);
    }
    // ribbon lines
    ctx.fillStyle = P.gold2;
    ctx.fillRect(Math.round(W / 2 - w / 2), y + 20, w, 1);
    ctx.fillStyle = P.gold4;
    ctx.fillRect(Math.round(W / 2 - w / 2 + 10), y + 20, w - 20, 1);
    RS.Text.draw(ctx, b.title, W / 2, y, { font: 'large', color: P.bone7, outline: P.ink0, align: 'center' });
    if (b.sub) RS.Text.draw(ctx, b.sub, W / 2, y + 24, { font: 'small', color: P.gold4, outline: P.ink0, align: 'center' });
    ctx.globalAlpha = 1;
    return y + (b.sub ? 38 : 26);
  }

  function toasts(ctx, g, below, obj) {
    const W = RS.App.W;
    let y = below ? below + 4 : 58;
    for (const t of g.toasts) {
      const a = t.t < 0.2 ? t.t / 0.2 : t.t > t.max - 0.4 ? (t.max - t.t) / 0.4 : 1;
      ctx.globalAlpha = RS.M.clamp(a, 0, 1);
      const w = Math.min(W - 20, Math.max(RS.Text.measure(t.text, 'bold'), t.sub ? RS.Text.measure(t.sub, 'small') : 0) + 20);
      if (obj && obj.right > W / 2 - w / 2 && y < obj.bottom + 4) y = obj.bottom + 4;
      const h = t.sub ? 30 : 18;
      UI.panel(ctx, Math.round(W / 2 - w / 2), y, w, h, 'dark', 0.92);
      RS.Text.draw(ctx, UI.fitText(t.text, 'bold', w - 12), W / 2, y + 3, { font: 'bold', color: t.color, align: 'center', shadow: P.ink0 });
      if (t.sub) RS.Text.draw(ctx, t.sub, W / 2, y + 17, { font: 'small', color: P.bone5, align: 'center' });
      y += h + 3;
      ctx.globalAlpha = 1;
    }
    return g.toasts.length ? y : 0;
  }

  // bottom hint; waits (keeps its timer) while toasts reach down into its space on short screens
  function hint(ctx, g, leftX, mmTop, busyBottom) {
    const h = g.hint;
    if (!h || g.dialog) return;
    const W = RS.App.W, H = RS.App.H;
    const avail = Math.max(120, W - leftX - 90);
    const lines = RS.Text.wrap(h.text, 'body', avail - 16);
    const w = Math.max(...lines.map((l) => RS.Text.measure(l, 'body'))) + 16;
    const hh = lines.length * 15 + 8;
    let x = Math.round(W / 2 - w / 2);
    x = RS.M.clamp(x, leftX + 2, W - 84 - w);
    if (x < leftX + 2) x = leftX + 2;
    const y = H - hh - 6;
    if (busyBottom && busyBottom > y - 2) return;
    const a = h.t < 0.3 ? h.t / 0.3 : h.t > h.max - 0.4 ? (h.max - h.t) / 0.4 : 1;
    ctx.globalAlpha = RS.M.clamp(a, 0, 1);
    UI.panel(ctx, x, y, w, hh, 'ember', 0.92);
    lines.forEach((l, i) => RS.Text.draw(ctx, l, x + 8, y + 4 + i * 15, { font: 'body', color: P.bone7, shadow: P.ink0 }));
    ctx.globalAlpha = 1;
  }

  function prompt(ctx, g, cx, cy) {
    const p = g.player;
    let label = null, px = 0, py = 0;
    if (g.target && !g.dialog) {
      label = g.promptFor(g.target);
      px = g.target.x; py = g.target.y - (g.target.bodyH || 18) - 8;
      if (g.target.kind === 'sign' || g.target.kind === 'tablet') py = g.target.y - 30;
    }
    // walk-in entrances & gates
    if (!label && g.levelName === 'overworld') {
      const objs = g.level.objectsNear(p.x - 50, p.y - 60, p.x + 50, p.y + 60);
      for (const o of objs) {
        if ((o.kind === 'entrance' || o.kind === 'lairgate') && o.prompt && Math.hypot(o.x - p.x, o.y - p.y) < 44) {
          if (o.kind === 'entrance') {
            const dg = g.world.dungeons[o.dungeon];
            const name = T.dungeons[dg.theme].name;
            label = '↑ ' + T.prompt.enter + ' · ' + name + (g.run.sigils.includes(o.dungeon) ? ' ✓' : '');
          } else {
            label = o.sealed ? T.prompt.sealed + ' · ' + T.hud.sigils + ' ' + g.run.sigils.length + '/3' : '↑ ' + T.prompt.enter;
          }
          px = o.prompt.x; py = o.prompt.y;
          break;
        }
      }
    }
    if (!label && g.levelName.startsWith('dungeon')) {
      const d = g.dungeonData[+g.levelName.slice(7)];
      if (d && d.exitObj && Math.hypot(d.exitObj.x - p.x, d.exitObj.y - p.y) < 40) { label = '↑ ' + T.prompt.exit; px = d.exitObj.x; py = d.exitObj.y - 34; }
    }
    if (!label) return;
    const needKey = g.target && label === g.promptFor(g.target);
    const key = needKey ? RS.Input.keyLabel('interact') : null;
    const kw = key ? RS.Text.measure(key, 'small') + 8 : 0;
    const lw = RS.Text.measure(label, 'small');
    const w = kw + lw + 10;
    let x = Math.round(px - cx - w / 2), y = Math.round(py - cy - 14 + Math.sin(g.time * 4) * 1);
    x = RS.M.clamp(x, 2, RS.App.W - w - 2); y = RS.M.clamp(y, 2, RS.App.H - 16);
    UI.panel(ctx, x, y, w, 15, 'dark', 0.92);
    if (key) { UI.panel(ctx, x + 2, y + 1, kw, 13, 'gold'); RS.Text.draw(ctx, key, x + 2 + kw / 2, y + 2, { font: 'small', color: P.gold5, align: 'center' }); }
    RS.Text.draw(ctx, label, x + kw + 5, y + 2, { font: 'small', color: P.bone7 });
  }

  function bossBar(ctx, g) {
    const b = g.boss;
    if (!b || b.dead || !b.awake) return;
    const W = RS.App.W;
    const w = Math.min(W - 150, 260);
    const x = Math.round(W / 2 - w / 2), y = 20;
    RS.Text.draw(ctx, T.guardian, W / 2, y - 14, { font: 'bold', color: P.emb6, align: 'center', outline: P.ink0 });
    UI.panel(ctx, x - 3, y - 1, w + 6, 10, 'dark');
    const f = RS.M.clamp(b.hp / b.maxHp, 0, 1);
    const shown = b.shownHp === undefined ? f : b.shownHp;
    b.shownHp = shown + (f - shown) * 0.08;
    ctx.fillStyle = P.bone3; ctx.fillRect(x, y + 1, Math.round(w * b.shownHp), 6);
    ctx.fillStyle = b.exposed ? P.emb6 : P.emb3; ctx.fillRect(x, y + 1, Math.round(w * f), 6);
    ctx.fillStyle = P.emb5; ctx.fillRect(x, y + 1, Math.round(w * f), 1);
    // phase ticks
    for (const t of [0.6, 0.3]) { ctx.fillStyle = P.ink0; ctx.fillRect(x + Math.round(w * t), y, 1, 8); }
  }

  function draw(ctx, g, cx, cy) {
    if (g.over && g.victory) { toasts(ctx, g, banner(ctx, g, null), null); return; }
    compass(ctx, g, cx, cy);
    prompt(ctx, g, cx, cy);
    const hx = hearts(ctx, g);
    // during the fight the boss bar (name + health) is the objective, so the panel steps aside
    const bossUp = !!(g.boss && g.boss.awake && !g.boss.dead);
    if (g.godMode) godChip(ctx, bossUp ? 4 : hx + 6, bossUp ? 19 : 3);
    const obj = bossUp ? { bottom: 20, right: 0 } : objective(ctx, g, 20);
    topRight(ctx, g);
    const lx = cooldowns(ctx, g);
    const mm = minimap(ctx, g, cx, cy);
    bossBar(ctx, g);
    const bb = banner(ctx, g, obj);
    const tb = toasts(ctx, g, bb, obj);
    hint(ctx, g, lx, mm.y, Math.max(bb, tb));
  }

  RS.HUD = { draw };
})();
