// Enemy & guardian sprites: slime, thorn beetle, seed spitter, bat, ruin sentry, wisp, Ruin Guardian.
(function () {
  'use strict';
  const P = RS.PAL, A = RS.Art, S = RS.Sprites;
  const ol = (b, c) => A.outline(b, c || P.ink0);

  const SLIME_PAL = {
    moss: ['#15453f', '#1f7a66', '#34b38a', '#86e8b4', '#e4fff0'],
    tide: [P.sea2, P.sea4, P.sea6, P.sea7, P.sea9],
    ember: [P.emb1, P.emb2, P.emb3, P.emb5, P.emb7]
  };
  function slime(pal, rx, ry, eyes, lift) {
    const b = new A.PixBuf(20, 18);
    const cx = 10, by = 16 - (lift || 0);
    A.shadeBlob(b, [{ x: cx, y: by - ry, r: rx, ry: ry, h: 1 }], pal.slice(0, 4), { dither: false, bias: 0.05 });
    // cut the bottom flat
    for (let x = 0; x < 20; x++) for (let y = by + 1; y < 18; y++) b.set(x, y, null);
    // glossy highlight
    b.set(cx - Math.round(rx * 0.45), by - Math.round(ry * 1.45), pal[4]);
    b.set(cx - Math.round(rx * 0.45) + 1, by - Math.round(ry * 1.45), pal[3]);
    b.set(cx - Math.round(rx * 0.45), by - Math.round(ry * 1.45) + 1, pal[3]);
    // eyes
    if (eyes) {
      const ey = by - Math.round(ry * 0.9);
      for (const ex of [cx - 2, cx + 2]) { b.set(ex, ey, P.ink0); b.set(ex, ey + 1, P.ink0); b.set(ex, ey, P.white); }
      b.set(cx - 2, ey + 1, P.ink0); b.set(cx + 2, ey + 1, P.ink0);
    }
    // moss sprout on top
    b.set(cx + 1, by - ry * 2 - 0, pal[3]);
    ol(b);
    return b;
  }

  function beetle(frame) {
    // facing down (towards +y)
    const b = new A.PixBuf(18, 18);
    const legs = frame % 2;
    const glow = frame === 2;
    // legs
    const lc = P.ink2;
    for (const [lx, ly, dx] of [[3, 6, -1], [3, 9, -1], [3, 12, -1], [14, 6, 1], [14, 9, 1], [14, 12, 1]]) {
      const off = ((ly === 9) !== !!legs) ? 1 : -1;
      b.set(lx, ly + off, lc); b.set(lx + dx, ly + off + 1, lc);
    }
    // shell
    A.shadeBlob(b, [{ x: 9, y: 8, r: 6, ry: 7, h: 1 }], glow ? [P.emb1, P.emb2, P.emb3, P.emb5] : [P.ink1, P.ink2, P.ink3, P.ink4], { dither: false });
    b.vline(9, 2, 14, glow ? P.emb6 : P.ink1);
    // ember markings
    for (const [x, y] of [[6, 6], [12, 6], [7, 10], [11, 10]]) b.set(x, y, glow ? P.emb7 : P.emb4);
    // head + horn
    b.ellipse(9, 15, 3, 1.8, P.ink1);
    b.set(9, 16, P.gold3); b.set(9, 17, glow ? P.emb7 : P.gold4); b.set(8, 16, P.gold2); b.set(10, 16, P.gold2);
    b.set(7, 14, P.emb5); b.set(11, 14, P.emb5);
    if (frame === 3) { b.set(2, 3, P.bone5); b.set(15, 3, P.bone5); b.set(1, 5, P.bone4); b.set(16, 5, P.bone4); }
    ol(b);
    return b;
  }

  function spitter(frame) {
    const b = new A.PixBuf(20, 22);
    const sway = frame === 1 ? 1 : 0;
    const swell = frame === 2 ? 1 : frame === 3 ? 2 : 0;
    const wilt = frame === 5;
    // leaves
    b.ellipse(5, 18, 4, 1.8, P.moss4); b.ellipse(15, 18, 4, 1.8, P.moss3); b.set(3, 17, P.moss6); b.set(14, 17, P.moss5);
    // stem
    for (let y = 10; y < 20; y++) b.set(10 + (y < 14 ? sway : 0) + (wilt ? Math.floor((20 - y) / 3) : 0), y, y % 3 ? P.moss4 : P.moss5);
    // head
    const hx = 10 + sway + (wilt ? 3 : 0), hy = wilt ? 12 : 7;
    const r = 5 + swell * 0.6;
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + 0.3;
      b.ellipse(hx + Math.cos(a) * r * 0.75, hy + Math.sin(a) * r * 0.7, 2.4, 2.2, k % 2 ? P.emb3 : P.emb4);
    }
    b.ellipse(hx, hy, 2.8 + swell * 0.4, 2.6 + swell * 0.4, swell === 2 ? P.emb6 : P.gold3);
    if (frame === 4) { b.ellipse(hx, hy + 1, 2, 1.6, P.ink0); b.set(hx, hy + 1, P.moss6); }
    else b.set(hx, hy, P.ink1);
    if (swell) b.set(hx - 1, hy - 1, P.emb7);
    if (wilt) for (let i = 0; i < b.u32.length; i++) if ((b.u32[i] >>> 24) && RS.rand2(i, 7, 2) < 0.2) b.u32[i] = RS.Color.c32(P.earth3);
    ol(b);
    return b;
  }

  function bat(frame) {
    const b = new A.PixBuf(20, 14);
    const wy = [2, 5, 9][frame];
    // wings
    for (const s of [-1, 1]) {
      const x0 = 10 + s * 2;
      for (let i = 0; i < 7; i++) {
        const x = x0 + s * i;
        const y = Math.round(6 + (wy - 6) * (i / 6));
        b.vline(x, Math.min(y, 7), Math.max(y, 7) + (i < 5 ? 1 : 0), i % 3 === 2 ? P.ink2 : P.ink3);
      }
    }
    b.ellipse(10, 7, 2.6, 3, P.ink3);
    b.set(9, 5, P.ink4); b.set(8, 3, P.ink3); b.set(12, 3, P.ink3);
    b.set(9, 6, P.emb5); b.set(11, 6, P.emb5);
    b.set(10, 9, P.bone6);
    ol(b);
    return b;
  }

  function sentry(frame, back) {
    const b = new A.PixBuf(22, 28);
    const stone = [P.bone1, P.bone2, P.bone3, P.bone4, P.bone5, P.bone6];
    const lift = frame === 2 ? -2 : frame === 3 ? 2 : 0;
    const step = frame === 1 ? 1 : 0;
    // legs
    b.rect(6, 22, 4, 5 - step, stone[2]); b.rect(12, 22 + step, 4, 5 - step, stone[2]);
    b.hline(6, 9, 26 - step, stone[1]); b.hline(12, 15, 26, stone[1]);
    // torso
    for (let y = 11; y < 23; y++) for (let x = 5; x < 17; x++) {
      const u = (x - 5) / 11;
      let c = u < 0.25 ? stone[5] : u < 0.6 ? stone[4] : stone[2];
      if (y === 11) c = stone[5];
      if ((x + y) % 7 === 0) c = stone[3];
      b.set(x, y, c);
    }
    // moss on shoulders
    b.hline(5, 9, 11, P.moss5); b.set(15, 11, P.moss4);
    // head / helm
    for (let y = 4; y < 11; y++) for (let x = 7; x < 15; x++) b.set(x, y, x < 9 ? stone[5] : x > 12 ? stone[2] : stone[4]);
    b.hline(7, 14, 4, stone[5]);
    if (!back) { b.hline(8, 13, 7, P.ink0); b.set(9, 7, P.emb5); b.set(12, 7, P.emb5); if (frame === 2) { b.set(10, 7, P.emb6); b.set(11, 7, P.emb6); } }
    // arms + mace
    const ay = 13 + (frame === 2 ? -9 : frame === 3 ? 6 : 0);
    b.rect(2, 13, 3, 7, stone[3]); b.rect(17, 13, 3, 7, stone[2]);
    if (frame === 2) {
      b.rect(3, 4, 3, 10, stone[3]); b.rect(16, 4, 3, 10, stone[2]);
      b.rect(6, 0, 10, 4, P.rock3); b.hline(6, 15, 0, P.rock5); b.set(8, 1, P.emb4); b.set(13, 1, P.emb4);
    } else if (frame === 3) {
      b.rect(6, 23, 10, 4, P.rock3); b.hline(6, 15, 23, P.rock5);
    } else {
      b.rect(17, 19, 4, 5, P.rock3); b.set(17, 19, P.rock5);
    }
    void ay; void lift;
    ol(b);
    return b;
  }

  function wisp(frame) {
    const b = new A.PixBuf(16, 18);
    const cols = [P.sea5, P.sea6, P.tideGlow, P.sea9];
    for (let y = 2; y < 16; y++) {
      const t = (y - 2) / 13;
      const hw = Math.sin(t * Math.PI) * 5 + (t > 0.6 ? 0.5 : 0);
      const cx = 8 + Math.sin(y * 0.8 + frame * 2) * (1 - t) * 1.6;
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
        const u = Math.abs(x - cx) / Math.max(0.6, hw);
        b.set(x, y, u < 0.35 && t > 0.3 ? cols[3] : u < 0.7 ? cols[2] : cols[1]);
      }
    }
    // tail wisps
    b.set(8 + (frame - 1), 1, cols[1]); b.set(7, 16, cols[0]); b.set(9, 17, cols[0]);
    b.set(6, 9, P.ink1); b.set(10, 9, P.ink1); b.set(6, 10, P.ink1); b.set(10, 10, P.ink1);
    ol(b, P.ink1);
    return b;
  }

  // ---- Ruin Guardian (boss) ---------------------------------------------------------
  function guardian(pose, core) {
    const W = 64, H = 64;
    const b = new A.PixBuf(W, H);
    const stone = [P.rock1, P.rock2, P.rock3, P.bone3, P.bone4, P.bone5, P.bone6];
    const cx = 32;
    const low = pose === 'slam' ? 5 : pose === 'stun' ? 6 : 0;
    const lean = pose === 'charge' ? 3 : 0;
    const step = pose === 'walk1' ? 1 : pose === 'walk2' ? -1 : 0;
    const shade = (x0, y0, w, h, pal) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const u = (x - x0) / Math.max(1, w - 1), v = (y - y0) / Math.max(1, h - 1);
        let li = 0.7 - u * 0.45 - v * 0.25 + (RS.rand2(x >> 1, y >> 1, 77) - 0.5) * 0.18;
        b.set(x, y, pal[RS.M.clamp(Math.floor(li * pal.length), 0, pal.length - 1)]);
      }
    };
    // legs
    shade(cx - 16, 48 + low / 2 + (step > 0 ? -1 : 0), 11, 15 - low / 2, stone);
    shade(cx + 5, 48 + low / 2 + (step < 0 ? -1 : 0), 11, 15 - low / 2, stone);
    b.hline(cx - 17, cx - 5, 62, P.rock1); b.hline(cx + 4, cx + 16, 62, P.rock1);
    // torso block
    shade(cx - 18 + lean, 22 + low, 36, 28, stone);
    // shoulder plates
    shade(cx - 24 + lean, 20 + low, 12, 9, stone);
    shade(cx + 12 + lean, 20 + low, 12, 9, stone);
    // moss & vines
    for (let x = cx - 18; x < cx + 18; x++) if (RS.rand2(x, 3, 5) < 0.55) b.set(x + lean, 22 + low, P.moss5);
    for (let k = 0; k < 5; k++) { const x = cx - 16 + k * 8 + lean; for (let j = 0; j < 3 + (k % 3) * 2; j++) b.set(x, 23 + low + j, j % 2 ? P.moss3 : P.moss4); }
    // chest core
    const coreR = core === 'exposed' ? 6 : 4;
    const ccx = cx + lean, ccy = 34 + low;
    if (core === 'exposed') { b.ellipse(ccx, ccy, 8, 7, P.ink0); }
    b.ellipse(ccx, ccy, coreR + 1, coreR + 1, P.emb1);
    b.ellipse(ccx, ccy, coreR, coreR, core === 'dim' ? P.emb2 : P.emb4);
    b.ellipse(ccx - 1, ccy - 1, coreR * 0.55, coreR * 0.55, core === 'dim' ? P.emb3 : P.emb6);
    b.set(ccx - 2, ccy - 2, P.emb7);
    // cracks radiating from the core
    for (let k = 0; k < 4; k++) { let x = ccx + (k < 2 ? -coreR - 1 : coreR + 1), y = ccy + (k % 2 ? 2 : -2); for (let j = 0; j < 6; j++) { b.set(x, y, P.emb3); x += k < 2 ? -1 : 1; y += (k % 2 ? 1 : -1) * (j % 2); } }
    // head
    shade(cx - 9 + lean, 8 + low + (pose === 'slam' ? 3 : 0), 18, 15, stone);
    const hy = 8 + low + (pose === 'slam' ? 3 : 0);
    b.hline(cx - 9 + lean, cx + 8 + lean, hy, P.bone6);
    // visor slit with a single eye
    b.hline(cx - 6 + lean, cx + 5 + lean, hy + 6, P.ink0); b.hline(cx - 6 + lean, cx + 5 + lean, hy + 7, P.ink0);
    const eyeC = pose === 'stun' ? P.emb2 : P.emb6;
    b.set(cx - 1 + lean, hy + 6, eyeC); b.set(cx + lean, hy + 6, eyeC); b.set(cx - 1 + lean, hy + 7, P.emb4); b.set(cx + lean, hy + 7, P.emb4);
    // horns
    b.line(cx - 9 + lean, hy + 2, cx - 13 + lean, hy - 4, P.bone5); b.line(cx + 8 + lean, hy + 2, cx + 12 + lean, hy - 4, P.bone4);
    // arms & fists by pose
    const arm = (side, ax, ay, len, down) => {
      const x0 = side < 0 ? ax - 8 : ax;
      shade(x0, ay, 9, len, stone);
      shade(x0 - 2, down ? ay + len : ay - 9, 13, 10, [P.rock1, P.rock2, P.rock3, P.rock4, P.bone4, P.bone5]);
    };
    if (pose === 'windup') {
      arm(-1, cx - 18, 4 + low, 18, false); arm(1, cx + 18, 4 + low, 18, false);
    } else if (pose === 'slam') {
      arm(-1, cx - 20, 26 + low, 16, true); arm(1, cx + 20, 26 + low, 16, true);
    } else if (pose === 'charge') {
      arm(-1, cx - 18 + lean, 28, 14, true); arm(1, cx + 18 + lean, 28, 14, true);
    } else if (pose === 'stun') {
      arm(-1, cx - 19, 30 + low / 2, 12, true); arm(1, cx + 19, 30 + low / 2, 12, true);
    } else {
      arm(-1, cx - 19, 26 + (pose === 'idle1' ? 1 : 0), 14, true); arm(1, cx + 19, 26 + (pose === 'idle1' ? 1 : 0), 14, true);
    }
    ol(b);
    return b;
  }

  function build() {
    for (const th of ['moss', 'tide', 'ember']) {
      const pal = SLIME_PAL[th];
      S.add('slime_' + th + '_idle_0', slime(pal, 6.2, 4.6, true), 10, 17);
      S.add('slime_' + th + '_idle_1', slime(pal, 6.8, 4.1, true), 10, 17);
      S.add('slime_' + th + '_crouch', slime(pal, 7.6, 3.4, true), 10, 17);
      S.add('slime_' + th + '_jump', slime(pal, 4.8, 6.0, true), 10, 17);
      S.add('slime_' + th + '_land', slime(pal, 8.0, 3.2, true), 10, 17);
    }
    const bf = [beetle(0), beetle(1), beetle(2), beetle(3)];
    const names = ['walk_0', 'walk_1', 'tele', 'stun'];
    bf.forEach((buf, k) => {
      const cv = buf.toCanvas();
      S.add('beetle_down_' + names[k], cv, 9, 17);
      S.add('beetle_left_' + names[k], A.rot90(cv, 1), 9, 16);
      S.add('beetle_up_' + names[k], A.rot90(cv, 2), 9, 16);
      S.add('beetle_right_' + names[k], A.rot90(cv, 3), 9, 16);
    });
    ['idle_0', 'idle_1', 'tele_0', 'tele_1', 'shoot', 'wilt'].forEach((n, k) => S.add('spitter_' + n, spitter(k), 10, 21));
    for (let f = 0; f < 3; f++) S.add('bat_' + f, bat(f), 10, 12);
    ['walk_0', 'walk_1', 'windup', 'smash'].forEach((n, k) => { S.add('sentry_down_' + n, sentry(k, false), 11, 27); S.add('sentry_up_' + n, sentry(k, true), 11, 27); });
    for (let f = 0; f < 3; f++) S.add('wisp_' + f, wisp(f), 8, 16);
    const poses = ['idle0', 'idle1', 'walk1', 'walk2', 'windup', 'slam', 'charge', 'stun'];
    for (const ps of poses) {
      S.add('guardian_' + ps, guardian(ps, ps === 'stun' ? 'exposed' : 'lit'), 32, 63);
    }
    S.add('guardian_dead', guardian('stun', 'dim'), 32, 63);
    // warning ring & shockwave are drawn procedurally at runtime
  }

  RS.EnemyArt = { build };
})();
