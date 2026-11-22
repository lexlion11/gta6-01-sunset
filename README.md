# Sunset City

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/lexlion11/gta6-01-sunset/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/lexlion11/gta6-01-sunset/reward.svg)](https://make.fun/bounty/gta6-01)

A 2D top-down open-world crime game that runs entirely in the browser. You walk, drive,
rob and race through a procedurally generated coastal city at dusk, with the police
never far behind. It is plain HTML5 canvas and ES modules — no library, no build step,
no network request of any kind. Every last pixel is drawn with canvas primitives, so
there is not a single image file to ship.

## What is in the city

- **A procedural city.** A ten-by-ten road grid with pavements, lane markings, buildings
  of several kinds, parks with trees, street props (benches, hydrants, bins, planters, a
  food stall), a timber boardwalk, a beach, gulls working the shoreline, and the ocean
  along the south edge. The generator is seeded, so the same city comes back every time.
- **On foot.** Eight-direction walking, running, mouse aim, a weapon that fires, and
  pedestrians who scatter at the sound of a shot or the blast of a horn.
- **Behind the wheel.** Seven car types with distinct speed and handling, enter and exit
  with `F`, NPC traffic that drives the grid and turns at the corners, parked cars to
  steal, a handbrake that slides the car into a corner and a nitro tank that burns down
  while you hold `Space`.
- **The horn.** `H` sounds the horn: pedestrians scatter, traffic brakes, and a police
  car close enough loses you for a moment and spins its wheels.
- **Heat and the police.** A wanted level that rises when you run people over or ram a
  cop; the cruisers chase, ram and give up one star at a time. The chase is the fastest
  way to lose them.
- **Jobs.** A phone on the boardwalk hands out work: deliver a car to a marker, run every
  checkpoint against the clock, make a drop on foot, pick up a fare and taxi it across
  town in any car, shake off the police, or rob the stash behind the pier and run the
  case to the safe house in the Nightjar.
- **The HUD.** The objective card, a minimap, health, wanted stars, your money, a clean
  job streak, and a speedometer with a needle and a nitro bar that comes up when you are
  behind the wheel. `P` pauses the whole world where it stands.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` / arrow keys | walk, drive and run |
| mouse | aim |
| left click | fire |
| `Space` (in a car) | nitro |
| `C` (in a car) | handbrake |
| `B` (in a car) | look over your shoulder |
| `F` | enter or leave a car |
| `H` | the horn |
| `E` | take a job at the phone on the boardwalk |
| `P` | pause and resume |
| `Enter` | start the game, or try again after a WASTED |

## How to run it

Build the entry (copies `game/` and `screenshots/` into `out/` and writes
`out/dossier.json`, and prints a short receipt of what it handed in):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Play it locally (serves `game/` on port 8080):

```sh
node serve.ts
```

Then open <http://localhost:8080>. The four screenshots come from the same build:
`shots-src/capture.mjs` drives headless Chrome over the DevTools protocol and writes
`screenshots/1-start.jpg`, `2-play.jpg`, `3-end.jpg` and `4-mission.jpg`, then prints
the byte total of the set.

## Layout

```
game/index.html      the page
game/src/config.js   the tunables, the palette, the gulls and the nitro tank
game/src/world.js    the procedural city and its landmarks
game/src/render.js   the draw order: ground, roads, buildings, props, foliage, gulls, cars
game/src/hud.js      the objective card, the status bar, the speedometer, the minimap, pause
game/src/entities.js traffic, pedestrians, police and the gulls of the shoreline
game/src/vehicles.js the car types, their handling, and the damage that wrecks them
game/src/missions.js the job board, including the taxi run
game/src/random.js   the seeded random source
game/src/main.js     the loop, the state machine and the pause
game/src/shots.js    the fixed screenshot poses
```

## License

MIT - see `LICENSE`. Sunset City is an original work; it borrows no artwork, names or
assets from any existing game.
