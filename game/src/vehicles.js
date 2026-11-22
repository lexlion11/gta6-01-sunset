// The cars of Sunset City. Six families with distinct speed and handling, plus the
// police cruiser, the heavy van the missions use and the getaway car the heist
// leaves waiting at the drop-off.

export const CAR_TYPES = [
  {
    id: 'compact',
    name: 'Sunset Compact',
    w: 30, h: 15,
    accel: 340, topSpeed: 330, brake: 520, turn: 2.9, grip: 0.9,
    body: '#e04f4f', roof: '#8f2f2f',
    mass: 1,
  },
  {
    id: 'coupe',
    name: 'Vesper Coupé',
    w: 33, h: 16,
    accel: 430, topSpeed: 430, brake: 640, turn: 3.2, grip: 0.95,
    body: '#3f7fd0', roof: '#2a5a97',
    mass: 0.95,
  },
  {
    id: 'taxi',
    name: 'Dune Taxi',
    w: 32, h: 16,
    accel: 300, topSpeed: 300, brake: 520, turn: 3.5, grip: 0.92,
    body: '#f0c33a', roof: '#c99a1f',
    mass: 1,
  },
  {
    id: 'muscle',
    name: 'Rattler Muscle',
    w: 36, h: 18,
    accel: 520, topSpeed: 470, brake: 560, turn: 2.5, grip: 0.86,
    body: '#2b2f38', roof: '#171a20',
    mass: 1.15,
  },
  {
    id: 'van',
    name: 'Ladle Van',
    w: 42, h: 20,
    accel: 230, topSpeed: 250, brake: 440, turn: 2.1, grip: 0.82,
    body: '#d9d2c4', roof: '#a8a094',
    mass: 1.4,
  },
  {
    id: 'police',
    name: 'Sunset Interceptor',
    w: 34, h: 17,
    accel: 460, topSpeed: 445, brake: 600, turn: 3.0, grip: 0.95,
    body: '#1f3f8f', roof: '#152a5e',
    mass: 1.05,
    police: true,
  },
  {
    id: 'getaway',
    name: 'Nightjar Getaway',
    w: 38, h: 18,
    accel: 560, topSpeed: 510, brake: 620, turn: 2.7, grip: 0.9,
    body: '#2b2436', roof: '#12101a',
    mass: 1.1,
    getaway: true,
  },
];

export function carType(id) {
  return CAR_TYPES.find((t) => t.id === id) ?? CAR_TYPES[0];
}

/** A car entity: position, heading, velocity along the heading, and its body type. */
export function makeCar(typeId, x, y, angle = 0) {
  const t = carType(typeId);
  return {
    type: t,
    x, y, angle,
    speed: 0,
    steer: 0,
    hp: 100,
    radius: Math.max(t.w, t.h) * 0.45,
    occupant: null,
    siren: false,
    ai: null,
    // The nitro the player has left in this car, and the slip of the wheels.
    nitro: 1,
    slip: 0,
  };
}

/**
 * Advances a car's motion by dt. throttle is -1..1, steerInput is -1..1.
 * The car accelerates along its heading, loses speed to drag, and turns harder the
 * faster it goes.
 *
 * opts.handbrake locks the wheels: the car keeps its speed but loses grip and
 * slides, so it can be turned sideways into a corner.
 * opts.boost adds a burst of thrust on top of the normal acceleration.
 */
export function stepCar(car, dt, throttle, steerInput, opts = {}) {
  const t = car.type;
  const maxSpeed = t.topSpeed;
  const boost = opts.boost ? 1.55 : 1;
  if (throttle > 0) {
    car.speed += t.accel * throttle * boost * dt / t.mass;
  } else if (throttle < 0) {
    if (car.speed > 0) car.speed -= t.brake * dt;
    else car.speed -= t.accel * 0.6 * dt / t.mass;
  }
  // drag and the top speed
  car.speed -= car.speed * 0.55 * dt;
  if (car.speed > maxSpeed * (opts.boost ? 1.15 : 1)) car.speed = maxSpeed * (opts.boost ? 1.15 : 1);
  if (car.speed < -maxSpeed * 0.4) car.speed = -maxSpeed * 0.4;

  // steering scales with speed, so a parked car does not spin
  const grip = opts.handbrake ? t.grip * 0.45 : t.grip;
  const steerPower = t.turn * (0.35 + Math.min(1, Math.abs(car.speed) / 220) * 0.65);
  car.steer += (steerInput - car.steer) * Math.min(1, dt * 8);
  car.angle += car.steer * steerPower * dt * Math.sign(car.speed || 1) * (car.speed < 0 ? -1 : 1);

  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  // The grip part of the movement follows the heading, the rest slides sideways:
  // with the handbrake on, that sideways part grows and the car drifts.
  const slide = 1 - grip;
  car.slip = Math.abs(car.speed) * slide * (opts.handbrake ? 2.2 : 1);
  car.x += dx * grip + Math.cos(car.angle) * car.speed * dt * slide;
  car.y += dy * grip + Math.sin(car.angle) * car.speed * dt * slide;
  return car;
}

/** The corners of a car's box in world space, for drawing and collision. */
export function carCorners(car) {
  const t = car.type;
  const c = Math.cos(car.angle);
  const s = Math.sin(car.angle);
  const hw = t.w / 2;
  const hh = t.h / 2;
  const pts = [
    [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh],
  ];
  return pts.map(([x, y]) => ({ x: car.x + x * c - y * s, y: car.y + x * s + y * c }));
}

/** Whether two circles overlap. */
export function overlaps(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

/**
 * The speed of a car in the units the speedometer shows, and a short word for
 * what the car is doing, so the HUD can colour the dial.
 */
export function speedReadout(car) {
  const speed = car ? Math.abs(car.speed) : 0;
  let label = 'IDLE';
  if (speed > 40) label = 'CRUISE';
  if (speed > 160) label = 'FAST';
  if (speed > 300) label = 'REDLINE';
  return { speed, label };
}
