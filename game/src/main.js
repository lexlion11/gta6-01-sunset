// Sunset City: the game itself. A 2D top-down open-world crime game drawn with
// canvas primitives, with no library, no build step and no network request.

import { VIEW, COLORS, PHYSICS, WANTED, TRAFFIC, HEIST, GULLS } from './config.js';
import { createInput, KEYS } from './input.js';
import { buildWorld, roadX, roadY, tileAt, TILES } from './world.js';
import {
  createCamera, updateCamera, worldToScreen, screenToWorld,
  drawSky, drawGround, drawBoardwalk, drawBuildings, drawFoliage, drawProps,
  drawCar, drawPerson, drawBullet, drawMarker, drawPhone, drawLamps,
  drawStash, drawHorn, drawNightTint, drawGulls,
} from './render.js';
import {
  drawObjective, drawStatus, drawMinimap, drawTitle, drawBanner, drawToast,
  drawFloatText, drawTitleScene, drawSpeedometer, drawStreak, drawPause,
} from './hud.js';
import { makeCar, stepCar, carType, overlaps, speedReadout, applyDamage } from './vehicles.js';
import {
  spawnPedestrians, stepPed, makeTrafficCar, stepTraffic, makeCop, stepCop,
  bulletHitsPerson, bulletHitsCar, panicTraffic, confuseCop, spawnGulls, stepGulls,
} from './entities.js';
import {
  createJobBoard, markerOf, checkJob, objectiveText, JOB_KINDS, completionBonus,
} from './missions.js';
import { isShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const world = buildWorld(20261124);
const input = createInput(canvas);
const cam = createCamera();
const jobBoard = createJobBoard(world);

const state = {
  mode: 'title',       // title | play | over
  time: 0,
  health: WANTED.health,
  wanted: 0,
  heat: 0,             // how long the current wanted level has held
  wantedAt: 0,
  money: 250,
  flash: 0,
  banner: null,
  toast: null,
  floats: [],
  inCar: null,
  job: null,
  jobActive: false,
  phoneUsed: false,
  message: '',
  streak: 0,           // jobs finished in a row without being caught
  lastBonus: 0,
  horn: null,          // the ringing of the horn, if it is still going
  nitro: 1,            // the player's own boost, refilled slowly
  boosting: false,
  lookBack: false,
  chase: 0,            // how long the police have been on the tail
  paused: false,       // P holds the world still; the draw still runs under it
};

const player = {
  x: roadX(4) + 120,
  y: roadY(4) + 120,
  vx: 0, vy: 0,  angle: -Math.PI / 2,
  walkPhase: 0,
  health: WANTED.health,
  radius: 9,
  colors: { shirt: COLORS.player, skin: COLORS.playerSkin, hair: '#2c2118' },
  fireCooldown: 0,
};

const peds = spawnPedestrians(world, TRAFFIC.pedestrians);
// The gulls that circle over the water at the south edge of the map.
const gulls = spawnGulls(world, GULLS.count);
const traffic = [];
const cops = [];
const bullets = [];
const parkedCars = [];

const TRAFFIC_TYPES = ['compact', 'coupe', 'taxi', 'muscle', 'van'];

// A handful of parked cars near the pavements to steal.
function seedParkedCars() {
  for (let i = 0; i < TRAFFIC.parked; i++) {
    const c = 1 + Math.floor(Math.random() * 9);
    const r = 1 + Math.floor(Math.random() * 9);
    const cell = 420 + 116;
    const along = Math.random() < 0.5;
    const id = TRAFFIC_TYPES[i % TRAFFIC_TYPES.length];
    const x = along ? c * cell + 116 + Math.random() * 380 : c * cell + 30 + Math.random() * 40;
    const y = along ? r * cell + 30 + Math.random() * 40 : r * cell + 116 + Math.random() * 380;
    const car = makeCar(id, x, y, along ? 0 : Math.PI / 2);
    parkedCars.push(car);
  }
}
seedParkedCars();

function seedTraffic() {
  for (let i = 0; i < TRAFFIC.density; i++) {
    const c = Math.floor(Math.random() * 11);
    const r = Math.floor(Math.random() * 11);
    const cell = 420 + 116;
    const vertical = Math.random() < 0.5;
    const x = vertical ? c * cell + 116 / 2 : Math.random() * world.width;
    const y = vertical ? Math.random() * world.sandTop : r * cell + 116 / 2;
    const angle = vertical ? Math.PI / 2 : 0;
    traffic.push(makeTrafficCar(x, y, angle, TRAFFIC_TYPES[i % TRAFFIC_TYPES.length]));
  }
}
seedTraffic();

/** The banner helper. */
function banner(text, color, life = 3) {
  state.banner = { text, color, at: state.time, life };
}

/** The toast helper. */
function toast(text) {
  state.toast = { text, at: state.time };
}

/** A floating text in the world. */
function floatText(x, y, text, color) {
  state.floats.push({ x, y, text, color, at: state.time, rise: 0 });
}

// ---------------------------------------------------------------- the player's car

/** Get into the nearest car within reach. */
function tryEnterCar() {
  const list = [...parkedCars, ...traffic, ...cops];
  let best = null;
  let bestD = 46;
  for (const car of list) {
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return false;
  player.x = best.x;
  player.y = best.y;
  state.inCar = best;
  best.occupant = 'player';
  banner(`Entered the ${best.type.name}`, '#8fe08a', 2);
  return true;
}

/** Get out of the car. */
function exitCar() {
  const car = state.inCar;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 26;
  player.y = car.y + Math.sin(side) * 26;
  car.occupant = null;
  state.inCar = null;
  banner('On foot', '#f6f2e6', 1.5);
}

/** Spawn a police car near the player and raise the wanted level. */
function raiseWanted(by = 1) {
  const before = state.wanted;
  state.wanted = Math.min(WANTED.max, state.wanted + by);
  // A new crime puts the heat back up to its full time.
  state.heat = 0;
  state.wantedAt = state.time;
  if (state.wanted === before) return;
  const want = state.wanted * WANTED.copsPerStar;
  while (cops.length < want) {
    const a = Math.random() * Math.PI * 2;
    const d = 320 + Math.random() * 140;
    const cop = makeCop(player.x + Math.cos(a) * d, player.y + Math.sin(a) * d);
    cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x);
    cops.push(cop);
  }
  banner(`WANTED LEVEL ${state.wanted}`, '#ff6b6b', 2.5);
}

/** Drop the wanted level back to zero. */
function clearWanted() {
  state.wanted = 0;
  state.chase = 0;
  banner('You lost the police', '#8fe08a', 2.5);
}

// ---------------------------------------------------------------- the horn

/**
 * The horn: it scatters the pedestrians, panics the traffic and puts a police car
 * off the road for a moment. It is the cheapest way out of a tight squeeze.
 */
function honk() {
  if (state.horn && state.time - state.horn.at < PHYSICS.hornCooldown) return;
  const car = state.inCar;
  const x = car ? car.x : player.x;
  const y = car ? car.y : player.y;
  state.horn = { at: state.time, x, y, rings: [{ x, y, radius: 10, alpha: 1 }] };
  banner('HONK!', '#ffd23f', 1);

  // the pedestrians scatter
  for (const p of peds) {
    if (Math.hypot(p.x - x, p.y - y) > PHYSICS.hornRadius) continue;
    p.state = 'flee';
    p.fleeTimer = 4;
  }
  // the traffic brakes
  for (const t of traffic) {
    if (Math.hypot(t.x - x, t.y - y) > PHYSICS.hornRadius) continue;
    panicTraffic(t);
  }
  // a police car that is close enough loses the player for a moment
  for (const cop of cops) {
    if (Math.hypot(cop.x - x, cop.y - y) > PHYSICS.hornRadius) continue;
    confuseCop(cop);
  }
}

/** The horn rings spread out and fade. */
function updateHorn(dt) {
  const horn = state.horn;
  if (!horn) return;
  const age = state.time - horn.at;
  if (age > PHYSICS.hornLife) {
    state.horn = null;
    return;
  }
  horn.rings.length = 0;
  const count = 3;
  for (let i = 0; i < count; i++) {
    const t = (age / PHYSICS.hornLife) * count - i;
    if (t < 0 || t > 1) continue;
    horn.rings.push({
      x: horn.x,
      y: horn.y,
      radius: 12 + t * PHYSICS.hornRadius,
      alpha: (1 - t) * (1 - age / PHYSICS.hornLife),
    });
  }
}

// ---------------------------------------------------------------- shooting

function fire() {
  if (player.fireCooldown > 0) return;
  player.fireCooldown = 0.16;
  const m = input.mouse;
  const target = screenToWorld(cam, m.x, m.y);
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const len = Math.hypot(dx, dy) || 1;
  bullets.push({
    x: player.x + (dx / len) * 12,
    y: player.y + (dy / len) * 12,
    vx: (dx / len) * PHYSICS.bulletSpeed,
    vy: (dy / len) * PHYSICS.bulletSpeed,
    life: PHYSICS.bulletLife,
    owner: 'player',
  });
  player.angle = Math.atan2(dy, dx);
}

// ---------------------------------------------------------------- jobs

/** Start the job the phone offers. */
function startJob() {
  const job = jobBoard.current();
  state.job = job;
  state.jobActive = true;
  state.phoneUsed = true;
  banner(`${job.title} - ${job.detail}`, COLORS.marker, 4);
  if (job.kind === JOB_KINDS.DELIVER) {
    // put the car to deliver right next to the player
    const car = makeCar(job.carId, player.x + 30, player.y + 20, 0);
    parkedCars.push(car);
    banner(`Get in the ${car.type.name} - it is beside you`, COLORS.marker, 4);
  }
  if (job.kind === JOB_KINDS.ESCAPE) {
    raiseWanted(2);
  }
  if (job.kind === JOB_KINDS.HEIST) {
    // The getaway car waits at the safe house, and the alarm goes off as soon as
    // the case is lifted.
    const car = makeCar(job.carId, world.safehouse.x + 40, world.safehouse.y + 30, 0);
    parkedCars.push(car);
    raiseWanted(HEIST.alarmWanted);
    banner('The Nightjar is waiting at the safe house', '#8f7bff', 4);
  }
}

/** Finish the current job and pay out. */
function completeJob() {
  const job = state.job;
  if (!job) return;
  const bonus = completionBonus(job, state.streak, state.health, state.wanted);
  state.money += job.reward + bonus;
  state.streak += 1;
  state.lastBonus = bonus;
  floatText(player.x, player.y - 20, `+$${job.reward + bonus}`, COLORS.money);
  toast(`Job done! +$${job.reward}${bonus ? ` (+$${bonus} bonus)` : ''}`);
  banner(`JOB COMPLETE - +$${job.reward + bonus}`, '#8fe08a', 3.5);
  jobBoard.advance();
  state.job = null;
  state.jobActive = false;
  if (state.wanted > 0) clearWanted();
}

// ---------------------------------------------------------------- the update

function update(dt) {
  // Parsed but frozen: the frame still draws (so the pause overlay has the world
  // behind it) but the clock and everything on it stand still.
  if (state.paused) return;
  state.time += dt;
  state.flash = Math.max(0, state.flash - dt * 2);
  updateHorn(dt);

  if (state.mode === 'title') {
    if (input.wasPressed('Enter') || input.mouse.clicked) {
      state.mode = 'play';
      banner('Sunset City - find the job phone on the boardwalk', COLORS.marker, 4);
    }
    updateCamera(cam, player.x, player.y, dt, world);
    return;
  }

  // movement keys
  const up = KEYS.up.some((k) => input.isDown(k));
  const down = KEYS.down.some((k) => input.isDown(k));
  const left = KEYS.left.some((k) => input.isDown(k));
  const right = KEYS.right.some((k) => input.isDown(k));
  const running = KEYS.run.some((k) => input.isDown(k));
  const handbrake = KEYS.handbrake.some((k) => input.isDown(k));
  state.lookBack = KEYS.lookBack.some((k) => input.isDown(k));
  // Looking over the shoulder flips the world left to right, so the flip has to
  // be settled before anything reads the mouse in world space.
  cam.flip = state.lookBack;

  const m = input.mouse;
  const mouseWorld = screenToWorld(cam, m.x, m.y);
  input.mouse.worldX = mouseWorld.x;
  input.mouse.worldY = mouseWorld.y;

  if (state.inCar) {
    const car = state.inCar;
    const throttle = (up ? 1 : 0) + (down ? -1 : 0);
    const steer = (right ? 1 : 0) + (left ? 1 : 0);
    // The nitro: a burst of thrust that burns the tank down and refills itself
    // slowly while the car is not boosting. It needs the car to be moving or
    // accelerating, so it cannot be used to creep forward from a standstill.
    const wantsBoost = KEYS.fire.some((k) => input.isDown(k))
      && state.nitro > 0.02
      && (throttle > 0 || car.speed > 60);
    state.boosting = wantsBoost;
    if (wantsBoost) {
      state.nitro = Math.max(0, state.nitro - dt * PHYSICS.nitroDrain);
    } else {
      state.nitro = Math.min(1, state.nitro + dt * PHYSICS.nitroRefill);
    }
    stepCar(car, dt, throttle, steer, { handbrake, boost: wantsBoost });
    // stay on the map
    car.x = Math.max(20, Math.min(world.width - 20, car.x));
    car.y = Math.max(20, Math.min(world.sandTop - 10, car.y));
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    if (input.wasPressed('KeyF') || input.wasPressed('KeyE')) exitCar();
    // the horn startles the traffic
    if (input.wasPressed('KeyH')) honk();
    // running people over hurts them, and the cops notice
    for (const p of peds) {
      if (overlaps(car.x, car.y, car.radius, p.x, p.y, p.radius)) {
        if (Math.abs(car.speed) > 140) {
          p.state = 'flee';
          p.x += (p.x - car.x) * 0.5;
          p.y += (p.y - car.y) * 0.5;
          if (state.wanted < WANTED.max) raiseWanted(1);
        }
      }
    }
    // ramming a cop raises the wanted level
    for (const cop of cops) {
      if (overlaps(car.x, car.y, car.radius, cop.x, cop.y, cop.radius)) {
        if (Math.abs(car.speed) > 120) {
          raiseWanted(1);
          if (applyDamage(cop, 40)) {
            cops.splice(cops.indexOf(cop), 1);
            floatText(cop.x, cop.y, '+$300', COLORS.money);
            state.money += 300;
          }
        }
      }
    }
  } else {
    // on foot
    let dx = (right ? 1 : 0) - (left ? 1 : 0);
    let dy = (down ? 1 : 0) - (up ? 1 : 0);
    const len = Math.hypot(dx, dy);
    const speed = running ? PHYSICS.runSpeed : PHYSICS.walkSpeed;
    if (len > 0) {
      dx /= len;
      dy /= len;
      player.x += dx * speed * dt;
      player.y += dy * speed * dt;
      player.walkPhase += dt * 11;
      // do not walk into buildings
      const b = world.inBuilding(player.x, player.y);
      if (b) {
        player.x -= dx * speed * dt;
        player.y -= dy * speed * dt;
      }
    }
    // mouse aim
    player.angle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);
    if (m.down) fire();
    // A click that lands between two frames still counts as a shot: the button
    // was down for a moment even if the loop never saw it held.
    if (m.clicked) fire();
    if (input.wasPressed('KeyF')) tryEnterCar();
    // The horn works on foot too: it just only scatters the pedestrians.
    if (input.wasPressed('KeyH')) honk();
  }

  // The player walks the whole land: the streets, the boardwalk and the sand down
  // to the water's edge, but never into the sea itself.
  player.x = Math.max(20, Math.min(world.width - 20, player.x));
  player.y = Math.max(20, Math.min(world.oceanTop - 10, player.y));

  // shooting cooldown
  if (player.fireCooldown > 0) player.fireCooldown -= dt;

  // bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let hit = false;
    if (b.life <= 0) hit = true;
    if (!hit && world.inBuilding(b.x, b.y)) hit = true;
    if (!hit) {
      for (const p of peds) {
        if (bulletHitsPerson(b, p)) {
          p.state = 'flee';
          p.health = (p.health ?? 100) - 40;
          if (p.health <= 0) {
            peds.splice(peds.indexOf(p), 1);
            floatText(p.x, p.y, '+$50', COLORS.money);
            state.money += 50;
          }
          hit = true;
          break;
        }
      }
    }
    if (!hit) {
      for (const car of [...traffic, ...parkedCars, ...cops]) {
        if (bulletHitsCar(b, car)) {
          if (applyDamage(car, 25) && car !== state.inCar) {
            const list = traffic.includes(car) ? traffic : (parkedCars.includes(car) ? parkedCars : cops);
            list.splice(list.indexOf(car), 1);
            floatText(car.x, car.y, '+$200', COLORS.money);
            state.money += 200;
          }
          hit = true;
          break;
        }
      }
    }
    if (hit) bullets.splice(i, 1);
  }

  // pedestrians
  const danger = state.wanted > 0 || bullets.length > 0;
  for (const p of peds) {
    stepPed(p, dt, p.target ?? { x: p.x + Math.cos(p.walkPhase) * 200, y: p.y + Math.sin(p.walkPhase) * 200 }, player, danger, world.sandTop - 16);
    // walk around the pavements: if a pedestrian wanders onto a road, give it a new goal
    if (p.target === undefined || Math.hypot(p.target.x - p.x, p.target.y - p.y) < 20) {
      const c = Math.floor(Math.random() * 11);
      const r = Math.floor(Math.random() * 11);
      const cell = 420 + 116;
      p.target = {
        x: Math.max(140, Math.min(world.width - 140, c * cell + 134 + 10 + Math.random() * 360)),
        y: Math.max(140, Math.min(world.sandTop - 140, r * cell + 134 + 10 + Math.random() * 360)),
      };
    }
  }

  // traffic
  for (let i = traffic.length - 1; i >= 0; i--) {
    const car = traffic[i];
    stepTraffic(car, dt, world);
    // a traffic car that hits the player hurts them
    if (!state.inCar && overlaps(car.x, car.y, car.radius, player.x, player.y, player.radius)) {
      if (Math.abs(car.speed) > 120) {
        state.health -= 12;
        state.flash = 0.5;
      }
    }
    if (car.x < 10 || car.x > world.width - 10 || car.y < 10 || car.y > world.sandTop) {
      traffic.splice(i, 1);
    }
  }

  // the gulls work the shoreline whatever the city is doing
  stepGulls(gulls, dt, world);

  // police
  for (let i = cops.length - 1; i >= 0; i--) {
    const cop = cops[i];
    stepCop(cop, dt, { x: player.x, y: player.y });
    // A cop that touches the player hurts them, but only every half second: with
    // six cars around, a per-frame hit would end the game at once.
    if (cop.hitAt === undefined) cop.hitAt = -10;
    const touching = (!state.inCar && overlaps(cop.x, cop.y, cop.radius, player.x, player.y, player.radius))
      || (state.inCar && overlaps(cop.x, cop.y, cop.radius, state.inCar.x, state.inCar.y, state.inCar.radius));
    if (touching && state.time - cop.hitAt > 0.5) {
      cop.hitAt = state.time;
      state.health -= state.inCar ? 4 : 7;
      state.flash = 0.35;
    }
    if (Math.hypot(cop.x - player.x, cop.y - player.y) > 1500) cops.splice(i, 1);
  }
  // The heat cools: with nothing to hide behind, the police lose the player a
  // star at a time, and they let go once it reaches nothing. While an escape
  // job holds, the heat stays where the job put it.
  const escapeJob = state.job && state.job.kind === JOB_KINDS.ESCAPE;
  if (state.wanted > 0 && !escapeJob) {
    if (state.wantedAt === undefined) state.wantedAt = state.time;
    state.heat = (state.heat ?? 0) + dt;
    if (state.heat >= PHYSICS.wantedDecay) {
      state.heat = 0;
      if (state.wanted > 1) {
        state.wanted -= 1;
        state.wantedAt = state.time;
        banner(`WANTED LEVEL ${state.wanted}`, '#ffb347', 2);
      } else {
        clearWanted();
      }
    }
  }

  // keep the right number of cops for the wanted level
  const wantCops = state.wanted * WANTED.copsPerStar;
  while (cops.length < wantCops) {
    const a = Math.random() * Math.PI * 2;
    const d = 300 + Math.random() * 120;
    const cop = makeCop(player.x + Math.cos(a) * d, player.y + Math.sin(a) * d);
    cops.push(cop);
  }

  // The phone
  if (!state.jobActive && Math.hypot(player.x - world.phone.x, player.y - world.phone.y) < 46) {
    if (input.wasPressed('KeyE') || input.wasPressed('KeyF')) startJob();
    else if (!state.phoneUsed) banner('Press E to take a job from the phone', '#6fd3ff', 1.5);
  }

  // the job
  if (state.job) {
    const finished = checkJob(state.job, {
      playerX: player.x,
      playerY: player.y,
      wanted: state.wanted,
      inCar: !!state.inCar,
      inTargetCar: state.inCar && state.inCar.type.id === state.job.carId,
    });
    if (finished) completeJob();
    else if (state.job.time !== undefined) {
      state.job.time -= dt;
      if (state.job.time <= 0) {
        banner('Job failed - try the phone again', '#ff6b6b', 3);
        state.job = null;
        state.jobActive = false;
      }
    }
  }

  // floating texts
  for (let i = state.floats.length - 1; i >= 0; i--) {
    const f = state.floats[i];
    f.rise += dt * 26;
    if (state.time - f.at > 1.4) state.floats.splice(i, 1);
  }

  // death
  if (state.health <= 0) {
    state.health = 0;
    state.mode = 'over';
    banner('WASTED', '#ff6b6b', 6);
  }

  // Looking over the shoulder flips the world left to right.
  cam.flip = state.lookBack;
  updateCamera(cam, player.x, player.y, dt, world);
}

// ---------------------------------------------------------------- the draw

function draw() {
  ctx.save();
  if (cam.shake > 0) {
    ctx.translate((Math.random() - 0.5) * cam.shake * 12, (Math.random() - 0.5) * cam.shake * 12);
  }
  if (state.mode === 'title') {
    // the title card is its own painted scene, not the world
    drawTitleScene(ctx, world, state.time);
    ctx.restore();
    drawTitle(ctx, state.time);
    return;
  }
  drawSky(ctx, cam, world, state.time);
  drawGround(ctx, cam, world);
  drawBoardwalk(ctx, cam, world);
  drawBuildings(ctx, cam, world, state.time);
  drawProps(ctx, cam, world);
  drawFoliage(ctx, cam, world);
  // the gulls over the water, drawn above the trees and the palms
  drawGulls(ctx, cam, gulls, state.time);
  drawLamps(ctx, cam, world);

  // the mission marker
  const job = state.job;
  if (job) {
    const m = markerOf(job);
    if (m) drawMarker(ctx, cam, m, state.time);
  }

  // the cash case of the heist
  drawStash(ctx, cam, world, state.time);

  // parked cars
  for (const car of parkedCars) drawCar(ctx, cam, car, { time: state.time });
  // traffic
  for (const car of traffic) drawCar(ctx, cam, car, { time: state.time });
  // cops
  for (const cop of cops) drawCar(ctx, cam, cop, { time: state.time });

  // the player's car is drawn on top of the player
  if (state.inCar) {
    drawCar(ctx, cam, state.inCar, { time: state.time, selected: true, boost: state.boosting });
  }

  // pedestrians
  for (const p of peds) {
    drawPerson(ctx, cam, p, p.state === 'flee'
      ? { shirt: '#e05a5a', skin: p.skin, hair: p.hair }
      : { shirt: p.shirt, skin: p.skin, hair: p.hair });
  }

  // the player
  if (!state.inCar) drawPerson(ctx, cam, player, player.colors);

  // bullets
  for (const b of bullets) drawBullet(ctx, cam, b);

  // the phone
  drawPhone(ctx, cam, world, state.time);

  // floating texts
  for (const f of state.floats) drawFloatText(ctx, cam, f);

  // the rings of the horn
  if (state.horn) drawHorn(ctx, cam, state.horn);

  ctx.restore();

  // the dusk tint and the vignette over the whole picture: they lie on top of
  // the world but under the HUD, so the readouts stay crisp.
  drawNightTint(ctx);

  // the hud
  if (state.mode !== 'title') {
    const obj = state.job ? objectiveText(state.job) : objectiveText(null);
    drawObjective(ctx, obj.title, obj.sub);
    drawStreak(ctx, state.streak, state.lastBonus);
    drawStatus(ctx, state.health, state.wanted, state.money, state.flash);
    const marks = [];
    if (state.job) {
      const m = markerOf(state.job);
      if (m) marks.push(m);
    }
    if (!state.jobActive) marks.push({ x: world.phone.x, y: world.phone.y, color: '#6fd3ff' });
    // The speedometer takes the bottom-right corner while the player is
    // driving, so the minimap steps aside for it.
    drawMinimap(ctx, cam, world, marks, 190, state.inCar ? 176 : 0);
    // the speedometer, only while the player is behind the wheel
    if (state.inCar) {
      const readout = speedReadout(state.inCar);
      drawSpeedometer(ctx, readout.speed, readout.label, state.nitro);
    }
    drawBanner(ctx, state.banner, state.time);
    drawToast(ctx, state.toast, state.time);
  }
  if (state.mode === 'title') {
    drawTitleScene(ctx, world, state.time);
    drawTitle(ctx, state.time);
  }
  if (state.mode === 'over') {
    ctx.fillStyle = 'rgba(60,10,10,0.45)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.font = 'bold 76px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#ff6b6b';
    ctx.textAlign = 'center';
    ctx.fillText('WASTED', VIEW.width / 2, VIEW.height / 2);
    ctx.font = '20px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#f6f2e6';
    ctx.fillText('Press ENTER to try again', VIEW.width / 2, VIEW.height / 2 + 40);
    ctx.textAlign = 'left';
  }
  // The pause shade goes on last, over the world and the HUD both.
  if (state.paused && state.mode === 'play') drawPause(ctx);
}

// ---------------------------------------------------------------- the loop

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // P freezes the world where it stands; P again picks it back up. Only in play:
  // the title card and the WASTED screen read their own keys.
  if (state.mode === 'play' && input.wasPressed('KeyP')) state.paused = !state.paused;
  if (state.mode === 'over' && input.wasPressed('Enter')) {
    state.mode = 'play';
    state.health = WANTED.health;
    state.wanted = 0;
    state.money = 250;
    state.job = null;
    state.jobActive = false;
    state.streak = 0;
    state.nitro = 1;
    state.horn = null;
    state.paused = false;
    cops.length = 0;
    player.x = roadX(4) + 120;
    player.y = roadY(4) + 120;
  }
  update(dt);
  draw();
  input.endFrame();
  requestAnimationFrame(frame);
}

// The screenshot mode: ?shot=start|play|end|mission puts the game in a fixed state
// and draws one frame instead of running the world.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot') ?? (typeof window.SUNSET_SHOT === 'string' ? window.SUNSET_SHOT : null);
if (shot && isShot(shot)) {
  setupShot(shot);
  draw();
} else {
  requestAnimationFrame(frame);
}

/** Puts the game into a fixed pose for a screenshot. */
function setupShot(kind) {
  state.mode = 'play';
  // A pose is a still life: the world must never be frozen mid-pause in one.
  state.paused = false;
  if (kind === 'start') {
    state.mode = 'title';
    // a vista from high over the southern beach, looking down the avenues with the
    // ocean and the sunset horizon in the lower frame
    player.x = world.width * 0.5;
    player.y = world.height - 420;
    cam.x = world.width * 0.5;
    cam.y = world.height - 300;
    cam.zoom = 0.55;
    // traffic on the avenues for scale
    for (let i = 0; i < 5; i++) {
      traffic.push(makeTrafficCar(roadX(2 + i) + 58, roadY(7) + 40 + i * 90, Math.PI / 2, TRAFFIC_TYPES[i % TRAFFIC_TYPES.length]));
    }
  } else if (kind === 'play') {
    // on the avenue with the beach and the sea a little way south
    player.x = roadX(5) + 120;
    player.y = roadY(8) + 120;
    cam.x = player.x;
    cam.y = player.y;
    cam.zoom = 0.8;
    // a car right next to the player and some traffic around
    const car = makeCar('muscle', player.x + 44, player.y + 6, 0);
    parkedCars.push(car);
    state.inCar = null;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 90 + Math.random() * 320;
      traffic.push(makeTrafficCar(player.x + Math.cos(a) * d, player.y + Math.sin(a) * d, Math.random() * 6, TRAFFIC_TYPES[i % TRAFFIC_TYPES.length]));
    }
  } else if (kind === 'mission') {
    // standing at the phone on the boardwalk
    player.x = world.phone.x - 55;
    player.y = world.phone.y + 30;
    const job = createJobBoard(world).current();
    // The shot shows the phone and the waypoint at once: the marker of this job
    // sits a short way down the boardwalk rather than across the whole city.
    job.marker = { x: world.phone.x + 210, y: world.phone.y + 40 };
    job.title = 'Deliver the car';
    job.detail = 'Bring the Sunset Compact to the drop-off marker';
    state.job = job;
    state.jobActive = true;
    state.money = 1450;
    cam.zoom = 0.78;
    cam.x = player.x + 150;
    cam.y = player.y - 380;
  } else if (kind === 'end') {
    // a police chase down the avenue: the player is in a car with the cops behind
    const car = makeCar('muscle', roadX(7) + 58, roadY(6) + 300, -Math.PI / 2);
    state.inCar = car;
    player.x = car.x;
    player.y = car.y;
    state.wanted = 3;
    state.money = 4820;
    state.health = 42;
    state.nitro = 0.72;
    car.speed = 240;
    for (let i = 0; i < 5; i++) {
      const cop = makeCop(car.x - 20 - i * 78, car.y + 34 - i * 14, -Math.PI / 2);
      cop.angle = -Math.PI / 2;
      cops.push(cop);
    }
    for (let i = 0; i < 3; i++) {
      traffic.push(makeTrafficCar(roadX(7) + 58, roadY(3) + 60 + i * 120, Math.PI / 2, TRAFFIC_TYPES[i % TRAFFIC_TYPES.length]));
    }
    cam.zoom = 1.15;
    cam.x = car.x + 20;
    cam.y = car.y - 60;
  }
  if (kind !== 'start') {
    // the shot's camera is the one that counts: the world camera would drift back
    cam.x = cam.x;
  }
}

export { state, player, world, parkedCars, traffic, cops, peds, bullets, carType, tileAt, TILES };
