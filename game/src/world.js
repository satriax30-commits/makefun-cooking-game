// The game's rules and state, with no drawing and no browser in it: the chef, the stations
// (bins, grill, fryer, assembly counter, plate stack, serving window, trash), the order tickets
// and the shift clock. step() advances one fixed step and returns what happened as bit flags, so
// the caller can react (sounds, announcements) without the world knowing about screens or sound.
// Nothing here allocates after createWorld returns, except the short-lived ticket objects.

import {
  CHEF, FIELD, FRYER, GRILL, INGREDIENTS, LAYOUT, ORDERS, RECIPES, SCORE, SHIFT_SECONDS,
} from './config.js';

export const EVENT_PICKUP = 1;
export const EVENT_PLACE = 2;
export const EVENT_COOKED = 4;
export const EVENT_BURNT = 8;
export const EVENT_SERVED = 16;
export const EVENT_WRONG = 32;
export const EVENT_MISSED = 64;
export const EVENT_OVER = 128;
export const EVENT_TRASH = 256;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function stationCentre(station) {
  return { x: station.x + station.w / 2, y: station.y + station.h / 2 };
}

function near(chef, station) {
  const c = stationCentre(station);
  const dx = chef.x - c.x;
  const dy = chef.y - c.y;
  return dx * dx + dy * dy < CHEF.reach * CHEF.reach;
}

/** True when two item lists hold the same ingredients, order aside (a bun twice counts twice). */
export function matchesRecipe(items, recipeItems) {
  if (items.length !== recipeItems.length) return false;
  const left = items.slice().sort();
  const right = recipeItems.slice().sort();
  for (let i = 0; i < left.length; i += 1) if (left[i] !== right[i]) return false;
  return true;
}

export function createWorld(random) {
  const chef = { x: 640, y: 420, carry: null };
  // carry: null, or { kind: 'item', id } for one ingredient, or { kind: 'plate', items: [] }.
  const grill = [];
  for (let i = 0; i < GRILL.slots; i += 1) grill.push({ item: null, t: 0, state: 'empty' });
  const fryer = [];
  for (let i = 0; i < FRYER.slots; i += 1) fryer.push({ item: null, t: 0, state: 'empty' });
  const plate = { items: null }; // the plate resting on the assembly counter, or null
  const orders = [];
  const state = {
    chef, grill, fryer, plate, orders,
    score: 0, served: 0, missed: 0, combo: 0, bestCombo: 0,
    timeLeft: SHIFT_SECONDS, orderTimer: ORDERS.firstAfterSeconds, elapsed: 0, over: false,
  };

  function reset() {
    chef.x = 640;
    chef.y = 420;
    chef.carry = null;
    for (const slot of grill) { slot.item = null; slot.t = 0; slot.state = 'empty'; }
    for (const slot of fryer) { slot.item = null; slot.t = 0; slot.state = 'empty'; }
    plate.items = null;
    orders.length = 0;
    state.score = 0;
    state.served = 0;
    state.missed = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.timeLeft = SHIFT_SECONDS;
    state.orderTimer = ORDERS.firstAfterSeconds;
    state.elapsed = 0;
    state.over = false;
  }

  function spawnOrder() {
    if (orders.length >= ORDERS.maxActive) return;
    const recipe = RECIPES[Math.floor(random() * RECIPES.length)];
    orders.push({ recipe, patience: ORDERS.patienceSeconds, max: ORDERS.patienceSeconds, id: state.elapsed });
  }

  /** The station under the chef, if any, in the order the chef would mean to use. */
  function stationAtChef() {
    for (const bin of LAYOUT.bins) if (near(chef, bin)) return { type: 'bin', bin };
    if (near(chef, LAYOUT.grill)) return { type: 'grill' };
    if (near(chef, LAYOUT.fryer)) return { type: 'fryer' };
    if (near(chef, LAYOUT.counter)) return { type: 'counter' };
    if (near(chef, LAYOUT.plates)) return { type: 'plates' };
    if (near(chef, LAYOUT.serve)) return { type: 'serve' };
    if (near(chef, LAYOUT.trash)) return { type: 'trash' };
    return null;
  }

  /** The station whose rectangle holds the point (a mouse click), if any. */
  function stationAtPoint(x, y) {
    for (const bin of LAYOUT.bins) {
      if (x >= bin.x && x <= bin.x + bin.w && y >= bin.y && y <= bin.y + bin.h) return { type: 'bin', bin };
    }
    const rects = [
      ['grill', LAYOUT.grill], ['fryer', LAYOUT.fryer], ['counter', LAYOUT.counter],
      ['plates', LAYOUT.plates], ['serve', LAYOUT.serve], ['trash', LAYOUT.trash],
    ];
    for (const [type, r] of rects) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { type };
    }
    return null;
  }

  function cookSlot(slots, cookSeconds, burnSeconds, dt) {
    let events = 0;
    for (const slot of slots) {
      if (slot.state === 'empty') continue;
      slot.t += dt;
      if (slot.state === 'cooking' && slot.t >= cookSeconds) {
        slot.state = 'cooked';
        events |= EVENT_COOKED;
      } else if (slot.state === 'cooked' && slot.t >= cookSeconds + burnSeconds) {
        slot.state = 'burnt';
        slot.item = 'burnt';
        events |= EVENT_BURNT;
      }
    }
    return events;
  }

  /**
   * Use a station. Returns event flags. A use only works when the chef stands close enough to
   * the station; a click on a far station is ignored (the chef walks there instead — see moveTo).
   */
  function use(station) {
    if (station === null) return 0;
    const carry = chef.carry;
    if (station.type === 'bin') {
      if (carry !== null) return 0;
      chef.carry = { kind: 'item', id: station.bin.id };
      return EVENT_PICKUP;
    }
    if (station.type === 'grill' || station.type === 'fryer') {
      const slots = station.type === 'grill' ? grill : fryer;
      const rawId = station.type === 'grill' ? 'pattyRaw' : 'friesRaw';
      const cookedId = station.type === 'grill' ? 'patty' : 'fries';
      const cookSeconds = station.type === 'grill' ? GRILL.cookSeconds : FRYER.cookSeconds;
      if (carry !== null && carry.kind === 'item' && carry.id === rawId) {
        for (const slot of slots) {
          if (slot.state === 'empty') {
            slot.item = cookedId;
            slot.t = 0;
            slot.state = 'cooking';
            chef.carry = null;
            return EVENT_PLACE;
          }
        }
        return 0;
      }
      if (carry === null) {
        for (const slot of slots) {
          if (slot.state === 'cooked' || slot.state === 'burnt') {
            chef.carry = { kind: 'item', id: slot.item };
            slot.item = null;
            slot.t = 0;
            slot.state = 'empty';
            return EVENT_PICKUP;
          }
        }
      }
      return 0;
    }
    if (station.type === 'plates') {
      if (carry === null) {
        chef.carry = { kind: 'plate', items: [] };
        return EVENT_PICKUP;
      }
      return 0;
    }
    if (station.type === 'counter') {
      if (carry !== null && carry.kind === 'plate' && plate.items === null) {
        plate.items = carry.items;
        chef.carry = null;
        return EVENT_PLACE;
      }
      if (carry === null && plate.items !== null) {
        chef.carry = { kind: 'plate', items: plate.items };
        plate.items = null;
        return EVENT_PICKUP;
      }
      if (carry !== null && carry.kind === 'item' && plate.items !== null) {
        // Only real food goes on a plate, never a raw patty or a burnt one.
        if (carry.id === 'pattyRaw' || carry.id === 'friesRaw' || carry.id === 'burnt') return 0;
        plate.items.push(carry.id);
        chef.carry = null;
        return EVENT_PLACE;
      }
      return 0;
    }
    if (station.type === 'serve') {
      if (carry === null || carry.kind !== 'plate' || carry.items.length === 0) return 0;
      for (let i = 0; i < orders.length; i += 1) {
        if (matchesRecipe(carry.items, orders[i].recipe.items)) {
          const order = orders[i];
          const tip = Math.round((SCORE.tipMax * order.patience) / order.max);
          const comboBonus = state.combo * 10;
          state.score += order.recipe.price + tip + comboBonus;
          state.served += 1;
          state.combo += 1;
          if (state.combo > state.bestCombo) state.bestCombo = state.combo;
          orders.splice(i, 1);
          chef.carry = null;
          return EVENT_SERVED;
        }
      }
      state.score = Math.max(0, state.score - SCORE.wrongPenalty);
      state.combo = 0;
      return EVENT_WRONG;
    }
    if (station.type === 'trash') {
      if (carry === null) return 0;
      chef.carry = null;
      return EVENT_TRASH;
    }
    return 0;
  }

  /**
   * One fixed step. `move` is { x, y } in -1..1 (keyboard, or a walk target's direction) and
   * `useStation` is a station to use this step, or null.
   */
  function step(dt, move, useStation) {
    if (state.over) return 0;
    let events = 0;
    state.elapsed += dt;
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.over = true;
      return EVENT_OVER;
    }

    chef.x = clamp(chef.x + move.x * CHEF.speed * dt, LAYOUT.floor.x + CHEF.radius, LAYOUT.floor.x + LAYOUT.floor.w - CHEF.radius);
    chef.y = clamp(chef.y + move.y * CHEF.speed * dt, LAYOUT.floor.y + CHEF.radius, LAYOUT.floor.y + LAYOUT.floor.h - CHEF.radius);

    events |= cookSlot(grill, GRILL.cookSeconds, GRILL.burnSeconds, dt);
    events |= cookSlot(fryer, FRYER.cookSeconds, FRYER.burnSeconds, dt);

    state.orderTimer -= dt;
    if (state.orderTimer <= 0) {
      spawnOrder();
      state.orderTimer = ORDERS.intervalSeconds;
    }
    for (let i = orders.length - 1; i >= 0; i -= 1) {
      orders[i].patience -= dt;
      if (orders[i].patience <= 0) {
        orders.splice(i, 1);
        state.missed += 1;
        state.combo = 0;
        state.score = Math.max(0, state.score - SCORE.missPenalty);
        events |= EVENT_MISSED;
      }
    }

    if (useStation) events |= use(useStation);
    return events;
  }

  reset();
  return { state, reset, step, stationAtChef, stationAtPoint, use };
}
