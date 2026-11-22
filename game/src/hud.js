// The heads-up display: objective, minimap, health, wanted stars, money, the
// speedometer and the title card.

import { COLORS, VIEW, WANTED, CITY, SPEEDOMETER } from './config.js';
import { worldToScreen } from './render.js';

function panel(ctx, x, y, w, h, r = 10) {
  ctx.fillStyle = COLORS.hudShade;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** The top-left objective card. */
export function drawObjective(ctx, text, sub) {
  panel(ctx, 18, 18, 380, sub ? 66 : 48);
  ctx.fillStyle = COLORS.marker;
  ctx.fillRect(18, 18, 5, sub ? 66 : 48);
  ctx.font = 'bold 12px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fillText('OBJECTIVE', 34, 36);
  ctx.font = 'bold 17px "DejaVu Sans", sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(fit(ctx, text, 348), 34, 56);
  if (sub) {
    ctx.font = '13px "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText(fit(ctx, sub, 348), 34, 76);
  }
}

/** Shorten a string so it fits the width. */
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}...`).width > maxWidth) t = t.slice(0, -1);
  return `${t}...`;
}

/** The bottom-left status bar: health, wanted stars and money. */
export function drawStatus(ctx, health, wanted, money, flash) {
  const w = 380;
  const h = 54;
  const x = 18;
  const y = VIEW.height - h - 18;
  panel(ctx, x, y, w, h);

  // health bar
  ctx.font = 'bold 11px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('HEALTH', x + 14, y + 20);
  const barW = 150;
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x + 14, y + 27, barW, 10);
  const hp = Math.max(0, Math.min(100, health)) / 100;
  ctx.fillStyle = hp > 0.5 ? '#6fd06f' : hp > 0.25 ? '#e8c34a' : '#e05a5a';
  ctx.fillRect(x + 14, y + 27, barW * hp, 10);
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,60,60,${Math.min(0.5, flash)})`;
    ctx.fillRect(x, y, w, h);
  }

  // wanted stars
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('WANTED', x + 182, y + 20);
  for (let i = 0; i < WANTED.max; i++) {
    drawStar(ctx, x + 190 + i * 22, y + 30, 8, i < wanted ? COLORS.star : COLORS.starOff);
  }

  // money
  ctx.font = 'bold 20px "DejaVu Sans", sans-serif';
  ctx.fillStyle = COLORS.money;
  ctx.fillText(`$${money}`, x + w - 16 - ctx.measureText(`$${money}`).width, y + 36);
}

/**
 * The speedometer: a dial in the bottom-right corner with a needle that follows
 * the speed of the car. It is drawn over the minimap, so the minimap moves left.
 */
export function drawSpeedometer(ctx, speed, label, nitro) {
  const r = SPEEDOMETER.radius;
  const cx = VIEW.width - r - 26;
  const cy = VIEW.height - r - 26;

  // the dial face
  ctx.fillStyle = 'rgba(12,14,20,0.78)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // the ticks around the dial, with the red line at the top speed
  const start = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  for (let i = 0; i <= 10; i++) {
    const a = start + (sweep * i) / 10;
    const red = i >= 8;
    ctx.strokeStyle = red ? 'rgba(255,90,90,0.9)' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = red ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12));
    ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4));
    ctx.stroke();
  }

  // the arc of the speed, filled in
  const frac = Math.max(0, Math.min(1, speed / SPEEDOMETER.max));
  const needleAngle = start + sweep * frac;
  ctx.strokeStyle = frac > 0.8 ? '#ff6b6b' : frac > 0.55 ? '#ffc24a' : '#6fd3ff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 18, start, needleAngle);
  ctx.stroke();

  // the needle
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(needleAngle);
  ctx.fillStyle = '#f6f2e6';
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(r - 20, -2.2);
  ctx.lineTo(r - 20, 2.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // the hub
  ctx.fillStyle = '#f6f2e6';
  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // the readout in the middle of the dial
  ctx.font = 'bold 22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(speed)), cx, cy + 32);
  ctx.font = 'bold 9px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(label, cx, cy + 44);

  // the nitro bar under the dial
  if (nitro !== undefined) {
    const barW = 88;
    const bx = cx - barW / 2;
    const by = cy + r - 18;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(bx, by, barW, 6);
    ctx.fillStyle = '#8f7bff';
    ctx.fillRect(bx, by, barW * Math.max(0, Math.min(1, nitro)), 6);
    ctx.font = 'bold 8px "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('NITRO', cx, by - 4);
  }
  ctx.textAlign = 'left';
}

/** One wanted star. */
function drawStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.44;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * The minimap, bottom right. `inset` is how far the map has to move away from
 * the right edge: the speedometer sits in that corner while the player is
 * driving, so the map steps aside for it.
 */
export function drawMinimap(ctx, cam, world, marks, size = 190, inset = 0) {
  const x = VIEW.width - size - 18 - inset;
  const y = VIEW.height - size - 18;
  panel(ctx, x, y, size, size, 12);

  const scale = size / Math.max(world.width, world.height);
  const ox = x + (size - world.width * scale) / 2;
  const oy = y + (size - world.height * scale) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, size - 4, size - 4, 10);
  ctx.clip();

  // land
  ctx.fillStyle = '#26303c';
  ctx.fillRect(ox, oy, world.width * scale, world.height * scale);
  // ocean
  ctx.fillStyle = '#173d52';
  ctx.fillRect(ox, oy + world.oceanTop * scale, world.width * scale, (world.height - world.oceanTop) * scale);
  // sand
  ctx.fillStyle = '#7d6c48';
  ctx.fillRect(ox, oy + world.sandTop * scale, world.width * scale, (world.oceanTop - world.sandTop) * scale);
  // roads
  ctx.strokeStyle = '#4c5563';
  ctx.lineWidth = 1.4;
  for (let c = 0; c <= 10; c++) {
    ctx.beginPath();
    ctx.moveTo(ox + c * (CITY.block + CITY.road) * scale, oy);
    ctx.lineTo(ox + c * (CITY.block + CITY.road) * scale, oy + world.sandTop * scale);
    ctx.stroke();
  }
  for (let r = 0; r <= 10; r++) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + r * (CITY.block + CITY.road) * scale);
    ctx.lineTo(ox + world.width * scale, oy + r * (CITY.block + CITY.road) * scale);
    ctx.stroke();
  }
  // parks
  ctx.fillStyle = '#3f6b3a';
  for (const p of world.parks) {
    ctx.fillRect(ox + p.x * scale, oy + p.y * scale, p.w * scale, p.h * scale);
  }
  // the phone
  ctx.fillStyle = '#6fd3ff';
  ctx.fillRect(ox + world.phone.x * scale - 2, oy + world.phone.y * scale - 2, 4, 4);
  // markers
  for (const m of marks) {
    ctx.fillStyle = m.color ?? COLORS.marker;
    ctx.beginPath();
    ctx.arc(ox + m.x * scale, oy + m.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // the player
  const px = ox + cam.x * scale;
  const py = oy + cam.y * scale;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // the view rectangle
  const vw = (VIEW.width / cam.zoom) * scale;
  const vh = (VIEW.height / cam.zoom) * scale;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + cam.x * scale - vw / 2, oy + cam.y * scale - vh / 2, vw, vh);
}

/**
 * The title backdrop: a painted view of Sunset City at sunset, drawn with
 * primitives only - the sky, the sun, the hills, the skyline, the palms and the sea.
 */
export function drawTitleScene(ctx, world, time) {
  const horizon = 430;

  // the sky
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, '#241a4a');
  g.addColorStop(0.36, '#7b3f74');
  g.addColorStop(0.68, '#e8745f');
  g.addColorStop(1, '#ffc46b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, horizon);

  // the sun
  const sunX = VIEW.width * 0.68;
  const sunY = horizon - 40;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 260);
  glow.addColorStop(0, 'rgba(255,240,190,0.95)');
  glow.addColorStop(0.4, 'rgba(255,190,120,0.35)');
  glow.addColorStop(1, 'rgba(255,150,110,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 280, sunY - 280, 560, 560);
  ctx.fillStyle = '#fff2c4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 52, 0, Math.PI * 2);
  ctx.fill();

  // long thin clouds
  ctx.fillStyle = 'rgba(255,225,205,0.28)';
  for (let i = 0; i < 9; i++) {
    const y = 60 + i * 36;
    const x = ((i * 251) % (VIEW.width + 300)) - 150 + Math.sin(time * 0.2 + i) * 20;
    ctx.beginPath();
    ctx.ellipse(x, y, 130 + (i % 3) * 55, 7 + (i % 2) * 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // the hills behind the town
  ctx.fillStyle = '#3b2a52';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= VIEW.width; x += 40) {
    ctx.lineTo(x, horizon - 46 - Math.sin(x * 0.006) * 30 - Math.sin(x * 0.017) * 12);
  }
  ctx.lineTo(VIEW.width, horizon);
  ctx.closePath();
  ctx.fill();

  // the sea
  const sg = ctx.createLinearGradient(0, horizon, 0, VIEW.height);
  sg.addColorStop(0, '#c4705f');
  sg.addColorStop(0.35, '#2a6f8e');
  sg.addColorStop(1, '#123c55');
  ctx.fillStyle = sg;
  ctx.fillRect(0, horizon, VIEW.width, VIEW.height - horizon);

  // the sun's path on the water
  ctx.fillStyle = 'rgba(255,214,150,0.30)';
  ctx.beginPath();
  ctx.moveTo(sunX - 34, horizon);
  ctx.lineTo(sunX + 34, horizon);
  ctx.lineTo(sunX + 150, VIEW.height);
  ctx.lineTo(sunX - 150, VIEW.height);
  ctx.closePath();
  ctx.fill();

  // the waves
  ctx.strokeStyle = 'rgba(230,245,250,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 22; i++) {
    const y = horizon + 8 + i * 17;
    if (y > VIEW.height) break;
    ctx.beginPath();
    for (let x = 0; x <= VIEW.width; x += 20) {
      const yy = y + Math.sin((x + i * 40) * 0.035) * 3.5;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // the town: a skyline of towers along the shore
  const towers = [
    [40, 150, 46], [96, 210, 60], [166, 120, 38], [214, 240, 74], [298, 170, 52],
    [360, 130, 44], [414, 260, 66], [490, 190, 50], [548, 140, 40], [598, 230, 70],
    [678, 160, 46], [734, 250, 58], [802, 180, 50], [862, 220, 64], [936, 140, 42],
    [988, 250, 72], [1070, 170, 48], [1128, 220, 60], [1198, 150, 44],
  ];
  for (const [x, h, w] of towers) {
    ctx.fillStyle = '#241a3a';
    ctx.fillRect(x, horizon - h, w, h + 6);
    // a few lit windows
    ctx.fillStyle = 'rgba(255,214,140,0.55)';
    for (let wy = horizon - h + 10; wy < horizon - 8; wy += 18) {
      for (let wx = x + 6; wx < x + w - 8; wx += 14) {
        if (((wx * 7 + wy * 13 + x) % 5) < 2) ctx.fillRect(wx, wy, 5, 8);
      }
    }
  }
  // the shore
  ctx.fillStyle = '#c9a877';
  ctx.fillRect(0, horizon - 6, VIEW.width, 12);

  // palm silhouettes along the shore
  ctx.strokeStyle = '#181225';
  for (let i = 0; i < 9; i++) {
    const x = 60 + i * 140;
    const h = 70 + (i % 3) * 18;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x, horizon);
    ctx.quadraticCurveTo(x + 8, horizon - h * 0.6, x + 20, horizon - h);
    ctx.stroke();
    ctx.lineWidth = 6;
    for (let f = 0; f < 5; f++) {
      const a = -Math.PI / 2 + (f - 2) * 0.5;
      ctx.beginPath();
      ctx.moveTo(x + 20, horizon - h);
      ctx.quadraticCurveTo(
        x + 20 + Math.cos(a) * 26,
        horizon - h + Math.sin(a) * 26 - 10,
        x + 20 + Math.cos(a) * 52,
        horizon - h + Math.sin(a) * 52 + 16,
      );
      ctx.stroke();
    }
  }
  void world;
}

/** The title screen: a band over the city, so the world still shows behind it. */
export function drawTitle(ctx, time) {
  const bandH = 300;
  const top = VIEW.height - bandH;
  const g = ctx.createLinearGradient(0, top, 0, VIEW.height);
  g.addColorStop(0, 'rgba(10,12,20,0)');
  g.addColorStop(0.45, 'rgba(10,12,20,0.72)');
  g.addColorStop(1, 'rgba(10,12,20,0.94)');
  ctx.fillStyle = g;
  ctx.fillRect(0, top, VIEW.width, bandH);

  const cx = VIEW.width / 2;
  const tg = ctx.createLinearGradient(0, 500, 0, 590);
  tg.addColorStop(0, '#ffe6a8');
  tg.addColorStop(1, '#ff7a5c');
  ctx.fillStyle = tg;
  ctx.font = 'bold 76px "DejaVu Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SUNSET CITY', cx, 578);
  ctx.font = 'bold 17px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#f6f2e6';
  ctx.fillText('an original open-world crime caper', cx, 606);
  ctx.fillStyle = `rgba(255,210,63,${0.6 + 0.35 * Math.sin(time * 3)})`;
  ctx.font = 'bold 19px "DejaVu Sans", sans-serif';
  ctx.fillText('PRESS ENTER TO START', cx, 650);
  ctx.font = '14px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('WASD to move   -   mouse to aim   -   click to fire   -   F for a car   -   H for the horn   -   E for the phone', cx, 682);
  ctx.textAlign = 'left';
}

/** A banner that slides in at the top of the screen. */
export function drawBanner(ctx, banner, time) {
  if (!banner) return;
  const age = time - banner.at;
  if (age > banner.life) return;
  const a = Math.min(1, age * 4) * Math.min(1, (banner.life - age) * 3);
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(12,14,20,0.78)';
  const w = 520;
  const h = 54;
  ctx.beginPath();
  ctx.roundRect(VIEW.width / 2 - w / 2, 86, w, h, 10);
  ctx.fill();
  ctx.fillStyle = banner.color ?? COLORS.marker;
  ctx.font = 'bold 20px "DejaVu Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(banner.text, VIEW.width / 2, 120);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

/** A small toast near the player, for pickups. */
export function drawToast(ctx, toast, time) {
  if (!toast) return;
  const age = time - toast.at;
  if (age > 1.6) return;
  ctx.globalAlpha = Math.max(0, 1 - age / 1.6);
  ctx.font = 'bold 16px "DejaVu Sans", sans-serif';
  ctx.fillStyle = COLORS.money;
  ctx.textAlign = 'center';
  ctx.fillText(toast.text, VIEW.width / 2, 150);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

/**
 * The streak card: it appears next to the objective when the player has finished
 * jobs in a row without losing the heat.
 */
export function drawStreak(ctx, streak, bonus) {
  if (!streak || streak < 2) return;
  panel(ctx, 18, 96, 214, 42);
  ctx.font = 'bold 12px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('CLEAN STREAK', 32, 112);
  ctx.font = 'bold 17px "DejaVu Sans", sans-serif';
  ctx.fillStyle = COLORS.money;
  ctx.fillText(`${streak} jobs  +$${bonus}`, 32, 130);
}

/** The money helper on screen, drawn in world space above a car. */
export function drawFloatText(ctx, cam, item) {
  const p = worldToScreen(cam, item.x, item.y);
  ctx.font = 'bold 15px "DejaVu Sans", sans-serif';
  ctx.fillStyle = item.color ?? COLORS.money;
  ctx.textAlign = 'center';
  ctx.fillText(item.text, p.x, p.y - (item.rise ?? 0));
  ctx.textAlign = 'left';
}
