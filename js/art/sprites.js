// Sprite registry + small procedural sprites (ground decals, pickups, icons, UI frames).
(function () {
  'use strict';
  const P = RS.PAL;
  const A = RS.Art;
  const map = new Map();

  function add(key, canvasOrBuf, ax, ay) {
    const cv = canvasOrBuf instanceof A.PixBuf ? canvasOrBuf.toCanvas() : canvasOrBuf;
    const e = {
      key, canvas: cv, w: cv.width, h: cv.height, ax: ax === undefined ? Math.floor(cv.width / 2) : ax, ay: ay === undefined ? cv.height : ay,
      _flip: null, _white: null, _red: null,
      get flip() { if (!this._flip) this._flip = A.flipH(this.canvas); return this._flip; },
      get white() { if (!this._white) this._white = A.silhouette(this.canvas, P.white); return this._white; },
      get whiteFlip() { if (!this._whiteFlip) this._whiteFlip = A.flipH(this.white); return this._whiteFlip; },
      get dark() { if (!this._dark) this._dark = A.silhouette(this.canvas, P.ink0); return this._dark; }
    };
    map.set(key, e);
    return e;
  }
  function get(key) { return map.get(key) || null; }
  function has(key) { return map.has(key); }

  // Draw a sprite entry at world coords (anchor), relative to camera
  function draw(ctx, key, x, y, opts) {
    const s = typeof key === 'string' ? map.get(key) : key;
    if (!s) return;
    let img = s.canvas;
    const flip = opts && opts.flip;
    if (opts && opts.white) img = flip ? s.whiteFlip : s.white;
    else if (flip) img = s.flip;
    const dx = Math.round(x - (flip ? s.w - s.ax : s.ax));
    const dy = Math.round(y - s.ay);
    if (opts && opts.alpha !== undefined && opts.alpha < 1) {
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * opts.alpha;
      ctx.drawImage(img, dx, dy);
      ctx.globalAlpha = a;
    } else ctx.drawImage(img, dx, dy);
  }

  // ---------------------------------------------------------------------------
  function buildDecals() {
    const rng = new RS.RNG('decals-v1');
    // grass tufts in several palettes
    const tuftSets = {
      g: [P.moss3, P.moss5, P.moss7],
      m: [P.moss4, P.moss6, P.moss8],
      f: [P.moss1, P.moss3, P.moss5],
      s: [P.swamp2, P.swamp4, P.moss6],
      d: [P.moss2, P.moss4, P.moss6],
      y: [P.gold1, P.gold3, P.gold4]
    };
    for (const k of Object.keys(tuftSets)) {
      const [dk, md, lt] = tuftSets[k];
      for (let v = 0; v < 5; v++) {
        const w = 7, h = 6;
        const b = new A.PixBuf(w, h);
        const blades = 3 + (v % 3);
        for (let i = 0; i < blades; i++) {
          const bx = 1 + Math.round((i + 0.5) * (w - 2) / blades) - 1 + rng.int(0, 1);
          const len = rng.int(2, 5);
          const lean = rng.pick([-1, 0, 0, 1]);
          for (let j = 0; j < len; j++) {
            const x = bx + (j >= len - 2 ? lean * (j - (len - 3)) * 0.5 : 0);
            const y = h - 1 - j;
            b.set(Math.round(x), y, j === len - 1 ? lt : j === 0 ? dk : md);
          }
        }
        add('tuft_' + k + v, b, 3, 6);
      }
    }
    // flowers
    const petals = { w: [P.bone7, P.bone5], y: [P.gold4, P.gold2], r: [P.emb5, P.emb3], b: [P.sea7, P.ink5], p: ['#e7a9a0', '#b86a66'] };
    for (const k of Object.keys(petals)) {
      const [pl, pd] = petals[k];
      for (let v = 0; v < 3; v++) {
        const b = new A.PixBuf(7, 7);
        const heads = v === 0 ? [[3, 2]] : v === 1 ? [[2, 2], [5, 3]] : [[1, 3], [4, 1], [5, 4]];
        for (const [hx, hy] of heads) {
          b.set(hx, hy + 1, P.moss3); b.set(hx, hy + 2, P.moss2);
          b.set(hx - 1, hy, pd); b.set(hx + 1, hy, pd); b.set(hx, hy - 1, pl); b.set(hx, hy + 1, pd);
          b.set(hx, hy, P.gold4);
          if (k === 'y') b.set(hx, hy, P.emb4);
        }
        add('flower_' + k + v, b, 3, 6);
      }
    }
    // pebbles
    for (let v = 0; v < 6; v++) {
      const b = new A.PixBuf(5, 4);
      const ramp = v < 3 ? [P.bone1, P.bone3, P.bone5] : [P.rock1, P.rock3, P.rock5];
      const pw = rng.int(2, 4), ph = rng.int(2, 3);
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) b.set(x + 0, y + 4 - ph, y === 0 && x < pw - 1 ? ramp[2] : ramp[1]);
      b.set(pw - 1, 3, ramp[0]);
      if (v % 2) { b.set(pw + 1, 3, ramp[1]); b.set(pw + 1, 2, ramp[2]); }
      add('pebble' + v, b, 2, 4);
    }
    // leaves / litter
    const leafCols = [[P.earth5, P.earth3], [P.gold2, P.gold1], [P.emb3, P.emb2], [P.moss5, P.moss3]];
    leafCols.forEach(([l, d], i) => {
      const b = new A.PixBuf(4, 3);
      b.set(0, 1, d); b.set(1, 0, l); b.set(1, 1, l); b.set(2, 1, l); b.set(2, 2, d); b.set(3, 2, d);
      add('leaf' + i, b, 2, 3);
    });
    // twigs
    for (let v = 0; v < 2; v++) {
      const b = new A.PixBuf(8, 4);
      b.line(0, 3, 7, v ? 0 : 1, P.earth3); b.set(4, v ? 1 : 2, P.earth5); b.set(5, v ? 0 : 1, P.earth4);
      if (v) b.set(3, 3, P.earth2);
      add('twig' + v, b, 4, 4);
    }
    // shells
    for (let v = 0; v < 2; v++) {
      const b = new A.PixBuf(4, 3);
      b.set(1, 0, P.bone7); b.set(2, 0, P.bone6); b.set(0, 1, P.bone6); b.set(1, 1, '#e7b9a8'); b.set(2, 1, P.bone7); b.set(3, 1, P.bone5);
      b.set(1, 2, P.bone4); b.set(2, 2, P.bone4);
      if (v) b.recolor({ [P.bone7]: P.sand5, '#e7b9a8': P.sea7 });
      add('shell' + v, b, 2, 3);
    }
    // cracks
    for (let v = 0; v < 3; v++) {
      const b = new A.PixBuf(9, 6);
      let x = 0, y = rng.int(1, 4);
      while (x < 9) { b.set(x, y, P.ink2); if (rng.chance(0.35)) y = RS.M.clamp(y + rng.sign(), 0, 5); x++; if (rng.chance(0.2)) b.set(x, RS.M.clamp(y + rng.sign(), 0, 5), P.ink2); }
      add('crack' + v, b, 4, 6);
    }
    // small bones
    {
      const b = new A.PixBuf(7, 4);
      b.hline(1, 5, 1, P.bone6); b.set(0, 0, P.bone7); b.set(0, 2, P.bone6); b.set(6, 0, P.bone6); b.set(6, 2, P.bone5);
      b.hline(1, 5, 2, P.bone4);
      add('bones0', b, 3, 4);
      const s = new A.PixBuf(6, 5);
      s.rect(1, 0, 4, 3, P.bone6); s.set(1, 0, P.bone7); s.set(2, 1, P.ink1); s.set(4, 1, P.ink1); s.rect(2, 3, 3, 1, P.bone5); s.set(0, 4, P.bone4); s.set(5, 4, P.bone4);
      add('skull0', s, 3, 5);
    }
    // lily pads
    for (let v = 0; v < 3; v++) {
      const b = new A.PixBuf(8, 5);
      b.ellipse(4, 2.5, 3.6, 2.2, P.moss4);
      b.ellipse(3.5, 2, 2.4, 1.3, P.moss5);
      b.set(4, 1, 0); b.set(5, 1, 0); b.set(5, 0, 0);
      b.hline(1, 6, 4, P.moss2);
      if (v === 2) { b.set(3, 1, '#e7a9a0'); b.set(4, 1, P.bone7); b.set(3, 0, P.bone7); }
      add('lily' + v, b, 4, 5);
    }
    // moss patches
    for (let v = 0; v < 3; v++) {
      const b = new A.PixBuf(8, 5);
      for (let i = 0; i < 9; i++) b.set(rng.int(0, 7), rng.int(1, 4), rng.pick([P.moss4, P.moss5, P.moss3]));
      b.set(rng.int(2, 5), 2, P.moss6);
      add('mosspatch' + v, b, 4, 5);
    }
    // rubble
    for (let v = 0; v < 3; v++) {
      const b = new A.PixBuf(9, 6);
      for (let i = 0; i < 3 + v; i++) {
        const x = rng.int(0, 6), y = rng.int(2, 4);
        b.set(x, y, P.bone4); b.set(x + 1, y, P.bone3); b.set(x, y + 1, P.bone2); b.set(x + 1, y + 1, P.bone1); b.set(x, y - 1, P.bone5);
      }
      add('rubble' + v, b, 4, 6);
    }
    // surface roots
    for (let v = 0; v < 2; v++) {
      const b = new A.PixBuf(14, 6);
      let y = 2;
      for (let x = 0; x < 14; x++) { b.set(x, y, P.earth4); b.set(x, y + 1, P.earth2); if (rng.chance(0.3)) y = RS.M.clamp(y + rng.sign(), 1, 3); }
      b.set(3, 4, P.earth3); b.set(9, 0, P.earth4);
      add('roots' + v, b, 7, 6);
    }
    // tiny mushrooms (ground)
    {
      const b = new A.PixBuf(6, 5);
      b.set(1, 1, P.emb3); b.set(2, 1, P.emb4); b.set(0, 2, P.emb2); b.set(1, 2, P.emb3); b.set(2, 2, P.emb3); b.set(1, 3, P.bone6); b.set(1, 4, P.bone5);
      b.set(4, 2, P.bone6); b.set(4, 3, P.bone5); b.set(3, 2, P.bone5); b.set(5, 2, P.bone4); b.set(4, 4, P.bone4);
      add('mushtiny0', b, 3, 5);
      const g = new A.PixBuf(6, 5);
      g.set(1, 1, P.sea7); g.set(2, 1, P.sea8); g.set(0, 2, P.sea5); g.set(1, 2, P.sea6); g.set(2, 2, P.sea6); g.set(1, 3, P.bone5); g.set(1, 4, P.bone4);
      g.set(4, 2, P.sea8); g.set(4, 3, P.bone5); g.set(3, 2, P.sea6); g.set(5, 2, P.sea5); g.set(4, 4, P.bone4);
      add('mushtiny1', g, 3, 5);
    }
    // grass drips hanging over cliff tops (drawn at face top)
    for (let v = 0; v < 4; v++) {
      const b = new A.PixBuf(12, 6);
      for (let x = 0; x < 12; x++) {
        const len = rng.chance(0.55) ? rng.int(1, v === 3 ? 5 : 3) : 0;
        for (let y = 0; y < len; y++) b.set(x, y, y === len - 1 ? P.moss2 : P.moss4);
      }
      add('drip' + v, b, 6, 0);
    }
    // vines hanging on faces
    for (let v = 0; v < 3; v++) {
      const b = new A.PixBuf(7, 16);
      let x = 3;
      const len = rng.int(8, 15);
      for (let y = 0; y < len; y++) {
        b.set(x, y, y % 3 === 0 ? P.moss5 : P.moss3);
        if (y % 4 === 1) b.set(x + rng.sign(), y, P.moss6);
        if (rng.chance(0.25)) x = RS.M.clamp(x + rng.sign(), 1, 5);
      }
      add('vine' + v, b, 3, 0);
    }
    // reeds (static decal version)
    for (let v = 0; v < 3; v++) {
      const b = new A.PixBuf(7, 10);
      for (let i = 0; i < 4; i++) {
        const x = 1 + i + rng.int(0, 1) * (i % 2);
        const len = rng.int(5, 9);
        for (let y = 0; y < len; y++) b.set(x, 9 - y, y > len - 3 ? P.swamp5 : P.swamp3);
        if (rng.chance(0.5)) { b.set(x, 9 - len, P.earth4); b.set(x, 10 - len, P.earth3); }
      }
      add('reed' + v, b, 3, 10);
    }
    // puddle
    for (let v = 0; v < 2; v++) {
      const b = new A.PixBuf(12, 6);
      b.ellipse(6, 3, 5.6, 2.6, P.sea3);
      b.ellipse(5.5, 2.6, 4, 1.5, P.sea4);
      b.set(3, 2, P.sea7); b.set(4, 2, P.sea6);
      add('puddle' + v, b, 6, 5);
    }
  }

  // ---------------------------------------------------------------------------
  function buildIcons() {
    // heart (9x8): full, half, empty
    const heartRows = [
      '.oo...oo.',
      'oHHo.oLHo',
      'oHLHoHHHo',
      'oHHHHHHDo',
      '.oHHHHDo.',
      '..oHHDo..',
      '...oDo...',
      '....o....'
    ];
    const hm = { o: P.ink0, H: P.heart, L: P.heartLight, D: P.heartDark };
    add('heart_full', A.fromRows(heartRows, hm), 0, 0);
    const half = A.fromRows(heartRows, hm);
    for (let y = 0; y < 8; y++) for (let x = 5; x < 9; x++) { const v = half.get(x, y); if (v !== RS.Color.c32(P.ink0) && (v >>> 24)) half.set(x, y, P.ink3); }
    add('heart_half', half, 0, 0);
    const empty = A.fromRows(heartRows, { o: P.ink0, H: P.ink3, L: P.ink4, D: P.ink2 });
    add('heart_empty', empty, 0, 0);

    // ember currency icon (7x9) "불씨"
    const emberRows = [
      '...o...',
      '..oYo..',
      '..oYWo.',
      '.oYWYo.',
      'oOYWYOo',
      'oOYYYOo',
      'oROOORo',
      '.oRRRo.',
      '..ooo..'
    ];
    add('icon_ember', A.fromRows(emberRows, { o: P.ink0, Y: P.emb5, W: P.emb7, O: P.emb4, R: P.emb3 }), 0, 0);
    // potion (8x9)
    const potRows = [
      '..oooo..',
      '..oBBo..',
      '...oo...',
      '..oGGo..',
      '.oGRRRo.',
      'oGRWRRRo',
      'oRRRRRRo',
      'oRRRRDDo',
      '.oooooo.'
    ];
    add('icon_potion', A.fromRows(potRows, { o: P.ink0, B: P.earth4, G: P.bone6, R: P.emb3, W: P.emb6, D: P.emb2 }), 0, 0);
    // blade icon and dodge icon for cooldown HUD (10x10)
    const bladeRows = [
      '........oo',
      '.......oWo',
      '......oWBo',
      '.....oWBo.',
      '..o.oWBo..',
      '..ooWBo...',
      '...oGo....',
      '..oGoGo...',
      '.oGo.oo...',
      '.oo.......'
    ];
    add('icon_blade', A.fromRows(bladeRows, { o: P.ink0, W: P.bone7, B: P.rock5, G: P.gold3 }), 0, 0);
    const dodgeRows = [
      '..........',
      '...oooo...',
      '..oWWWWo..',
      '.oW....Wo.',
      '.o..oo..o.',
      'oo.oWWo.oo',
      '...oWWo...',
      '..oW..Wo..',
      '.oo....oo.',
      '..........'
    ];
    add('icon_dodge', A.fromRows(dodgeRows, { o: P.ink0, W: P.sea8 }), 0, 0);
    // sigil icons (13x13): root, tide, ember + empty socket
    const sigilShapes = {
      root: [
        '....ooooo....',
        '..oo.....oo..',
        '.o...GGG...o.',
        '.o..G.G.G..o.',
        'o..G..G..G..o',
        'o.....G.....o',
        'o...GGGGG...o',
        'o..G..G..G..o',
        'o.G...G...G.o',
        '.o....G....o.',
        '.o...G.G...o.',
        '..oo.....oo..',
        '....ooooo....'
      ],
      tide: [
        '....ooooo....',
        '..oo.....oo..',
        '.o.........o.',
        '.o..GG.....o.',
        'o..G..G..G..o',
        'o.G....GG...o',
        'o...........o',
        'o..GG....G..o',
        'o.G..G..G...o',
        '.o....GG...o.',
        '.o.........o.',
        '..oo.....oo..',
        '....ooooo....'
      ],
      ember: [
        '....ooooo....',
        '..oo.....oo..',
        '.o....G....o.',
        '.o...GG....o.',
        'o...G.G.G...o',
        'o...G..GG...o',
        'o..G..G..G..o',
        'o..G.GGG.G..o',
        'o...G...G...o',
        '.o...GGG...o.',
        '.o.........o.',
        '..oo.....oo..',
        '....ooooo....'
      ]
    };
    const glow = { root: [P.rootGlow, P.moss5, P.moss2], tide: [P.tideGlow, P.sea5, P.sea2], ember: [P.emberGlow, P.emb4, P.emb1] };
    for (const k of Object.keys(sigilShapes)) {
      const [g1, g2, g3] = glow[k];
      const b = A.fromRows(sigilShapes[k], { o: P.gold3, G: g1 });
      // fill disc interior
      const fill = new A.PixBuf(13, 13);
      fill.ellipse(6.5, 6.5, 6, 6, g3);
      fill.ellipse(6, 6, 4.5, 4.5, g2);
      fill.blit(b, 0, 0);
      const out = new A.PixBuf(15, 15);
      out.blit(fill, 1, 1);
      A.outline(out, P.ink0);
      add('sigil_' + k, out, 0, 0);
      const dim = out.clone();
      dim.recolor({ [g1]: P.ink4, [g2]: P.ink2, [g3]: P.ink1, [P.gold3]: P.bone2 });
      add('sigil_' + k + '_empty', dim, 0, 0);
    }
    // arrow for objective compass (7x7)
    const arrow = A.fromRows([
      '...o...',
      '..oYo..',
      '.oYYYo.',
      'oYYYYYo',
      'ooYYYoo',
      '..oYo..',
      '..ooo..'
    ], { o: P.ink0, Y: P.gold4 });
    add('arrow_up', arrow, 3, 3);
    // key prompt frame is drawn in UI code
    // interaction marker (bouncing) 7x6
    add('marker', A.fromRows([
      'ooooooo',
      'oYYYYYo',
      '.oYYYo.',
      '..oYo..',
      '...o...'
    ], { o: P.ink0, Y: P.gold4 }), 3, 5);
  }

  // UI panel 9-slice sources (drawn by UI code via fillRect patterns); icons for shop upgrades
  function buildShopIcons() {
    const I = {
      hp: ['..oo.oo..', '.oRRoRRo.', 'oRWRRRRRo', 'oRRRRRRDo', '.oRRRRDo.', '..oRRDo..', '...oDo...', '....o....'],
      blade: ['.......oo', '......oWo', '.....oWBo', '....oWBo.', '.o.oWBo..', '.ooWBo...', '..oGo....', '.oGoo....', 'oGo......'],
      speed: ['...oo....', '..oBBo...', '..oBBo...', '.oGGGGo..', 'oGGGGGGo.', '.oBoBBo..', '.oB..oBo.', 'oB....oBo', 'oo.....oo'],
      dodgeDist: ['.........', '..ooo....', '.oWWWo.o.', 'oW...WoWo', 'o..o..oWo', '..oWo..o.', '.oW.Wo...', 'oW...Wo..', 'oo...oo..'],
      dodgeCd: ['..ooooo..', '.oWWWWWo.', 'oW..o..Wo', 'oW..o..Wo', 'oW..ooWWo', 'oW.....Wo', 'oW.....Wo', '.oWWWWWo.', '..ooooo..'],
      potion: ['..oooo..', '..oBBo..', '...oo...', '..oGGo..', '.oGRRRo.', 'oGRWRRRo', 'oRRRRRRo', 'oRRRRDDo', '.oooooo.'],
      magnet: ['.ooo.ooo.', 'oRRo.oBBo', 'oRRo.oBBo', 'oRRo.oBBo', 'oRRo.oBBo', 'oRRRoBBBo', '.oRRBBBo.', '..ooooo..', '.........']
    };
    const pal = { o: P.ink0, R: P.emb3, W: P.bone7, D: P.emb1, B: P.sea6, G: P.gold3 };
    for (const k of Object.keys(I)) add('up_' + k, A.fromRows(I[k], pal), 0, 0);
  }

  function buildPickups() {
    // ember shard pickup (small) 7x9 with glow frames
    for (let f = 0; f < 4; f++) {
      const b = new A.PixBuf(9, 11);
      const e = A.fromRows([
        '...o...',
        '..oYo..',
        '.oYWYo.',
        'oOYWYOo',
        'oOYYYOo',
        '.oROOo.',
        '..ooo..'
      ], { o: P.ink0, Y: f === 1 ? P.emb6 : P.emb5, W: P.emb7, O: P.emb4, R: P.emb3 });
      b.blit(e, 1, f === 2 ? 1 : 2);
      add('pk_ember' + f, b, 4, 10);
    }
    // big ember cluster
    for (let f = 0; f < 4; f++) {
      const b = new A.PixBuf(13, 13);
      const e = A.fromRows([
        '....o......',
        '...oYo..o..',
        '..oYWYooYo.',
        '.oOYWYOYWYo',
        '.oOYYYOOYOo',
        'oYoROOoROo.',
        'oWYoooo.oo.',
        'oYOo.......',
        '.oo........'
      ], { o: P.ink0, Y: f === 1 ? P.emb6 : P.emb5, W: P.emb7, O: P.emb4, R: P.emb3 });
      b.blit(e, 1, f === 2 ? 2 : 3);
      add('pk_embers' + f, b, 6, 12);
    }
    // life fruit
    const fruit = A.fromRows([
      '....oo..',
      '...oGGo.',
      '..ooGo..',
      '.oRRoRo.',
      'oRWRRRRo',
      'oRRRRRDo',
      'oRRRRDDo',
      '.oRDDDo.',
      '..oooo..'
    ], { o: P.ink0, G: P.moss5, R: P.heart, W: P.heartLight, D: P.heartDark });
    add('pk_fruit', fruit, 4, 9);
    const pot = A.fromRows([
      '..oooo..', '..oBBo..', '...oo...', '..oGGo..', '.oGRRRo.', 'oGRWRRRo', 'oRRRRRRo', 'oRRRRDDo', '.oooooo.'
    ], { o: P.ink0, B: P.earth4, G: P.bone6, R: P.emb3, W: P.emb6, D: P.emb2 });
    add('pk_potion', pot, 4, 9);
  }

  function buildAll() {
    buildDecals();
    buildIcons();
    buildShopIcons();
    buildPickups();
  }

  RS.Sprites = { add, get, has, draw, map, buildAll };
})();
