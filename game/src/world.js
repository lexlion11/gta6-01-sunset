// The city of Sunset City, generated once and then walked around in.
// A road grid with pavements, buildings, parks, a boardwalk, a beach and the ocean.

import { CITY, COLORS } from './config.js';
import { makeRandom } from './random.js';

const TILE_ROAD = 0;
const TILE_PAVEMENT = 1;
const TILE_BLOCK = 2;
const TILE_PARK = 3;
const TILE_SAND = 4;
const TILE_BOARDWALK = 5;
const TILE_OCEAN = 6;

export const TILES = {
  ROAD: TILE_ROAD,
  PAVEMENT: TILE_PAVEMENT,
  BLOCK: TILE_BLOCK,
  PARK: TILE_PARK,
  SAND: TILE_SAND,
  BOARDWALK: TILE_BOARDWALK,
  OCEAN: TILE_OCEAN,
};

/** Total size of the world in world units (pixels at 1:1). */
export const WORLD = {
  width: CITY.cols * (CITY.block + CITY.road) + CITY.road,
  height: CITY.rows * (CITY.block + CITY.road) + CITY.road + CITY.beachHeight + CITY.oceanHeight,
};

/** The x of the left edge of the road column c. */
export const roadX = (c) => c * (CITY.block + CITY.road);
/** The y of the top edge of the road row r. */
export const roadY = (r) => r * (CITY.block + CITY.road);

/** The road rectangle of column c (vertical carriageway). */
export const roadCol = (c) => ({ x: roadX(c), y: 0, w: CITY.road, h: WORLD.height });
/** The road rectangle of row r (horizontal carriageway). */
export const roadRow = (r) => ({ x: 0, y: roadY(r), w: WORLD.width, h: CITY.road });

export function buildWorld(seed = 20261124) {
  const rand = makeRandom(seed);
  const tiles = new Uint8Array(CITY.cols * CITY.rows);
  const buildings = [];
  const parks = [];
  const lamps = [];
  const trees = [];
  const palms = [];

  for (let r = 0; r < CITY.rows; r++) {
    for (let c = 0; c < CITY.cols; c++) {
      const x = roadX(c) + CITY.road;
      const y = roadY(r) + CITY.road;
      const roll = rand();
      if (roll < 0.16) {
        tiles[r * CITY.cols + c] = TILE_PARK;
        const lot = lotRect(x, y);
        parks.push(lot);
        // trees inside the park
        const n = rand.int(6, 12);
        for (let i = 0; i < n; i++) {
          trees.push({
            x: lot.x + rand.range(26, lot.w - 26),
            y: lot.y + rand.range(26, lot.h - 26),
            r: rand.range(11, 19),
            hue: rand(),
          });
        }
      } else {
        tiles[r * CITY.cols + c] = TILE_BLOCK;
        // The lot inside the sidewalk ring, split into one to four buildings.
        const lot = lotRect(x, y);
        const parts = splitLot(lot, rand);
        for (const cell of parts) {
          const gap = rand.range(6, 14);
          const bw = cell.w - gap * 2;
          const bh = cell.h - gap * 2;
          if (bw < 46 || bh < 46) continue;
          const floors = rand.int(2, 7);
          buildings.push({
            x: cell.x + gap,
            y: cell.y + gap,
            w: bw,
            h: bh,
            floors,
            color: rand.pick(COLORS.building),
            roof: rand.pick(COLORS.roof),
            lit: rand.range(0.25, 0.7),
            seed: rand.int(0, 9999),
          });
        }
      }
    }
  }

  // Street lamps along the pavements of the roads.
  for (let r = 0; r <= CITY.rows; r++) {
    for (let c = 0; c <= CITY.cols; c++) {
      if (r % 2 === 0 && c % 2 === 1) {
        lamps.push({ x: roadX(c) + CITY.road + 6, y: roadY(r) + CITY.road + 10, on: rand.chance(0.75) });
        lamps.push({ x: roadX(c) + CITY.road + CITY.block - 6, y: roadY(r) + CITY.road + CITY.block - 10, on: rand.chance(0.75) });
      }
    }
  }

  // The boardwalk runs along the top of the beach, with palms and the job phone on it.
  const boardwalkY = WORLD.height - CITY.oceanHeight - CITY.beachHeight;
  const boardwalk = {
    x: 0,
    y: boardwalkY,
    w: WORLD.width,
    h: CITY.boardwalk,
  };
  for (let i = 0; i < 26; i++) {
    palms.push({
      x: rand.range(40, WORLD.width - 40),
      y: boardwalkY + rand.range(-26, CITY.beachHeight * 0.8),
      h: rand.range(46, 78),
      lean: rand.range(-0.25, 0.25),
    });
  }

  const phone = { x: WORLD.width * 0.5 + 120, y: boardwalkY + 30 };

  // Named places, used by the missions and the minimap.
  const landmarks = [
    { name: 'Boardwalk', x: phone.x, y: phone.y },
    { name: 'Dockside Lot', x: roadX(2) + 200, y: roadY(8) + 240 },
    { name: 'Sunset Pier', x: WORLD.width * 0.22, y: boardwalkY - 60 },
    { name: 'Neon Square', x: roadX(4) + CITY.road + 210, y: roadY(3) + CITY.road + 210 },
    { name: 'Park Gate', x: roadX(6) + CITY.road + 90, y: roadY(5) + CITY.road + 90 },
  ];

  return {
    seed,
    tiles,
    buildings,
    parks,
    lamps,
    trees,
    palms,
    boardwalk,
    phone,
    landmarks,
    // The world's own size: the camera clamps to it and the minimap scales by it.
    width: WORLD.width,
    height: WORLD.height,
    sandTop: WORLD.height - CITY.oceanHeight - CITY.beachHeight,
    oceanTop: WORLD.height - CITY.oceanHeight,
    /** True when the point is on a carriageway (drivable). */
    isRoad(x, y) {
      for (let c = 0; c <= CITY.cols; c++) {
        const rx = roadX(c);
        if (x >= rx && x <= rx + CITY.road) return true;
      }
      for (let r = 0; r <= CITY.rows; r++) {
        const ry = roadY(r);
        if (y >= ry && y <= ry + CITY.road) return true;
      }
      return false;
    },
    /** True when the point is inside a building footprint. */
    inBuilding(x, y) {
      for (const b of this.buildings) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
      }
      return null;
    },
  };
}

/** The lot inside a block's sidewalk ring: the ground the buildings stand on. */
export function lotRect(x, y) {
  const inner = CITY.road + CITY.pavement;
  return {
    x: x + CITY.pavement,
    y: y + CITY.pavement,
    w: CITY.block - CITY.pavement * 2,
    h: CITY.block - CITY.pavement * 2,
  };
}

/**
 * Splits a lot into one to four cells, so a block holds a single tower, a pair of
 * slabs or a tight group of four.
 */
function splitLot(lot, rand) {
  const roll = rand();
  const cells = [];
  if (roll < 0.34) {
    cells.push({ x: lot.x, y: lot.y, w: lot.w, h: lot.h });
  } else if (roll < 0.67) {
    const vertical = rand.chance(0.5);
    const a = rand.range(0.38, 0.62);
    if (vertical) {
      cells.push({ x: lot.x, y: lot.y, w: lot.w * a, h: lot.h });
      cells.push({ x: lot.x + lot.w * a, y: lot.y, w: lot.w * (1 - a), h: lot.h });
    } else {
      cells.push({ x: lot.x, y: lot.y, w: lot.w, h: lot.h * a });
      cells.push({ x: lot.x, y: lot.y + lot.h * a, w: lot.w, h: lot.h * (1 - a) });
    }
  } else {
    const vertical = rand.chance(0.5);
    const a = rand.range(0.38, 0.62);
    if (vertical) {
      cells.push({ x: lot.x, y: lot.y, w: lot.w * a, h: lot.h });
      cells.push({ x: lot.x + lot.w * a, y: lot.y, w: lot.w * (1 - a), h: lot.h });
    } else {
      cells.push({ x: lot.x, y: lot.y, w: lot.w, h: lot.h * a });
      cells.push({ x: lot.x, y: lot.y + lot.h * a, w: lot.w, h: lot.h * (1 - a) });
    }
  }
  return cells;
}

/** The tile kind at a world point, or -1 outside the grid. */
export function tileAt(world, x, y) {
  if (y >= world.oceanTop) return TILE_OCEAN;
  if (y >= world.sandTop) {
    if (y < world.sandTop + CITY.boardwalk) return TILE_BOARDWALK;
    return TILE_SAND;
  }
  const c = Math.floor((x - CITY.road) / (CITY.block + CITY.road));
  const r = Math.floor((y - CITY.road) / (CITY.block + CITY.road));
  if (c < 0 || r < 0 || c >= CITY.cols || r >= CITY.rows) return TILE_ROAD;
  return world.tiles[r * CITY.cols + c];
}
