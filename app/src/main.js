// Wires the page: pick a photo, type a caption, choose how many panels and the preview format, drag inside a panel
// to reposition the photo, then export the poster as a PNG at 1080x1080, 1080x1350 or 1920x1080. A `?shot=` query
// sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover, defaultTransforms } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const titleEl = document.getElementById('title');
const taglineEl = document.getElementById('tagline');
const zoomEl = document.getElementById('zoom');
const zoomVal = document.getElementById('zoom-val');
const statusEl = document.getElementById('status');

const FORMAT = {
  square: { w: 1, h: 1 },
  portrait: { w: 4, h: 5 },
  landscape: { w: 16, h: 9 },
};
const EXPORTS = [
  { w: 1080, h: 1080, name: 'cover-1080x1080.png' },
  { w: 1080, h: 1350, name: 'cover-1080x1350.png' },
  { w: 1920, h: 1080, name: 'cover-1920x1080.png' },
];

const state = {
  photo: null,
  title: titleEl.value,
  tagline: taglineEl.value,
  panels: 3,
  format: 'square',
  zoom: Number(zoomEl.value),
  transforms: defaultTransforms(3),
};
let layout = null;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function syncCanvasSize() {
  const cover = document.body.classList.contains('shot-cover');
  if (cover) {
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
  } else {
    const stage = document.querySelector('.stage');
    const availW = Math.max(80, stage.clientWidth - 52);
    const availH = Math.max(80, stage.clientHeight - 52);
    const f = FORMAT[state.format];
    let dw = availW;
    let dh = dw * f.h / f.w;
    if (dh > availH) { dh = availH; dw = dh * f.w / f.h; }
    canvas.style.width = `${Math.floor(dw)}px`;
    canvas.style.height = `${Math.floor(dh)}px`;
  }
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(2, Math.round(rect.width));
  canvas.height = Math.max(2, Math.round(rect.height));
}

function redraw() {
  syncCanvasSize();
  layout = drawCover(canvas, state);
}

function setOn(group, el) {
  for (const b of group) b.classList.toggle('on', b === el);
}

function exportAt(size) {
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off, state);
  off.toBlob((blob) => {
    if (!blob) { statusEl.textContent = 'Export failed.'; return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = size.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    statusEl.textContent = `Saved ${size.name} (${size.w} × ${size.h})`;
  }, 'image/png');
}

// photo
document.getElementById('photo').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    state.photo = await loadImage(URL.createObjectURL(file));
    redraw();
  } catch {
    statusEl.textContent = 'Could not read that image.';
  }
});
async function loadSample(name) {
  try {
    state.photo = await loadImage(`samples/${name}.jpg`);
    redraw();
  } catch {
    statusEl.textContent = 'Sample failed to load.';
  }
}
document.getElementById('sample-pier').addEventListener('click', () => loadSample('pier'));
document.getElementById('sample-boulevard').addEventListener('click', () => loadSample('boulevard'));

// caption
titleEl.addEventListener('input', () => { state.title = titleEl.value; redraw(); });
taglineEl.addEventListener('input', () => { state.tagline = taglineEl.value; redraw(); });

// panels
const panelBtns = [...document.querySelectorAll('[data-panels]')];
panelBtns.forEach((b) => b.addEventListener('click', () => {
  state.panels = Number(b.dataset.panels);
  state.transforms = defaultTransforms(state.panels);
  setOn(panelBtns, b);
  redraw();
}));

// zoom
zoomEl.addEventListener('input', () => {
  state.zoom = Number(zoomEl.value);
  zoomVal.textContent = `${state.zoom.toFixed(2)}×`;
  redraw();
});

// format (preview aspect)
const formatBtns = [...document.querySelectorAll('[data-format]')];
formatBtns.forEach((b) => b.addEventListener('click', () => {
  state.format = b.dataset.format;
  setOn(formatBtns, b);
  redraw();
}));

// export
document.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => exportAt(EXPORTS[Number(b.dataset.export)])));

// drag-to-reposition a panel
function panelAt(evt) {
  if (!layout) return -1;
  const rect = canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  for (let i = 0; i < layout.rects.length; i++) {
    const r = layout.rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}
let dragging = -1;
let lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  dragging = panelAt(e);
  if (dragging < 0) return;
  canvas.setPointerCapture(e.pointerId);
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', (e) => {
  if (dragging < 0) { canvas.style.cursor = panelAt(e) >= 0 ? 'grab' : 'default'; return; }
  const r = layout.rects[dragging];
  const t = state.transforms[dragging];
  t.px = clamp(t.px - ((e.clientX - lastX) / r.w) * 2, -1, 1);
  t.py = clamp(t.py - ((e.clientY - lastY) / r.h) * 2, -1, 1);
  lastX = e.clientX;
  lastY = e.clientY;
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = -1; canvas.style.cursor = 'default'; });
canvas.addEventListener('pointercancel', () => { dragging = -1; });

window.addEventListener('resize', redraw);

// screenshot scenes
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, async (sampleUrl, patch) => {
    state.photo = await loadImage(sampleUrl);
    state.title = patch.title;
    state.tagline = patch.tagline;
    state.panels = patch.panels;
    state.format = patch.format;
    state.transforms = defaultTransforms(state.panels);
    titleEl.value = state.title;
    taglineEl.value = state.tagline;
    setOn(panelBtns, panelBtns.find((b) => Number(b.dataset.panels) === state.panels));
    setOn(formatBtns, formatBtns.find((b) => b.dataset.format === state.format));
    redraw();
  });
} else {
  redraw();
}
