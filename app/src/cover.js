// Draws the whole cover: panel frames, the photos cropped into them, the sunset grade and the caption.

import { drawPanelPhoto, drawSunsetGrade, drawScanlines, drawCaption, panelsFor } from './panels.js';

/**
 * Draws the cover onto `canvas`.
 * `photos`   array of photo slots: { img: HTMLImageElement|null, dx, dy, zoom }
 * `caption`  the big caption, `tagline` the small line under it
 * `selected` index of the panel being edited, or -1 (draws a highlight ring on it)
 */
export function drawCover(canvas, photos, caption, tagline, selected = -1) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const count = Math.max(1, photos.length);
  const panels = panelsFor(count, w, h);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#1a0b2e';
  ctx.fillRect(0, 0, w, h);

  const gap = Math.max(4, Math.round(h * 0.012));

  photos.forEach((slot, i) => {
    const p = panels[i];
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x, p.y, p.w, p.h);
    ctx.clip();
    if (slot.img) {
      drawPanelPhoto(ctx, p, slot.img, slot.dx, slot.dy, slot.zoom);
      ctx.translate(p.x, p.y);
      drawSunsetGrade(ctx, p.w, p.h);
    } else {
      const g = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
      g.addColorStop(0, '#3a1354');
      g.addColorStop(1, '#c2308a');
      ctx.fillStyle = g;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.font = `600 ${p.h * 0.09}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Panel ${i + 1}`, p.x + p.w / 2, p.y + p.h / 2);
    }
    ctx.restore();
    if (i === selected) {
      ctx.save();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = Math.max(3, h * 0.006);
      ctx.strokeRect(p.x + ctx.lineWidth / 2, p.y + ctx.lineWidth / 2, p.w - ctx.lineWidth, p.h - ctx.lineWidth);
      ctx.restore();
    }
  });

  drawScanlines(ctx, w, h);
  drawSunsetGrade(ctx, 0, 0, w, h);
  drawCaption(ctx, w, h, caption, tagline);

  // Thin neon frame around the whole cover.
  ctx.strokeStyle = 'rgba(255, 90, 180, 0.8)';
  ctx.lineWidth = Math.max(2, h * 0.004);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.strokeStyle = 'rgba(90, 220, 255, 0.5)';
  ctx.lineWidth = Math.max(1, h * 0.002);
  ctx.strokeRect(gap / 2, gap / 2, w - gap, h - gap);
}
