// The cover renderer: a neon sunset poster in the spirit of a Grand-Theft-Auto-style box cover, drawn entirely from
// scratch on a 2D canvas at whatever size the canvas is. A photo and a caption become a multi-panel poster: the
// photo is cropped into 2-4 panels (each with its own pan and zoom), colour-graded with a hot pink/orange sunset
// tint, and set over a slatted sunset sun, palm-tree silhouettes and neon accents, with the caption in big block
// lettering. No Rockstar artwork, logos or fonts are used anywhere.
//
// drawCover(canvas, state) draws onto `canvas` (any width/height; the layout adapts to its aspect ratio) and returns
// the panel rectangles in canvas pixels, so the caller can map pointer drags onto panels.
//
// state = {
//   photo: Image | null,
//   title: string,            // the big caption
//   tagline: string,          // a small neon line under the title
//   panels: 2 | 3 | 4,
//   zoom: number,             // global crop zoom, >= 1
//   transforms: [{px, py, zoom}],  // per panel: pan x/y in -1..1, plus its own zoom
// }

const C = {
  skyTop: '#15052e',
  skyMid: '#4a0f66',
  skyLow: '#b81f74',
  skyHot: '#ff7a3c',
  ink: '#12061f',
  sunTop: '#ffd34d',
  sunLow: '#ff2b6e',
  cyan: '#2ee8ff',
  magenta: '#ff2bd6',
};

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function hexRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function lerpColor(a, b, t) {
  const pa = hexRgb(a), pb = hexRgb(b);
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)},${Math.round(pa[1] + (pb[1] - pa[1]) * t)},${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`;
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** The default per-panel crop offsets: each panel shows a different slice of the photo. */
export function defaultTransforms(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (n === 4) {
      const row = Math.floor(i / 2), col = i % 2;
      out.push({ px: col === 0 ? -0.7 : 0.7, py: row === 0 ? -0.6 : 0.6, zoom: 1 });
    } else if (n === 3) {
      out.push({ px: (i - 1) * 0.95, py: i === 1 ? -0.4 : 0.3, zoom: 1 });
    } else {
      out.push({ px: i === 0 ? -0.6 : 0.6, py: i === 0 ? -0.3 : 0.3, zoom: 1 });
    }
  }
  return out;
}

export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const p = clamp(state.panels | 0, 2, 4);
  const transforms = state.transforms && state.transforms.length === p ? state.transforms : defaultTransforms(p);
  const lay = layout(w, h, p);

  paintSky(ctx, w, h);
  drawPalms(ctx, w, h);
  const sun = sunOf(w, h, lay);
  drawSunGlow(ctx, sun);
  drawRays(ctx, sun, w, h);
  drawSun(ctx, sun);

  const photo = state.photo || null;
  const zoom = state.zoom || 1;
  lay.rects.forEach((r, i) => {
    const t = transforms[i] || { px: 0, py: 0, zoom: 1 };
    drawPanel(ctx, photo, r, t, zoom);
  });

  drawTitleBlock(ctx, lay.titleRect, state.title, state.tagline);
  vignette(ctx, w, h);
  scanlines(ctx, w, h);
  return lay;
}

// ---------------------------------------------------------------- layout

function layout(w, h, panels) {
  const m = Math.round(Math.max(w, h) * 0.045);
  const landscape = w > h * 1.25;
  let panelsRect, titleRect;
  if (landscape) {
    const pw = Math.round(w * 0.60);
    panelsRect = { x: m, y: m, w: pw - m - Math.round(m * 0.5), h: h - 2 * m };
    titleRect = { x: pw + Math.round(m * 0.5), y: m, w: w - pw - m - Math.round(m * 0.5), h: h - 2 * m };
  } else {
    const ph = Math.round(h * 0.5);
    panelsRect = { x: m, y: m, w: w - 2 * m, h: ph - m };
    titleRect = { x: m, y: m + ph + Math.round(h * 0.02), w: w - 2 * m, h: h - m - (m + ph) - Math.round(h * 0.06) };
  }
  const gap = Math.max(6, Math.round(Math.min(panelsRect.w, panelsRect.h) * 0.035));
  const rects = [];
  if (panels === 4) {
    const cw = (panelsRect.w - gap) / 2;
    const ch = (panelsRect.h - gap) / 2;
    rects.push({ x: panelsRect.x, y: panelsRect.y, w: cw, h: ch });
    rects.push({ x: panelsRect.x + cw + gap, y: panelsRect.y, w: cw, h: ch });
    rects.push({ x: panelsRect.x, y: panelsRect.y + ch + gap, w: cw, h: ch });
    rects.push({ x: panelsRect.x + cw + gap, y: panelsRect.y + ch + gap, w: cw, h: ch });
  } else {
    const cw = (panelsRect.w - gap * (panels - 1)) / panels;
    for (let i = 0; i < panels; i++) rects.push({ x: panelsRect.x + i * (cw + gap), y: panelsRect.y, w: cw, h: panelsRect.h });
  }
  return { panelsRect, titleRect, rects, landscape, m };
}

function sunOf(w, h, lay) {
  if (lay.landscape) {
    const r = Math.min(lay.titleRect.w, lay.titleRect.h) * 0.46;
    return { cx: lay.titleRect.x + lay.titleRect.w / 2, cy: lay.titleRect.y + lay.titleRect.h * 0.34, r };
  }
  const r = Math.min(w * 0.4, h * 0.24);
  return { cx: w / 2, cy: lay.titleRect.y + lay.titleRect.h * 0.30, r };
}

// ---------------------------------------------------------------- sky, sun, palms

function paintSky(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, C.skyTop);
  g.addColorStop(0.42, C.skyMid);
  g.addColorStop(0.74, C.skyLow);
  g.addColorStop(1, C.skyHot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawSunGlow(ctx, sun) {
  const g = ctx.createRadialGradient(sun.cx, sun.cy, sun.r * 0.6, sun.cx, sun.cy, sun.r * 2.1);
  g.addColorStop(0, 'rgba(255,140,90,0.55)');
  g.addColorStop(0.6, 'rgba(255,60,140,0.18)');
  g.addColorStop(1, 'rgba(255,60,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(sun.cx - sun.r * 2.1, sun.cy - sun.r * 2.1, sun.r * 4.2, sun.r * 4.2);
}

function drawRays(ctx, sun, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = Math.max(1, w * 0.0015);
  const n = 24;
  const maxR = Math.hypot(w, h);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.05;
    ctx.beginPath();
    ctx.moveTo(sun.cx + Math.cos(a) * sun.r, sun.cy + Math.sin(a) * sun.r);
    ctx.lineTo(sun.cx + Math.cos(a) * maxR, sun.cy + Math.sin(a) * maxR);
    ctx.stroke();
  }
  ctx.restore();
}

/** The slatted 80s sunset sun: a disc of horizontal bars shading yellow to hot pink. */
function drawSun(ctx, sun) {
  const { cx, cy, r } = sun;
  const bands = 18;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const y0 = cy - r + (2 * r) * t;
    const bandH = (2 * r) / bands;
    const midY = y0 + bandH / 2 - cy;
    const halfW = r * Math.sqrt(Math.max(0, 1 - (midY / r) * (midY / r)));
    if (halfW < 1) continue;
    ctx.fillStyle = lerpColor(C.sunTop, C.sunLow, t);
    const inset = Math.max(1, bandH * 0.16);
    rr(ctx, cx - halfW, y0 + inset, halfW * 2, bandH - inset * 2, 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPalms(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = C.ink;
  ctx.strokeStyle = C.ink;
  ctx.lineCap = 'round';
  palm(ctx, w * 0.03, h * 1.02, h * 0.5, false);
  palm(ctx, w * 0.97, h * 0.99, h * 0.44, true);
  if (w > h * 1.25) palm(ctx, w * 0.60, h * 1.02, h * 0.6, true);
  ctx.restore();
}

function palm(ctx, x, y, s, flip) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.scale(s, s);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(12, -70, -4, -150);
  ctx.stroke();
  const tx = -4, ty = -150;
  const fronds = 8;
  for (let i = 0; i < fronds; i++) {
    const a = -Math.PI * 0.92 + (i / (fronds - 1)) * Math.PI * 0.84;
    const L = 88 - (i % 3) * 6;
    const ex = tx + Math.cos(a) * L;
    const ey = ty + Math.sin(a) * L;
    const cx2 = tx + Math.cos(a) * L * 0.55;
    const cy2 = ty + Math.sin(a) * L * 0.55 + 26;
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(cx2, cy2, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- panels

function drawPanel(ctx, photo, r, t, zoom) {
  const z = t.zoom * zoom;
  ctx.save();
  const sh = Math.max(3, r.w * 0.02);
  ctx.fillStyle = 'rgba(8,0,20,0.5)';
  ctx.fillRect(r.x + sh, r.y + sh, r.w, r.h);
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  if (photo) {
    const s = Math.max(r.w / photo.naturalWidth, r.h / photo.naturalHeight) * z;
    const dw = photo.naturalWidth * s;
    const dh = photo.naturalHeight * s;
    const spanX = Math.max(0, dw - r.w);
    const spanY = Math.max(0, dh - r.h);
    const dx = r.x - spanX / 2 - (spanX / 2) * t.px;
    const dy = r.y - spanY / 2 - (spanY / 2) * t.py;
    ctx.drawImage(photo, dx, dy, dw, dh);
    grade(ctx, r);
  } else {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, '#2a0f4d');
    g.addColorStop(1, '#571244');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.max(12, Math.round(Math.min(r.w, r.h) * 0.1))}px system-ui, sans-serif`;
    ctx.fillText('ADD A PHOTO', r.x + r.w / 2, r.y + r.h / 2);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(2, Math.round(r.w * 0.008));
  ctx.strokeRect(r.x + ctx.lineWidth / 2, r.y + ctx.lineWidth / 2, r.w - ctx.lineWidth, r.h - ctx.lineWidth);
}

/** The Vice sunset / neon grade: a pink-to-orange overlay, then a deep vignette. */
function grade(ctx, r) {
  const { x, y, w, h } = r;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(120,30,160,0.6)');
  g.addColorStop(0.55, 'rgba(255,40,130,0.35)');
  g.addColorStop(1, 'rgba(255,150,60,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  const v = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.25, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,0,30,0.6)');
  ctx.fillStyle = v;
  ctx.fillRect(x, y, w, h);
}

// ---------------------------------------------------------------- title

function titleFont(s) { return `900 ${s}px system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, 'Noto Sans', sans-serif`; }
function tagFont(s) { return `700 ${s}px system-ui, -apple-system, 'Segoe UI', sans-serif`; }

function titleLines(text) {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const word of words) {
    if (cur && (cur + ' ' + word).length > 15) { lines.push(cur); cur = word; }
    else cur = cur ? cur + ' ' + word : word;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function drawTitleText(ctx, text, x, y, s) {
  ctx.font = titleFont(s);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.fillStyle = C.magenta;
  ctx.fillText(text, x + s * 0.05, y + s * 0.07);
  ctx.fillStyle = C.cyan;
  ctx.fillText(text, x - s * 0.04, y + s * 0.02);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = s * 0.16;
  ctx.strokeText(text, x, y);
  const g = ctx.createLinearGradient(0, y - s, 0, y + s * 0.12);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#ffd9a0');
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
}

function drawTagline(ctx, text, x, y, s) {
  ctx.font = tagFont(s);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.cyan;
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = s * 0.5;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0.14em';
  ctx.fillText(text, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.shadowBlur = 0;
}

function drawTitleBlock(ctx, r, title, tagline) {
  const cx = r.x + r.w / 2;
  const lines = titleLines((title || '').trim().toUpperCase());
  const hasTag = !!(tagline && tagline.trim());
  const maxW = r.w * 0.94;
  let s = Math.min(r.h * 0.30, r.w * 0.18);
  ctx.font = titleFont(s);
  let widest = 0;
  for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width);
  while (widest > maxW && s > 10) {
    s -= 2;
    ctx.font = titleFont(s);
    widest = 0;
    for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width);
  }
  const lh = s * 1.05;
  const titleH = lh * lines.length;
  const tagS = Math.min(s * 0.32, r.h * 0.1);
  const tagH = hasTag ? tagS * 1.6 : 0;
  const totalH = titleH + tagH + (hasTag ? r.h * 0.03 : 0);
  let y = r.y + (r.h - totalH) / 2 + s * 0.92;
  for (const line of lines) { drawTitleText(ctx, line, cx, y, s); y += lh; }
  if (hasTag) {
    y += r.h * 0.03;
    drawTagline(ctx, tagline.trim().toUpperCase(), cx, y, tagS);
  }
}

// ---------------------------------------------------------------- finish

function vignette(ctx, w, h) {
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(8,0,20,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function scanlines(ctx, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  const step = Math.max(3, Math.round(h / 480));
  for (let y = 0; y < h; y += step * 2) ctx.fillRect(0, y, w, step);
}
