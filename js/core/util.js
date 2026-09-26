// Core utilities: deterministic RNG, hashing, noise, math, heap, grid helpers.
window.RS = window.RS || {};

(function () {
  'use strict';

  // ---- hashing -------------------------------------------------------------
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function hashStr(str) {
    return xmur3(String(str))();
  }

  // Integer hash of 2D coordinates + seed -> uint32
  function hash2(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1440662683)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    h = Math.imul(h, 2246822519);
    h ^= h >>> 13;
    return h >>> 0;
  }
  function rand2(x, y, s) {
    return hash2(x, y, s) / 4294967296;
  }

  // ---- RNG (sfc32) ---------------------------------------------------------
  class RNG {
    constructor(seed) {
      const g = xmur3(String(seed));
      this.a = g(); this.b = g(); this.c = g(); this.d = g();
      for (let i = 0; i < 12; i++) this.next();
    }
    next() {
      let a = this.a | 0, b = this.b | 0, c = this.c | 0, d = this.d | 0;
      const t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      c = (c + t) | 0;
      this.a = a; this.b = b; this.c = c; this.d = d;
      return (t >>> 0) / 4294967296;
    }
    range(a, b) { return a + (b - a) * this.next(); }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    sign() { return this.next() < 0.5 ? -1 : 1; }
    weighted(items, weightFn) {
      let total = 0;
      for (const it of items) total += Math.max(0, weightFn(it));
      if (total <= 0) return items[0];
      let r = this.next() * total;
      for (const it of items) {
        r -= Math.max(0, weightFn(it));
        if (r <= 0) return it;
      }
      return items[items.length - 1];
    }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
    fork(label) {
      return new RNG(this.a + ':' + this.b + ':' + label);
    }
    gauss() {
      return (this.next() + this.next() + this.next() - 1.5) / 1.5;
    }
  }

  // ---- Noise ---------------------------------------------------------------
  // Fast seeded value noise (smooth), output in [0,1)
  function makeValueNoise(seed) {
    const rng = new RNG('vn:' + seed);
    const perm = new Uint16Array(512);
    const vals = new Float32Array(256);
    for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = rng.next(); }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const fn = function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const X = xi & 255, Y = yi & 255;
      const pa = perm[X], pb = perm[X + 1];
      const a = vals[perm[pa + Y]], b = vals[perm[pb + Y]];
      const c = vals[perm[pa + Y + 1]], d = vals[perm[pb + Y + 1]];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    fn.fbm = function (x, y, oct, lac, gain) {
      let sum = 0, amp = 1, norm = 0, f = 1;
      for (let o = 0; o < oct; o++) {
        sum += fn(x * f + o * 17.3, y * f - o * 9.1) * amp;
        norm += amp; amp *= gain; f *= lac;
      }
      return sum / norm;
    };
    return fn;
  }

  // Seeded 2D simplex noise, output in [-1,1]
  function makeSimplex(seed) {
    const rng = new RNG('sx:' + seed);
    const perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const grad = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    const fn = function (xin, yin) {
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n0 = 0, n1 = 0, n2 = 0;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) { const g = grad[perm[ii + perm[jj]] & 7]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) { const g = grad[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) { const g = grad[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
      return 70 * (n0 + n1 + n2);
    };
    fn.fbm = function (x, y, oct, lac, gain) {
      let sum = 0, amp = 1, norm = 0, f = 1;
      for (let o = 0; o < oct; o++) {
        sum += fn(x * f + o * 31.7, y * f + o * 11.3) * amp;
        norm += amp; amp *= gain; f *= lac;
      }
      return sum / norm;
    };
    return fn;
  }

  // ---- math ----------------------------------------------------------------
  const M = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    inv: (a, b, v) => (b === a ? 0 : (v - a) / (b - a)),
    smooth: (t) => t * t * (3 - 2 * t),
    smoothstep: (a, b, v) => { const t = M.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); },
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    dist2: (ax, ay, bx, by) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay),
    approach: (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step)),
    sign: (v) => (v > 0 ? 1 : v < 0 ? -1 : 0),
    easeOut: (t) => 1 - (1 - t) * (1 - t),
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    wrapAngle: (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; },
    rectsOverlap: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  };

  // ---- binary min-heap -----------------------------------------------------
  class MinHeap {
    constructor() { this.k = []; this.v = []; }
    get size() { return this.k.length; }
    push(key, val) {
      const k = this.k, v = this.v;
      let i = k.length;
      k.push(key); v.push(val);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (k[p] <= k[i]) break;
        [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]];
        i = p;
      }
    }
    pop() {
      const k = this.k, v = this.v;
      const top = v[0];
      const lk = k.pop(), lv = v.pop();
      if (k.length > 0) {
        k[0] = lk; v[0] = lv;
        let i = 0;
        const n = k.length;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < n && k[l] < k[m]) m = l;
          if (r < n && k[r] < k[m]) m = r;
          if (m === i) break;
          [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]];
          i = m;
        }
      }
      return top;
    }
  }

  const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const DIRS8 = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

  // Generic grid A* (4-neighbour). cost(x,y,fromX,fromY) returns Infinity for blocked.
  function astar(w, h, sx, sy, gx, gy, cost, opts) {
    opts = opts || {};
    const maxIter = opts.maxIter || w * h * 4;
    const n = w * h;
    const g = new Float32Array(n).fill(Infinity);
    const from = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const heap = new MinHeap();
    const si = sy * w + sx, gi = gy * w + gx;
    const heur = opts.heuristic || ((x, y) => Math.abs(x - gx) + Math.abs(y - gy));
    g[si] = 0;
    heap.push(heur(sx, sy), si);
    let iter = 0;
    while (heap.size > 0 && iter++ < maxIter) {
      const cur = heap.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === gi) break;
      const cx = cur % w, cy = (cur / w) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DIRS4[d][0], ny = cy + DIRS4[d][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (closed[ni]) continue;
        const c = cost(nx, ny, cx, cy);
        if (!(c < Infinity)) continue;
        const ng = g[cur] + c;
        if (ng < g[ni]) {
          g[ni] = ng; from[ni] = cur;
          heap.push(ng + heur(nx, ny) * (opts.heurWeight || 1), ni);
        }
      }
    }
    if (from[gi] === -1 && si !== gi) return null;
    const path = [];
    let c = gi;
    while (c !== -1) { path.push(c); if (c === si) break; c = from[c]; }
    path.reverse();
    return path;
  }

  // BFS distance field from a list of start indices over passable(i) cells (4-neighbour)
  function bfs(w, h, starts, passable, maxDist) {
    const dist = new Int32Array(w * h).fill(-1);
    const q = new Int32Array(w * h);
    let qh = 0, qt = 0;
    for (const s of starts) { if (dist[s] === -1) { dist[s] = 0; q[qt++] = s; } }
    while (qh < qt) {
      const cur = q[qh++];
      const cd = dist[cur];
      if (maxDist !== undefined && cd >= maxDist) continue;
      const cx = cur % w, cy = (cur / w) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DIRS4[d][0], ny = cy + DIRS4[d][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (dist[ni] !== -1) continue;
        if (!passable(ni, cur)) continue;
        dist[ni] = cd + 1;
        q[qt++] = ni;
      }
    }
    return dist;
  }

  // Poisson-disc sampling in a rectangle with an acceptance predicate
  function poisson(rng, w, h, minDist, accept, maxPoints, tries) {
    const pts = [];
    const cell = minDist / Math.SQRT2;
    const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
    const grid = new Int32Array(gw * gh).fill(-1);
    const active = [];
    const attempts = tries || 30;
    const fits = (x, y) => {
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      for (let yy = Math.max(0, gy - 2); yy <= Math.min(gh - 1, gy + 2); yy++) {
        for (let xx = Math.max(0, gx - 2); xx <= Math.min(gw - 1, gx + 2); xx++) {
          const pi = grid[yy * gw + xx];
          if (pi >= 0) {
            const p = pts[pi];
            if ((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) < minDist * minDist) return false;
          }
        }
      }
      return true;
    };
    const add = (x, y) => {
      pts.push({ x, y });
      grid[Math.floor(y / cell) * gw + Math.floor(x / cell)] = pts.length - 1;
      active.push(pts.length - 1);
    };
    for (let k = 0; k < 200 && pts.length === 0; k++) {
      const x = rng.range(0, w), y = rng.range(0, h);
      if (accept(x, y)) add(x, y);
    }
    while (active.length > 0 && pts.length < (maxPoints || 1e9)) {
      const ai = Math.floor(rng.next() * active.length);
      const p = pts[active[ai]];
      let found = false;
      for (let t = 0; t < attempts; t++) {
        const a = rng.range(0, Math.PI * 2);
        const r = rng.range(minDist, minDist * 2);
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (!accept(x, y) || !fits(x, y)) continue;
        add(x, y);
        found = true;
        break;
      }
      if (!found) active.splice(ai, 1);
    }
    return pts;
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  RS.hashStr = hashStr;
  RS.hash2 = hash2;
  RS.rand2 = rand2;
  RS.RNG = RNG;
  RS.makeValueNoise = makeValueNoise;
  RS.makeSimplex = makeSimplex;
  RS.M = M;
  RS.MinHeap = MinHeap;
  RS.DIRS4 = DIRS4;
  RS.DIRS8 = DIRS8;
  RS.astar = astar;
  RS.bfs = bfs;
  RS.poisson = poisson;
  RS.formatTime = formatTime;
})();
