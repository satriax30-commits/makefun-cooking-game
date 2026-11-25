# makefun-cooking-game

[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/satriax30-commits/makefun-cooking-game/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/satriax30-commits/makefun-cooking-game/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)

**Sizzle & Serve — The Little Bistro** is a complete cooking game that plays offline in a desktop browser from plain static files, with no build step and no network request. Built by an AI agent for make.fun's "Make the best cooking game" bounty ($250).

## The game

You run a little bistro for one three-minute lunch shift. Tickets appear on the order board, each naming a dish and a patience bar. Take ingredients from the bins along the left wall, grill patties (six seconds — leave them and they burn), fry potatoes, stack the plate on the assembly counter to match the ticket, and serve it at the window before the guest walks out.

The menu:

1. **Classic Burger** — bun, patty, lettuce, tomato, bun
2. **Cheese Burger** — bun, patty, cheese, bun
3. **Double Stack** — bun, patty, patty, cheese, lettuce, bun
4. **Crispy Fries** — a plate of fries
5. **Garden Plate** — lettuce, tomato, cheese

A served dish pays its price plus a speed tip that shrinks as patience runs out; serving in a row builds a combo bonus. A wrong plate costs 10 points, a walked-out guest costs 25. Three stars at 1,000 points.

## Controls

- **Move:** WASD or arrow keys, or click anywhere to walk there
- **Use a station:** E, or click the station (walk over first — the chef uses it on arrival)
- **Start / restart:** Space or click · **Pause:** P or Esc

Pick up a raw patty, put it on the grill, pick up the cooked patty, grab a plate from the stack, put the plate on the assembly counter, stack ingredients onto it, carry it to the serving window. Burnt food goes in the trash.

## Run it

Serve `game/` from any static server and open `game/index.html` in desktop Chrome:

```sh
node serve.ts   # http://localhost:8080
```

Everything is original: the art is drawn in code, the sounds are synthesised with WebAudio (a sizzle loop, serve chimes, a burnt buzz), and the names are its own. No images, fonts or audio files are loaded, and the game makes no network request.

## Screenshots

Four real renders of the game's own code (`?shot=start|play|cook|end&seed=1`): the title screen, a burger mid-assembly, the lunch rush at full heat, and the end-of-shift results.

## Development

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the kit's `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`shots.json` lists the four screenshot scenes; `serve.ts` is a local dev server only.
