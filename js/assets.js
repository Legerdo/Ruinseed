// Builds every procedural sprite once at boot.
(function () {
  'use strict';
  RS.Assets = {
    built: false,
    build() {
      if (this.built) return;
      const t0 = performance.now();
      RS.Sprites.buildAll();
      if (RS.Nature) RS.Nature.build();
      if (RS.Structures) RS.Structures.build();
      if (RS.Characters) RS.Characters.build();
      if (RS.DungeonArt) RS.DungeonArt.build();
      if (RS.UI && RS.UI.buildFrames) RS.UI.buildFrames();
      this.built = true;
      this.buildMs = performance.now() - t0;
    }
  };
})();
