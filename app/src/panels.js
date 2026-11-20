// The panel layout engine: a cover is a canvas divided into 1-4 panels, each a rectangle holding one photo,
// cropped and positioned by the user, with a sunset/neon grade and bold caption lettering on top.

// Panel arrangements, as fractions of the cover rectangle, for 1 to 4 panels. The first entry of each is the
// square/portrait arrangement and the second (where there is one) the wide one.
const ARRANGEMENTS = {
  1: [[{ x: 0, y: 0, w: 1, h: 1 }]],
  2: [
    // square / portrait: side by side
    [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
    // wide: stacked
    [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  ],
  3: [
    // square / portrait: one tall left, two stacked right
    [
      { x: 0, y: 0, w: 0.54, h: 1 },
      { x: 0.54, y: 0, w: 0.46, h: 0.5 },
      { x: 0.54, y: 0.5, w: 0.46, h: 0.5 },
    ],
    // wide: one big left, two stacked right
    [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62, y: 0, w: 0.38, h: 0.5 },
      { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
    ],
  ],
  4: [
    // square / portrait: 2 x 2
    [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
    // wide: a strip of four
    [
      { x: 0, y: 0, w: 0.25, h: 1 },
      { x: 0.25, y: 0, w: 0.25, h: 1 },
      { x: 0.5, y: 0, w: 0.25, h: 1 },
      { x: 0.75, y: 0, w: 0.25, h: 1 },
    ],
  ],
};

/** The panel rectangles for `count` photos on a canvas `width` x `height` pixels. */
export function panelsFor(count, width, height) {
  const table = ARRANGEMENTS[Math.max(1, Math.min(4, count))] ?? ARRANGEMENTS[1];
  const wide = width > height * 1.15;
  const slots = table[wide && table.length > 1 ? 1 : 0];
  return slots.map((s) => ({ x: s.x * width, y: s.y * height, w: s.w * width, h: s.h * height }));
}

/** Which panel a point falls in, or -1. */
export function panelAt(panels, px, py) {
  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    if (px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h) return i;
  }
  return -1;
}

/**
 * Draws one photo into its panel: cover-crop scaled by `zoom` (1 = the photo covers the panel tightly, 3 = a
 * wider field of view), then shifted by `dx`/`dy` within the slack that leaves, clamped so no edge shows.
 */
export function drawPanelPhoto(ctx, panel, photo, dx = 0, dy = 0, zoom = 1) {
  const { x, y, w, h } = panel;
  const iw = photo.naturalWidth;
  const ih = photo.naturalHeight;
  const scale = Math.max(w / iw, h / ih) * Math.max(1, zoom);
  const dw = iw * scale;
  const dh = ih * scale;
  const slackX = Math.max(0, dw - w) / 2;
  const slackY = Math.max(0, dh - h) / 2;
  const px = x + (w - dw) / 2 - Math.max(-slackX, Math.min(slackX, dx * slackX));
  const py = y + (h - dh) / 2 - Math.max(-slackY, Math.min(slackY, dy * slackY));
  ctx.drawImage(photo, px, py, dw, dh);
}

/** A Vice City sunset wash: violet sky, hot pink-to-orange horizon, stronger toward the foot. */
export function drawSunsetGrade(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, 'rgba(44, 12, 72, 0.40)');
  sky.addColorStop(0.42, 'rgba(255, 86, 128, 0.16)');
  sky.addColorStop(0.70, 'rgba(255, 138, 58, 0.24)');
  sky.addColorStop(1, 'rgba(214, 34, 122, 0.46)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const sun = ctx.createRadialGradient(w * 0.8, h * 0.86, 0, w * 0.8, h * 0.86, h * 0.6);
  sun.addColorStop(0, 'rgba(255, 198, 96, 0.30)');
  sun.addColorStop(1, 'rgba(255, 198, 96, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
}

/** The retro grille: faint horizontal scanlines over the whole cover. */
export function drawScanlines(ctx, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = '#180630';
  const step = Math.max(2, Math.round(h / 340));
  for (let y = 0; y < h; y += step * 2) ctx.fillRect(0, y, w, step);
  ctx.restore();
}

/** A dark scrim rising from the foot, so the caption always reads over a bright photo. */
function drawCaptionScrim(ctx, w, h) {
  const g = ctx.createLinearGradient(0, h * 0.62, 0, h);
  g.addColorStop(0, 'rgba(16, 4, 30, 0)');
  g.addColorStop(0.55, 'rgba(16, 4, 30, 0.34)');
  g.addColorStop(1, 'rgba(12, 2, 24, 0.80)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
}

/** Splits a caption into at most two lines, at the space nearest the middle. */
function wrapTwoLines(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [text];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

/**
 * The caption lettering: giant condensed capitals in cream white, a dark drop shadow, a hot-pink neon halo and
 * a magenta outline, with a letter-spaced tagline under it. Sized to fill the width and to stay inside the cover.
 */
export function drawCaption(ctx, w, h, caption, tagline, withScrim = true) {
  const text = caption.trim().toUpperCase();
  const tag = tagline.trim().toUpperCase();
  if (withScrim) drawCaptionScrim(ctx, w, h);
  const family = "'Arial Narrow', 'Helvetica Neue', Impact, sans-serif";
  const maxWidth = w * 0.88;
  const tagSize = Math.round(Math.min(w, h) * 0.022);
  const tagGap = tag ? tagSize * 1.9 : 0;
  const captionBox = h * 0.30;

  let lines = [];
  let size = 0;
  if (text) {
    // Size a candidate arrangement: the largest letters that keep every line inside 88% of the width and the
    // whole block inside the caption box.
    const fit = (candidate) => {
      let s = h * 0.26;
      for (; s > 8; s -= 2) {
        ctx.font = `900 ${s}px ${family}`;
        const widest = Math.max(...candidate.map((l) => ctx.measureText(l).width));
        if (widest <= maxWidth && candidate.length * s * 1.02 <= captionBox) break;
      }
      return s;
    };
    const one = [text];
    const two = wrapTwoLines(text);
    const sOne = fit(one);
    const sTwo = two.length > 1 ? fit(two) : 0;
    lines = sTwo > sOne ? two : one;
    size = Math.max(sOne, sTwo);
    ctx.font = `900 ${size}px ${family}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${-size * 0.02}px`;
  }

  const lineH = size * 1.02;
  const captionBottom = h * 0.945 - tagGap;
  const cx = w / 2;

  if (text) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    lines.forEach((line, i) => {
      const ly = captionBottom - (lines.length - 1 - i) * lineH;
      // dark cast shadow, offset down-right like a screenprint
      ctx.save();
      ctx.translate(size * 0.035, size * 0.045);
      ctx.fillStyle = 'rgba(10, 2, 22, 0.88)';
      ctx.fillText(line, cx, ly);
      ctx.restore();
      // neon halo
      ctx.save();
      ctx.shadowColor = 'rgba(255, 52, 158, 0.95)';
      ctx.shadowBlur = size * 0.30;
      ctx.fillStyle = '#ff6fc4';
      ctx.fillText(line, cx, ly);
      ctx.restore();
      // cream face
      ctx.fillStyle = '#fff7f0';
      ctx.fillText(line, cx, ly);
      // magenta edge
      ctx.strokeStyle = 'rgba(255, 32, 132, 0.85)';
      ctx.lineWidth = Math.max(1, size * 0.014);
      ctx.strokeText(line, cx, ly);
    });
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  if (tag) {
    const ts = Math.max(9, tagSize);
    ctx.font = `700 ${ts}px Georgia, 'Times New Roman', serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${ts * 0.22}px`;
    ctx.fillStyle = 'rgba(255, 232, 208, 0.95)';
    ctx.shadowColor = 'rgba(6, 2, 14, 0.85)';
    ctx.shadowBlur = ts * 0.6;
    ctx.fillText(tag, cx, h * 0.965);
    ctx.shadowBlur = 0;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
}
