// Bootstrap: integer-scaled pixel canvas, fixed-step loop, scenes and modal stack.
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  RS.params = params;
  RS.Scenes = RS.Scenes || {};

  const App = {
    canvas: null, ctx: null, W: 320, H: 200, scale: 1,
    scene: null, sceneName: '', modals: [],
    time: 0, frame: 0, acc: 0, last: 0, fps: 60, ready: false,
    hitStop: 0,

    init() {
      // simulation speed-up is a test hook, only honoured in the development build (dev.html)
      this.speed = RS.Debug ? Math.max(1, Math.min(12, +(params.get('speed') || 1))) : 1;
      this.canvas = document.getElementById('game');
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      window.addEventListener('resize', () => this.resize());
      this.resize();
      RS.Text.init();
      RS.Save.load();
      RS.Input.attach(this.canvas);
      if (RS.Audio) RS.Audio.init();
      if (RS.Assets) RS.Assets.build();
      this.ready = true;
      // dev.html boots straight into test scenes from the URL; the real game always opens on the title
      if (RS.Debug && RS.Debug.boot) RS.Debug.boot(params);
      else this.setScene('title');
      requestAnimationFrame((t) => this.loop(t));
      window.RS_READY = true;
    },

    resize() {
      const dpr = window.devicePixelRatio || 1;
      const cw = window.innerWidth, ch = window.innerHeight;
      const pw = Math.max(1, Math.round(cw * dpr)), ph = Math.max(1, Math.round(ch * dpr));
      // integer scale whose internal height is closest to ~225px, never below 180px (or width below 300px)
      const maxS = Math.max(1, Math.min(Math.floor(ph / 180), Math.floor(pw / 300)));
      let scale = maxS;
      // ties (e.g. 960x540: 180 vs 270) go to the roomier view
      if (maxS > 1 && Math.abs(ph / (maxS - 1) - 225) <= Math.abs(ph / maxS - 225) && pw / (maxS - 1) <= 1100) scale = maxS - 1;
      if (params.get('scale')) scale = Math.max(1, +params.get('scale'));
      const iw = Math.ceil(pw / scale), ih = Math.ceil(ph / scale);
      this.scale = scale;
      this.W = iw; this.H = ih;
      this.canvas.width = iw; this.canvas.height = ih;
      this.canvas.style.width = (iw * scale / dpr) + 'px';
      this.canvas.style.height = (ih * scale / dpr) + 'px';
      this.ctx.imageSmoothingEnabled = false;
      if (this.scene && this.scene.resize) this.scene.resize(iw, ih);
    },

    setScene(name, p) {
      if (this.scene && this.scene.exit) this.scene.exit();
      this.modals = [];
      this.sceneName = name;
      this.scene = RS.Scenes[name];
      if (this.scene && this.scene.enter) this.scene.enter(p || {});
    },
    pushModal(m) { this.modals.push(m); if (m.enter) m.enter(); return m; },
    popModal(m) {
      const i = m ? this.modals.indexOf(m) : this.modals.length - 1;
      if (i >= 0) { const [r] = this.modals.splice(i, 1); if (r.exit) r.exit(); }
    },
    topModal() { return this.modals[this.modals.length - 1] || null; },

    loop(ts) {
      requestAnimationFrame((t) => this.loop(t));
      if (!this.last) this.last = ts;
      let dt = (ts - this.last) / 1000;
      this.last = ts;
      if (dt > 0.25) dt = 0.25;
      const speed = this.speed || 1;
      this.acc += dt * speed;
      const step = 1 / 60;
      let n = 0;
      while (this.acc >= step && n < 5 * speed) {
        this.update(step);
        this.acc -= step; n++;
      }
      if (n >= 5 * speed) this.acc = 0;
      this.render();
    },

    update(dt) {
      RS.Input.pollGamepad();
      this.time += dt;
      this.frame++;
      const top = this.topModal();
      if (top) {
        top.update(dt);
        if (!top.pausesGame && this.scene && this.scene.update) this.scene.update(dt, true);
      } else if (this.scene && this.scene.update) this.scene.update(dt, false);
      if (RS.Audio) RS.Audio.update(dt);
      RS.Input.endStep();
    },

    render() {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (this.scene && this.scene.render) this.scene.render(ctx);
      else { ctx.fillStyle = RS.PAL.ink0; ctx.fillRect(0, 0, this.W, this.H); }
      for (const m of this.modals) if (m.render) m.render(ctx);
      if (RS.Debug && RS.Debug.overlay) RS.Debug.overlay(ctx);
    }
  };
  RS.App = App;

  window.addEventListener('load', () => {
    try { App.init(); }
    catch (e) {
      console.error(e);
      window.RS_ERROR = String(e && e.stack || e);
      const c = document.getElementById('game');
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0a0c16'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#e3dac2'; ctx.font = '16px "Malgun Gothic", sans-serif';
      ctx.fillText('게임을 시작하는 중 오류가 발생했습니다. 페이지를 새로고침해 주세요.', 10, 30);
    }
  });
})();
