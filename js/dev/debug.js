// Development/test hooks: URL-driven boot into specific scenes and a small automation API.
(function () {
  'use strict';
  RS.Debug = {
    boot(params) {
      const scene = params.get('scene') || 'title';
      if (scene === 'play') {
        const seed = +(params.get('seed') || 1);
        RS.App.setScene('loading', { seed, attempt: +(params.get('attempt') || 1) });
        return;
      }
      RS.App.setScene(RS.Scenes[scene] ? scene : 'title', {});
    },
    game() { return RS.currentGame; }
  };
  // automation helpers for headless tests
  window.RST = {
    ready: () => !!(RS.currentGame && RS.App.sceneName === 'play'),
    g: () => RS.currentGame,
    tp(tx, ty) { const g = RS.currentGame; g.player.x = tx * 16 + 8; g.player.y = ty * 16 + 12; RS.Phys.updateLevel(g.level, g.player); const i = ty * g.level.w + tx; g.player.level = g.level.hgt[i]; g.snapCamera(); },
    info() {
      const g = RS.currentGame; if (!g) return null;
      return { level: g.levelName, x: Math.round(g.player.x), y: Math.round(g.player.y), hp: g.player.hp, sig: g.run.sigils.slice(), ents: g.level.entities.length, obj: g.objective().text, scene: RS.App.sceneName };
    }
  };
})();
