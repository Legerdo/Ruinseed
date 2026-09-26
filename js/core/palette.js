// Master palette. Ink blue, moss green, bone stone, earth brown, muted gold, ember accent.
(function () {
  'use strict';
  const P = {
    // ink blues: outlines, deep shadow, night
    ink0: '#0a0c16', ink1: '#11152a', ink2: '#1a213d', ink3: '#252f52', ink4: '#34416b', ink5: '#4b5a88', ink6: '#6c7aa6',
    // moss greens
    moss0: '#12221a', moss1: '#1a3022', moss2: '#23402a', moss3: '#2e5333', moss4: '#3c6a3d', moss5: '#4f8446', moss6: '#6b9e52', moss7: '#8fb863', moss8: '#b8d27e', moss9: '#dbe8a6',
    // earth browns
    earth0: '#1c130f', earth1: '#2b1d15', earth2: '#3d2b1e', earth3: '#523a27', earth4: '#6b4d32', earth5: '#86653f', earth6: '#a3814f', earth7: '#bf9d66',
    // bone stone
    bone0: '#34343c', bone1: '#4a4a52', bone2: '#626168', bone3: '#7e7a78', bone4: '#9d968a', bone5: '#bdb4a0', bone6: '#dad0b8', bone7: '#efe8d6',
    // sand
    sand0: '#7f6a48', sand1: '#9d875e', sand2: '#b9a276', sand3: '#d2bd8f', sand4: '#e6d8ae', sand5: '#f3ead0',
    // sea & water
    sea0: '#0c1b30', sea1: '#112640', sea2: '#163352', sea3: '#1c4466', sea4: '#255a7c', sea5: '#34738f', sea6: '#4f90a2', sea7: '#79b3b5', sea8: '#b3d9cf', sea9: '#e2f2ea',
    // muted gold
    gold0: '#4e3814', gold1: '#76561f', gold2: '#9c7a2f', gold3: '#c29e45', gold4: '#e0c26e', gold5: '#f4e1a0',
    // ember accent (the one strong accent)
    emb0: '#34100b', emb1: '#5e1a10', emb2: '#922914', emb3: '#c63f1a', emb4: '#ea6a28', emb5: '#ff9a45', emb6: '#ffc877', emb7: '#fff0c4',
    // swamp
    swamp0: '#191f15', swamp1: '#232b1c', swamp2: '#303a24', swamp3: '#414c2d', swamp4: '#566236', swamp5: '#6e7a44',
    // canyon red earth
    cany0: '#2f1712', cany1: '#47221a', cany2: '#623223', cany3: '#7f452f', cany4: '#9c5c3e', cany5: '#b97a52', cany6: '#d19d70',
    // cool rock
    rock0: '#1d1f28', rock1: '#2b2e39', rock2: '#3c404c', rock3: '#525764', rock4: '#6c717d', rock5: '#8b8f97', rock6: '#adb0b3', rock7: '#cfd0cc',
    // magic glows for sigils
    rootGlow: '#9ef07f', tideGlow: '#86e3f0', emberGlow: '#ffbf5e',
    white: '#f8f4e8', black: '#06070c', heart: '#e2462b', heartDark: '#8e1f16', heartLight: '#ff8a5c'
  };

  const cache32 = new Map();
  function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }
  function rgbToHex(r, g, b) {
    const c = (v) => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    return '#' + c(r) + c(g) + c(b);
  }
  // Packed little-endian ABGR for Uint32Array views of ImageData
  function c32(hex, alpha) {
    const key = hex + (alpha === undefined ? '' : ':' + alpha);
    let v = cache32.get(key);
    if (v === undefined) {
      const [r, g, b] = hexToRgb(hex);
      const a = alpha === undefined ? 255 : alpha;
      v = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
      cache32.set(key, v);
    }
    return v;
  }
  function mix(hexA, hexB, t) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  }
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  RS.PAL = P;
  RS.Color = { hexToRgb, rgbToHex, c32, mix, rgba };
})();
