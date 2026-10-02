// ══════════════════════════════════════════
//  RMT VISUALIZATION — Marchenko-Pastur
// ══════════════════════════════════════════
(function () {
  const canvas = document.getElementById('rmtCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

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
      if (Math.random() < mpPdf(lam, Q, lambda_plus, lambda_minus) / pdfMax)
        eigenvalues.push(lam + (Math.random() - 0.5) * 0.015);
    }
    while (eigenvalues.length < N - 1) eigenvalues.push(lambda_minus + Math.random() * 0.08);
    eigenvalues.push(lambda_plus + marketCorr * (N * 0.14 + 1.5));
    eigenvalues.sort((a, b) => a - b);
    return { Q, lambda_plus, lambda_minus };
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const parent = canvas.parentElement;
    cssW = Math.min(parent.offsetWidth || 480, 540);
    cssH = 360;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tick = 0;
  }

  function draw() {
    const W = cssW, H = cssH;
    const padL = 44, padR = 16, padT = 24, padB = 32;
    const plotW = W - padL - padR, plotH = H - padT - padB;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,13,30,0.75)';
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

    ctx.strokeStyle = 'rgba(91,164,245,0.07)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (i / 4) * plotH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    }

    const revealFrac = Math.min(tick / 90, 1);
    const binW = plotW / N_BINS;
    for (let b = 0; b < N_BINS; b++) {
      const ev = xMin + (b + 0.5) / N_BINS * (xMax - xMin);
      const isMarket = ev > lambda_plus;
      const barH = (bins[b] / maxBin) * plotH * revealFrac;
      ctx.fillStyle = isMarket
        ? `rgba(245,163,91,${0.45 + 0.35 * (bins[b] / maxBin)})`
        : `rgba(91,164,245,${0.28 + 0.42 * (bins[b] / maxBin)})`;
      ctx.fillRect(padL + b * binW + 1, padT + plotH - barH, binW - 2, barH);
    }

    const mpFrac = Math.min((tick - 45) / 75, 1);
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
      ctx.strokeStyle = `rgba(125,232,160,${0.8 * mpFrac})`;
      ctx.lineWidth = 2; ctx.stroke();
    }

    const lpX = xPx(lambda_plus);
    ctx.beginPath(); ctx.moveTo(lpX, padT); ctx.lineTo(lpX, padT + plotH);
    ctx.strokeStyle = 'rgba(200,216,255,0.18)'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(90,106,136,0.8)';
    ctx.font = '9px Space Mono, monospace'; ctx.textAlign = 'center';
    ctx.fillText('λ+', lpX, padT - 5);

    if (marketCorr > 0.08) {
      const mktX = xPx(eigenvalues[eigenvalues.length - 1]);
      ctx.fillStyle = 'rgba(245,163,91,0.85)';
      ctx.font = '9px Space Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('market', mktX, padT - 5);
    }

    ctx.fillStyle = 'rgba(90,106,136,0.7)'; ctx.textAlign = 'center';
    ctx.font = '9px Space Mono, monospace';
    ctx.fillText('Eigenvalue', padL + plotW / 2, H - 8);

    ctx.fillStyle = 'rgba(125,232,160,0.75)';
    ctx.fillRect(padL + 4, padT + 8, 18, 2);
    ctx.fillStyle = 'rgba(90,106,136,0.75)'; ctx.textAlign = 'left';
    ctx.font = '9px Space Mono, monospace';
    ctx.fillText('Marchenko-Pastur', padL + 26, padT + 12);

    tick++;
  }

  let frameCount = 0;
  function loop() {
    if (!running) return;
    frameCount++;
    if (frameCount % 2 === 0) draw();
    rafId = requestAnimationFrame(loop);
  }

  const observer = new IntersectionObserver(entries => {
    const visible = entries[0].isIntersecting;
    if (visible && !rafId) { running = true; rafId = requestAnimationFrame(loop); }
    else if (!visible && rafId) { running = false; cancelAnimationFrame(rafId); rafId = null; }
  }, { threshold: 0.1 });
  observer.observe(canvas);

  const slider = document.getElementById('marketCorrSlider');
  if (slider) {
    slider.addEventListener('input', () => {
      marketCorr = parseFloat(slider.value);
      tick = 0;
      computeEigenvalues();
    });
  }

  window.addEventListener('resize', () => { resize(); computeEigenvalues(); });

  resize();
  computeEigenvalues();
  running = true;
  rafId = requestAnimationFrame(loop);
})();
