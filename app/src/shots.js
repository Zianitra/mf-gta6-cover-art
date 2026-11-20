// Fixed scenes for screenshots, driven by ?shot= and query params:
//   ?shot=editor&panels=N   the full app with N sample photos loaded (default 3)
//   ?shot=cover&panels=N    the exported-style cover alone, body class shot-cover
// `photo0..N-1` pick the samples (samples/<name>.jpg); `caption` and `tagline` set the words.
// window.__shotReady is set once painted.
export async function runShot(shot, query, load) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const n = Math.max(1, Math.min(4, Number(query.get('panels') ?? 3)));
  const names = ['boulevard', 'pier', 'boardwalk', 'neon'];
  const samples = [];
  for (let i = 0; i < n; i++) samples.push(`samples/${query.get(`photo${i}`) ?? names[i % names.length]}.jpg`);
  await load(samples, {
    caption: query.get('caption') ?? 'Sunset Heist',
    tagline: query.get('tagline') ?? 'Welcome to the boulevard',
    offsets: [
      [-0.3, 0.1, 1.15],
      [0.2, -0.2, 1.3],
      [0, 0.3, 1.2],
      [-0.2, 0, 1.1],
    ],
  });
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
