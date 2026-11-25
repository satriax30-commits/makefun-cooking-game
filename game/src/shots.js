// The screenshot scenes behind ?shot=start|play|cook|end. Each one builds its frame from the
// real world state — real tickets, a real patty on the grill, a real plate mid-assembly — so the
// frame is what a short game really looks like, and the same seed always gives the same frame.
import { RECIPES, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function ticket(world, recipeIndex, patience, max) {
  return { recipe: RECIPES[recipeIndex], patience, max, id: recipeIndex };
}

/** Run the world forward with the chef standing still, so orders arrive on their own clock. */
function idle(world, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, null);
}

/**
 * Set `world` to the named scene (start, play, cook or end; any other name is start) and return
 * the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'cook' && name !== 'end') {
    idle(world, 6);
    state.orders.length = 0;
    state.orders.push(ticket(world, 0, 48, 55));
    state.orders.push(ticket(world, 3, 30, 55));
    state.chef.x = 640;
    state.chef.y = 420;
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Mid-assembly: a classic burger half built on the counter, a patty sizzling, two tickets up.
    idle(world, 40);
    state.orders.length = 0;
    state.orders.push(ticket(world, 0, 38, 55));
    state.orders.push(ticket(world, 1, 22, 55));
    state.grill[0] = { item: 'patty', t: 3.5, state: 'cooking' };
    state.grill[1] = { item: 'patty', t: 6, state: 'cooked' };
    state.plate.items = ['bun', 'patty', 'lettuce'];
    state.chef.x = 700;
    state.chef.y = 520;
    state.chef.carry = { kind: 'item', id: 'tomato' };
    state.score = 260;
    state.served = 2;
    state.timeLeft = 140;
    return { screen: SCREEN_PLAY, best: 260 };
  }
  if (name === 'cook') {
    // The rush at full heat: grill and fryer both busy, a fries plate waiting, tickets piling up.
    idle(world, 90);
    state.orders.length = 0;
    state.orders.push(ticket(world, 2, 18, 55));
    state.orders.push(ticket(world, 3, 40, 55));
    state.orders.push(ticket(world, 4, 50, 55));
    state.grill[0] = { item: 'patty', t: 5, state: 'cooking' };
    state.grill[1] = { item: 'patty', t: 2, state: 'cooking' };
    state.fryer[0] = { item: 'fries', t: 7, state: 'cooking' };
    state.plate.items = ['fries'];
    state.chef.x = 1000;
    state.chef.y = 620;
    state.chef.carry = { kind: 'plate', items: ['bun', 'patty', 'cheese'] };
    state.score = 640;
    state.served = 5;
    state.missed = 0;
    state.combo = 3;
    state.timeLeft = 88;
    return { screen: SCREEN_PLAY, best: 640 };
  }
  // end: the shift is over, with a three-star score on the board.
  idle(world, 30);
  state.orders.length = 0;
  state.score = 1120;
  state.served = 9;
  state.missed = 1;
  state.bestCombo = 4;
  state.timeLeft = 0;
  state.over = true;
  state.chef.x = 640;
  state.chef.y = 420;
  return { screen: SCREEN_OVER, best: 1120 };
}
