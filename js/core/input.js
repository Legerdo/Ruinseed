// Keyboard (layout-independent via e.code), mouse and gamepad input mapped to actions.
(function () {
  'use strict';
  const GAME_KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyJ: 'attack', KeyZ: 'attack',
    KeyK: 'dodge', KeyX: 'dodge', ShiftLeft: 'dodge', ShiftRight: 'dodge',
    KeyE: 'interact', Space: 'interact', Enter: 'interact', NumpadEnter: 'interact',
    KeyQ: 'potion', KeyR: 'potion',
    KeyM: 'map', Tab: 'map',
    Escape: 'pause', KeyP: 'pause'
  };
  const UI_KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Enter: 'confirm', NumpadEnter: 'confirm', Space: 'confirm', KeyE: 'confirm', KeyJ: 'confirm', KeyZ: 'confirm',
    Escape: 'cancel', Backspace: 'cancel', KeyX: 'cancel', KeyK: 'cancel', KeyP: 'cancel',
    Tab: 'tab', KeyM: 'map'
  };
  const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace', 'Enter']);

  const down = new Set();
  const pressedCodes = new Set();
  const listeners = [];
  const mouse = { x: -1, y: -1, down: false, pressed: false, rpressed: false, released: false, wheel: 0, moved: false, inside: false };
  const pad = { held: {}, prev: {}, pressed: {}, connected: false, axisX: 0, axisY: 0 };
  let device = 'keyboard';
  let canvasRef = null;
  let firstInputCallbacks = [];
  let gotFirstInput = false;

  function fireFirstInput() {
    if (gotFirstInput) return;
    gotFirstInput = true;
    for (const cb of firstInputCallbacks) { try { cb(); } catch (e) { console.error(e); } }
  }

  function attach(canvas) {
    canvasRef = canvas;
    window.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      device = 'keyboard';
      fireFirstInput();
      if (!e.repeat) pressedCodes.add(e.code);
      down.add(e.code);
      for (const l of listeners) l(e);
    }, { passive: false });
    window.addEventListener('keyup', (e) => { down.delete(e.code); });
    window.addEventListener('blur', () => { down.clear(); mouse.down = false; });
    const toLocal = (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = Math.floor(((e.clientX - r.left) / r.width) * canvas.width);
      mouse.y = Math.floor(((e.clientY - r.top) / r.height) * canvas.height);
      mouse.inside = e.clientX >= 0 && e.clientY >= 0 && e.clientX < window.innerWidth && e.clientY < window.innerHeight;
    };
    window.addEventListener('mousemove', (e) => { toLocal(e); mouse.moved = true; device = 'mouse'; });
    window.addEventListener('mousedown', (e) => {
      toLocal(e);
      fireFirstInput();
      device = 'mouse';
      if (e.button === 0) { mouse.down = true; mouse.pressed = true; }
      if (e.button === 2) mouse.rpressed = true;
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) { mouse.down = false; mouse.released = true; } });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener('touchstart', () => fireFirstInput(), { passive: true });
  }

  function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    pad.connected = !!gp;
    pad.prev = pad.held;
    pad.held = {};
    pad.axisX = 0; pad.axisY = 0;
    if (!gp) return;
    const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const dz = 0.35;
    pad.axisX = Math.abs(ax) > dz ? ax : 0;
    pad.axisY = Math.abs(ay) > dz ? ay : 0;
    const h = pad.held;
    h.up = b(12) || ay < -0.5; h.down = b(13) || ay > 0.5; h.left = b(14) || ax < -0.5; h.right = b(15) || ax > 0.5;
    h.attack = b(2); h.dodge = b(1) || b(5) || b(7); h.interact = b(0); h.potion = b(3);
    h.pause = b(9); h.map = b(8);
    h.confirm = b(0); h.cancel = b(1);
    pad.pressed = {};
    let any = false;
    for (const k of Object.keys(h)) { if (h[k] && !pad.prev[k]) { pad.pressed[k] = true; any = true; } }
    if (any) { device = 'gamepad'; fireFirstInput(); }
  }

  function held(action) {
    for (const code of down) if (GAME_KEYS[code] === action || (UI_KEYS[code] === action && !GAME_KEYS[code])) return true;
    return !!pad.held[action];
  }
  function pressed(action) {
    for (const code of pressedCodes) if (GAME_KEYS[code] === action) return true;
    return !!pad.pressed[action];
  }
  function uiPressed(action) {
    for (const code of pressedCodes) if (UI_KEYS[code] === action) return true;
    return !!pad.pressed[action] || (action === 'up' && pad.pressed.up) || (action === 'down' && pad.pressed.down);
  }
  function anyPressed() {
    return pressedCodes.size > 0 || mouse.pressed || Object.keys(pad.pressed).length > 0;
  }
  function moveVector() {
    if (RS.Input.override) return { x: RS.Input.override.x, y: RS.Input.override.y };
    let x = 0, y = 0;
    if (held('left')) x -= 1;
    if (held('right')) x += 1;
    if (held('up')) y -= 1;
    if (held('down')) y += 1;
    if (pad.axisX || pad.axisY) { x = pad.axisX; y = pad.axisY; }
    return { x, y };
  }
  // Call after each fixed update step
  function endStep() {
    pressedCodes.clear();
    mouse.pressed = false; mouse.rpressed = false; mouse.released = false; mouse.wheel = 0; mouse.moved = false;
    pad.pressed = {};
  }
  function onKey(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }
  function onFirstInput(fn) { if (gotFirstInput) fn(); else firstInputCallbacks.push(fn); }

  const LABELS = {
    keyboard: { attack: 'J', dodge: 'K', interact: 'E', potion: 'Q', map: 'M', pause: 'Esc', confirm: 'Enter', cancel: 'Esc' },
    gamepad: { attack: 'X', dodge: 'B', interact: 'A', potion: 'Y', map: '보기', pause: '메뉴', confirm: 'A', cancel: 'B' }
  };
  function keyLabel(action) {
    const set = device === 'gamepad' ? LABELS.gamepad : LABELS.keyboard;
    return set[action] || action;
  }

  RS.Input = {
    attach, pollGamepad, held, pressed, uiPressed, anyPressed, moveVector, endStep, onKey, onFirstInput, keyLabel,
    mouse, pad, get device() { return device; }, get hasInput() { return gotFirstInput; }, isDown: (code) => down.has(code)
  };
})();
