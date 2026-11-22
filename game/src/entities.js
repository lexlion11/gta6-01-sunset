// The people and the traffic of Sunset City: pedestrians that walk the pavements and
// run from trouble, cars that drive the road grid, and the police that chase the player.

import { PHYSICS, COLORS, CITY } from './config.js';
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

/** Move a pedestrian for dt. */
export function stepPed(ped, dt, target, player, danger) {
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
  };
  car.type = { ...car.type };
  car.speed = car.type.topSpeed * 0.35;
  return car;
}

/** Drive a traffic car for dt, keeping it on the roads. */
export function stepTraffic(car, dt, world) {
  const ai = car.ai;
  ai.turnTimer -= dt;
  const ahead = lookAhead(car, 120);
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

  // slow down for whatever is in front
  let throttle = ai.cruise;
  if (ahead) {
    const gap = ahead.gap;
    if (gap < 90) throttle = -0.4;
    else if (gap < 150) throttle = 0.15;
  }
  // stay inside the world
  if (car.x < 60 || car.x > world.width - 60 || car.y < 60 || car.y > world.sandTop - 20) {
    throttle = -0.3;
  }
  stepCar(car, dt, throttle, steer);
  void roadX;
  void roadY;
  return car;
}

/** What is in front of a car, if anything. */
function lookAhead(car, dist) {
  const dx = Math.cos(car.angle) * dist;
  const dy = Math.sin(car.angle) * dist;
  return { x: car.x + dx, y: car.y + dy };
}

/** The police: they chase the player and try to ram them. */
export function makeCop(x, y) {
  const car = makeCar('police', x, y, 0);
  car.siren = true;
  car.ai = { turnTimer: 0 };
  return car;
}

/** Drive a police car towards a target. */
export function stepCop(car, dt, target) {
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 1.8));
  let throttle = 1;
  if (Math.abs(diff) > 1.4) throttle = 0.35;
  stepCar(car, dt, throttle, steer);
  return car;
}

/** Whether a bullet hits a person. */
export function bulletHitsPerson(b, ped) {
  return overlaps(b.x, b.y, 3, ped.x, ped.y, ped.radius);
}

/** Whether a bullet hits a car. */
export function bulletHitsCar(b, car) {
  return overlaps(b.x, b.y, 3, car.x, car.y, car.radius);
}
