// Sizzle & Serve — The Little Bistro: every tuning number, colour and layout in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window, so no
// rule below depends on the screen size. All art is drawn in code (flat shapes, no images), all
// sound is synthesised in code (WebAudio oscillators and filtered noise, no audio files).

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** One shift lasts three minutes of cooking. */
export const SHIFT_SECONDS = 180;

export const CHEF = {
  radius: 22,
  speed: 330,
  /** How close the chef must be to a station to use it (centre to centre). */
  reach: 96,
};

export const GRILL = {
  slots: 2,
  /** Seconds on the grill before a raw patty is cooked. */
  cookSeconds: 6,
  /** Seconds past cooked before it burns. */
  burnSeconds: 7,
};

export const FRYER = {
  slots: 1,
  cookSeconds: 8,
  burnSeconds: 8,
};

/** Orders: how often a new ticket can arrive, how many can wait, how long a guest waits. */
export const ORDERS = {
  firstAfterSeconds: 4,
  intervalSeconds: 13,
  maxActive: 3,
  patienceSeconds: 55,
};

/** Points for a served dish, plus a speed tip that shrinks as patience runs out. */
export const SCORE = {
  serveBase: 100,
  tipMax: 50,
  missPenalty: 25,
  wrongPenalty: 10,
  /** Stars on the end screen at these scores. */
  star1: 300,
  star2: 600,
  star3: 1000,
};

/** Ingredient ids. A patty is 'pattyRaw' in hand, 'patty' once cooked; 'burnt' is trash-only. */
export const INGREDIENTS = {
  bun: { name: 'Bun', color: '#e8b25a', dark: '#c98f2e' },
  pattyRaw: { name: 'Raw patty', color: '#d97b7b', dark: '#a84f4f' },
  patty: { name: 'Patty', color: '#8a5a33', dark: '#5f3c1e' },
  lettuce: { name: 'Lettuce', color: '#7dc24a', dark: '#4d8a26' },
  tomato: { name: 'Tomato', color: '#e5534b', dark: '#b03028' },
  cheese: { name: 'Cheese', color: '#f2c94c', dark: '#d9a521' },
  friesRaw: { name: 'Potato', color: '#f0d9a0', dark: '#c9a85e' },
  fries: { name: 'Fries', color: '#f5c542', dark: '#d19a1f' },
  burnt: { name: 'Burnt!', color: '#2b2b2b', dark: '#111111' },
};

/**
 * The menu. A dish is a multiset of ingredient ids on one plate; 'bun' twice means a top and a
 * bottom bun. The plate's items may arrive in any order — the window checks the multiset.
 */
export const RECIPES = [
  { id: 'classic', name: 'Classic Burger', price: 100, items: ['bun', 'patty', 'lettuce', 'tomato', 'bun'] },
  { id: 'cheese', name: 'Cheese Burger', price: 100, items: ['bun', 'patty', 'cheese', 'bun'] },
  { id: 'double', name: 'Double Stack', price: 140, items: ['bun', 'patty', 'patty', 'cheese', 'lettuce', 'bun'] },
  { id: 'fries', name: 'Crispy Fries', price: 60, items: ['fries'] },
  { id: 'garden', name: 'Garden Plate', price: 80, items: ['lettuce', 'tomato', 'cheese'] },
];

/** Kitchen layout (logical coordinates). The order board hangs along the top wall. */
export const LAYOUT = {
  board: { x: 24, y: 14, width: 1232, height: 92 },
  /** Ingredient bins along the left wall, top to bottom. */
  bins: [
    { id: 'bun', x: 40, y: 150, w: 120, h: 74 },
    { id: 'pattyRaw', x: 40, y: 238, w: 120, h: 74 },
    { id: 'lettuce', x: 40, y: 326, w: 120, h: 74 },
    { id: 'tomato', x: 40, y: 414, w: 120, h: 74 },
    { id: 'cheese', x: 40, y: 502, w: 120, h: 74 },
    { id: 'friesRaw', x: 40, y: 590, w: 120, h: 74 },
  ],
  grill: { x: 1060, y: 150, w: 180, h: 110 },
  fryer: { x: 1060, y: 280, w: 180, h: 110 },
  /** The assembly counter and its plate live centre-right. */
  counter: { x: 560, y: 560, w: 320, h: 96 },
  plates: { x: 900, y: 560, w: 120, h: 96 },
  serve: { x: 1060, y: 430, w: 180, h: 110 },
  trash: { x: 1060, y: 560, w: 180, h: 96 },
  /** The floor the chef walks on (everything below the board, inside the walls). */
  floor: { x: 16, y: 118, w: 1248, h: 586 },
};

export const PALETTE = {
  backdrop: '#171310',
  wall: '#3d2b23',
  floor: '#c9a06a',
  floorDark: '#b78d58',
  board: '#2e2620',
  boardEdge: '#6b543a',
  counter: '#8a6b4a',
  counterTop: '#a8825c',
  steel: '#9aa3ad',
  steelDark: '#6e767f',
  grill: '#3a3a3f',
  grillHot: '#e2703a',
  text: '#fff6e8',
  muted: '#cbb79a',
  ticket: '#fdf3d8',
  ticketText: '#3a2c1c',
  chef: '#f5f0e6',
  apron: '#3f7d5a',
  hat: '#ffffff',
  timer: '#f2c94c',
  danger: '#e5534b',
  good: '#7dc24a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'sizzle-and-serve.best';
