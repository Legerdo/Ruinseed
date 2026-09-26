// Character sprites: the hooded hero (4 directions: idle/walk/attack/roll/hurt/death/cheer),
// relic blade at 16 angles, slash smears, camp keeper NPC, and combat effects.
(function () {
  'use strict';
  const P = RS.PAL, A = RS.Art, S = RS.Sprites;
  const SKIN = '#e9b98f', SKIN2 = '#c08563';
  const HERO = {
    C: P.emb4, c: P.emb3, d: P.emb2, h: P.earth2, s: SKIN, S: SKIN2, e: P.ink1,
    g: P.moss5, G: P.moss3, l: P.moss6, b: P.earth4, B: P.earth2, y: P.gold4, p: P.ink4, q: P.ink3, w: P.bone7, x: P.ink2
  };

  // ---- hero body rows (13 upper rows + 3 leg rows = 16) ---------------------------
  const FRONT = [
    '................',
    '......CCCC......',
    '.....cCCCCc.....',
    '....cccccccd....',
    '....chhhhhhd....',
    '....csesseSd....',
    '....csssssSd....',
    '....dcCccccd....',
    '...ccglgggGcd...',
    '...cdglggGGdd...',
    '...sdggggGGdS...',
    '....dbbyybbd....',
    '....dGgGGgGd....'
  ];
  const FRONT_BLINK = FRONT.slice(); FRONT_BLINK[5] = '....csxssxSd....';
  const FRONT_HURT = FRONT.slice(); FRONT_HURT[5] = '....cxsssxSd....'; FRONT_HURT[6] = '....cssxxsSd....';
  const BACK = [
    '................',
    '......CCCC......',
    '.....cCCdCc.....',
    '....cCCcdccd....',
    '....cCccdccd....',
    '....ccccdcdd....',
    '....dcccdcdd....',
    '....dcccccdd....',
    '...ccCcccccdd...',
    '...cCccdcccdd...',
    '...sccdcccdcS...',
    '....dccdccdd....',
    '....ddcdcdcd....'
  ];
  const SIDE = [
    '................',
    '.....CCCC.......',
    '....cCCCCc......',
    '...dccccCCh.....',
    '...dccccchs.....',
    '...dcccchse.....',
    '...dccccsss.....',
    '...ddcccccd.....',
    '..dccgglg.......',
    '..dccgggG.......',
    '..dccgggGs......',
    '..ddcbbyb.......',
    '..dddGgGG.......'
  ];
  const LEGS = {
    stand: ['.....pp..pp.....', '.....bb..bb.....', '....BBB..BBB....'],
    liftA: ['.....pp..pp.....', '.....BB..bb.....', '..........BBB...'],
    liftB: ['.....pp..pp.....', '.....bb..BB.....', '....BBB.........'],
    sStand: ['.....ppq........', '.....bbq........', '.....BBBB.......'],
    sApart: ['....qq..pp......', '....bb...bb.....', '...BB.....BBB...'],
    sApart2: ['....pp..qq......', '....bb...bb.....', '...BB.....BBB...'],
    sPass: ['.....pqq........', '.....bbb........', '.....BBBB.......']
  };

  function heroFrame(upper, legs, bob, opts) {
    opts = opts || {};
    const b = new A.PixBuf(18, 19);
    const put = (rows, y0) => {
      rows.forEach((row, ry) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          if (ch === '.') continue;
          b.set(x + 1, y0 + ry + 1, HERO[ch]);
        }
      });
    };
    const legRows = LEGS[legs];
    if (bob < 0) put([legRows[0]], 13 + bob + 1); // fill the gap when lifted
    put(legRows, 13 + 1);
    put(upper, bob + 1);
    if (opts.arm) {
      // extended sword arm in the facing direction
      for (const [x, y, c] of opts.arm) b.set(x + 1, y + 1 + bob, HERO[c]);
    }
    A.outline(b, P.ink0);
    return b;
  }

  function mirrorRows(rows) { return rows.map((r) => r.split('').reverse().join('')); }

  // curled roll ball, 4 rotations
  function rollFrame(f) {
    const b = new A.PixBuf(18, 19);
    const ball = new A.PixBuf(14, 14);
    ball.ellipse(7, 7, 6.5, 6.5, P.emb3);
    ball.ellipse(6, 6, 4.5, 4.2, P.emb4);
    ball.ellipse(5, 5, 2, 2, P.emb5);
    // tunic stripe + boot to read the rotation
    for (let i = 2; i < 12; i++) ball.set(i, 9, P.moss4);
    ball.set(10, 10, P.earth4); ball.set(11, 10, P.earth2); ball.set(3, 4, SKIN);
    const cv = A.rot90(ball.toCanvas(), f);
    const bb = A.bufFromCanvas(cv);
    b.blit(bb, 2, 4);
    A.outline(b, P.ink0);
    return b;
  }

  function deathFrames() {
    const out = [];
    // kneel
    const k = heroFrame(FRONT_HURT, 'stand', 2);
    out.push(k);
    // collapsed heap
    const h = new A.PixBuf(18, 19);
    h.ellipse(9, 14, 7.5, 3.5, P.emb3);
    h.ellipse(8, 13, 5.5, 2.3, P.emb4);
    h.rect(12, 13, 3, 2, P.earth4); h.set(4, 14, SKIN);
    h.hline(3, 14, 16, P.emb2);
    A.outline(h, P.ink0);
    out.push(h);
    // fading heap with embers
    const f = h.clone();
    for (let i = 0; i < f.u32.length; i++) if ((f.u32[i] >>> 24) && RS.rand2(i, 3, 9) < 0.45) f.u32[i] = 0;
    for (let k2 = 0; k2 < 6; k2++) f.set(4 + k2 * 2, 6 + (k2 % 3) * 2, k2 % 2 ? P.emb6 : P.emb5);
    out.push(f);
    return out;
  }

  // relic blade at an angle (radians); drawn around a pivot at (12,12) of a 24x24 buffer
  function bladeAt(angle, glow) {
    const b = new A.PixBuf(26, 26);
    const cx = 13, cy = 13;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    // hilt (2px behind pivot), guard, blade (10px)
    const at = (d, o) => [Math.round(cx + ca * d - sa * o), Math.round(cy + sa * d + ca * o)];
    for (let d = -3; d <= 11; d++) {
      for (let o = -1; o <= 1; o++) {
        const [x, y] = at(d, o * 0.6);
        if (d < 0) { if (o === 0) b.set(x, y, d === -3 ? P.gold3 : P.earth3); continue; }
        if (d === 0) { b.set(x, y, P.gold4); const [gx, gy] = at(0, o * 1.8); b.set(gx, gy, P.gold3); continue; }
        if (d === 11 && o !== 0) continue;
        const edge = o !== 0;
        b.set(x, y, edge ? (glow ? P.emb5 : P.bone5) : (glow ? P.emb7 : P.bone7));
      }
    }
    A.outline(b, P.ink0);
    return b;
  }

  // crescent smear for a swing; dir 0..3 (down,left,up,right), stage 0..2
  function slashArc(dir, stage) {
    const R = 22;
    const b = new A.PixBuf(R * 2 + 2, R * 2 + 2);
    const cx = R + 1, cy = R + 1;
    const base = [Math.PI / 2, Math.PI, -Math.PI / 2, 0][dir];
    const span = [1.3, 2.3, 2.5][stage];
    const r0 = [9, 8, 8][stage], r1 = [17, 20, 21][stage];
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      if (r < r0 || r > r1) continue;
      let a = Math.atan2(dy, dx) - base;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      const t = a / (span / 2);
      if (Math.abs(t) > 1) continue;
      // thickness tapers toward the ends of the arc
      const taper = 1 - Math.abs(t) * 0.75;
      const thick = (r1 - r0) * taper;
      if (r < r1 - thick) continue;
      const u = (r1 - r) / Math.max(1, thick);
      let c;
      if (stage === 2) c = u < 0.35 ? P.emb5 : P.emb3;
      else c = u < 0.3 ? P.white : u < 0.6 ? P.emb7 : u < 0.85 ? P.emb5 : P.emb4;
      if (stage === 2 && RS.rand2(x, y, 5) < 0.35) continue;
      b.set(x, y, c);
    }
    return b;
  }

  // camp keeper NPC: hooded elder with staff and lantern-lit face
  function keeper(f) {
    const rows = [
      '................',
      '.......GGG......',
      '......GllGG.....',
      '.....GlGGGGg....',
      '.....GwwwwGg....',
      '.....Gsesesg....',
      '.....GwwwwwG....',
      '....GGwwwwwGG...',
      '...GGgwwwwgGGb..',
      '...GgggwwggGGb..',
      '...sGgggggGGsb..',
      '...GGbbyybGGGb..',
      '...GGgGgGgGGGb..',
      '....GGGGGGGG.b..',
      '.....BB..BB..b..',
      '....BBB..BBB.b..'
    ];
    const pal = { G: P.moss3, g: P.moss4, l: P.moss6, w: P.bone6, s: SKIN, e: P.ink1, b: P.earth4, y: P.gold4, B: P.earth2 };
    const b = new A.PixBuf(18, 19);
    rows.forEach((row, ry) => { for (let x = 0; x < 16; x++) if (row[x] !== '.') b.set(x + 1, ry + 1 + (f === 1 && ry < 13 ? 1 : 0), pal[row[x]]); });
    // staff top ember
    b.set(14, 8 + (f === 1 ? 1 : 0), P.gold3); b.set(14, 7 + (f === 1 ? 1 : 0), f ? P.emb5 : P.emb6);
    A.outline(b, P.ink0);
    return b;
  }

  function effects() {
    // hit spark (4 frames)
    for (let f = 0; f < 4; f++) {
      const b = new A.PixBuf(15, 15);
      const r = [3, 6, 7, 5][f];
      const c = f < 2 ? P.white : f === 2 ? P.emb6 : P.emb4;
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + (f % 2) * 0.2;
        const len = k % 2 ? r * 0.55 : r;
        for (let d = (f >= 2 ? r * 0.4 : 0); d <= len; d++) b.set(Math.round(7 + Math.cos(a) * d), Math.round(7 + Math.sin(a) * d), c);
      }
      if (f < 2) b.rect(6, 6, 3, 3, P.white);
      S.add('fx_hit_' + f, b, 7, 7);
    }
    // dust puff (4 frames)
    for (let f = 0; f < 4; f++) {
      const b = new A.PixBuf(12, 10);
      const rr = [2, 3.5, 4.5, 4][f];
      b.ellipse(6, 6, rr, rr * 0.75, f < 3 ? P.bone5 : P.bone4);
      if (f > 0) b.ellipse(5, 5, rr * 0.55, rr * 0.4, P.bone6);
      if (f === 3) for (let i = 0; i < b.u32.length; i++) if (RS.rand2(i, 1, 4) < 0.5) b.u32[i] = 0;
      S.add('fx_dust_' + f, b, 6, 8);
    }
    // death poof (5 frames) — ink smoke ring with embers
    for (let f = 0; f < 5; f++) {
      const b = new A.PixBuf(24, 24);
      const r = 3 + f * 2.2;
      for (let k = 0; k < 10; k++) {
        const a = k / 10 * Math.PI * 2;
        const x = 12 + Math.cos(a) * r, y = 12 + Math.sin(a) * r * 0.85;
        const s = Math.max(0.8, 3 - f * 0.55);
        b.ellipse(x, y, s, s, f < 2 ? P.bone6 : f < 4 ? P.bone4 : P.bone3);
      }
      if (f < 2) b.ellipse(12, 12, 4 - f, 4 - f, P.white);
      if (f >= 1 && f <= 3) for (let k = 0; k < 4; k++) b.set(12 + Math.round(Math.cos(k * 1.7 + f) * (r + 2)), 12 + Math.round(Math.sin(k * 1.7 + f) * (r + 2)), P.emb5);
      S.add('fx_poof_' + f, b, 12, 12);
    }
    // seed projectile (spitter) and ember orb (guardian)
    const seed = A.fromRows(['.GG.', 'GlgG', 'GggG', '.GG.'], { G: P.moss2, g: P.moss5, l: P.moss8 });
    A.outline(seed, P.ink0);
    S.add('proj_seed', seed, 3, 3);
    for (let f = 0; f < 2; f++) {
      const b = new A.PixBuf(10, 10);
      b.ellipse(5, 5, 4, 4, f ? P.emb4 : P.emb3);
      b.ellipse(4.5, 4.5, 2.6, 2.6, f ? P.emb6 : P.emb5);
      b.set(4, 4, P.emb7);
      A.outline(b, P.emb1);
      S.add('proj_orb_' + f, b, 5, 5);
    }
    for (let f = 0; f < 2; f++) {
      const b = new A.PixBuf(8, 8);
      b.ellipse(4, 4, 3, 3, f ? P.sea6 : P.sea5); b.ellipse(3.5, 3.5, 1.6, 1.6, P.sea9);
      A.outline(b, P.ink1);
      S.add('proj_wisp_' + f, b, 4, 4);
    }
    // falling boulder (guardian summon)
    const fr = RS.Nature.rock(2, 'm', [P.rock1, P.rock2, P.rock3, P.rock4, P.rock5, P.rock6]);
    S.add('proj_rock', fr, 8, 14);
    // leaf bits for cut grass/bushes
    for (let f = 0; f < 3; f++) {
      const b = new A.PixBuf(4, 3);
      b.set(0, 1, P.moss3); b.set(1, 0, [P.moss5, P.moss6, P.moss7][f]); b.set(2, 1, [P.moss5, P.moss6, P.moss7][f]); b.set(3, 2, P.moss3);
      S.add('fx_leaf_' + f, b, 2, 1);
    }
  }

  function build() {
    // 18x19 frames, anchor at feet (9, 17)
    const AX = 9, AY = 17;
    const add = (k, buf) => S.add(k, buf, AX, AY);
    // down
    add('hero_down_idle_0', heroFrame(FRONT, 'stand', 0));
    add('hero_down_idle_1', heroFrame(FRONT, 'stand', 1));
    add('hero_down_blink', heroFrame(FRONT_BLINK, 'stand', 0));
    add('hero_down_walk_0', heroFrame(FRONT, 'stand', 0));
    add('hero_down_walk_1', heroFrame(FRONT, 'liftA', -1));
    add('hero_down_walk_2', heroFrame(FRONT, 'stand', 0));
    add('hero_down_walk_3', heroFrame(FRONT, 'liftB', -1));
    // up
    add('hero_up_idle_0', heroFrame(BACK, 'stand', 0));
    add('hero_up_idle_1', heroFrame(BACK, 'stand', 1));
    add('hero_up_walk_0', heroFrame(BACK, 'stand', 0));
    add('hero_up_walk_1', heroFrame(BACK, 'liftA', -1));
    add('hero_up_walk_2', heroFrame(BACK, 'stand', 0));
    add('hero_up_walk_3', heroFrame(BACK, 'liftB', -1));
    // side (right; left is mirrored at draw time)
    add('hero_side_idle_0', heroFrame(SIDE, 'sStand', 0));
    add('hero_side_idle_1', heroFrame(SIDE, 'sStand', 1));
    add('hero_side_walk_0', heroFrame(SIDE, 'sApart', 0));
    add('hero_side_walk_1', heroFrame(SIDE, 'sPass', -1));
    add('hero_side_walk_2', heroFrame(SIDE, 'sApart2', 0));
    add('hero_side_walk_3', heroFrame(SIDE, 'sPass', -1));
    // attack poses: wind-up (lean back) and strike (lean in, arm out)
    add('hero_down_atk_0', heroFrame(FRONT, 'stand', -1, { arm: [[12, 9, 's'], [13, 8, 's']] }));
    add('hero_down_atk_1', heroFrame(FRONT, 'liftB', 1, { arm: [[9, 11, 's'], [8, 12, 's']] }));
    add('hero_up_atk_0', heroFrame(BACK, 'stand', -1, { arm: [[2, 9, 's'], [2, 8, 's']] }));
    add('hero_up_atk_1', heroFrame(BACK, 'liftA', 1, { arm: [[7, 7, 's'], [8, 6, 's']] }));
    add('hero_side_atk_0', heroFrame(SIDE, 'sStand', -1, { arm: [[5, 8, 's'], [4, 7, 's']] }));
    add('hero_side_atk_1', heroFrame(SIDE, 'sApart', 1, { arm: [[10, 9, 's'], [11, 9, 's']] }));
    // hurt & death & cheer
    add('hero_down_hurt', heroFrame(FRONT_HURT, 'liftA', 0));
    add('hero_up_hurt', heroFrame(BACK, 'liftA', 0));
    add('hero_side_hurt', heroFrame(SIDE, 'sApart', 0));
    deathFrames().forEach((b, i) => add('hero_death_' + i, b));
    const cheer = FRONT.slice();
    cheer[8] = '..sccglgggGcds..'; cheer[9] = '..scdglggGGdds..'; cheer[10] = '....dggggGGd....';
    add('hero_cheer', heroFrame(cheer, 'stand', -1, { arm: [[2, 6, 's'], [13, 6, 's'], [2, 7, 's'], [13, 7, 's']] }));
    for (let f = 0; f < 4; f++) add('hero_roll_' + f, rollFrame(f));
    // blade at 16 angles (+ glowing variants)
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2;
      S.add('blade_' + k, bladeAt(a, false), 13, 13);
      S.add('bladeG_' + k, bladeAt(a, true), 13, 13);
    }
    for (let d = 0; d < 4; d++) for (let st = 0; st < 3; st++) S.add('slash_' + d + '_' + st, slashArc(d, st), 23, 23);
    S.add('keeper_0', keeper(0), 9, 17); S.add('keeper_1', keeper(1), 9, 17);
    S.add('shadow_hero', (() => { const b = new A.PixBuf(12, 4); b.ellipse(6, 2, 6, 2, P.ink0); return b; })(), 6, 2);
    effects();
    if (RS.EnemyArt) RS.EnemyArt.build();
  }

  RS.Characters = { build, heroFrame, FRONT, SIDE, BACK };
})();
