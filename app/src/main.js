// Wires the page: pick photos into up to 4 panels, crop and position each, edit the caption, export PNG.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const caption = document.getElementById('caption');
const tagline = document.getElementById('tagline');
const layout = document.getElementById('layout');
const zoom = document.getElementById('zoom');
const slotsBox = document.getElementById('slots');
const status = document.getElementById('status');

// One slot per panel: { img, dx, dy, zoom }. Start with 3 panels so the cover reads as a poster.
const state = [
  { img: null, dx: 0, dy: 0, zoom: 1 },
  { img: null, dx: 0, dy: 0, zoom: 1 },
  { img: null, dx: 0, dy: 0, zoom: 1 },
];
let selected = 0;

function panelCount() {
  const v = layout.value;
  if (v === 'auto') return 3;
  return Math.max(1, Math.min(4, Number(v)));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function redraw() {
  const count = panelCount();
  while (state.length < count) state.push({ img: null, dx: 0, dy: 0, zoom: 1 });
  drawCover(canvas, state.slice(0, count), caption.value, tagline.value, selected < count ? selected : -1);
  renderSlots(count);
}

/** The per-panel slot buttons: click to select, click the badge to load a photo. */
function renderSlots(count) {
  slotsBox.replaceChildren();
  for (let i = 0; i < count; i++) {
    const row = document.createElement('div');
    row.className = 'slot' + (i === selected ? ' active' : '');
    const label = document.createElement('button');
    label.type = 'button';
    label.textContent = `Panel ${i + 1}${state[i].img ? ' — loaded' : ' — empty'}`;
    label.addEventListener('click', () => {
      selected = i;
      zoom.value = String(state[i].zoom);
      redraw();
    });
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      state[i].img = await loadImage(URL.createObjectURL(f));
      state[i].dx = 0;
      state[i].dy = 0;
      state[i].zoom = 1;
      zoom.value = '1';
      selected = i;
      redraw();
    });
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.textContent = 'Photo…';
    pick.addEventListener('click', () => file.click());
    row.append(label, pick, file);
    slotsBox.append(row);
  }
}

zoom.addEventListener('input', () => {
  state[selected].zoom = Number(zoom.value);
  redraw();
});
document.getElementById('center').addEventListener('click', () => {
  state[selected].dx = 0;
  state[selected].dy = 0;
  state[selected].zoom = 1;
  zoom.value = '1';
  redraw();
});
layout.addEventListener('change', redraw);
caption.addEventListener('input', redraw);
tagline.addEventListener('input', redraw);

// Drag on the preview to reposition the selected panel's photo.
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width * canvas.width;
  const py = (e.clientY - rect.top) / rect.height * canvas.height;
  const count = panelCount();
  const perCol = count === 4 || (count === 2 && canvas.width <= canvas.height * 1.15) ? 2 : count === 3 ? 2 : 1;
  const cols = Math.ceil(count / perCol);
  const col = Math.min(cols - 1, Math.floor(px / (canvas.width / cols)));
  const idx = Math.min(count - 1, col * perCol + Math.min(perCol - 1, Math.floor(py / (canvas.height / perCol))));
  selected = idx;
  zoom.value = String(state[idx].zoom);
  drag = { x: e.clientX, y: e.clientY, dx: state[idx].dx, dy: state[idx].dy };
  redraw();
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  state[selected].dx = drag.dx + (e.clientX - drag.x) / rect.width * 2;
  state[selected].dy = drag.dy + (e.clientY - drag.y) / rect.height * 2;
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });

document.getElementById('export').addEventListener('click', () => {
  const [w, h] = document.getElementById('size').value.split('x').map(Number);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  drawCover(out, state.slice(0, panelCount()), caption.value, tagline.value, -1);
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cover-${w}x${h}.png`;
    a.click();
    status.textContent = `Saved cover-${w}x${h}.png`;
  }, 'image/png');
});

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), async (samples, texts) => {
    const count = samples.length;
    layout.value = String(count);
    while (state.length < count) state.push({ img: null, dx: 0, dy: 0, zoom: 1 });
    for (let i = 0; i < count; i++) {
      state[i].img = await loadImage(samples[i]);
      state[i].dx = texts.offsets?.[i]?.[0] ?? 0;
      state[i].dy = texts.offsets?.[i]?.[1] ?? 0;
      state[i].zoom = texts.offsets?.[i]?.[2] ?? 1;
    }
    caption.value = texts.caption;
    tagline.value = texts.tagline;
    selected = -1;
    redraw();
  });
} else {
  redraw();
}
