// ══════════════════════════════════════════
//  RMT VISUALIZATION — Marchenko-Pastur
//  Depends on: nothing (self-contained)
// ══════════════════════════════════════════
(function () {
  const canvas = document.getElementById('rmtCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let N = 80, T = 320; // N assets, T observations
  let marketCorr = 0; // 0..1 slider
  let eigenvalues = [];
  let tick = 0;
  let rafId = null;
  let running = true;
  let animPhase = 0; // 0=building, 1=stable

  function randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function computeEigenvalues() {
    // Build N x T random return matrix with optional market factor
    const Q = T / N;
    // We don't do full SVD in JS — instead we simulate eigenvalue distribution
    // analytically: Marchenko-Pastur + market mode separation
    const lambda_plus = Math.pow(1 + 1 / Math.sqrt(Q), 2);
    const lambda_minus = Math.pow(1 - 1 / Math.sqrt(Q), 2);

    // Sample N eigenvalues from Marchenko-Pastur density via rejection sampling
    eigenvalues = [];
    const attempts = N * 20;
    let count = 0;
    const pdfMax = mpPdf(
      (lambda_plus + lambda_minus) / 2,
      Q,
      lambda_plus,
      lambda_minus
    ) * 1.2 + 0.1;

    for (let i = 0; i < attempts && count < N - 1; i++) {
      const lam = lambda_minus + Math.random() * (lambda_plus - lambda_minus + 0.5);
      const p = mpPdf(lam, Q, lambda_plus, lambda_minus) / pdfMax;
      if (Math.random() < p) {
        eigenvalues.push(lam + (Math.random() - 0.5) * 0.02);
        count++;
      }
    }

    // Fill remaining with noise near lambda_minus
    while (eigenvalues.length < N - 1) {
      eigenvalues.push(lambda_minus + Math.random() * 0.1);
    }

    // Market mode eigenvalue: separated by marketCorr
    const marketLambda = lambda_plus + marketCorr * (N * 0.15 + 2);
    eigenvalues.push(marketLambda);
    eigenvalues.sort((a, b) => a - b);

    return { Q, lambda_plus, lambda_minus };
  }

  function mpPdf(lam, Q, lp, lm) {
    if (lam <= lm || lam >= lp) return 0;
    return (Q / (2 * Math.PI)) * Math.sqrt((lp - lam) * (lam - lm)) / lam;
  }

  function resize() {
    const parent = canvas.parentElement;
    canvas.width = Math.min(parent.offsetWidth || 480, 540);
    canvas.height = 320;
    tick = 0;
    animPhase = 0;
  }

  function draw() {
    const W = canvas.width, H = canvas.height;
    const padL = 44, padR = 16, padT = 20, padB = 32;
    const plotW = W - padL - padR, plotH = H - padT - padB;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,13,30,0.6)';
    ctx.fillRect(0, 0, W, H);

    if (eigenvalues.length === 0) return;

    const { Q, lambda_plus, lambda_minus } = computeEigenvalues();

    // Histogram of eigenvalues
    const xMax = Math.max(...eigenvalues) * 1.08;
    const xMin = 0;
    const N_BINS = 30;
    const bins = Array(N_BINS).fill(0);
    for (const ev of eigenvalues) {
      const b = Math.floor(((ev - xMin) / (xMax - xMin)) * N_BINS);
      if (b >= 0 && b < N_BINS) bins[b]++;
    }
    const maxBin = Math.max(...bins, 1);

    function xPx(v) { return padL + ((v - xMin) / (xMax - xMin)) * plotW; }
    function yPx(h) { return padT + plotH - (h / maxBin) * plotH; }

    // Grid
    ctx.strokeStyle = 'rgba(91,164,245,0.06)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (i / 4) * plotH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    }

    // Eigenvalue histogram
    const binW = plotW / N_BINS;
    const revealFrac = prefersReduced ? 1 : Math.min(tick / 60, 1);
    for (let b = 0; b < N_BINS; b++) {
      const x = padL + b * binW;
      const barH = (bins[b] / maxBin) * plotH * revealFrac;
      const ev = xMin + (b + 0.5) / N_BINS * (xMax - xMin);
      const isMarket = ev > lambda_plus;
      const color = isMarket
        ? `rgba(245,163,91,${0.5 + 0.3 * (bins[b] / maxBin)})`
        : `rgba(91,164,245,${0.3 + 0.4 * (bins[b] / maxBin)})`;
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, padT + plotH - barH, binW - 2, barH);
    }

    // Marchenko-Pastur density overlay
    const mpFrac = prefersReduced ? 1 : Math.min((tick - 30) / 60, 1);
    if (mpFrac > 0) {
      ctx.beginPath();
      let started = false;
      for (let px = 0; px <= plotW; px++) {
        const lam = xMin + (px / plotW) * (xMax - xMin);
        const pdf = mpPdf(lam, Q, lambda_plus, lambda_minus);
        const scaledH = pdf * (xMax - xMin) / N_BINS * N * (plotH / maxBin) * 0.95;
        const y = padT + plotH - scaledH * mpFrac;
        if (!started) { ctx.moveTo(padL + px, y); started = true; }
        else ctx.lineTo(padL + px, y);
      }
      ctx.strokeStyle = `rgba(125,232,160,${0.7 * mpFrac})`;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // Lambda+ line
    const lpX = xPx(lambda_plus);
    ctx.beginPath(); ctx.moveTo(lpX, padT); ctx.lineTo(lpX, padT + plotH);
    ctx.strokeStyle = 'rgba(200,216,255,0.18)'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(90,106,136,0.8)';
    ctx.font = '8px Space Mono, monospace'; ctx.textAlign = 'center';
    ctx.fillText('λ+', lpX, padT - 4);

    // Market mode label
    if (marketCorr > 0.1) {
      const mktLam = eigenvalues[eigenvalues.length - 1];
      const mktX = xPx(mktLam);
      ctx.fillStyle = 'rgba(245,163,91,0.8)';
      ctx.font = '8px Space Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('market', mktX, padT - 4);
    }

    // X axis
    ctx.fillStyle = 'rgba(90,106,136,0.7)'; ctx.textAlign = 'center';
    ctx.font = '8px Space Mono, monospace';
    ctx.fillText('Eigenvalue', padL + plotW / 2, H - 6);

    // Legend
    ctx.fillStyle = 'rgba(125,232,160,0.7)';
    ctx.fillRect(padL + 4, padT + 6, 16, 2);
    ctx.fillStyle = 'rgba(90,106,136,0.7)'; ctx.textAlign = 'left';
    ctx.fillText('Marchenko-Pastur', padL + 24, padT + 10);

    tick++;
  }

  function loop() {
    if (!running) return;
    draw();
    rafId = requestAnimationFrame(loop);
  }

  const observer = new IntersectionObserver(entries => {
    const visible = entries[0].isIntersecting;
    if (visible && !rafId) { running = true; rafId = requestAnimationFrame(loop); }
    else if (!visible && rafId) { running = false; cancelAnimationFrame(rafId); rafId = null; }
  }, { threshold: 0.1 });
  observer.observe(canvas);

  // Market correlation slider
  const slider = document.getElementById('marketCorrSlider');
  if (slider) {
    slider.addEventListener('input', () => {
      marketCorr = parseFloat(slider.value);
      tick = 0;
    });
  }

  window.addEventListener('resize', resize);

  resize();
  computeEigenvalues();

  if (prefersReduced) {
    tick = 120;
    draw();
  } else {
    running = true;
    rafId = requestAnimationFrame(loop);
  }
})();
