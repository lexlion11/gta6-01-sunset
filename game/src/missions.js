// The job system. The phone on the boardwalk hands out work; each job is a small
// objective the player has to finish before the next one appears.

import { WORLD, nearestLandmark } from './world.js';
import { HEIST } from './config.js';

export const JOB_KINDS = {
  DELIVER: 'deliver',
  CHECKPOINT: 'checkpoint',
  ESCAPE: 'escape',
  HIT: 'hit',
  HEIST: 'heist',
  TAXI: 'taxi',
};

/**
 * The landmark nearest a point, skipping the one given: used to keep a fare's
 * drop-off a short hop from its pickup rather than a crossing of the whole city.
 */
function nearestOther(world, x, y, skip) {
  let best = null;
  let bestD = Infinity;
  for (const l of world.landmarks) {
    if (l === skip) continue;
    const d = (l.x - x) * (l.x - x) + (l.y - y) * (l.y - y);
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best ?? nearestLandmark(world, x, y);
}

/** A job the phone can offer. */
function makeJob(kind, index, world) {
  const rng = () => Math.random();
  if (kind === JOB_KINDS.DELIVER) {
    const carIds = ['compact', 'coupe', 'taxi', 'muscle', 'van'];
    const carId = carIds[index % carIds.length];
    const target = world.landmarks[1 + (index % (world.landmarks.length - 1))];
    return {
      kind,
      title: 'Deliver the car',
      detail: `Bring the ${carId} to the drop-off marker`,
      carId,
      marker: { x: target.x, y: target.y },
      reward: 900 + index * 120,
      done: false,
    };
  }
  if (kind === JOB_KINDS.CHECKPOINT) {
    const points = [];
    const count = 4;
    for (let i = 0; i < count; i++) {
      const l = world.landmarks[(i + index) % world.landmarks.length];
      points.push({ x: l.x + (rng() - 0.5) * 160, y: l.y + (rng() - 0.5) * 160 });
    }
    return {
      kind,
      title: 'Hit every checkpoint',
      detail: 'Drive through all four checkpoints before time runs out',
      checkpoints: points,
      index: 0,
      marker: points[0],
      time: 75,
      reward: 1100 + index * 150,
      done: false,
    };
  }
  if (kind === JOB_KINDS.ESCAPE) {
    return {
      kind,
      title: 'Lose the police',
      detail: 'You are hot: shake off the cops and stay free for 30 seconds',
      time: 30,
      reward: 1400 + index * 180,
      done: false,
    };
  }
  if (kind === JOB_KINDS.HEIST) {
    // The heist has two halves: lift the case from the stash on foot, then drive
    // it out of the city in the getaway car waiting at the safe house.
    return {
      kind,
      title: 'Lift the case',
      detail: 'Take the cash case from behind the pier, then drive it to the safe house',
      phase: 'lift',
      marker: { x: world.stash.x, y: world.stash.y },
      stash: world.stash,
      safehouse: world.safehouse,
      carId: 'getaway',
      reward: 2600 + index * 200,
      done: false,
    };
  }
  if (kind === JOB_KINDS.TAXI) {
    // The taxi run has two halves too: reach the fare wherever it is waiting, then
    // drive it across town. Any car will do - the fare does not care what it is
    // riding in, only that it shows up.
    const pickup = world.landmarks[(index + 1) % world.landmarks.length];
    const drop = nearestOther(world, pickup.x, pickup.y, pickup);
    return {
      kind,
      title: 'Taxi run',
      detail: 'Pick up the fare at the marker, then drive them to the drop-off',
      phase: 'pickup',
      marker: { x: pickup.x, y: pickup.y },
      fare: { x: pickup.x, y: pickup.y },
      dropoff: { x: drop.x, y: drop.y },
      reward: 800 + index * 110,
      done: false,
    };
  }
  const l = world.landmarks[(index + 2) % world.landmarks.length];
  return {
    kind,
    title: 'Make the drop',
    detail: 'Go to the marker on foot and pick up the package',
    marker: { x: l.x, y: l.y },
    reward: 700 + index * 100,
    done: false,
  };
}

/** The job list the phone cycles through. */
export function createJobBoard(world) {
  const order = [
    JOB_KINDS.DELIVER,
    JOB_KINDS.TAXI,
    JOB_KINDS.CHECKPOINT,
    JOB_KINDS.HIT,
    JOB_KINDS.ESCAPE,
    JOB_KINDS.HEIST,
  ];
  let index = 0;
  return {
    index,
    /** The job the phone currently offers. */
    current() {
      return makeJob(order[index % order.length], index, world);
    },
    /** Called when the current job is finished: the next one is queued. */
    advance() {
      index += 1;
    },
  };
}

/** The marker the player should head for, given the job. */
export function markerOf(job) {
  if (!job) return null;
  if (job.kind === JOB_KINDS.CHECKPOINT) return job.checkpoints[job.index] ?? null;
  if (job.kind === JOB_KINDS.HEIST) {
    return job.phase === 'lift' ? job.marker : { x: job.safehouse.x, y: job.safehouse.y };
  }
  if (job.kind === JOB_KINDS.TAXI) {
    return job.phase === 'pickup' ? job.marker : job.dropoff;
  }
  return job.marker ?? null;
}

/**
 * Progress of the current job: true when it is finished.
 * `state` carries the game facts the check needs.
 */
export function checkJob(job, state) {
  if (!job || job.done) return false;
  if (job.kind === JOB_KINDS.CHECKPOINT) {
    const cp = job.checkpoints[job.index];
    if (!cp) return false;
    const dx = state.playerX - cp.x;
    const dy = state.playerY - cp.y;
    if (dx * dx + dy * dy < 70 * 70) {
      job.index += 1;
      if (job.index >= job.checkpoints.length) {
        job.done = true;
        return true;
      }
    }
    return false;
  }
  if (job.kind === JOB_KINDS.ESCAPE) {
    if (state.wanted <= 0) {
      job.done = true;
      return true;
    }
    return false;
  }
  if (job.kind === JOB_KINDS.HEIST) {
    if (job.phase === 'lift') {
      const dx = state.playerX - job.stash.x;
      const dy = state.playerY - job.stash.y;
      // The case has to be lifted on foot: the alarm is wired to the door.
      if (dx * dx + dy * dy < HEIST.reach * HEIST.reach && !state.inCar) {
        job.phase = 'escape';
        job.stash.taken = true;
        job.detail = 'Drive the Nightjar to the safe house';
        job.marker = { x: job.safehouse.x, y: job.safehouse.y };
      }
      return false;
    }
    // The second half: the getaway car has to be at the safe house.
    const dx = state.playerX - job.safehouse.x;
    const dy = state.playerY - job.safehouse.y;
    const reach = HEIST.getawayReach;
    if (dx * dx + dy * dy < reach * reach && state.inTargetCar) {
      job.done = true;
      return true;
    }
    return false;
  }
  if (job.kind === JOB_KINDS.TAXI) {
    if (job.phase === 'pickup') {
      // The fare is met wherever the player finds it: on foot or behind the wheel.
      const dx = state.playerX - job.fare.x;
      const dy = state.playerY - job.fare.y;
      if (dx * dx + dy * dy < 60 * 60) {
        job.phase = 'dropoff';
        job.detail = 'Drive the fare to the drop-off';
        job.marker = job.dropoff;
      }
      return false;
    }
    // The second half: the fare rides, so the player has to be in a car.
    const dx = state.playerX - job.dropoff.x;
    const dy = state.playerY - job.dropoff.y;
    if (dx * dx + dy * dy < 80 * 80 && state.inCar) {
      job.done = true;
      return true;
    }
    return false;
  }
  const m = job.marker;
  if (!m) return false;
  const dx = state.playerX - m.x;
  const dy = state.playerY - m.y;
  const reach = job.kind === JOB_KINDS.DELIVER ? 90 : 60;
  if (dx * dx + dy * dy < reach * reach) {
    if (job.kind === JOB_KINDS.DELIVER && !state.inTargetCar) return false;
    job.done = true;
    return true;
  }
  return false;
}

/** A short line for the objective card. */
export function objectiveText(job) {
  if (!job) return { title: 'Find the job phone', sub: 'Head to the boardwalk on the south beach' };
  if (job.kind === JOB_KINDS.CHECKPOINT) {
    return { title: job.title, sub: `Checkpoint ${job.index + 1} of ${job.checkpoints.length} - ${job.detail}` };
  }
  if (job.kind === JOB_KINDS.HEIST) {
    if (job.phase === 'lift') return { title: job.title, sub: 'On foot: the case is behind the pier' };
    return { title: 'Run the case', sub: 'Get in the Nightjar and reach the safe house' };
  }
  if (job.kind === JOB_KINDS.TAXI) {
    if (job.phase === 'pickup') return { title: job.title, sub: 'The fare is at the marker' };
    return { title: 'Taxi run', sub: 'Any car: drive the fare to the drop-off' };
  }
  return { title: job.title, sub: job.detail };
}

/**
 * The bonus for finishing a job without a scratch: the payout grows with the
 * streak of clean jobs, and the cap keeps it sane.
 */
export function completionBonus(job, streak, health, wanted) {
  if (!job) return 0;
  let bonus = 0;
  if (health >= 90) bonus += 150;
  if (wanted === 0) bonus += 250;
  bonus += Math.min(3, Math.max(0, streak - 1)) * 200;
  return bonus;
}

/** The world bounds helper for a random point on a road. */
export function randomRoadPoint(world) {
  const c = Math.floor(Math.random() * 11);
  const r = Math.floor(Math.random() * 11);
  const road = 116;
  const cell = 420 + road;
  if (Math.random() < 0.5) {
    return { x: c * cell + road / 2, y: Math.random() * world.sandTop };
  }
  return { x: Math.random() * WORLD.width, y: r * cell + road / 2 };
}
