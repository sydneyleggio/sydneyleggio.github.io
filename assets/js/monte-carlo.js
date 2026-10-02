// ══════════════════════════════════════════
//  MONTE CARLO HERO — path fan animation
//  Depends on: rng (starfield.js)
// ══════════════════════════════════════════
(function () {
  const canvas = document.getElementById('monteCarloCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const HIST_W = 80;
  const N_PATHS = 60;
  const STEPS = 120;
  const DT = 1 / 252;

  const MODELS = ['gbm', 'merton', 'levy'];
  let modelIdx = 0;
  let paths = [];
  let histBins = [];
  let tick = 0;
  let rafId = null;
  let running = false;
  let cssW = 0, cssH = 0;

  function getModel() { return MODELS[modelIdx]; }

  function randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function poissonDraw(lam) {
    if (lam <= 0) return 0;
    let L = Math.exp(-lam), k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }

  function gbmStep(S, mu, sigma) {
    return S * Math.exp((mu - 0.5 * sigma * sigma) * DT + sigma * Math.sqrt(DT) * randn());
  }

  function mertonStep(S, mu, sigma, lambda, jumpMu, jumpSig) {
    const diff = gbmStep(S, mu, sigma);
    const jumps = poissonDraw(lambda * DT);
    let jFactor = 1;
    for (let j = 0; j < jumps; j++) jFactor *= Math.exp(jumpMu + jumpSig * randn());
    return diff * jFactor;
  }

  function levyStep(S, mu, sigma) {
    const alpha = 1.6;
    const u = randn(), v = randn();
    const stable = u / Math.pow(Math.abs(v) + 0.001, 1 / alpha - 1) * 0.08;
    const ret = mu * DT + sigma * Math.sqrt(DT) * stable;
    return S * Math.exp(Math.max(-0.18, Math.min(0.18, ret)));
  }

  function generatePaths() {
    paths = [];
    const model = getModel();
    for (let i = 0; i < N_PATHS; i++) {
      const path = [100];
      for (let t = 0; t < STEPS; t++) {
        const S = path[path.length - 1];
        let next;
        if (model === 'gbm') next = gbmStep(S, 0.08, 0.18);
        else if (model === 'merton') next = mertonStep(S, 0.06, 0.15, 1.2, -0.05, 0.12);
        else next = levyStep(S, 0.05, 0.12);
        path.push(Math.max(next, 1));
      }
      paths.push(path);
    }
    buildHistogram();
  }

  function buildHistogram() {
    const finals = paths.map(p => p[p.length - 1]);
    const lo = Math.min(...finals) * 0.95;
    const hi = Math.max(...finals) * 1.05;
    const N_BINS = 28;
    histBins = Array(N_BINS).fill(0);
    for (const v of finals) {
      const b = Math.floor(((v - lo) / (hi - lo)) * N_BINS);
      histBins[Math.min(b, N_BINS - 1)]++;
    }
    histBins._lo = lo; histBins._hi = hi;
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    cssW = Math.min(rect.width || 560, 860);
    cssH = 360;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    generatePaths();
    tick = 0;
  }

  function draw() {
    const W = cssW, H = cssH;
    const plotW = W - HIST_W - 16;
    const padT = 28, padB = 32, padL = 44;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,13,30,0.75)';
    ctx.fillRect(0, 0, W, H);

    const step = Math.min(tick, STEPS);

    let minP = Infinity, maxP = -Infinity;
    for (const p of paths) {
      for (let t = 0; t <= step; t++) {
        if (p[t] < minP) minP = p[t];
        if (p[t] > maxP) maxP = p[t];
      }
    }
    minP = Math.min(minP * 0.95, 60);
    maxP = maxP * 1.05;

    function xOf(t) { return padL + (t / STEPS) * (plotW - padL); }
    function yOf(v) { return padT + (1 - (v - minP) / (maxP - minP)) * (H - padT - padB); }

    // Grid
    ctx.strokeStyle = 'rgba(91,164,245,0.08)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (i / 4) * (H - padT - padB);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(plotW, y); ctx.stroke();
      const val = maxP - (i / 4) * (maxP - minP);
      ctx.fillStyle = 'rgba(90,106,136,0.6)';
      ctx.font = '9px Space Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(0), padL - 4, y + 3);
    }

    const model = getModel();
    const pathColor = model === 'gbm' ? [91, 164, 245]
      : model === 'merton' ? [245, 163, 91]
      : [125, 232, 160];

    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      ctx.beginPath();
      ctx.moveTo(xOf(0), yOf(p[0]));
      for (let s = 1; s <= step && s < p.length; s++) ctx.lineTo(xOf(s), yOf(p[s]));
      ctx.strokeStyle = `rgba(${pathColor[0]},${pathColor[1]},${pathColor[2]},0.25)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // S0 reference line
    ctx.beginPath(); ctx.moveTo(padL, yOf(100)); ctx.lineTo(plotW, yOf(100));
    ctx.strokeStyle = 'rgba(200,216,255,0.12)'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]); ctx.stroke(); ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(90,106,136,0.7)';
    ctx.font = '9px Space Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Time (trading days)', padL + (plotW - padL) / 2, H - 8);

    // Histogram
    if (step >= STEPS * 0.3) {
      const frac = Math.min((step - STEPS * 0.3) / (STEPS * 0.7), 1);
      const maxBin = Math.max(...histBins, 1);
      const hX = plotW + 8;
      for (let b = 0; b < histBins.length; b++) {
        const t0 = b / histBins.length, t1 = (b + 1) / histBins.length;
        const y0 = padT + (1 - t1) * (H - padT - padB);
        const y1 = padT + (1 - t0) * (H - padT - padB);
        const barW = (histBins[b] / maxBin) * (HIST_W - 14) * frac;
        const alpha = 0.2 + 0.5 * (histBins[b] / maxBin);
        ctx.fillStyle = `rgba(${pathColor[0]},${pathColor[1]},${pathColor[2]},${alpha})`;
        ctx.fillRect(hX, y0, barW, Math.max(y1 - y0 - 1, 1));
      }
    }

    const labelMap = { gbm: 'GBM · Log-normal', merton: 'Merton Jump-Diffusion', levy: 'Levy Flight' };
    ctx.fillStyle = `rgba(${pathColor[0]},${pathColor[1]},${pathColor[2]},0.85)`;
    ctx.font = '9px Space Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(labelMap[model], padL + 4, padT + 14);
  }

  let frameCount = 0;
  function loop() {
    if (!running) return;
    frameCount++;
    if (frameCount % 3 === 0) {
      tick++;
      if (tick > STEPS + 60) { tick = 0; generatePaths(); }
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  const observer = new IntersectionObserver(entries => {
    const visible = entries[0].isIntersecting;
    if (visible && !rafId) { running = true; rafId = requestAnimationFrame(loop); }
    else if (!visible && rafId) { running = false; cancelAnimationFrame(rafId); rafId = null; }
  }, { threshold: 0.1 });
  observer.observe(canvas);

  document.querySelectorAll('[data-mc-model]').forEach(btn => {
    btn.addEventListener('click', () => {
      modelIdx = MODELS.indexOf(btn.dataset.mcModel);
      tick = 0; frameCount = 0;
      generatePaths();
      document.querySelectorAll('[data-mc-model]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  window.addEventListener('resize', () => { resize(); });

  resize();
  running = true;
  rafId = requestAnimationFrame(loop);
})();
