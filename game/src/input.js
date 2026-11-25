// Keyboard and pointer input. Held keys steer the chef; one-shot presses (start, use a station,
// pause) are queued as bit flags and taken once by the loop, so a press between two frames is
// never lost and never counted twice. A click sets a walk target and, when it lands on a station
// the chef can reach, uses that station — so the whole game is playable with the mouse alone.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_USE = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const USE = new Set(['KeyE', 'KeyF']);

export function createInput(target, toLogical) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let actions = 0;
  // Where the chef should walk to (logical coordinates), or null when the keys steer.
  let walkTarget = null;
  // The station a click asked to use, once the chef is close enough; cleared on arrival or on
  // any key press.
  let pendingStation = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (USE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_USE;
    } else return;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      walkTarget = null;
      pendingStation = null;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
  });

  target.addEventListener('pointerdown', (event) => {
    const point = toLogical(event.clientX, event.clientY);
    if (point === null) return;
    walkTarget = point;
    pendingStation = point.station || null;
    actions |= ACTION_CONFIRM;
  });

  return {
    /** -1, 0 or 1 on each axis: keys win over a walk target. */
    move(chefX, chefY) {
      const kx = (right ? 1 : 0) - (left ? 1 : 0);
      const ky = (down ? 1 : 0) - (up ? 1 : 0);
      if (kx !== 0 || ky !== 0) return { x: kx, y: ky };
      if (walkTarget !== null) {
        const dx = walkTarget.x - chefX;
        const dy = walkTarget.y - chefY;
        const dist = Math.hypot(dx, dy);
        if (dist < 12) {
          walkTarget = null;
          return { x: 0, y: 0 };
        }
        return { x: dx / dist, y: dy / dist };
      }
      return { x: 0, y: 0 };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The station a click is waiting to use, if the chef has arrived. */
    takePendingStation(isNear) {
      if (pendingStation === null) return null;
      if (isNear(pendingStation)) {
        const station = pendingStation;
        pendingStation = null;
        return station;
      }
      return null;
    },
    clearPending() {
      pendingStation = null;
      walkTarget = null;
    },
  };
}
