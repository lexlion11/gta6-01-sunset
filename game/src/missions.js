// The job system. The phone on the boardwalk hands out work; each job is a small
// objective the player has to finish before the next one appears.

import { WORLD } from './world.js';

export const JOB_KINDS = {
  DELIVER: 'deliver',
  CHECKPOINT: 'checkpoint',
  ESCAPE: 'escape',
  HIT: 'hit',
};

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
    JOB_KINDS.CHECKPOINT,
    JOB_KINDS.HIT,
    JOB_KINDS.ESCAPE,
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
  return { title: job.title, sub: job.detail };
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
