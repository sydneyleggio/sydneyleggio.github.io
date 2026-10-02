// ══════════════════════════════════════════
//  RMT VISUALIZATION — Marchenko-Pastur
// ══════════════════════════════════════════
(function () {
  const canvas = document.getElementById('rmtCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let N = 80, T = 320;
  let marketCorr = 0;
  let eigenvalues = [];
  let tick = 0;
  let rafId = null;
  let running = false;
  let cssW = 0, cssH = 0;

  function mpPdf(lam, Q, lp, lm) {
    if (lam <= lm || lam >= lp) return 0;
    return (Q / (2 * Math.PI)) * Math.sqrt((lp - lam) * (lam - lm)) / lam;
  }

  function computeEigenvalues() {
    const Q = T / N;
    const lambda_plus = Math.pow(1 + 1 / Math.sqrt(Q), 2);
    const lambda_minus = Math.pow(1 - 1 / Math.sqrt(Q), 2);

    eigenvalues = [];
    const pdfMax = mpPdf((lambda_plus + lambda_minus) / 2, Q, lambda_plus, lambda_minus) * 1.25 + 0.05;

    for (let i = 0; i < N * 30 && eigenvalues.length < N - 1; i++) {
      const lam = lambda_minus + Math.random() * (lambda_plus - lambda_minus + 0.3);
      if (Math.random() < mpPdf(lam, Q, lambda_plus, lambda_minus) / pdfMax) {
        eigenvalues.push(lam + (Math.random() - 0.5) * 0.015);
      }
    }
    while (eigenvalues.length < N - 1) eigenvalues.push(lambda_minus + Math.random() * 0.08);

    const marketLambda = lambda_plus + marketCorr * (N * 0.14 + 1.5);
    eigenvalues.push(marketLambda);
    eigenvalues.sort((a, b) => a - b);
    return { Q, lambda_plus, lambda_minus };
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const parent = canvas.parentElement;
    cssW = Math.min(parent.offsetWidth || 480, 540);
    cssH = 320;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tick = 0;
  }

  function draw() {
    const W = cssW, H = cssH;
    const padL = 44, padR = 16, padT = 20, padB = 32;
    const plotW = W - padL - padR, plotH = H - padT - padB;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,13,30,0.7)';
    ctx.fillRect(0, 0, W, H);

    if (eigenvalues.length === 0) return;
    const { Q, lambda_plus, lambda_minus } = computeEigenvalues();

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

    // Grid
    ctx.strokeStyle = 'rgba(91,164,245,0.06)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (i / 4) * plotH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    }

    const revealFrac = prefersReduced ? 1 : Math.min(tick / 90, 1);
    const binW = plotW / N_BINS;
    for (let b = 0; b < N_BINS; b++) {
      const ev = xMin + (b + 0.5) / N_BINS * (xMax - xMin);
      const isMarket = ev > lambda_plus;
      const barH = (bins[b] / maxBin) * plotH * revealFrac;
      const y0 = padT + plotH - barH;
      ctx.fillStyle = isMarket
        ? `rgba(245,163,91,${0.45 + 0.35 * (bins[b] / maxBin)})`
        : `rgba(91,164,245,${0.28 + 0.42 * (bins[b] / maxBin)})`;
      ctx.fillRect(padL + b * binW + 1, y0, binW - 2, barH);
    }

    // MP density overlay
    const mpFrac = prefersReduced ? 1 : Math.min((tick - 45) / 75, 1);
    if (mpFrac > 0) {
      ctx.beginPath();
      let started = false;
      for (let px = 0; px <= plotW; px++) {
        const lam = xMin + (px / plotW) * (xMax - xMin);
        const pdf = mpPdf(lam, Q, lambda_plus, lambda_minus);
        const scaledH = pdf * (xMax - xMin) / N_BINS * N * (plotH / maxBin) * 0.92;
        const y = padT + plotH - scaledH * mpFrac;
        if (!started) { ctx.moveTo(padL + px, y); started = true; }
        else ctx.lineTo(padL + px, y);
      }
      ctx.strokeStyle = `rgba(125,232,160,${0.75 * mpFrac})`;
      ctx.lineWidth = 1.8; ctx.stroke();
    }

    // Lambda+ line
    const lpX = xPx(lambda_plus);
    ctx.beginPath(); ctx.moveTo(lpX, padT); ctx.lineTo(lpX, padT + plotH);
    ctx.strokeStyle = 'rgba(200,216,255,0.15)'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(90,106,136,0.75)';
    ctx.font = '8px Space Mono, monospace'; ctx.textAlign = 'center';
    ctx.fillText('λ+', lpX, padT - 4);

    if (marketCorr > 0.08) {
      const mktX = xPx(eigenvalues[eigenvalues.length - 1]);
      ctx.fillStyle = 'rgba(245,163,91,0.8)';
      ctx.font = '8px Space Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('market', mktX, padT - 4);
    }

    ctx.fillStyle = 'rgba(90,106,136,0.65)'; ctx.textAlign = 'center';
    ctx.font = '8px Space Mono, monospace';
    ctx.fillText('Eigenvalue', padL + plotW / 2, H - 6);

    ctx.fillStyle = 'rgba(125,232,160,0.7)';
    ctx.fillRect(padL + 4, padT + 6, 16, 2);
    ctx.fillStyle = 'rgba(90,106,136,0.7)'; ctx.textAlign = 'left';
    ctx.font = '8px Space Mono, monospace';
    ctx.fillText('Marchenko-Pastur', padL + 24, padT + 10);

    tick++;
  }

  // Slow loop: rebuild eigenvalues every ~4s
  let frameCount = 0;
  function loop() {
    if (!running) return;
    frameCount++;
    // Redraw every 2 frames to keep it smooth but not wasteful
    if (frameCount % 2 === 0) draw();
    rafId = requestAnimationFrame(loop);
  }

  const observer = new IntersectionObserver(entries => {
    const visible = entries[0].isIntersecting;
    if (visible && !rafId && !prefersReduced) {
      running = true; rafId = requestAnimationFrame(loop);
    } else if (!visible && rafId) {
      running = false; cancelAnimationFrame(rafId); rafId = null;
    }
  }, { threshold: 0.1 });
  observer.observe(canvas);

  const slider = document.getElementById('marketCorrSlider');
  if (slider) {
    slider.addEventListener('input', () => {
      marketCorr = parseFloat(slider.value);
      tick = 0;
      computeEigenvalues();
      if (prefersReduced) draw();
    });
  }

  window.addEventListener('resize', () => { resize(); computeEigenvalues(); if (prefersReduced) draw(); });

  resize();
  computeEigenvalues();

  if (prefersReduced) {
    tick = 200;
    draw();
  } else {
    running = true;
    rafId = requestAnimationFrame(loop);
  }
})();
