// Fixed scenes for screenshots: ?shot=cover shows the poster alone, filling the window; ?shot=editor shows the
// full app UI with a sample photo loaded. `photo` picks the sample (samples/<photo>.jpg), `title`/`tagline` the
// caption, `panels` the panel count and `format` the preview aspect. window.__shotReady is set once painted.
export async function runShot(shot, query, apply) {
  const patch = {
    title: query.get('title') ?? 'Sunset Heist',
    tagline: query.get('tagline') ?? 'Palm & Neon',
    panels: clampPanels(Number(query.get('panels') ?? 3)),
    format: query.get('format') ?? 'square',
  };
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await apply(`samples/${query.get('photo') ?? 'pier'}.jpg`, patch);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.dataset.shot = 'ready';
    window.__shotReady = true;
  }));
}

function clampPanels(n) {
  return n >= 2 && n <= 4 ? n : 3;
}
