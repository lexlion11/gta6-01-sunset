// Keyboard and mouse state. Keys are read by name; the mouse is read in world space
// by the camera.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, clicked: false };

  const codeOf = (e) => e.code;

  window.addEventListener('keydown', (e) => {
    const c = codeOf(e);
    if (!keys.has(c)) pressed.add(c);
    keys.add(c);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(codeOf(e));
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      // The aim point follows the press as well: a click that lands without a
      // preceding move would otherwise shoot at wherever the pointer last was.
      const rect = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
      mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys,
    pressed,
    mouse,
    isDown: (code) => keys.has(code),
    wasPressed: (code) => pressed.has(code),
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  fire: ['Space'],
  enter: ['KeyF'],
  action: ['KeyE'],
  horn: ['KeyH'],
};
