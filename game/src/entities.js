// The people, the traffic and the gulls of Sunset City: pedestrians that walk the
// pavements and run from trouble, cars that drive the road grid, the police that
// chase the player, and the seabirds that work the shoreline.

import { PHYSICS, COLORS, CITY, GULLS } from './config.js';
import { makeCar, stepCar, overlaps } from './vehicles.js';
import { roadX, roadY } from './world.js';

/** A pedestrian. */
export function makePed(x, y, skin) {
  return {
    x, y,
    vx: 0, vy: 0,
    skin,
    shirt: COLORS.ped[Math.floor(Math.random() * COLORS.ped.length)],
    hair: Math.random() < 0.5 ? '#3a2a1e' : '#191512',
    state: 'walk',
    walkPhase: Math.random() * 6,
    fleeTimer: 0,
    radius: 8,
  };
}

/** Spawn pedestrians along the pavements, never inside a building. */
export function spawnPedestrians(world, count) {
  const peds = [];
  const cell = CITY.block + CITY.road;
  let guard = 0;
  while (peds.length < count && guard < count * 30) {
    guard += 1;
    const c = Math.floor(Math.random() * 11);
    const r = Math.floor(Math.random() * 11);
    const x = c * cell + CITY.road + CITY.pavement + 10 + Math.random() * (CITY.block - CITY.pavement * 2 - 20);
    const y = r * cell + CITY.road + CITY.pavement + 10 + Math.random() * (CITY.block - CITY.pavement * 2 - 20);
    if (y > world.sandTop - 200) continue;
    if (world.inBuilding(x, y)) continue;
    peds.push(makePed(x, y));
  }
  return peds;
}

/**
 * Move a pedestrian for dt. `maxY`, when given, is the line the pedestrian may
 * not cross: the city passes the top of the sand so a fleeing pedestrian keeps
 * its feet dry instead of running into the sea.
 */
export function stepPed(ped, dt, target, player, danger, maxY) {
  ped.walkPhase += dt * (ped.state === 'flee' ? 14 : 7);
  let tx = target.x;
  let ty = target.y;
  let speed = PHYSICS.pedWalkSpeed;
  if (ped.state === 'flee') {
    speed = PHYSICS.pedFleeSpeed;
    const dx = ped.x - player.x;
    const dy = ped.y - player.y;
    const len = Math.hypot(dx, dy) || 1;
    tx = ped.x + (dx / len) * 120;
    ty = ped.y + (dy / len) * 120;
  }
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const len = Math.hypot(dx, dy);
  if (len > 4) {
    ped.vx += ((dx / len) * speed - ped.vx) * Math.min(1, dt * 6);
    ped.vy += ((dy / len) * speed - ped.vy) * Math.min(1, dt * 6);
  } else {
    ped.vx *= 0.8;
    ped.vy *= 0.8;
  }
  ped.x += ped.vx * dt;
  ped.y += ped.vy * dt;
  if (maxY !== undefined && ped.y > maxY) {
    // Walked off the beach into the surf: turn it around and send it back.
    ped.y = maxY;
    ped.vy = -Math.abs(ped.vy) - 20;
  }

  if (danger) {
    ped.state = 'flee';
    ped.fleeTimer = 3;
  } else if (ped.fleeTimer > 0) {
    ped.fleeTimer -= dt;
    if (ped.fleeTimer <= 0) ped.state = 'walk';
  }
}

/** A traffic car: it drives the road grid and turns at junctions. */
export function makeTrafficCar(x, y, angle, typeId) {
  const car = makeCar(typeId, x, y, angle);
  car.ai = {
    turnTimer: 1 + Math.random() * 2,
    lane: Math.random() < 0.5 ? -1 : 1,
    cruise: 0.7 + Math.random() * 0.35,
    // How long this car has been stalled by a horn, and where it wants to go.
    panic: 0,
    swerve: 0,
  };
  car.type = { ...car.type };
  car.speed = car.type.topSpeed * 0.35;
  return car;
}

/** Drive a traffic car for dt, keeping it on the roads. */
export function stepTraffic(car, dt, world) {
  const ai = car.ai;
  ai.turnTimer -= dt;
  if (ai.panic > 0) ai.panic -= dt;
  let steer = 0;
  const cell = 420 + 116;

  // if the car is near a junction, decide whether to turn
  const nearestCol = Math.round(car.x / cell);
  const nearestRow = Math.round(car.y / cell);
  const nearJunction =
    Math.abs(car.x - nearestCol * cell) < 46 && Math.abs(car.y - nearestRow * cell) < 46;

  if (nearJunction && ai.turnTimer <= 0) {
    ai.turnTimer = 2 + Math.random() * 3;
    if (Math.random() < 0.45) {
      // turn right or left
      const right = Math.random() < 0.5;
      car.angle += right ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  // steer back to the middle of the lane
  const dirX = Math.cos(car.angle);
  const dirY = Math.sin(car.angle);
  const laneOffset = 26 * ai.lane;
  const desiredX = car.x - dirY * laneOffset;
  const desiredY = car.y + dirX * laneOffset;
  const offX = desiredX - car.x;
  const offY = desiredY - car.y;
  const cross = dirX * offY - dirY * offX;
  steer = Math.max(-1, Math.min(1, cross / 30));

  // A car that has just been honked at brakes and pulls to the side.
  let throttle = ai.cruise;
  if (ai.panic > 0) throttle = -0.5;

  // stay inside the world
  if (car.x < 60 || car.x > world.width - 60 || car.y < 60 || car.y > world.sandTop - 20) {
    throttle = -0.3;
  }
  stepCar(car, dt, throttle, steer);
  void roadX;
  void roadY;
  return car;
}

/**
 * Startles a traffic car: it brakes and drifts towards the kerb for a moment.
 * Returns the car so the caller can chain the call.
 */
export function panicTraffic(car, seconds = PHYSICS.trafficPanic) {
  if (!car.ai) return car;
  car.ai.panic = Math.max(car.ai.panic, seconds);
  return car;
}

/** The police: they chase the player and try to ram them. */
export function makeCop(x, y) {
  const car = makeCar('police', x, y, 0);
  car.siren = true;
  car.ai = { turnTimer: 0, confuse: 0, ram: Math.random() < 0.5 };
  return car;
}

/**
 * Drive a police car towards a target.
 *
 * A police car that has been honked at loses the player for a moment: it brakes
 * and spins its wheels before it picks the chase up again.
 */
export function stepCop(car, dt, target) {
  const ai = car.ai;
  if (ai.confuse > 0) {
    // Confused: the car sits still with the siren on, waiting for the player to
    // show up again.
    ai.confuse -= dt;
    stepCar(car, dt, -0.6, ai.ram ? 1 : -1);
    return car;
  }
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 1.8));
  let throttle = 1;
  if (Math.abs(diff) > 1.4) throttle = 0.35;
  // A ramming car closes in harder and brakes later than a careful one.
  if (ai.ram) {
    const dist = Math.hypot(dx, dy);
    if (dist < 90) throttle = 1.2;
  }
  stepCar(car, dt, throttle, steer);
  return car;
}

/** Confuses a police car for a moment, so it loses the player. */
export function confuseCop(car, seconds = PHYSICS.copConfuse) {
  if (!car.ai) return car;
  car.ai.confuse = Math.max(car.ai.confuse, seconds);
  return car;
}

/**
 * A gull: it circles a point over the ocean, its eye level an flattened ellipse
 * rather than a circle, and the circle's centre drifts slowly along the coast.
 * Pure atmosphere - no collision, no gameplay.
 */
export function makeGull(world) {
  return {
    cx: Math.random() * world.width,
    cy: world.oceanTop + 24 + Math.random() * (CITY.oceanHeight - 64),
    angle: Math.random() * Math.PI * 2,
    radius: GULLS.radius * (0.45 + Math.random() * 0.75),
    speed: 0.4 + Math.random() * 0.5,
    phase: Math.random() * 6,
    drift: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 12),
  };
}

/** Spawn the gulls over the water. */
export function spawnGulls(world, count) {
  const gulls = [];
  for (let i = 0; i < count; i++) gulls.push(makeGull(world));
  return gulls;
}

/** Move the gulls for dt: each one circles its own patch and the patch wanders. */
export function stepGulls(gulls, dt, world) {
  for (const g of gulls) {
    g.angle += g.speed * dt;
    g.cx += g.drift * dt;
    // The shoreline is a loop: a gull that flies off one end comes back at the other.
    if (g.cx < -120) g.cx += world.width + 240;
    if (g.cx > world.width + 120) g.cx -= world.width + 240;
  }
}

/** Where a gull is at the moment, in world space. */
export function gullPos(g) {
  return {
    x: g.cx + Math.cos(g.angle) * g.radius,
    y: g.cy + Math.sin(g.angle) * g.radius * 0.4,
  };
}

/** Whether a bullet hits a person. */
export function bulletHitsPerson(b, ped) {
  return overlaps(b.x, b.y, 3, ped.x, ped.y, ped.radius);
}

/** Whether a bullet hits a car. */
export function bulletHitsCar(b, car) {
  return overlaps(b.x, b.y, 3, car.x, car.y, car.radius);
}
