// The cars of Sunset City. Four families with distinct speed and handling, plus the
// police cruiser and the heavy van the missions use.

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
  };
}

/**
 * Advances a car's motion by dt. throttle is -1..1, steerInput is -1..1.
 * The car accelerates along its heading, loses speed to drag, and turns harder the
 * faster it goes.
 */
export function stepCar(car, dt, throttle, steerInput) {
  const t = car.type;
  const maxSpeed = t.topSpeed;
  if (throttle > 0) {
    car.speed += t.accel * throttle * dt / t.mass;
  } else if (throttle < 0) {
    if (car.speed > 0) car.speed -= t.brake * dt;
    else car.speed -= t.accel * 0.6 * dt / t.mass;
  }
  // drag and the top speed
  car.speed -= car.speed * 0.55 * dt;
  if (car.speed > maxSpeed) car.speed = maxSpeed;
  if (car.speed < -maxSpeed * 0.4) car.speed = -maxSpeed * 0.4;

  // steering scales with speed, so a parked car does not spin
  const grip = t.grip;
  const steerPower = t.turn * (0.35 + Math.min(1, Math.abs(car.speed) / 220) * 0.65);
  car.steer += (steerInput - car.steer) * Math.min(1, dt * 8);
  car.angle += car.steer * steerPower * dt * Math.sign(car.speed || 1) * (car.speed < 0 ? -1 : 1);

  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  car.x += dx * grip + Math.cos(car.angle) * car.speed * dt * (1 - grip);
  car.y += dy * grip + Math.sin(car.angle) * car.speed * dt * (1 - grip);
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
