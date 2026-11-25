// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between four screens: title, play, paused and shift over.
//
// ?seed=N fixes the order pattern. ?shot=start|play|cook|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
//
// All sound is synthesised with WebAudio — short oscillator blips for pickups and dings, a
// low sawtooth buzz for mistakes, and looped filtered noise for the grill's sizzle — so the game
// ships no audio files and makes no network request.

import { BEST_KEY, CHEF, LAYOUT, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BURNT, EVENT_COOKED, EVENT_MISSED, EVENT_OVER, EVENT_PICKUP, EVENT_PLACE,
  EVENT_SERVED, EVENT_TRASH, EVENT_WRONG, createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_USE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

/** The sizzle: a noise loop whose gain follows whether anything is on the grill or in the fryer. */
function createAudio() {
  let ctx = null;
  let sizzleGain = null;
  function ensure() {
    if (ctx !== null) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
      const length = ctx.sampleRate;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 5200;
      filter.Q.value = 0.6;
      sizzleGain = ctx.createGain();
      sizzleGain.gain.value = 0;
      noise.connect(filter);
      filter.connect(sizzleGain);
      sizzleGain.connect(ctx.destination);
      noise.start();
      return true;
    } catch {
      return false;
    }
  }
  function blip(frequency, seconds, type, volume, when) {
    if (!ensure()) return;
    const start = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + seconds);
  }
  return {
    unlock() { ensure(); if (ctx !== null && ctx.state === 'suspended') ctx.resume(); },
    pickup() { blip(520, 0.09, 'sine', 0.12, 0); },
    place() { blip(330, 0.1, 'triangle', 0.14, 0); },
    cooked() { blip(880, 0.12, 'sine', 0.14, 0); blip(1174, 0.16, 'sine', 0.12, 0.1); },
    served() { blip(659, 0.12, 'sine', 0.15, 0); blip(880, 0.12, 'sine', 0.15, 0.09); blip(1318, 0.22, 'sine', 0.14, 0.18); },
    wrong() { blip(160, 0.25, 'sawtooth', 0.1, 0); },
    trash() { blip(220, 0.08, 'square', 0.07, 0); },
    setSizzle(on) {
      if (!ensure()) return;
      sizzleGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.2);
    },
  };
}

const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  // Clicks arrive in screen pixels; the renderer knows the scale and offset into logical space.
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    const view = renderer.view;
    const lx = (px - view.x) / view.scale;
    const ly = (py - view.y) / view.scale;
    if (lx < 0 || ly < 0 || lx > 1280 || ly > 720) return null;
    return { x: lx, y: ly, station: world.stationAtPoint(lx, ly) };
  }
  const input = createInput(canvas, toLogical);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  // E pressed between frames: handleActions takes the flags, step() spends this one.
  let useQueued = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each serve.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Serve the tickets before the guests lose patience.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.setSizzle(false);
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Shift over. Score ${world.state.score}. Served ${world.state.served}, missed ${world.state.missed}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_PLACE) audio.place();
    if (events & EVENT_COOKED) { audio.cooked(); announce('Something is ready on the grill.'); }
    if (events & EVENT_BURNT) { audio.wrong(); announce('Something burnt!'); }
    if (events & EVENT_SERVED) { audio.served(); announce(`Served! Score ${world.state.score}.`); }
    if (events & EVENT_WRONG) { audio.wrong(); announce('That does not match any ticket.'); }
    if (events & EVENT_MISSED) { audio.wrong(); announce('A guest walked out.'); }
    if (events & EVENT_TRASH) audio.trash();
    const cooking = world.state.grill.some((s) => s.state === 'cooking') || world.state.fryer.some((s) => s.state === 'cooking');
    audio.setSizzle(screen === SCREEN_PLAY && cooking);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_USE && screen === SCREEN_PLAY) useQueued = true;
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.setSizzle(false);
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) return;
    let useStation = null;
    if (useQueued) {
      useQueued = false;
      useStation = world.stationAtChef();
    }
    if (useStation === null) {
      // A click on a station fires once the chef walks within reach of it.
      useStation = input.takePendingStation((station) => {
        if (station.type === 'bin') return world.state.chef && nearStation(station);
        return nearStation(station);
      });
    }
    const move = input.move(world.state.chef.x, world.state.chef.y);
    const events = world.step(STEP, move, useStation);
    handleEvents(events);
    if (events & EVENT_OVER) endGame();
  }

  function nearStation(station) {
    const chef = world.state.chef;
    let cx;
    let cy;
    if (station.type === 'bin') { cx = station.bin.x + station.bin.w / 2; cy = station.bin.y + station.bin.h / 2; }
    else {
      const rect = { grill: LAYOUT.grill, fryer: LAYOUT.fryer, counter: LAYOUT.counter, plates: LAYOUT.plates, serve: LAYOUT.serve, trash: LAYOUT.trash }[station.type];
      cx = rect.x + rect.w / 2;
      cy = rect.y + rect.h / 2;
    }
    const dx = chef.x - cx;
    const dy = chef.y - cy;
    return dx * dx + dy * dy < CHEF.reach * CHEF.reach;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting orders expire unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.setSizzle(false);
      announce('Paused.');
    }
  });

  announce('Sizzle and Serve. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
