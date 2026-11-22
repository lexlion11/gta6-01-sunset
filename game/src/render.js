// All the drawing. Everything is a canvas primitive: rectangles, circles, paths and
// gradients, no image files at all.

import { COLORS, VIEW, CITY, NIGHT } from './config.js';
import { TILES, tileAt, lotRect } from './world.js';

/** The camera: where it looks and how big a pixel is on screen. */
export function createCamera() {
  return { x: 0, y: 0, zoom: 1, shake: 0, targetX: 0, targetY: 0, flip: false };
}

export function updateCamera(cam, tx, ty, dt, world) {
  const follow = 0.12;
  cam.x += (tx - cam.x) * Math.min(1, dt * 8);
  cam.y += (ty - cam.y) * Math.min(1, dt * 8);
  cam.shake = Math.max(0, cam.shake - dt * 2.2);
  // The camera never leaves the world: without a clamp on a finite world size the
  // view would drift off the map and every screen coordinate with it.
  const maxX = Math.max(VIEW.width / 2, world.width - VIEW.width / 2);
  const maxY = Math.max(VIEW.height / 2, world.height - VIEW.height / 2);
  cam.x = Math.max(VIEW.width / 2, Math.min(maxX, cam.x));
  cam.y = Math.max(VIEW.height / 2, Math.min(maxY, cam.y));
  void follow;
}

/**
 * The world point on the screen. When the camera is flipped (the player is
 * looking over their shoulder), the x axis runs the other way.
 */
export function worldToScreen(cam, x, y) {
  const z = safeZoom(cam);
  const dx = cam.flip ? cam.x - x : x - cam.x;
  const sx = dx * z + VIEW.width / 2;
  const sy = (y - cam.y) * z + VIEW.height / 2;
  return { x: sx, y: sy };
}

/** The zoom a camera uses: never zero, negative or NaN, so a scale stays finite. */
function safeZoom(cam) {
  return Number.isFinite(cam.zoom) && cam.zoom > 0 ? cam.zoom : 1;
}

export function screenToWorld(cam, sx, sy) {
  const z = safeZoom(cam);
  const dx = (sx - VIEW.width / 2) / z;
  return {
    x: cam.flip ? cam.x - dx : cam.x + dx,
    y: (sy - VIEW.height / 2) / z + cam.y,
  };
}

/** The visible world rectangle. */
export function viewRect(cam, world) {
  const z = safeZoom(cam);
  const w = VIEW.width / z;
  const h = VIEW.height / z;
  return {
    x0: cam.x - w / 2,
    y0: cam.y - h / 2,
    x1: cam.x + w / 2,
    y1: cam.y + h / 2,
  };
}

/** The sky and the sea horizon behind the city. */
export function drawSky(ctx, cam, world, time) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  g.addColorStop(0, COLORS.dusk);
  g.addColorStop(0.45, '#8a4a70');
  g.addColorStop(0.72, COLORS.sky);
  g.addColorStop(1, '#ffd9a0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // sun low over the water
  const sunX = VIEW.width * 0.72;
  const sunY = VIEW.height * 0.42;
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 190);
  glow.addColorStop(0, 'rgba(255,236,180,0.95)');
  glow.addColorStop(1, 'rgba(255,180,110,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  ctx.fillStyle = '#fff0c0';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();

  // a few clouds
  ctx.fillStyle = 'rgba(255,225,210,0.20)';
  for (let i = 0; i < 7; i++) {
    const x = ((i * 397 + time * 12) % (VIEW.width + 400)) - 200;
    const y = 60 + ((i * 83) % 150);
    ctx.beginPath();
    ctx.ellipse(x, y, 90 + (i % 3) * 30, 20 + (i % 4) * 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  void world;
}

/** The ground: roads, pavements, blocks, parks, sand and sea. */
export function drawGround(ctx, cam, world) {
  const v = viewRect(cam, world);
  const zoom = safeZoom(cam);

  // the land: only where the world is, so the sky shows past its edge
  const tl = worldToScreen(cam, 0, 0);
  ctx.fillStyle = COLORS.asphalt;
  ctx.fillRect(tl.x, tl.y, world.width * zoom, world.height * zoom);

  // ocean band at the bottom of the world
  const oceanTop = worldToScreen(cam, 0, world.oceanTop).y;
  if (oceanTop < VIEW.height) {
    const g = ctx.createLinearGradient(0, oceanTop, 0, VIEW.height);
    g.addColorStop(0, COLORS.ocean);
    g.addColorStop(1, COLORS.oceanDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, oceanTop, VIEW.width, VIEW.height - oceanTop);
    // wave lines
    ctx.strokeStyle = 'rgba(223,242,247,0.30)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const y = oceanTop + 8 + i * 22;
      if (y > VIEW.height) break;
      ctx.beginPath();
      for (let x = 0; x <= VIEW.width; x += 24) {
        const yy = y + Math.sin((x + i * 30) * 0.03) * 4;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }

  // sand
  const sandTop = worldToScreen(cam, 0, world.sandTop).y;
  if (sandTop < VIEW.height) {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(0, sandTop, VIEW.width, Math.max(0, oceanTop - sandTop));
    ctx.fillStyle = COLORS.wetSand;
    ctx.fillRect(0, oceanTop - 16, VIEW.width, 16);
  }

  // roads: draw the whole grid, clipped to the view by the canvas itself
  ctx.fillStyle = COLORS.asphalt;
  const landBottom = worldToScreen(cam, 0, world.sandTop).y;
  for (let c = 0; c <= CITY.cols; c++) {
    const x = roadXWorld(c);
    const p = worldToScreen(cam, x, 0);
    if (p.x > VIEW.width || p.x + CITY.road * zoom < 0) continue;
    ctx.fillRect(p.x, 0, CITY.road * zoom, Math.max(0, Math.min(VIEW.height, landBottom)));
  }
  for (let r = 0; r <= CITY.rows; r++) {
    const y = roadYWorld(r);
    const p = worldToScreen(cam, 0, y);
    if (p.y > VIEW.height || p.y + CITY.road * zoom < 0) continue;
    ctx.fillRect(0, p.y, VIEW.width, CITY.road * zoom);
  }

  // lane markings down the middle of each road
  ctx.strokeStyle = COLORS.lane;
  ctx.lineWidth = Math.max(1, 2 * zoom);
  ctx.setLineDash([18 * zoom, 16 * zoom]);
  for (let c = 0; c <= CITY.cols; c++) {
    const x = roadXWorld(c) + CITY.road / 2;
    const p = worldToScreen(cam, x, 0);
    if (p.x > VIEW.width || p.x < 0) continue;
    ctx.beginPath();
    ctx.moveTo(p.x, 0);
    ctx.lineTo(p.x, Math.min(VIEW.height, landBottom));
    ctx.stroke();
  }
  for (let r = 0; r <= CITY.rows; r++) {
    const y = roadYWorld(r) + CITY.road / 2;
    const p = worldToScreen(cam, 0, y);
    if (p.y > VIEW.height || p.y < 0) continue;
    ctx.beginPath();
    ctx.moveTo(0, p.y);
    ctx.lineTo(VIEW.width, p.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // pavements: a sidewalk ring around every block, then the lot inside it
  for (let r = 0; r < CITY.rows; r++) {
    for (let c = 0; c < CITY.cols; c++) {
      const bx = roadXWorld(c) + CITY.road;
      const by = roadYWorld(r) + CITY.road;
      const bp = worldToScreen(cam, bx, by);
      const bw = CITY.block * zoom;
      if (bp.x > VIEW.width || bp.y > VIEW.height || bp.x + bw < 0 || bp.y + bw < 0) continue;
      // the sidewalk ring
      ctx.fillStyle = COLORS.pavement;
      ctx.fillRect(bp.x, bp.y, bw, bw);
      ctx.strokeStyle = COLORS.pavementLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(bp.x + 0.5, bp.y + 0.5, bw - 1, bw - 1);
      // the lot inside the ring
      const lot = lotRect(bx, by);
      const lp = worldToScreen(cam, lot.x, lot.y);
      const lw = lot.w * zoom;
      const lh = lot.h * zoom;
      const kind = tileAt(world, bx + CITY.block / 2, by + CITY.block / 2);
      ctx.fillStyle = kind === TILES.PARK ? COLORS.grass : COLORS.pavement;
      ctx.fillRect(lp.x, lp.y, lw, lh);
      if (kind === TILES.PARK) {
        // a path across the park
        ctx.fillStyle = COLORS.path;
        ctx.fillRect(lp.x, lp.y + lh * 0.44, lw, 10 * zoom);
        ctx.fillRect(lp.x + lw * 0.44, lp.y, 10 * zoom, lh);
      }
    }
  }
  void v;
}

function roadXWorld(c) {
  return c * (CITY.block + CITY.road);
}
function roadYWorld(r) {
  return r * (CITY.block + CITY.road);
}

/** The boardwalk over the sand. */
export function drawBoardwalk(ctx, cam, world) {
  const p = worldToScreen(cam, world.boardwalk.x, world.boardwalk.y);
  const h = world.boardwalk.h * safeZoom(cam);
  ctx.fillStyle = '#9a7248';
  ctx.fillRect(0, p.y, VIEW.width, h);
  ctx.strokeStyle = 'rgba(60,38,20,0.35)';
  ctx.lineWidth = 1;
  for (let x = 0; x < VIEW.width; x += 18 * safeZoom(cam)) {
    ctx.beginPath();
    ctx.moveTo(x, p.y);
    ctx.lineTo(x, p.y + h);
    ctx.stroke();
  }
  // rail
  ctx.fillStyle = '#7a5a38';
  ctx.fillRect(0, p.y + h - 4 * safeZoom(cam), VIEW.width, 4 * safeZoom(cam));
}

/** Buildings, with lit windows. */
export function drawBuildings(ctx, cam, world, time) {
  const v = viewRect(cam, world);
  for (const b of world.buildings) {
    if (b.x + b.w < v.x0 - 40 || b.x > v.x1 + 40 || b.y + b.h < v.y0 - 40 || b.y > v.y1 + 40) continue;
    const p = worldToScreen(cam, b.x, b.y);
    const w = b.w * safeZoom(cam);
    const h = b.h * safeZoom(cam);
    const s = safeZoom(cam);
    // body
    ctx.fillStyle = b.color;
    ctx.fillRect(p.x, p.y, w, h);
    // a lit side wall on the right, for a little depth
    ctx.fillStyle = 'rgba(255,235,190,0.10)';
    ctx.fillRect(p.x + w * 0.78, p.y, w * 0.22, h);
    // a shadow on the left
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(p.x, p.y, w * 0.16, h);
    // roof
    ctx.fillStyle = b.roof;
    ctx.fillRect(p.x - 3 * s, p.y - 8 * s, w + 6 * s, 9 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(p.x - 3 * s, p.y - 8 * s, w + 6 * s, 3 * s);
    // rooftop details
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(p.x + w * 0.18, p.y + h * 0.10, w * 0.22, h * 0.16);
    ctx.fillRect(p.x + w * 0.60, p.y + h * 0.55, w * 0.16, h * 0.12);
    // windows, sparse
    const cols = Math.max(1, Math.floor(b.w / 46));
    const rows = Math.max(1, Math.floor(b.h / 46));
    const padX = (b.w - cols * 46) / 2;
    const padY = (b.h - rows * 46) / 2;
    for (let ry = 0; ry < rows; ry++) {
      for (let rx = 0; rx < cols; rx++) {
        const seedv = (b.seed + rx * 31 + ry * 17) % 100;
        const on = seedv < b.lit * 55;
        ctx.fillStyle = on ? COLORS.windowLit : 'rgba(38,46,60,0.9)';
        const wx = p.x + (padX + rx * 46 + 12) * safeZoom(cam);
        const wy = p.y + (padY + ry * 46 + 14) * safeZoom(cam);
        ctx.fillRect(wx, wy, 20 * safeZoom(cam), 16 * safeZoom(cam));
      }
    }
  }
  void time;
}

/** Park trees and beach palms. */
export function drawFoliage(ctx, cam, world) {
  const v = viewRect(cam, world);
  for (const t of world.trees) {
    if (t.x < v.x0 || t.x > v.x1 || t.y < v.y0 || t.y > v.y1) continue;
    const p = worldToScreen(cam, t.x, t.y);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(p.x + 3, p.y + 3, t.r * safeZoom(cam), t.r * 0.6 * safeZoom(cam), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.hue > 0.5 ? COLORS.grass : COLORS.grassDark;
    ctx.beginPath();
    ctx.arc(p.x, p.y, t.r * safeZoom(cam), 0, Math.PI * 2);
    ctx.fill();
  }
  for (const palm of world.palms) {
    const p = worldToScreen(cam, palm.x, palm.y);
    const s = safeZoom(cam);
    ctx.strokeStyle = '#8a6b45';
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + palm.lean * palm.h * s, p.y - palm.h * s);
    ctx.stroke();
    ctx.strokeStyle = '#3f7a3c';
    ctx.lineWidth = 4 * s;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.42;
      ctx.beginPath();
      ctx.moveTo(p.x + palm.lean * palm.h * s, p.y - palm.h * s);
      ctx.quadraticCurveTo(
        p.x + palm.lean * palm.h * s + Math.cos(a) * 22 * s,
        p.y - palm.h * s + Math.sin(a) * 22 * s - 6 * s,
        p.x + palm.lean * palm.h * s + Math.cos(a) * 40 * s,
        p.y - palm.h * s + Math.sin(a) * 40 * s + 10 * s,
      );
      ctx.stroke();
    }
  }
}

/**
 * The street props: benches, hydrants, bins, planters and the food stall. They
 * give the pavements a bit of life without costing a file of assets.
 */
export function drawProps(ctx, cam, world) {
  const v = viewRect(cam, world);
  for (const prop of world.props) {
    if (prop.x < v.x0 - 40 || prop.x > v.x1 + 40 || prop.y < v.y0 - 40 || prop.y > v.y1 + 40) continue;
    const p = worldToScreen(cam, prop.x, prop.y);
    const s = safeZoom(cam);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(prop.angle ?? 0);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(2 * s, 3 * s, 9 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    if (prop.kind === 'bench') {
      ctx.fillStyle = COLORS.bench;
      ctx.fillRect(-10 * s, -4 * s, 20 * s, 8 * s);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(-10 * s, 0, 20 * s, 2 * s);
    } else if (prop.kind === 'hydrant') {
      ctx.fillStyle = COLORS.hydrant;
      ctx.fillRect(-3 * s, -9 * s, 6 * s, 11 * s);
      ctx.fillRect(-5 * s, -6 * s, 10 * s, 3 * s);
    } else if (prop.kind === 'bin') {
      ctx.fillStyle = COLORS.bin;
      ctx.fillRect(-5 * s, -10 * s, 10 * s, 12 * s);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(-5 * s, -10 * s, 10 * s, 3 * s);
    } else if (prop.kind === 'planter') {
      ctx.fillStyle = '#6b5a45';
      ctx.fillRect(-7 * s, -7 * s, 14 * s, 9 * s);
      ctx.fillStyle = COLORS.planter;
      ctx.beginPath();
      ctx.arc(0, -8 * s, 6 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.kind === 'stall') {
      ctx.fillStyle = COLORS.stall;
      ctx.fillRect(-13 * s, -10 * s, 26 * s, 14 * s);
      ctx.fillStyle = COLORS.stallAwning;
      ctx.fillRect(-15 * s, -16 * s, 30 * s, 7 * s);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(-15 * s + i * 6 * s, -16 * s, 3 * s, 7 * s);
      }
    }
    ctx.restore();
  }
}

/** A person: legs, torso, head. Drawn upright whatever the facing. */
export function drawPerson(ctx, cam, p, colors) {
  const s = safeZoom(cam);
  const sp = worldToScreen(cam, p.x, p.y);
  const x = sp.x;
  const y = sp.y;
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(x * 1, y * 1 + 2, 8 * s, 3.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // legs
  ctx.strokeStyle = '#2b2f38';
  ctx.lineWidth = 3 * s;
  const swing = Math.sin(p.walkPhase || 0) * 3 * s;
  ctx.beginPath();
  ctx.moveTo(x - 2 * s, y - 7 * s);
  ctx.lineTo(x - 2 * s + swing, y);
  ctx.moveTo(x + 2 * s, y - 7 * s);
  ctx.lineTo(x + 2 * s - swing, y);
  ctx.stroke();
  // torso
  ctx.fillStyle = colors.shirt;
  ctx.fillRect(x - 4.5 * s, y - 16 * s, 9 * s, 10 * s);
  // arms
  ctx.strokeStyle = colors.shirt;
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, y - 15 * s);
  ctx.lineTo(x - 6 * s - swing * 0.5, y - 7 * s);
  ctx.moveTo(x + 4 * s, y - 15 * s);
  ctx.lineTo(x + 6 * s + swing * 0.5, y - 7 * s);
  ctx.stroke();
  // head
  ctx.fillStyle = colors.skin;
  ctx.beginPath();
  ctx.arc(x, y - 20 * s, 4.4 * s, 0, Math.PI * 2);
  ctx.fill();
  // cap or hair
  ctx.fillStyle = colors.hair;
  ctx.beginPath();
  ctx.arc(x, y - 21.5 * s, 4.4 * s, Math.PI, Math.PI * 2);
  ctx.fill();
}

/** A car from above: body, roof, windows, wheels, lights. */
export function drawCar(ctx, cam, car, opts = {}) {
  const t = car.type;
  const s = safeZoom(cam);
  const p = worldToScreen(cam, car.x, car.y);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(car.angle);
  const w = t.w * s;
  const h = t.h * s;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(3 * s, 3 * s, w * 0.52, h * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  // wheels
  ctx.fillStyle = '#14161b';
  ctx.fillRect(-w * 0.34, -h * 0.62, w * 0.20, h * 0.26);
  ctx.fillRect(-w * 0.34, h * 0.36, w * 0.20, h * 0.26);
  ctx.fillRect(w * 0.16, -h * 0.62, w * 0.20, h * 0.26);
  ctx.fillRect(w * 0.16, h * 0.36, w * 0.20, h * 0.26);
  // body
  ctx.fillStyle = t.body;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  // cabin
  ctx.fillStyle = t.roof;
  ctx.fillRect(-w * 0.26, -h * 0.40, w * 0.46, h * 0.80);
  // windscreen
  ctx.fillStyle = 'rgba(190,225,240,0.75)';
  ctx.fillRect(-w * 0.26, -h * 0.40, w * 0.10, h * 0.80);
  ctx.fillRect(w * 0.16, -h * 0.40, w * 0.10, h * 0.80);
  // headlights
  ctx.fillStyle = '#fff3c4';
  ctx.fillRect(w * 0.44, -h * 0.40, w * 0.06, h * 0.26);
  ctx.fillRect(w * 0.44, h * 0.14, w * 0.06, h * 0.26);
  ctx.fillStyle = '#a02424';
  ctx.fillRect(-w * 0.50, -h * 0.40, w * 0.05, h * 0.24);
  ctx.fillRect(-w * 0.50, h * 0.16, w * 0.05, h * 0.24);
  if (opts.selected) {
    ctx.strokeStyle = COLORS.marker;
    ctx.lineWidth = 2 * s;
    ctx.strokeRect(-w / 2 - 3 * s, -h / 2 - 3 * s, w + 6 * s, h + 6 * s);
  }
  if (car.siren) {
    const flash = Math.floor(opts.time * 8) % 2 === 0;
    ctx.fillStyle = flash ? '#ff4444' : '#4488ff';
    ctx.fillRect(-w * 0.10, -h * 0.18, w * 0.22, h * 0.36);
    // the light bar throws a pool of colour on the road
    if (flash) {
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 26 * s);
      g.addColorStop(0, 'rgba(255,68,68,0.35)');
      g.addColorStop(1, 'rgba(255,68,68,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 26 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The nitro flame out of the back of a boosted car.
  if (opts.boost) {
    const flick = 0.6 + 0.4 * Math.sin((opts.time ?? 0) * 40);
    ctx.fillStyle = 'rgba(150,110,255,0.85)';
    ctx.fillRect(-w * 0.62, -h * 0.16, w * 0.16 * flick, h * 0.32);
    ctx.fillStyle = 'rgba(220,200,255,0.75)';
    ctx.fillRect(-w * 0.58, -h * 0.08, w * 0.08 * flick, h * 0.16);
  }
  ctx.restore();
}

/** A bullet as a small bright streak. */
export function drawBullet(ctx, cam, b) {
  const p = worldToScreen(cam, b.x, b.y);
  ctx.fillStyle = '#fff2a8';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 2.4 * safeZoom(cam), 0, Math.PI * 2);
  ctx.fill();
}

/** The mission marker: a pulsing column of light. */
export function drawMarker(ctx, cam, m, time) {
  const p = worldToScreen(cam, m.x, m.y);
  const s = safeZoom(cam);
  const pulse = 0.5 + 0.5 * Math.sin(time * 4);
  const r = (26 + pulse * 8) * s;
  ctx.save();
  ctx.globalAlpha = 0.45 + pulse * 0.35;
  ctx.fillStyle = m.color ?? COLORS.marker;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.22 + pulse * 0.18;
  ctx.fillRect(p.x - r * 0.35, p.y - 70 * s, r * 0.7, 70 * s);
  ctx.restore();
  ctx.strokeStyle = COLORS.markerPulse;
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r, r * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** The little job phone on the boardwalk. */
export function drawPhone(ctx, cam, world, time) {
  const p = worldToScreen(cam, world.phone.x, world.phone.y);
  const s = safeZoom(cam);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 3 * s, 12 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3b4a6b';
  ctx.fillRect(p.x - 7 * s, p.y - 26 * s, 14 * s, 26 * s);
  ctx.fillStyle = Math.floor(time * 2) % 2 === 0 ? '#9fe8ff' : '#5fb6d8';
  ctx.fillRect(p.x - 5 * s, p.y - 23 * s, 10 * s, 16 * s);
  ctx.fillStyle = '#2c3852';
  ctx.fillRect(p.x - 9 * s, p.y - 28 * s, 18 * s, 4 * s);
}

/**
 * The cash case of the heist: a small box on the sand with a warm glow around
 * it, so the player can tell it apart from the street.
 */
export function drawStash(ctx, cam, world, time) {
  if (world.stash.taken) return;
  const p = worldToScreen(cam, world.stash.x, world.stash.y);
  const s = safeZoom(cam);
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 34 * s);
  g.addColorStop(0, `rgba(255,214,120,${0.35 + pulse * 0.2})`);
  g.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 34 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.fillRect(p.x - 7 * s, p.y - 5 * s, 14 * s, 10 * s);
  ctx.fillStyle = '#d8b46a';
  ctx.fillRect(p.x - 7 * s, p.y - 1.5 * s, 14 * s, 3 * s);
  ctx.fillStyle = '#8fe08a';
  ctx.fillRect(p.x - 1.5 * s, p.y - 5 * s, 3 * s, 10 * s);
}

/**
 * The rings of the horn: they spread out from the car that honked.
 */
export function drawHorn(ctx, cam, horn) {
  const s = safeZoom(cam);
  for (const ring of horn.rings) {
    const p = worldToScreen(cam, ring.x, ring.y);
    const r = ring.radius * s;
    ctx.strokeStyle = `rgba(255,240,180,${Math.max(0, ring.alpha * 0.8)})`;
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * The dusk tint and the vignette that lie over the whole picture, so the city
 * reads as evening rather than noon.
 */
export function drawNightTint(ctx) {
  ctx.fillStyle = NIGHT.tint;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const g = ctx.createRadialGradient(
    VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.35,
    VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.85,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(8,6,18,${NIGHT.vignette})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

/** Street lamps: a pole and a warm pool of light. */
export function drawLamps(ctx, cam, world) {
  const v = viewRect(cam, world);
  for (const l of world.lamps) {
    if (l.x < v.x0 - 60 || l.x > v.x1 + 60 || l.y < v.y0 - 60 || l.y > v.y1 + 60) continue;
    const p = worldToScreen(cam, l.x, l.y);
    const s = safeZoom(cam);
    ctx.fillStyle = '#2b2f38';
    ctx.fillRect(p.x - 1.5 * s, p.y - 26 * s, 3 * s, 26 * s);
    ctx.fillStyle = l.on ? COLORS.window : '#4a5058';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 27 * s, 3.4 * s, 0, Math.PI * 2);
    ctx.fill();
    if (l.on) {
      const g = ctx.createRadialGradient(p.x, p.y - 24 * s, 2, p.x, p.y - 24 * s, 46 * s);
      g.addColorStop(0, 'rgba(255,224,150,0.30)');
      g.addColorStop(1, 'rgba(255,224,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 24 * s, 46 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
