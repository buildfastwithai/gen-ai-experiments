/* core/Input.js — pointer-lock mouse look, key state with edge detection,
   gamepad support, and buffered actions (so a punch pressed 80ms early still lands). */

const BUFFER_TIME = 0.16;

export class Input {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;

    this.keys = new Set();
    this.pressed = new Set();     // this frame only
    this.released = new Set();
    this.buffer = new Map();      // action -> time remaining

    this.mouse = { dx: 0, dy: 0, left: false, right: false, leftEdge: false, rightEdge: false, wheel: 0 };
    this.webToggle = false;
    this.locked = false;
    this.enabled = true;
    this.gamepadIndex = null;
    this.stick = { lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0 };

    this._bind();
  }

  _bind() {
    const c = this.canvas;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.code;
      this.keys.add(k); this.pressed.add(k);
      if (k === 'KeyX') { this.webToggle = !this.webToggle; this.pushBuffer('web'); }
      if (['Space', 'Tab', 'F1', 'F2'].includes(k)) e.preventDefault();
      this.emitAction(k);
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); this.released.add(e.code); });
    addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.left = this.mouse.right = false;
      this.webToggle = false;
    });

    c.addEventListener('mousedown', (e) => {
      if (!this.locked) { this.requestLock(); return; }
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftEdge = true; this.pushBuffer('attack'); }
      if (e.button === 2) {
        this.webToggle = false;
        this.mouse.right = true; this.mouse.rightEdge = true; this.pushBuffer('web');
      }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });

    addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      const s = 0.0022 * this.settings.mouseSensitivity;
      this.mouse.dx += e.movementX * s;
      this.mouse.dy += e.movementY * s * (this.settings.invertY ? -1 : 1);
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });

    addEventListener('gamepadconnected', (e) => { this.gamepadIndex = e.gamepad.index; });
    addEventListener('gamepaddisconnected', () => { this.gamepadIndex = null; });
  }

  requestLock() {
    if (!this.enabled) return;
    try {
      const request = this.canvas.requestPointerLock?.();
      request?.catch?.(() => {});
    } catch (e) { /* embedded browsers may not expose pointer lock */ }
  }
  exitLock() { document.exitPointerLock?.(); }

  emitAction(code) {
    const map = {
      Space: 'jump', KeyE: 'webpull', KeyQ: 'webtrap', KeyF: 'zip',
      ShiftLeft: 'dodge', KeyR: 'slingshot', KeyC: 'crouch', KeyV: 'perch', KeyX: 'web',
    };
    if (map[code]) this.pushBuffer(map[code]);
  }
  pushBuffer(action) { this.buffer.set(action, BUFFER_TIME); }
  /** Consume a buffered action — returns true once. */
  consume(action) {
    if (this.buffer.has(action)) { this.buffer.delete(action); return true; }
    return false;
  }
  peek(action) { return this.buffer.has(action); }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }

  /** Analog movement in local space: x = strafe, y = forward. */
  moveAxis() {
    let x = 0, y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    x += this.stick.lx; y += -this.stick.ly;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, len: Math.min(1, len) };
  }

  pollGamepad(dt) {
    if (this.gamepadIndex === null || !navigator.getGamepads) return;
    const gp = navigator.getGamepads()[this.gamepadIndex];
    if (!gp) return;
    const dz = (v) => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);
    this.stick.lx = dz(gp.axes[0] || 0); this.stick.ly = dz(gp.axes[1] || 0);
    this.stick.rx = dz(gp.axes[2] || 0); this.stick.ry = dz(gp.axes[3] || 0);
    this.mouse.dx += this.stick.rx * 2.6 * dt * this.settings.mouseSensitivity;
    this.mouse.dy += this.stick.ry * 1.9 * dt * this.settings.mouseSensitivity * (this.settings.invertY ? -1 : 1);
    const btn = (i) => gp.buttons[i] && gp.buttons[i].pressed;
    this._gpEdge = this._gpEdge || {};
    const edge = (i, action) => {
      const p = btn(i);
      if (p && !this._gpEdge[i]) this.pushBuffer(action);
      this._gpEdge[i] = p;
    };
    edge(0, 'jump'); edge(2, 'webtrap'); edge(1, 'dodge'); edge(3, 'webpull');
    edge(5, 'zip'); edge(4, 'slingshot');
    this.mouse.right = (gp.buttons[7]?.value || 0) > 0.35;
    if ((gp.buttons[6]?.value || 0) > 0.5) this.pushBuffer('attack');
    this.mouse.left = (gp.buttons[6]?.value || 0) > 0.5;
  }

  /** Call once per frame AFTER all systems read input. */
  endFrame(dt) {
    this.pressed.clear(); this.released.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
    this.mouse.leftEdge = false; this.mouse.rightEdge = false;
    for (const [k, t] of this.buffer) {
      const nt = t - dt;
      if (nt <= 0) this.buffer.delete(k); else this.buffer.set(k, nt);
    }
  }
}
