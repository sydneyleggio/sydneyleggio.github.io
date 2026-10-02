// ══════════════════════════════════════════
//  MONTE CARLO HERO — path fan animation
//  Depends on: rng, drawBody (starfield.js)
// ══════════════════════════════════════════
(function () {
  const canvas = document.getElementById('monteCarloCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Layout
  const HIST_W = 80;
  const N_PATHS = 60;
  const STEPS = 120;
  const DT = 1 / 252;

  // Model params
  const MODELS = ['gbm', 'merton', 'levy'];
  let modelIdx = 0;
  let paths = [];
  let histBins = [];
  let tick = 0;
  let rafId = null;
  let running = true;

  function getModel() { return MODELS[modelIdx]; }

  // GBM log-normal increment
  function gbmStep(S, mu, sigma) {
    const z = randn();
    return S * Math.exp((mu - 0.5 * sigma * sigma) * DT + sigma * Math.sqrt(DT) * z);
  }

  // Merton jump-diffusion
  function mertonStep(S, mu, sigma, lambda, jumpMu, jumpSig) {
    const z = randn();
    const diff = S * Math.exp((mu - 0.5 * sigma * sigma) * DT + sigma * Math.sqrt(DT) * z);
    const jumps = poissonDraw(lambda * DT);
    let jFactor = 1;
    for (let j = 0; j < jumps; j++) jFactor *= Math.exp(jumpMu + jumpSig * randn());
    return diff * jFactor;
  }

  // Truncated Levy flight (stable-like heavy tail via sum of randn with variance mixture)
  function levyStep(S, mu, sigma) {
    const alpha = 1.6;
    const u = randn(), v = randn();
    const stable = u / Math.pow(Math.abs(v), 1 / alpha - 1) * 0.08;
    const ret = mu * DT + sigma * Math.sqrt(DT) * stable;
    return S * Math.exp(Math.max(-0.25, Math.min(0.25, ret)));
  }

  function randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function poissonDraw(lam) {
    let L = Math.exp(-lam), k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }

  function generatePaths() {
    paths = [];
    const model = getModel();
    for (let i = 0; i < N_PATHS; i++) {
      const path = [100];
      for (let t = 0; t < STEPS; t++) {
        const S = path[path.length - 1];
        let next;
        if (model === 'gbm') {
          next = gbmStep(S, 0.08, 0.18);
        } else if (model === 'merton') {
          next = mertonStep(S, 0.06, 0.15, 1.2, -0.05, 0.12);
        } else {
          next = levyStep(S, 0.05, 0.12);
        }
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
    // Store range for drawing
    histBins._lo = lo; histBins._hi = hi;
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.min(rect.width, 900);
    canvas.height = Math.max(280, Math.min(360, rect.height || 320));
    generatePaths();
    tick = 0;
  }

  function draw() {
    const W = canvas.width, H = canvas.height;
    const plotW = W - HIST_W - 16;
    const padT = 24, padB = 28, padL = 40;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(8,13,30,0.6)';
    ctx.fillRect(0, 0, W, H);

    // Current step to draw up to
    const step = prefersReduced ? STEPS : Math.min(tick, STEPS);

    // Price range for this frame
    let minP = Infinity, maxP = -Infinity;
    for (const p of paths) {
      for (let t = 0; t <= step; t++) {
        if (p[t] < minP) minP = p[t];
        if (p[t] > maxP) maxP = p[t];
      }
    }
    minP = Math.min(minP * 0.95, 50);
    maxP = maxP * 1.05;

    function xOf(t) { return padL + (t / STEPS) * (plotW - padL); }
    function yOf(v) { return padT + (1 - (v - minP) / (maxP - minP)) * (H - padT - padB); }

    // Grid lines
    ctx.strokeStyle = 'rgba(91,164,245,0.06)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (i / 4) * (H - padT - padB);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(plotW, y); ctx.stroke();
    }

    // Paths
    const model = getModel();
    const pathColor = model === 'gbm' ? [91, 164, 245]
      : model === 'merton' ? [245, 163, 91]
      : [125, 232, 160];

    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      const final = p[Math.min(step, p.length - 1)];
      const t = (final - histBins._lo) / (histBins._hi - histBins._lo);
      const alpha = 0.18 + 0.12 * (i % 5 === 0 ? 1 : 0);
      ctx.beginPath();
      ctx.moveTo(xOf(0), yOf(p[0]));
      for (let s = 1; s <= step && s < p.length; s++) {
        ctx.lineTo(xOf(s), yOf(p[s]));
      }
      ctx.strokeStyle = `rgba(${pathColor[0]},${pathColor[1]},${pathColor[2]},${alpha})`;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }

    // S0 line
    const y100 = yOf(100);
    ctx.beginPath(); ctx.moveTo(padL, y100); ctx.lineTo(plotW, y100);
    ctx.strokeStyle = 'rgba(200,216,255,0.12)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]); ctx.stroke();
    ctx.setLineDash([]);

    // X-axis label
    ctx.fillStyle = 'rgba(90,106,136,0.8)';
    ctx.font = '9px Space Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Time (trading days)', padL + (plotW - padL) / 2, H - 4);

    // Histogram (right edge)
    if (step >= STEPS * 0.3) {
      const frac = Math.min((step - STEPS * 0.3) / (STEPS * 0.7), 1);
      const maxBin = Math.max(...histBins);
      const hX = plotW + 8;
      const lo = histBins._lo, hi = histBins._hi;
      for (let b = 0; b < histBins.length; b++) {
        const t0 = b / histBins.length, t1 = (b + 1) / histBins.length;
        const y0 = padT + (1 - t1) * (H - padT - padB);
        const y1 = padT + (1 - t0) * (H - padT - padB);
        const barW = (histBins[b] / maxBin) * (HIST_W - 12) * frac;
        const alpha = 0.2 + 0.45 * (histBins[b] / maxBin);
        ctx.fillStyle = `rgba(${pathColor[0]},${pathColor[1]},${pathColor[2]},${alpha})`;
        ctx.fillRect(hX, y0, barW, Math.max(y1 - y0 - 1, 1));
      }

      // Gaussian overlay (GBM only)
      if (model === 'gbm' && frac > 0.5) {
        const mu = paths.reduce((s, p) => s + Math.log(p[STEPS] / 100), 0) / N_PATHS;
        const sig2 = paths.reduce((s, p) => s + Math.pow(Math.log(p[STEPS] / 100) - mu, 2), 0) / N_PATHS;
        const sig = Math.sqrt(sig2);
        ctx.beginPath();
        for (let b = 0; b <= histBins.length; b++) {
          const t = b / histBins.length;
          const logS = Math.log(lo + t * (hi - lo));
          const pdf = (1 / (sig * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((logS - Math.log(100) - mu) / sig, 2));
          const barW = pdf * (hi - lo) / histBins.length * N_PATHS * (HIST_W - 12) * 1.2 * (frac - 0.5) * 2;
          const y = padT + (1 - t) * (H - padT - padB);
          if (b === 0) ctx.moveTo(hX + barW, y); else ctx.lineTo(hX + barW, y);
        }
        ctx.strokeStyle = 'rgba(200,220,255,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
      }
    }

    // Model label
    const labelMap = { gbm: 'GBM · Log-normal', merton: 'Merton Jump-Diffusion', levy: 'Levy Flight' };
    ctx.fillStyle = 'rgba(90,106,136,0.9)';
    ctx.font = '8px Space Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(labelMap[model], padL + 4, padT + 10);
  }

  function loop() {
    if (!running) return;
    tick++;
    if (tick > STEPS + 40) { tick = 0; generatePaths(); }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  // IntersectionObserver to pause when offscreen
  const observer = new IntersectionObserver(entries => {
    const visible = entries[0].isIntersecting;
    if (visible && !rafId) { running = true; rafId = requestAnimationFrame(loop); }
    else if (!visible && rafId) { running = false; cancelAnimationFrame(rafId); rafId = null; }
  }, { threshold: 0.1 });
  observer.observe(canvas);

  // Model toggle buttons
  document.querySelectorAll('[data-mc-model]').forEach(btn => {
    btn.addEventListener('click', () => {
      modelIdx = MODELS.indexOf(btn.dataset.mcModel);
      tick = 0;
      generatePaths();
      document.querySelectorAll('[data-mc-model]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  window.addEventListener('resize', () => { resize(); tick = 0; });

  if (prefersReduced) {
    resize();
    draw();
  } else {
    resize();
    running = true;
    rafId = requestAnimationFrame(loop);
  }
})();
