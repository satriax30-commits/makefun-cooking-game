// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour. Every
// sprite is flat canvas shapes drawn in code — the kitchen, the chef in his toque, the tickets,
// the food — so the game needs no image files at all.
import { FIELD, FONT, INGREDIENTS, LAYOUT, PALETTE, RECIPES, SCORE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawIngredientIcon(id, x, y, size) {
    const ing = INGREDIENTS[id];
    if (!ing) return;
    const r = size / 2;
    context.fillStyle = ing.color;
    context.beginPath();
    if (id === 'bun') {
      // A bun is a dome: half a circle with a flat bottom.
      context.arc(x, y + r * 0.4, r, Math.PI, 0);
      context.fill();
      context.fillRect(x - r, y + r * 0.4, size, r * 0.45);
      context.fillStyle = '#fff';
      context.fillRect(x - r * 0.4, y - r * 0.5, 3, 3);
      context.fillRect(x + r * 0.2, y - r * 0.7, 3, 3);
    } else if (id === 'lettuce') {
      context.beginPath();
      for (let i = 0; i < 3; i += 1) {
        context.arc(x - r * 0.6 + i * r * 0.6, y, r * 0.55, 0, Math.PI * 2);
      }
      context.fill();
    } else if (id === 'cheese') {
      context.beginPath();
      context.moveTo(x - r, y + r * 0.6);
      context.lineTo(x + r, y + r * 0.6);
      context.lineTo(x + r, y - r * 0.2);
      context.lineTo(x - r, y - r * 0.6);
      context.closePath();
      context.fill();
    } else if (id === 'fries') {
      context.fillStyle = '#e2574c';
      context.fillRect(x - r - 2, y - r * 0.2, size + 4, r * 0.9);
      context.fillStyle = ing.color;
      for (let i = 0; i < 3; i += 1) context.fillRect(x - r + i * (size / 3) + 2, y - r, size / 3 - 4, size * 0.8);
    } else {
      context.arc(x, y, r, 0, Math.PI * 2);
      context.fill();
    }
    context.strokeStyle = ing.dark;
    context.lineWidth = 2;
    if (id !== 'bun' && id !== 'cheese' && id !== 'fries' && id !== 'lettuce') {
      context.beginPath();
      context.arc(x, y, r, 0, Math.PI * 2);
      context.stroke();
    }
  }

  /** A plate with its stacked ingredients, drawn as layers so a burger reads as a burger. */
  function drawPlate(x, y, items, size) {
    const w = size;
    context.fillStyle = '#f2f2f2';
    context.beginPath();
    context.ellipse(x, y, w / 2, w / 5, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#c8c8c8';
    context.lineWidth = 2;
    context.stroke();
    let layerY = y - 4;
    for (const id of items) {
      const ing = INGREDIENTS[id];
      if (!ing) continue;
      context.fillStyle = ing.color;
      if (id === 'bun') {
        context.beginPath();
        context.arc(x, layerY, w * 0.32, Math.PI, 0);
        context.fill();
        layerY -= 6;
      } else if (id === 'lettuce') {
        roundRect(context, x - w * 0.34, layerY - 5, w * 0.68, 9, 4);
        context.fill();
        layerY -= 8;
      } else if (id === 'cheese') {
        context.beginPath();
        context.moveTo(x - w * 0.36, layerY);
        context.lineTo(x + w * 0.36, layerY);
        context.lineTo(x + w * 0.2, layerY - 9);
        context.lineTo(x - w * 0.2, layerY - 9);
        context.closePath();
        context.fill();
        layerY -= 8;
      } else {
        roundRect(context, x - w * 0.34, layerY - 9, w * 0.68, 10, 5);
        context.fill();
        layerY -= 9;
      }
    }
  }

  function drawTicket(order, x, y, w, h) {
    context.fillStyle = PALETTE.ticket;
    roundRect(context, x, y, w, h, 8);
    context.fill();
    context.strokeStyle = '#d9c48f';
    context.lineWidth = 2;
    context.stroke();
    const recipe = order.recipe;
    text(recipe.name, x + 12, y + 24, 19, PALETTE.ticketText, 'left');
    // The recipe as a row of icons, with a count for repeated ingredients.
    const counts = {};
    for (const id of recipe.items) counts[id] = (counts[id] || 0) + 1;
    let ix = x + 16;
    for (const id of Object.keys(counts)) {
      drawIngredientIcon(id, ix + 12, y + 52, 24);
      if (counts[id] > 1) text('x' + counts[id], ix + 25, y + 60, 14, PALETTE.ticketText, 'left');
      ix += 54;
    }
    // Patience bar: green while the guest is happy, red as they run out of patience.
    const frac = Math.max(0, order.patience / order.max);
    context.fillStyle = '#e0d3b0';
    roundRect(context, x + 12, y + h - 16, w - 24, 8, 4);
    context.fill();
    context.fillStyle = frac > 0.5 ? PALETTE.good : frac > 0.25 ? PALETTE.timer : PALETTE.danger;
    roundRect(context, x + 12, y + h - 16, (w - 24) * frac, 8, 4);
    context.fill();
  }

  function drawBoard(state) {
    const b = LAYOUT.board;
    context.fillStyle = PALETTE.board;
    roundRect(context, b.x, b.y, b.width, b.height, 10);
    context.fill();
    context.strokeStyle = PALETTE.boardEdge;
    context.lineWidth = 3;
    context.stroke();
    text('ORDER BOARD', b.x + 16, b.y + 30, 20, PALETTE.muted, 'left');
    text('Match the ticket!', b.x + 16, b.y + 58, 15, PALETTE.muted, 'left');
    if (state.orders.length === 0) {
      text('No orders yet — the lunch rush is coming…', b.x + 300, b.y + 52, 18, PALETTE.muted, 'left');
    }
    for (let i = 0; i < state.orders.length; i += 1) {
      drawTicket(state.orders[i], b.x + 300 + i * 300, b.y + 8, 280, 76);
    }
  }

  function drawStations(state) {
    // Ingredient bins along the left wall.
    for (const bin of LAYOUT.bins) {
      context.fillStyle = PALETTE.counter;
      roundRect(context, bin.x, bin.y, bin.w, bin.h, 8);
      context.fill();
      context.fillStyle = PALETTE.counterTop;
      roundRect(context, bin.x + 4, bin.y + 4, bin.w - 8, bin.h - 8, 6);
      context.fill();
      drawIngredientIcon(bin.id, bin.x + bin.w / 2, bin.y + 30, 34);
      text(INGREDIENTS[bin.id].name, bin.x + bin.w / 2, bin.y + bin.h - 8, 14, PALETTE.text, 'center');
    }
    // Grill: two slots, each showing its patty and a progress ring.
    const g = LAYOUT.grill;
    context.fillStyle = PALETTE.grill;
    roundRect(context, g.x, g.y, g.w, g.h, 8);
    context.fill();
    text('GRILL', g.x + 12, g.y + 22, 16, PALETTE.text, 'left');
    state.grill.forEach((slot, i) => {
      const cx = g.x + 52 + i * 76;
      const cy = g.y + 64;
      context.fillStyle = '#222226';
      context.beginPath();
      context.arc(cx, cy, 28, 0, Math.PI * 2);
      context.fill();
      if (slot.state !== 'empty') {
        const done = slot.state === 'cooked' || slot.state === 'burnt';
        context.fillStyle = slot.state === 'burnt' ? '#222' : slot.state === 'cooked' ? '#8a5a33' : '#d97b7b';
        context.beginPath();
        context.arc(cx, cy, 22, 0, Math.PI * 2);
        context.fill();
        if (slot.state === 'cooking') {
          context.strokeStyle = PALETTE.grillHot;
          context.lineWidth = 5;
          context.beginPath();
          context.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + (slot.t / 6) * Math.PI * 2);
          context.stroke();
        } else if (slot.state === 'cooked') {
          text('READY', cx, cy + 40, 13, PALETTE.good, 'center');
        } else {
          text('BURNT!', cx, cy + 40, 13, PALETTE.danger, 'center');
        }
      }
    });
    // Fryer: one basket of fries.
    const f = LAYOUT.fryer;
    context.fillStyle = PALETTE.steel;
    roundRect(context, f.x, f.y, f.w, f.h, 8);
    context.fill();
    text('FRYER', f.x + 12, f.y + 22, 16, '#222', 'left');
    const slot = state.fryer[0];
    context.fillStyle = '#5a4632';
    roundRect(context, f.x + 40, f.y + 38, 100, 56, 6);
    context.fill();
    if (slot.state !== 'empty') {
      if (slot.state === 'cooking') drawIngredientIcon('friesRaw', f.x + 90, f.y + 66, 30);
      else drawIngredientIcon(slot.state === 'burnt' ? 'burnt' : 'fries', f.x + 90, f.y + 66, 34);
      if (slot.state === 'cooked') text('READY', f.x + 90, f.y + 104, 13, PALETTE.good, 'center');
      if (slot.state === 'burnt') text('BURNT!', f.x + 90, f.y + 104, 13, PALETTE.danger, 'center');
    }
    // Assembly counter with the plate being built.
    const c = LAYOUT.counter;
    context.fillStyle = PALETTE.counter;
    roundRect(context, c.x, c.y, c.w, c.h, 8);
    context.fill();
    context.fillStyle = PALETTE.counterTop;
    roundRect(context, c.x + 4, c.y + 4, c.w - 8, c.h - 8, 6);
    context.fill();
    text('ASSEMBLY', c.x + 14, c.y + 26, 16, PALETTE.text, 'left');
    if (state.plate.items !== null) drawPlate(c.x + c.w / 2, c.y + 62, state.plate.items, 110);
    else text('Put a plate here, then stack ingredients', c.x + c.w / 2, c.y + 62, 15, PALETTE.muted, 'center');
    // Plate stack.
    const p = LAYOUT.plates;
    context.fillStyle = PALETTE.counter;
    roundRect(context, p.x, p.y, p.w, p.h, 8);
    context.fill();
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = '#f2f2f2';
      context.beginPath();
      context.ellipse(p.x + p.w / 2, p.y + 62 - i * 7, 34, 8, 0, 0, Math.PI * 2);
      context.fill();
    }
    text('PLATES', p.x + p.w / 2, p.y + 26, 15, PALETTE.text, 'center');
    // Serving window.
    const s = LAYOUT.serve;
    context.fillStyle = '#7a4a2b';
    roundRect(context, s.x, s.y, s.w, s.h, 8);
    context.fill();
    context.fillStyle = '#f7e8c8';
    roundRect(context, s.x + 8, s.y + 8, s.w - 16, s.h - 16, 6);
    context.fill();
    text('SERVE  →', s.x + s.w / 2, s.y + 34, 20, '#7a4a2b', 'center');
    text('Bring the finished plate', s.x + s.w / 2, s.y + 62, 14, '#7a4a2b', 'center');
    text('matching a ticket', s.x + s.w / 2, s.y + 84, 14, '#7a4a2b', 'center');
    // Trash.
    const t = LAYOUT.trash;
    context.fillStyle = '#4a4a52';
    roundRect(context, t.x, t.y, t.w, t.h, 8);
    context.fill();
    text('🗑 TRASH', t.x + t.w / 2, t.y + 40, 18, '#ddd', 'center');
    text('Dump burnt food here', t.x + t.w / 2, t.y + 68, 14, '#aaa', 'center');
  }

  function drawChef(state) {
    const chef = state.chef;
    // Shadow, body, apron, head and toque.
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(chef.x, chef.y + 18, 26, 9, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.chef;
    context.beginPath();
    context.arc(chef.x, chef.y, 22, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.apron;
    context.beginPath();
    context.arc(chef.x, chef.y + 6, 18, 0, Math.PI);
    context.fill();
    context.fillStyle = '#2b2b2b';
    context.beginPath();
    context.arc(chef.x - 8, chef.y - 4, 2.5, 0, Math.PI * 2);
    context.arc(chef.x + 8, chef.y - 4, 2.5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#2b2b2b';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(chef.x, chef.y + 2, 7, 0.2, Math.PI - 0.2);
    context.stroke();
    // Toque.
    context.fillStyle = PALETTE.hat;
    roundRect(context, chef.x - 16, chef.y - 38, 32, 14, 6);
    context.fill();
    context.beginPath();
    context.arc(chef.x - 10, chef.y - 38, 8, 0, Math.PI * 2);
    context.arc(chef.x, chef.y - 42, 9, 0, Math.PI * 2);
    context.arc(chef.x + 10, chef.y - 38, 8, 0, Math.PI * 2);
    context.fill();
    // What the chef carries, held overhead.
    const carry = chef.carry;
    if (carry !== null) {
      if (carry.kind === 'plate') drawPlate(chef.x, chef.y - 52, carry.items, 64);
      else drawIngredientIcon(carry.id, chef.x, chef.y - 52, 30);
    }
  }

  function drawHud(state) {
    const minutes = Math.floor(state.timeLeft / 60);
    const seconds = Math.floor(state.timeLeft % 60);
    const clock = minutes + ':' + String(seconds).padStart(2, '0');
    text('SCORE ' + state.score, 24, 700, 26, PALETTE.text, 'left');
    text('Served ' + state.served + '   Missed ' + state.missed, 300, 700, 20, PALETTE.muted, 'left');
    if (state.combo >= 2) text('COMBO x' + state.combo, 560, 700, 22, PALETTE.timer, 'left');
    text('⏱ ' + clock, FIELD.width - 24, 700, 28, state.timeLeft < 30 ? PALETTE.danger : PALETTE.text, 'right');
    // Shift timer bar along the bottom edge.
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.fillRect(0, FIELD.height - 8, FIELD.width, 8);
    context.fillStyle = state.timeLeft < 30 ? PALETTE.danger : PALETTE.timer;
    context.fillRect(0, FIELD.height - 8, FIELD.width * (state.timeLeft / 180), 8);
  }

  function drawField(state) {
    // Walls and chequered floor.
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const fl = LAYOUT.floor;
    for (let ty = 0; ty < 8; ty += 1) {
      for (let tx = 0; tx < 16; tx += 1) {
        context.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floor : PALETTE.floorDark;
        context.fillRect(fl.x + tx * 78, fl.y + ty * 74, 78, 74);
      }
    }
    drawStations(state);
    drawChef(state);
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(20,14,10,0.88)';
    roundRect(context, x, y, PANEL.width, height, 14);
    context.fill();
    context.strokeStyle = PALETTE.boardEdge;
    context.lineWidth = 3;
    context.stroke();
    text(title, FIELD.width / 2, y + 76, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.timer, 'center');
  }

  function stars(score) {
    return (score >= SCORE.star3 ? 3 : score >= SCORE.star2 ? 2 : score >= SCORE.star1 ? 1 : 0);
  }

  /** Paint one frame: the kitchen, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state);
    drawBoard(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('SIZZLE & SERVE', [
        'You run The Little Bistro for one lunch shift.',
        'Take tickets, grill patties, fry potatoes,',
        'stack plates to match — and serve before',
        'the guests lose patience!',
        '',
        'Move: WASD / arrows or click to walk.  Use: E or click a station.',
        'Best score: ' + best,
      ], 'Press Space or click to start the shift');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The grill will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      const n = stars(state.score);
      const starLine = '★'.repeat(n) + '☆'.repeat(3 - n);
      drawPanel('Shift over!', [
        starLine,
        'Score: ' + state.score + '   (best ' + best + ')',
        'Served: ' + state.served + '   Missed: ' + state.missed,
        'Best combo: x' + state.bestCombo,
        '',
        n === 3 ? 'Three stars — the bistro is famous!' : n === 2 ? 'Two stars — a solid lunch rush.' : 'The guests are hungry for a rematch.',
      ], 'Press Space or click to cook again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
