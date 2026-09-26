// Procedural structure sprites: autotiled ruin walls, pillars, statues, camp props, signs, chests,
// dungeon entrances (cliff caves, sunken stairs, root shrines), the guardian gate and landmarks.
(function () {
  'use strict';
  const P = RS.PAL, A = RS.Art, S = RS.Sprites;
  const BONE = [P.bone0, P.bone1, P.bone2, P.bone3, P.bone4, P.bone5, P.bone6, P.bone7];
  const ROCK = [P.rock0, P.rock1, P.rock2, P.rock3, P.rock4, P.rock5, P.rock6];
  const WOOD = [P.earth1, P.earth2, P.earth3, P.earth4, P.earth5, P.earth6];

  const ol = (b, c) => A.outline(b, c || P.ink0);
  const hsh = (x, y, s) => RS.rand2(x, y, s);

  // shaded stone block with bevel
  function block(b, x, y, w, h, pal, seed) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let c = pal[3];
      if (j === 0 || i === 0) c = pal[5];
      else if (j === h - 1 || i === w - 1) c = pal[1];
      else if (hsh(x + i, y + j, seed || 1) < 0.08) c = pal[2];
      else if (hsh(x + i, y + j, (seed || 1) + 5) < 0.06) c = pal[4];
      b.set(x + i, y + j, c);
    }
  }
  function bricks(b, x0, y0, w, h, pal, seed, mossy) {
    const bh = 5;
    for (let row = 0; row * bh < h; row++) {
      const off = (row % 2) * 4 + Math.floor(hsh(row, 0, seed) * 3);
      let x = x0 - off;
      while (x < x0 + w) {
        const bw = 6 + Math.floor(hsh(x, row, seed) * 4);
        const cx0 = Math.max(x0, x), cx1 = Math.min(x0 + w, x + bw - 1);
        const yy = y0 + row * bh, hh = Math.min(bh - 1, y0 + h - yy);
        if (cx1 > cx0 && hh > 0) {
          const pal2 = hsh(x, row, seed + 3) < 0.25 ? [pal[0], pal[1], pal[2], pal[2], pal[3], pal[4]] : pal;
          block(b, cx0, yy, cx1 - cx0, hh, pal2, seed + row);
        }
        x += bw;
      }
      // mortar line
      for (let i = x0; i < x0 + w; i++) if (y0 + row * bh + bh - 1 < y0 + h) b.set(i, y0 + row * bh + bh - 1, pal[0]);
    }
    if (mossy) for (let i = x0; i < x0 + w; i++) for (let j = y0; j < y0 + h; j++) if (hsh(i, j, seed + 11) < 0.07) b.set(i, j, hsh(i, j, 2) < 0.5 ? P.moss4 : P.moss3);
  }

  // ---- ruin walls: 16 x 28, anchor (8, 27) at tile bottom -------------------------
  function ruinWall(mask, broken) {
    const b = new A.PixBuf(16, 28);
    const N = mask & 1, E = mask & 2, Sx = mask & 4, Wx = mask & 8;
    const x0 = Wx ? 0 : 2, x1 = E ? 16 : 14;
    const topY = N ? 0 : 6;
    const faceTop = 14;
    const pal = [P.bone1, P.bone2, P.bone3, P.bone4, P.bone5, P.bone6];
    const topPal = [P.bone2, P.bone3, P.bone4, P.bone5, P.bone6, P.bone7];
    // top surface (walkway of the wall)
    const topBottom = Sx ? 28 : faceTop;
    for (let y = topY; y < topBottom; y++) for (let x = x0; x < x1; x++) {
      let c = topPal[3];
      if (hsh(x, y, 21 + mask) < 0.12) c = topPal[2];
      if (hsh(x, y, 22 + mask) < 0.05) c = topPal[5];
      if (!N && y === topY) c = topPal[5];
      if (!Wx && x === x0) c = topPal[4];
      if (!E && x === x1 - 1) c = topPal[1];
      b.set(x, y, c);
    }
    // stone joints on the top
    for (let y = topY + 4; y < topBottom; y += 5) for (let x = x0; x < x1; x++) if ((x + y) % 7 !== 0) b.set(x, y, topPal[1]);
    // front face when nothing continues south
    if (!Sx) {
      bricks(b, x0, faceTop, x1 - x0, 14, pal, 40 + mask, true);
      for (let x = x0; x < x1; x++) { b.set(x, faceTop, P.bone6); b.set(x, 27, P.ink2); }
    }
    if (broken) {
      // bite chunks out of the top
      const rng = new RS.RNG('rw' + mask);
      for (let k = 0; k < 3; k++) {
        const cx = rng.int(x0 + 1, x1 - 3), w = rng.int(2, 4), d = rng.int(2, 5);
        for (let y = topY; y < topY + d; y++) for (let x = cx; x < cx + w; x++) if (!N || y > 1) b.set(x, y, null);
      }
      for (let x = x0; x < x1; x++) if (hsh(x, 3, mask) < 0.3) b.set(x, faceTop - 1 < 0 ? 0 : faceTop + 2, P.moss5);
    }
    ol(b);
    return b;
  }

  function pillar(v) {
    const H = v === 0 ? 42 : v === 1 ? 30 : 14;
    const b = new A.PixBuf(16, H);
    const base = H - 1;
    // plinth
    block(b, 1, base - 4, 14, 4, BONE, 3);
    // shaft
    const top = v === 2 ? base - 8 : 5;
    for (let y = top; y < base - 4; y++) for (let x = 3; x < 13; x++) {
      const u = (x - 3) / 9;
      let c = u < 0.2 ? BONE[6] : u < 0.45 ? BONE[5] : u < 0.8 ? BONE[4] : BONE[3];
      if ((x - 3) % 3 === 2) c = BONE[3];
      if (hsh(x, y, 9) < 0.05) c = BONE[2];
      b.set(x, y, c);
    }
    if (v === 0) { block(b, 1, 1, 14, 5, BONE, 4); b.hline(2, 13, 0, BONE[6]); }
    else {
      // broken jagged top
      for (let x = 3; x < 13; x++) { const d = Math.floor(hsh(x, v, 7) * 4); for (let y = top; y < top + d; y++) b.set(x, y, null); b.set(x, top + d, BONE[6]); }
    }
    // moss & vines
    for (let y = top; y < base; y++) if (hsh(3, y, v) < 0.3) b.set(3 + Math.floor(hsh(y, 3, v) * 2), y, P.moss4);
    ol(b);
    return b;
  }
  function pillarFallen() {
    const b = new A.PixBuf(36, 16);
    for (let y = 4; y < 14; y++) for (let x = 3; x < 32; x++) {
      const u = (y - 4) / 9;
      let c = u < 0.25 ? BONE[6] : u < 0.5 ? BONE[5] : u < 0.8 ? BONE[4] : BONE[2];
      if ((y - 4) % 3 === 2) c = BONE[3];
      b.set(x, y, c);
    }
    b.ellipse(3, 9, 3, 5, BONE[5]); b.ellipse(3, 9, 2, 3, BONE[4]);
    for (let x = 8; x < 28; x++) if (hsh(x, 1, 5) < 0.4) b.set(x, 4, P.moss5);
    ol(b);
    return b;
  }
  function statue(v) {
    const b = new A.PixBuf(20, 36);
    block(b, 2, 29, 16, 6, BONE, 12);
    // robed figure
    for (let y = 8; y < 29; y++) {
      const hw = 3 + (y - 8) * 0.22;
      for (let x = Math.floor(10 - hw); x <= Math.ceil(10 + hw); x++) {
        const u = (x - (10 - hw)) / (2 * hw);
        let c = u < 0.3 ? BONE[6] : u < 0.65 ? BONE[5] : BONE[3];
        if ((y + x) % 5 === 0 && u > 0.4) c = BONE[4];
        b.set(x, y, c);
      }
    }
    b.ellipse(10, 6, 3.4, 3.6, BONE[5]); b.set(9, 5, BONE[7]); b.set(9, 6, BONE[2]); b.set(11, 6, BONE[2]);
    if (v === 0) { b.line(5, 14, 10, 20, BONE[4]); b.line(15, 14, 10, 20, BONE[3]); b.vline(10, 2, 26, BONE[2]); b.set(10, 1, P.gold3); }
    else { b.line(6, 12, 3, 20, BONE[4]); b.line(14, 12, 17, 20, BONE[3]); }
    for (let y = 8; y < 34; y++) if (hsh(y, v, 3) < 0.25) b.set(6 + Math.floor(hsh(v, y, 4) * 8), y, P.moss4);
    ol(b);
    return b;
  }

  function tablet() {
    const b = new A.PixBuf(16, 20);
    for (let y = 2; y < 19; y++) for (let x = 2; x < 14; x++) {
      const top = y < 5 && (x < 2 + (5 - y) || x > 13 - (5 - y));
      if (top) continue;
      let c = x < 4 ? P.rock5 : x > 11 ? P.rock2 : P.rock4;
      if (y === 18) c = P.rock1;
      b.set(x, y, c);
    }
    // carved glowing runes
    for (let r = 0; r < 4; r++) for (let x = 5; x < 11; x++) if (hsh(x, r, 8) < 0.65) b.set(x, 7 + r * 3, P.gold3);
    b.hline(4, 11, 17, P.moss4);
    ol(b);
    return b;
  }
  function signpost() {
    const b = new A.PixBuf(18, 24);
    b.rect(8, 8, 2, 16, WOOD[2]); b.vline(8, 8, 23, WOOD[3]);
    // arrow plank
    for (let y = 3; y < 10; y++) for (let x = 1; x < 16; x++) {
      if (x > 13 && Math.abs(y - 6.5) > (16 - x) * 1.5) continue;
      let c = y === 3 ? WOOD[5] : y === 9 ? WOOD[1] : WOOD[4];
      if ((x * 3 + y) % 7 === 0) c = WOOD[3];
      b.set(x, y, c);
    }
    b.hline(3, 11, 6, WOOD[2]);
    b.set(5, 23, P.moss4); b.set(11, 23, P.moss5);
    ol(b);
    return b;
  }

  function campfire(f) {
    const b = new A.PixBuf(20, 22);
    // stones ring
    const stones = [[3, 18], [6, 20], [10, 21], [14, 20], [17, 18], [4, 15], [16, 15]];
    for (const [x, y] of stones) { b.rect(x - 1, y - 1, 3, 2, P.bone3); b.set(x - 1, y - 1, P.bone5); b.set(x + 1, y, P.bone1); }
    // logs
    b.line(5, 18, 14, 14, WOOD[2]); b.line(5, 17, 14, 13, WOOD[4]);
    b.line(14, 18, 6, 14, WOOD[1]); b.line(14, 17, 6, 13, WOOD[3]);
    b.set(10, 17, P.emb2); b.set(9, 16, P.emb3);
    // flames (frame dependent)
    const rng = new RS.RNG('fire' + f);
    const hgt = [11, 13, 10, 12][f];
    for (let y = 0; y < hgt; y++) {
      const t = y / hgt;
      const hw = (1 - t) * 4.2 + Math.sin(y * 0.9 + f * 1.7) * 0.7;
      const cx = 10 + Math.sin(y * 0.5 + f) * (t * 1.3);
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
        const u = Math.abs(x - cx) / Math.max(0.5, hw);
        const c = u < 0.35 && t < 0.6 ? P.emb7 : u < 0.6 ? P.emb5 : P.emb4;
        b.set(x, 15 - y, t > 0.8 && rng.chance(0.4) ? P.emb3 : c);
      }
    }
    if (f % 2) b.set(7 + f, 1, P.emb5);
    ol(b, P.ink1);
    return b;
  }
  function lantern(f) {
    const b = new A.PixBuf(12, 26);
    b.rect(5, 10, 2, 16, P.rock2); b.vline(5, 10, 25, P.rock4);
    b.rect(3, 24, 6, 2, P.rock2);
    // lamp housing
    b.rect(2, 3, 8, 8, P.ink2); b.rect(3, 4, 6, 6, [P.emb5, P.emb6, P.emb5, P.emb4][f]);
    b.rect(5, 5, 2, 3, P.emb7);
    b.hline(1, 10, 2, P.rock3); b.hline(3, 8, 1, P.rock2); b.set(5, 0, P.rock3);
    ol(b);
    return b;
  }
  function brazier(f, lit) {
    const b = new A.PixBuf(18, 26);
    block(b, 5, 16, 8, 9, BONE, 30);
    // bowl
    for (let y = 11; y < 16; y++) { const hw = 6 - (y - 11) * 0.6; for (let x = Math.floor(9 - hw); x <= Math.ceil(9 + hw); x++) b.set(x, y, y === 11 ? P.bone6 : x < 7 ? P.bone5 : P.bone3); }
    b.hline(2, 16, 11, P.bone6);
    if (lit) {
      const hgt = [9, 11, 8, 10][f];
      for (let y = 0; y < hgt; y++) {
        const t = y / hgt;
        const hw = (1 - t) * 5 + Math.sin(y + f * 2) * 0.8;
        const cx = 9 + Math.sin(y * 0.6 + f) * t * 1.5;
        for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
          const u = Math.abs(x - cx) / Math.max(0.5, hw);
          b.set(x, 10 - y, u < 0.35 && t < 0.55 ? P.emb7 : u < 0.65 ? P.emb5 : P.emb4);
        }
      }
    } else {
      b.hline(4, 14, 10, P.ink2); b.set(7, 10, P.earth2); b.set(10, 10, P.earth3);
    }
    ol(b);
    return b;
  }
  function tent() {
    const b = new A.PixBuf(36, 30);
    for (let y = 2; y < 28; y++) {
      const t = (y - 2) / 26;
      const hw = 3 + t * 14;
      for (let x = Math.floor(18 - hw); x <= Math.ceil(18 + hw); x++) {
        const u = (x - (18 - hw)) / (2 * hw);
        let c = u < 0.5 ? (u < 0.15 ? P.bone6 : P.bone5) : (u > 0.85 ? P.bone2 : P.bone4);
        if (y > 18 && Math.abs(x - 18) < (y - 18) * 0.5) c = P.ink1; // opening
        if (y % 6 === 0 && Math.abs(x - 18) > 2) c = P.emb3;
        b.set(x, y, c);
      }
    }
    b.vline(18, 0, 18, P.earth2); b.set(18, 0, P.earth4);
    b.line(3, 28, 1, 29, P.earth3); b.line(33, 28, 35, 29, P.earth3);
    ol(b);
    return b;
  }
  function logseat(vertical) {
    if (vertical) {
      const b = new A.PixBuf(14, 12);
      for (let y = 4; y < 11; y++) for (let x = 2; x < 12; x++) b.set(x, y, x < 4 ? WOOD[4] : x > 9 ? WOOD[1] : WOOD[2]);
      b.ellipse(7, 4, 5, 2.4, WOOD[5]); b.ellipse(7, 4, 3, 1.3, WOOD[4]);
      ol(b);
      return b;
    }
    const b = new A.PixBuf(32, 12);
    for (let y = 3; y < 11; y++) for (let x = 2; x < 30; x++) { const u = (y - 3) / 7; b.set(x, y, u < 0.25 ? WOOD[5] : u < 0.6 ? WOOD[3] : WOOD[1]); }
    b.ellipse(2, 7, 2, 4, WOOD[5]); b.ellipse(2, 7, 1, 2, WOOD[4]);
    ol(b);
    return b;
  }
  function crate() {
    const b = new A.PixBuf(16, 16);
    block(b, 1, 2, 14, 13, [WOOD[0], WOOD[1], WOOD[2], WOOD[3], WOOD[4], WOOD[5]], 5);
    b.line(2, 3, 13, 13, WOOD[2]); b.line(2, 13, 13, 3, WOOD[2]);
    b.hline(1, 14, 2, WOOD[5]);
    ol(b);
    return b;
  }
  function barrel() {
    const b = new A.PixBuf(14, 16);
    for (let y = 2; y < 15; y++) { const hw = 5 + Math.sin((y - 2) / 13 * Math.PI) * 1; for (let x = Math.floor(7 - hw); x <= Math.ceil(7 + hw); x++) b.set(x, y, x < 5 ? WOOD[4] : x > 9 ? WOOD[1] : WOOD[3]); }
    b.hline(1, 12, 4, P.rock3); b.hline(1, 12, 12, P.rock3);
    b.ellipse(7, 2.5, 5, 1.6, WOOD[5]);
    ol(b);
    return b;
  }
  function bedroll() {
    const b = new A.PixBuf(18, 9);
    b.rect(1, 2, 16, 6, P.emb2); b.rect(1, 2, 16, 2, P.emb3); b.rect(12, 2, 5, 6, P.bone5); b.set(13, 3, P.bone6);
    ol(b);
    return b;
  }
  function chest(open) {
    const b = new A.PixBuf(18, 16);
    const wood = [WOOD[0], WOOD[1], WOOD[2], WOOD[3], WOOD[4], WOOD[5]];
    if (!open) {
      block(b, 1, 5, 16, 10, wood, 7);
      for (let x = 2; x < 16; x++) { b.set(x, 3, WOOD[4]); b.set(x, 4, WOOD[3]); }
      b.hline(3, 14, 2, WOOD[5]);
      b.vline(4, 3, 14, P.gold2); b.vline(13, 3, 14, P.gold2);
      b.rect(8, 7, 2, 3, P.gold4); b.set(8, 9, P.gold1);
    } else {
      block(b, 1, 7, 16, 8, wood, 7);
      b.rect(2, 1, 14, 5, WOOD[2]); b.hline(2, 15, 1, WOOD[4]);
      b.rect(3, 6, 12, 2, P.ink1);
      b.set(7, 6, P.gold4); b.set(10, 6, P.gold5);
      b.vline(4, 1, 14, P.gold2); b.vline(13, 1, 14, P.gold2);
    }
    ol(b);
    return b;
  }

  // ---- dungeon entrances --------------------------------------------------------------
  const THEME = {
    moss: { glow: P.rootGlow, dim: P.moss4, rock: [P.rock1, P.rock2, P.rock3, P.rock4, P.rock5, P.rock6], accent: P.moss5 },
    tide: { glow: P.tideGlow, dim: P.sea5, rock: [P.bone1, P.bone2, P.bone3, P.bone4, P.bone5, P.bone6], accent: P.sea6 },
    ember: { glow: P.emberGlow, dim: P.emb3, rock: [P.cany1, P.cany2, P.cany3, P.cany4, P.cany5, P.cany6], accent: P.emb4 }
  };
  // cave mouth cut into a cliff face: 36 x 34, anchor bottom centre
  function caveMouth(theme) {
    const T = THEME[theme];
    const W = 36, H = 34;
    const b = new A.PixBuf(W, H);
    const cx = 18, by = H - 1;
    // rocky arch frame
    for (let y = 2; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - cx) / 17, dy = (y - by) / 31;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const inner = ((x - cx) / 11.5) ** 2 + ((y - by) / 22) ** 2;
      if (inner < 1) {
        // interior darkness with depth rings
        const depth = 1 - inner;
        let c = depth > 0.55 ? P.black : depth > 0.3 ? P.ink0 : depth > 0.12 ? P.ink1 : P.ink2;
        b.set(x, y, c);
      } else {
        const u = (x - cx) / 17;
        let li = 0.6 - u * 0.3 - (y / H) * 0.25 + (hsh(x >> 1, y >> 1, 3) - 0.5) * 0.3;
        if (inner < 1.18) li -= 0.25;
        b.set(x, y, T.rock[RS.M.clamp(Math.floor(li * 6), 0, 5)]);
      }
    }
    // glow motes inside
    const rng = new RS.RNG('cave' + theme);
    for (let k = 0; k < 7; k++) { const x = cx + rng.int(-7, 7), y = by - rng.int(2, 14); if (b.get(x, y) === RS.Color.c32(P.black) || b.get(x, y) === RS.Color.c32(P.ink0)) b.set(x, y, k < 3 ? T.glow : T.dim); }
    // theme dressing
    if (theme === 'moss') {
      for (let k = 0; k < 9; k++) { let x = rng.int(4, W - 5), y = rng.int(3, 8); for (let j = 0; j < rng.int(4, 11); j++) { if (b.opaque(x, y + j)) b.set(x, y + j, j % 3 ? P.moss4 : P.moss6); } }
    } else if (theme === 'tide') {
      for (let k = 0; k < 5; k++) { const x = rng.int(8, W - 9); for (let j = 0; j < 4; j++) b.set(x, 6 + j + k, P.sea6); }
      b.hline(cx - 9, cx + 9, by, P.sea5);
    } else {
      for (let k = 0; k < 8; k++) { let x = rng.int(3, W - 4), y = rng.int(6, H - 3); for (let j = 0; j < 4; j++) { if (b.opaque(x, y) && b.get(x, y) !== RS.Color.c32(P.black)) b.set(x, y, j < 2 ? P.emb4 : P.emb3); x += rng.sign(); y += 1; } }
    }
    ol(b);
    return b;
  }

  // sunken stairwell framed by broken pillars: 52 x 50, anchor bottom centre
  function ruinStairs(theme) {
    const T = THEME[theme];
    const W = 52, H = 50;
    const b = new A.PixBuf(W, H);
    const cx = 26;
    // stone rim platform
    for (let y = 18; y < H - 1; y++) for (let x = 4; x < W - 4; x++) {
      const c = hsh(x >> 1, y >> 1, 12) < 0.12 ? P.bone3 : (y < 21 ? P.bone6 : P.bone4);
      b.set(x, y, c);
    }
    // stairwell pit (central tile) descending north into darkness
    for (let y = 20; y < 44; y++) for (let x = cx - 9; x <= cx + 8; x++) {
      const step = Math.floor((44 - y) / 4);
      const t = step / 6;
      let c = (44 - y) % 4 === 0 ? P.bone5 : (44 - y) % 4 === 1 ? P.bone3 : P.bone2;
      if (t > 0.5) c = (44 - y) % 4 === 0 ? P.bone2 : P.ink2;
      if (t > 0.75) c = P.ink1;
      if (y < 24) c = P.black;
      b.set(x, y, c);
    }
    for (let y = 20; y < 44; y++) { b.set(cx - 10, y, P.bone1); b.set(cx + 9, y, P.ink2); }
    // broken pillars on both sides
    const pil = (x0, hgt) => {
      for (let y = 44 - hgt; y < 46; y++) for (let x = x0; x < x0 + 8; x++) b.set(x, y, x < x0 + 2 ? P.bone6 : x > x0 + 5 ? P.bone3 : P.bone5);
      for (let x = x0; x < x0 + 8; x++) { const d = Math.floor(hsh(x, x0, 2) * 3); for (let y = 44 - hgt; y < 44 - hgt + d; y++) b.set(x, y, null); }
      b.rect(x0 - 1, 44, 10, 4, P.bone4); b.hline(x0 - 1, x0 + 8, 44, P.bone6);
    };
    pil(4, 36); pil(W - 12, 28);
    // lintel fragment
    for (let x = 10; x < 30; x++) { b.set(x, 10, P.bone6); b.set(x, 11, P.bone4); b.set(x, 12, P.bone3); }
    // moss / water dressing
    for (let k = 0; k < 40; k++) { const x = (hsh(k, 1, 7) * W) | 0, y = 18 + ((hsh(k, 2, 7) * 30) | 0); if (b.opaque(x, y) && b.get(x, y) !== RS.Color.c32(P.black)) b.set(x, y, theme === 'tide' ? (k % 3 ? P.sea5 : P.sea7) : P.moss4); }
    // faint glow at the bottom of the stairs
    b.set(cx - 1, 22, T.glow); b.set(cx + 2, 23, T.dim); b.set(cx - 4, 23, T.dim);
    ol(b);
    return b;
  }

  // root-covered stone shrine with a dark doorway: 52 x 54
  function rootShrine(theme) {
    const T = THEME[theme];
    const W = 52, H = 54;
    const b = new A.PixBuf(W, H);
    const cx = 26;
    // stone arch body
    for (let y = 6; y < H - 1; y++) for (let x = 6; x < W - 6; x++) {
      const dx = (x - cx) / 20, dy = (y - (H - 1)) / 46;
      if (dx * dx + dy * dy > 1) continue;
      const inner = ((x - cx) / 8.5) ** 2 + ((y - (H - 1)) / 22) ** 2;
      if (inner < 1) {
        const depth = 1 - inner;
        b.set(x, y, depth > 0.5 ? P.black : depth > 0.25 ? P.ink0 : P.ink1);
      } else {
        const u = (x - cx) / 20;
        let li = 0.62 - u * 0.3 - (y / H) * 0.2 + (hsh(x >> 1, y >> 1, 4) - 0.5) * 0.25;
        b.set(x, y, T.rock[RS.M.clamp(Math.floor(li * 6), 0, 5)]);
      }
    }
    // roots crawling over the arch
    const rng = new RS.RNG('roots' + theme);
    for (let k = 0; k < 11; k++) {
      let x = rng.int(4, W - 5), y = rng.int(2, 10);
      let a = Math.PI / 2 + rng.range(-0.8, 0.8);
      for (let j = 0; j < 40; j++) {
        x += Math.cos(a) * 0.9; y += Math.sin(a) * 0.9;
        a += rng.range(-0.3, 0.3);
        if (y >= H - 1) break;
        const xi = Math.round(x), yi = Math.round(y);
        const inner = ((xi - cx) / 8.5) ** 2 + ((yi - (H - 1)) / 22) ** 2;
        if (inner < 0.95) break;
        b.set(xi, yi, P.earth3); b.set(xi + 1, yi, P.earth2); if (j % 5 === 0) b.set(xi - 1, yi, P.earth4);
      }
    }
    // leafy crown on top
    const crown = RS.Nature.canopy(W, 16, [{ x: 16, y: 8, r: 8 }, { x: 28, y: 6, r: 10 }, { x: 38, y: 9, r: 7 }], [P.moss1, P.moss2, P.moss3, P.moss4, P.moss5, P.moss6], 77, { sparks: 6 });
    b.blit(crown, 0, 0);
    // glowing rune stones by the door
    for (const [x, y] of [[cx - 12, H - 6], [cx + 11, H - 6]]) { b.rect(x - 1, y - 3, 3, 5, P.rock3); b.set(x, y - 2, T.glow); b.set(x, y, T.dim); }
    for (let k = 0; k < 5; k++) { const x = cx + rng.int(-5, 5), y = H - 1 - rng.int(3, 15); if (b.get(x, y) === RS.Color.c32(P.black)) b.set(x, y, k < 2 ? T.glow : T.dim); }
    ol(b);
    return b;
  }

  // the guardian's sealed gate: 88 x 72, set into the lair cliff
  function lairGate(open) {
    const W = 88, H = 72;
    const b = new A.PixBuf(W, H);
    const cx = 44;
    const DK = [P.ink1, P.ink2, P.rock1, P.rock2, P.rock3, P.rock4, P.rock5];
    // facade slab
    for (let y = 10; y < H - 1; y++) for (let x = 8; x < W - 8; x++) {
      let li = 0.5 + (hsh(x >> 2, y >> 2, 5) - 0.5) * 0.25 - (y / H) * 0.15;
      b.set(x, y, DK[RS.M.clamp(Math.floor(li * 7), 0, 6)]);
    }
    // stepped pediment
    for (let s = 0; s < 3; s++) for (let x = 12 + s * 8; x < W - 12 - s * 8; x++) for (let y = 10 - s * 3; y < 13 - s * 3; y++) b.set(x, y, y % 3 === 0 ? P.rock5 : P.rock3);
    // pillars
    for (const x0 of [10, W - 22]) {
      for (let y = 14; y < H - 1; y++) for (let x = x0; x < x0 + 12; x++) {
        const u = (x - x0) / 11;
        let c = u < 0.2 ? P.rock6 : u < 0.5 ? P.rock5 : u < 0.8 ? P.rock4 : P.rock2;
        if ((x - x0) % 4 === 3) c = P.rock3;
        b.set(x, y, c);
      }
      block(b, x0 - 2, 12, 16, 4, DK, 9); block(b, x0 - 2, H - 6, 16, 5, DK, 10);
    }
    // doorway
    const dx0 = cx - 18, dx1 = cx + 18, dy0 = 24;
    for (let y = dy0; y < H - 1; y++) for (let x = dx0; x < dx1; x++) {
      const arch = y < dy0 + 10 && ((x - cx) / 18) ** 2 + ((y - (dy0 + 10)) / 10) ** 2 > 1;
      if (arch) continue;
      if (open) {
        const depth = (y - dy0) / (H - dy0);
        b.set(x, y, depth < 0.15 ? P.ink1 : P.black);
        if (hsh(x, y, 3) < 0.02) b.set(x, y, P.emb3);
      } else {
        // two stone door leaves with carvings
        const leaf = x < cx ? 0 : 1;
        let c = (x - dx0) % 18 < 2 ? P.rock5 : P.rock3;
        if (Math.abs(x - cx) < 1) c = P.ink0;
        if ((y - dy0) % 12 === 11) c = P.rock2;
        if (hsh(x >> 1, y >> 1, leaf + 20) < 0.06) c = P.rock2;
        b.set(x, y, c);
      }
    }
    // three sigil sockets arc above the door
    const sockets = [[cx - 14, 20], [cx, 16], [cx + 14, 20]];
    for (const [x, y] of sockets) { b.ellipse(x, y, 4, 4, P.gold1); b.ellipse(x, y, 2.6, 2.6, P.ink1); }
    // gold trim
    for (let x = dx0 - 2; x < dx1 + 2; x++) if (x % 3 !== 0) b.set(x, dy0 - 1, P.gold2);
    // cracks and ivy
    const rng = new RS.RNG('gate');
    for (let k = 0; k < 6; k++) { let x = rng.int(12, W - 12), y = rng.int(12, 30); for (let j = 0; j < 12; j++) { b.set(x, y, P.ink1); y++; x += rng.int(-1, 1); } }
    for (let k = 0; k < 8; k++) { const x = rng.int(8, W - 8); for (let j = 0; j < rng.int(4, 14); j++) b.set(x + (j % 3 === 0 ? 1 : 0), 12 + j, j % 2 ? P.moss3 : P.moss4); }
    ol(b);
    return { buf: b, sockets };
  }

  // ---- landmarks ------------------------------------------------------------------------
  function giantTree() {
    const W = 72, H = 88;
    const b = new A.PixBuf(W, H);
    const cx = 36, base = H - 2;
    // massive trunk with buttress roots
    for (let y = 42; y <= base; y++) {
      const t = (y - 42) / (base - 42);
      const hw = 6 + t * t * 12;
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
        const u = (x - (cx - hw)) / (2 * hw);
        let c = u < 0.2 ? P.earth5 : u < 0.5 ? P.earth4 : u < 0.8 ? P.earth3 : P.earth2;
        if (((x * 5 + y * 2) % 9) === 0) c = P.earth2;
        if (t > 0.6 && Math.abs(x - cx) > 4 && hsh(x, y, 3) < 0.15) c = P.earth1;
        b.set(x, y, c);
      }
    }
    // hollow with glow
    b.ellipse(cx + 1, base - 9, 3.5, 5, P.ink0); b.set(cx, base - 10, P.gold4); b.set(cx + 2, base - 8, P.gold3);
    const sp = [{ x: cx, y: 26, r: 24, ry: 20, h: 1.1 }];
    const rng = new RS.RNG('giant');
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; sp.push({ x: cx + Math.cos(a) * 20, y: 26 + Math.sin(a) * 14, r: rng.range(9, 13), h: 0.85, z: Math.sin(a) < 0 ? 0.2 : 0 }); }
    const cn = RS.Nature.canopy(W, 54, sp, [P.moss0, P.moss1, P.moss2, P.moss3, P.moss4, P.moss5, P.moss6, P.moss7], 4242, { clump: 3, sparks: 30 });
    b.blit(cn, 0, 0);
    // golden fruit / motes
    for (let k = 0; k < 7; k++) { const x = rng.int(12, W - 12), y = rng.int(10, 40); if (b.opaque(x, y)) b.set(x, y, P.gold4); }
    ol(b, P.moss0);
    return b;
  }
  function bigWillow() {
    const b = new A.PixBuf(60, 64);
    const src = RS.Art.bufFromCanvas(S.get('tree_willow_1').canvas);
    // scale up 1.5x by nearest duplication with extra strands (hand-crafted feel via new canopy)
    const cx = 30, base = 62;
    for (let y = 30; y <= base; y++) { const hw = 5 + ((y - 30) / 32) ** 2 * 8; for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) b.set(x, y, x < cx - 2 ? P.earth4 : x > cx + 3 ? P.earth2 : P.earth3); }
    const sp = [{ x: cx, y: 20, r: 20, ry: 15 }];
    for (let k = 0; k < 7; k++) { const a = Math.PI + (k / 6) * Math.PI; sp.push({ x: cx + Math.cos(a) * 14, y: 20 + Math.sin(a) * 7, r: 10 }); }
    const cn = RS.Nature.canopy(60, 40, sp, [P.moss1, P.moss2, P.moss3, P.moss4, P.moss5, P.moss6, P.moss7], 5151, { sparks: 16 });
    b.blit(cn, 0, 0);
    const rng = new RS.RNG('bw');
    for (let x = 6; x < 54; x++) {
      if (rng.chance(0.3)) continue;
      let y0 = 0;
      for (let y = 39; y > 0; y--) if (b.opaque(x, y)) { y0 = y; break; }
      if (!y0) continue;
      const len = rng.int(8, 22);
      for (let k = 1; k <= len; k++) b.set(x, y0 + k, k > len - 2 ? P.moss2 : k % 3 ? P.moss4 : P.moss5);
    }
    void src;
    ol(b);
    return b;
  }
  function lighthouse() {
    const W = 36, H = 76;
    const b = new A.PixBuf(W, H);
    const cx = 18;
    for (let y = 14; y < H - 1; y++) {
      const hw = 8 + (y - 14) / (H - 14) * 5;
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
        const u = (x - (cx - hw)) / (2 * hw);
        let c = u < 0.25 ? P.bone6 : u < 0.55 ? P.bone5 : u < 0.8 ? P.bone4 : P.bone2;
        if (Math.floor(y / 10) % 2 === 1) c = u < 0.25 ? '#c98a78' : u < 0.55 ? '#b0705e' : u < 0.8 ? '#8e5446' : '#5e3530';
        if ((y % 5 === 0)) c = P.bone3;
        b.set(x, y, c);
      }
    }
    // broken lantern room
    for (let y = 4; y < 14; y++) for (let x = cx - 7; x <= cx + 7; x++) { if (y < 8 && hsh(x, y, 4) < 0.45) continue; b.set(x, y, (x - cx + 7) % 4 === 0 ? P.rock2 : P.ink2); }
    b.rect(cx - 2, 8, 4, 4, P.gold4); b.set(cx - 1, 9, P.gold5);
    b.hline(cx - 9, cx + 9, 14, P.rock3);
    // door and window
    b.rect(cx - 2, H - 10, 5, 9, P.ink1); b.rect(cx - 1, 30, 3, 5, P.ink1);
    for (let y = 16; y < H - 1; y++) if (hsh(y, 2, 1) < 0.2) b.set(cx - 8 + Math.floor(hsh(2, y, 1) * 4), y, P.moss4);
    ol(b);
    return b;
  }
  function shipwreck() {
    const W = 76, H = 44;
    const b = new A.PixBuf(W, H);
    // tilted hull
    for (let x = 4; x < W - 4; x++) {
      const t = (x - 4) / (W - 8);
      const top = 14 + Math.round(Math.sin(t * Math.PI) * -6 + t * 6);
      const bot = 38 - Math.round(Math.abs(t - 0.45) * 10);
      for (let y = top; y < bot; y++) {
        let c = ((y - top) % 4 === 0) ? P.earth1 : ((y - top) < 3 ? P.earth5 : P.earth3);
        if (x > W * 0.55 && x < W * 0.7 && y > top + 6) c = P.ink1; // hole
        b.set(x, y, c);
      }
    }
    // ribs sticking out
    for (let k = 0; k < 4; k++) { const x = 46 + k * 5; b.line(x, 20, x + 3, 8 + k, P.bone4); b.line(x + 1, 20, x + 4, 8 + k, P.bone2); }
    // broken mast
    b.line(26, 16, 18, 2, P.earth4); b.line(27, 16, 19, 2, P.earth2);
    for (let x = 6; x < W - 6; x++) if (hsh(x, 1, 5) < 0.5) b.set(x, 38 - Math.round(Math.abs((x - 4) / (W - 8) - 0.45) * 10), P.moss4);
    ol(b);
    return b;
  }
  function deadGiant() {
    const W = 60, H = 72;
    const b = new A.PixBuf(W, H);
    const cx = 30, base = H - 2;
    const bark = [P.ink2, P.earth1, P.earth2, P.bone2, P.bone3];
    for (let y = 22; y <= base; y++) {
      const t = (y - 22) / (base - 22);
      const hw = 5 + t * t * 10;
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) { const u = (x - (cx - hw)) / (2 * hw); b.set(x, y, u < 0.25 ? bark[3] : u < 0.6 ? bark[2] : bark[1]); }
    }
    const rng = new RS.RNG('deadgiant');
    const branch = (x, y, a, len, w) => {
      for (let i = 0; i < len; i++) {
        x += Math.cos(a); y += Math.sin(a);
        for (let k = 0; k < w; k++) b.set(Math.round(x) + k, Math.round(y), k === 0 ? bark[3] : bark[1]);
        a += rng.range(-0.2, 0.2);
      }
      if (len > 5) { branch(x, y, a - rng.range(0.4, 0.8), len * 0.6, Math.max(1, w - 1)); branch(x, y, a + rng.range(0.3, 0.8), len * 0.55, Math.max(1, w - 1)); }
    };
    branch(cx - 2, 26, -Math.PI / 2 - 0.6, 16, 3);
    branch(cx + 2, 28, -Math.PI / 2 + 0.7, 15, 3);
    branch(cx, 24, -Math.PI / 2, 12, 2);
    for (let k = 0; k < 14; k++) { const x = rng.int(6, W - 6); for (let y = 4; y < 40; y++) if (b.opaque(x, y)) { for (let j = 1; j < rng.int(4, 11); j++) b.set(x, y + j, j % 2 ? P.swamp4 : P.swamp3); break; } }
    b.ellipse(cx, base - 10, 3, 4, P.ink0); b.set(cx, base - 11, P.tideGlow);
    ol(b);
    return b;
  }
  function rockArch() {
    const W = 60, H = 46;
    const b = new A.PixBuf(W, H);
    const R = [P.cany1, P.cany2, P.cany3, P.cany4, P.cany5, P.cany6];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const outer = ((x - 30) / 29) ** 2 + ((y - (H - 1)) / 44) ** 2;
      const inner = ((x - 30) / 17) ** 2 + ((y - (H - 1)) / 30) ** 2;
      if (outer > 1 || inner < 1) continue;
      let li = 0.62 - (x - 30) / 29 * 0.3 - y / H * 0.15 + (hsh(x >> 1, y >> 1, 9) - 0.5) * 0.25;
      if (y % 7 === 0) li -= 0.12;
      b.set(x, y, R[RS.M.clamp(Math.floor(li * 6), 0, 5)]);
    }
    ol(b);
    return b;
  }
  function cairn() {
    const b = new A.PixBuf(18, 28);
    const stones = [[9, 24, 7, 3], [9, 19, 6, 3], [8, 14, 5, 3], [9, 9, 4, 3], [9, 5, 3, 2]];
    for (const [x, y, rx, ry] of stones) { b.ellipse(x, y, rx, ry, P.bone4); b.ellipse(x - 1, y - 1, rx * 0.6, ry * 0.5, P.bone6); }
    b.set(9, 2, P.gold3);
    ol(b);
    return b;
  }
  function tower() {
    const W = 40, H = 70;
    const b = new A.PixBuf(W, H);
    for (let y = 8; y < H - 1; y++) for (let x = 6; x < W - 6; x++) {
      const u = (x - 6) / (W - 12);
      let c = u < 0.2 ? P.bone6 : u < 0.5 ? P.bone5 : u < 0.8 ? P.bone4 : P.bone2;
      if (y % 6 === 0 || ((x + Math.floor(y / 6) * 3) % 8 === 0)) c = P.bone3;
      b.set(x, y, c);
    }
    // broken top
    for (let x = 6; x < W - 6; x++) { const d = Math.floor(hsh(x, 2, 3) * 12); for (let y = 8; y < 8 + d; y++) b.set(x, y, null); }
    // bell window
    b.ellipse(20, 26, 6, 7, P.ink1); b.rect(18, 24, 5, 6, P.gold2); b.set(19, 25, P.gold4);
    b.rect(17, H - 14, 7, 13, P.ink1);
    for (let y = 12; y < H - 1; y++) if (hsh(y, 5, 5) < 0.3) b.set(7 + Math.floor(hsh(5, y, 5) * 3), y, P.moss4);
    ol(b);
    return b;
  }
  function statueHead() {
    const W = 56, H = 48;
    const b = new A.PixBuf(W, H);
    const cx = 28;
    for (let y = 2; y < H - 1; y++) for (let x = 4; x < W - 4; x++) {
      const d = ((x - cx) / 24) ** 2 + ((y - 26) / 24) ** 2;
      if (d > 1 || y > H - 2) continue;
      const u = (x - cx) / 24;
      let li = 0.62 - u * 0.32 - (y / H) * 0.15;
      b.set(x, y, BONE[RS.M.clamp(Math.floor(li * 8), 1, 7)]);
    }
    // face: brow, closed eyes, nose, mouth
    b.hline(cx - 14, cx - 5, 18, P.bone2); b.hline(cx + 5, cx + 14, 18, P.bone2);
    b.hline(cx - 12, cx - 6, 22, P.ink2); b.hline(cx + 6, cx + 12, 22, P.ink2);
    b.vline(cx, 20, 30, P.bone3); b.hline(cx - 3, cx + 3, 31, P.bone2);
    b.hline(cx - 6, cx + 6, 36, P.ink2);
    // cracks, moss crown, water line
    const rng = new RS.RNG('head');
    for (let k = 0; k < 3; k++) { let x = rng.int(10, W - 10), y = 4; for (let j = 0; j < 16; j++) { b.set(x, y, P.bone1); y++; x += rng.int(-1, 1); } }
    for (let x = 6; x < W - 6; x++) for (let y = 2; y < 12; y++) if (b.opaque(x, y) && (!b.opaque(x, y - 1) || !b.opaque(x, y - 2)) && hsh(x, y, 1) < 0.7) b.set(x, y, P.moss4);
    for (let x = 4; x < W - 4; x++) if (b.opaque(x, H - 4)) { b.set(x, H - 4, P.sea5); b.set(x, H - 3, P.sea4); }
    ol(b);
    return b;
  }
  function obelisk(big) {
    const W = big ? 20 : 14, H = big ? 56 : 32;
    const b = new A.PixBuf(W, H);
    const cx = W / 2;
    for (let y = 2; y < H - 1; y++) {
      const hw = (big ? 4 : 2.6) + (y / H) * (big ? 3 : 2);
      for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
        const u = (x - (cx - hw)) / (2 * hw);
        b.set(x, y, u < 0.3 ? P.ink4 : u < 0.6 ? P.ink3 : P.ink2);
      }
    }
    b.set(Math.floor(cx), 1, P.ink4);
    for (let r = 0; r < (big ? 6 : 3); r++) { const y = 10 + r * 7; b.set(Math.floor(cx) - 1, y, P.emb5); b.set(Math.floor(cx), y + 1, P.emb4); b.set(Math.floor(cx) - 1, y + 2, P.emb3); }
    b.rect(1, H - 4, W - 2, 3, P.rock3); b.hline(1, W - 2, H - 4, P.rock5);
    ol(b);
    return b;
  }

  function build() {
    for (let m = 0; m < 16; m++) for (let br = 0; br < 2; br++) S.add('rwall_' + m + '_' + br, ruinWall(m, br), 8, 27);
    S.add('pillar_0', pillar(0), 8, 41); S.add('pillar_1', pillar(1), 8, 29); S.add('pillar_2', pillar(2), 8, 13);
    S.add('pillar_fallen', pillarFallen(), 18, 15);
    S.add('statue_0', statue(0), 10, 35); S.add('statue_1', statue(1), 10, 35);
    S.add('tablet', tablet(), 8, 19);
    S.add('signpost', signpost(), 9, 23);
    for (let f = 0; f < 4; f++) {
      S.add('campfire_' + f, campfire(f), 10, 21);
      S.add('lantern_' + f, lantern(f), 6, 25);
      S.add('brazier_lit_' + f, brazier(f, true), 9, 25);
    }
    S.add('brazier_unlit', brazier(0, false), 9, 25);
    S.add('tent', tent(), 18, 29);
    S.add('logseat', logseat(false), 16, 11); S.add('logseat_v', logseat(true), 7, 11);
    S.add('crate', crate(), 8, 15); S.add('barrel', barrel(), 7, 15); S.add('bedroll', bedroll(), 9, 7);
    S.add('chest_closed', chest(false), 9, 15); S.add('chest_open', chest(true), 9, 15);
    for (const th of ['moss', 'tide', 'ember']) {
      S.add('cave_' + th, caveMouth(th), 18, 34);
      S.add('ruinstairs_' + th, ruinStairs(th), 26, 49);
      S.add('rootshrine_' + th, rootShrine(th), 26, 53);
    }
    const gc = lairGate(false), go = lairGate(true);
    S.add('lairgate_closed', gc.buf, 44, 71); S.add('lairgate_open', go.buf, 44, 71);
    RS.LAIR_SOCKETS = gc.sockets; // relative socket positions for glowing sigils
    S.add('lm_giant_tree', giantTree(), 36, 87);
    S.add('lm_willow', bigWillow(), 30, 63);
    S.add('lm_lighthouse', lighthouse(), 18, 75);
    S.add('lm_shipwreck', shipwreck(), 38, 42);
    S.add('lm_dead_tree', deadGiant(), 30, 71);
    S.add('lm_arch', rockArch(), 30, 45);
    S.add('lm_cairn', cairn(), 9, 27);
    S.add('lm_tower', tower(), 20, 69);
    S.add('lm_statue_head', statueHead(), 28, 47);
    S.add('lm_obelisk', obelisk(true), 10, 55);
    S.add('obelisk', obelisk(false), 7, 31);
  }

  RS.Structures = { build, THEME };
})();
