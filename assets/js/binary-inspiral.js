// ══════════════════════════════════════════
//  BINARY INSPIRAL — standalone (research.html)
//  Extracted from binary-panels.js Panel A
//  Depends on: drawBody (starfield.js)
// ══════════════════════════════════════════
(function () {
  const cA = document.getElementById('binaryA');
  if (!cA) return;
  const ctxA = cA.getContext('2d');

  // DPR scaling for sharpness on retina displays
  const dpr = window.devicePixelRatio || 1;
  const cssW = cA.width, cssH = cA.height;
  cA.style.width = cssW + 'px';
  cA.style.height = cssH + 'px';
  cA.width = Math.round(cssW * dpr);
  cA.height = Math.round(cssH * dpr);
  ctxA.setTransform(dpr, 0, 0, dpr, 0, 0);

  const AW = cssW, AH = cssH, ACX = AW / 2, ACY = AH / 2;
  let angA = 0, tA = 0, runA = true, lastRA = 0;
  const ripA = [];
  let rafId = null;
  let active = true;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  cA.addEventListener('click', () => { runA = !runA; });

  function drawPanelA() {
    const ratioEl = document.getElementById('ratioA');
    const eccEl = document.getElementById('eccA');
    const q = ratioEl ? parseFloat(ratioEl.value) : 3;
    const ecc = eccEl ? parseFloat(eccEl.value) : 0;
    const ct = (tA * 0.0004) % 1;
    const a = 100 + 38 * (1 - ct * 0.5);
    const e2 = 1 - ecc * ecc;
    const r = Math.max(a * e2 / (1 + ecc * Math.cos(angA)), 12);
    const om = 0.013 * (1 + ct * 0.45) * (a * a) / (r * r + 0.5);
    angA += Math.min(om, 0.12); tA++;

    const m1 = q, m2 = 1, tot = m1 + m2;
    const r1 = r * m2 / tot, r2 = r * m1 / tot;
    const x1 = ACX + r1 * Math.cos(angA), y1 = ACY + r1 * Math.sin(angA);
    const x2 = ACX - r2 * Math.cos(angA), y2 = ACY - r2 * Math.sin(angA);

    const periBoost = ecc > 0.1 ? Math.max(0, (a - r) / (a * ecc + 1)) : 0;
    const spawnRate = Math.round(11 / (1 + periBoost * 2.5));
    if (tA - lastRA > spawnRate) { ripA.push({ r: 0, a: 0.6 + periBoost * 0.35, burst: periBoost > 0.6 }); lastRA = tA; }

    ctxA.clearRect(0, 0, AW, AH);
    const bg = ctxA.createRadialGradient(ACX, ACY, 0, ACX, ACY, 220);
    bg.addColorStop(0, 'rgba(10,20,55,0.55)'); bg.addColorStop(1, 'rgba(3,5,15,0)');
    ctxA.fillStyle = bg; ctxA.fillRect(0, 0, AW, AH);

    for (let i = ripA.length - 1; i >= 0; i--) {
      const rp = ripA[i];
      rp.r += rp.burst ? 2.4 : 1.8; rp.a -= rp.burst ? 0.007 : 0.009;
      if (rp.r > 290 || rp.a <= 0) { ripA.splice(i, 1); continue; }
      ctxA.save(); ctxA.translate(ACX, ACY);
      ctxA.beginPath();
      ctxA.ellipse(0, 0, rp.r, rp.r * 0.75, angA * 0.15, 0, Math.PI * 2);
      ctxA.strokeStyle = `rgba(91,164,245,${rp.a * 0.52})`; ctxA.lineWidth = rp.burst ? 1.8 : 1.3; ctxA.stroke();
      ctxA.beginPath();
      ctxA.ellipse(0, 0, rp.r * 0.65, rp.r * 0.52, angA * 0.15 + Math.PI / 4, 0, Math.PI * 2);
      ctxA.strokeStyle = `rgba(125,232,160,${rp.a * 0.2})`; ctxA.lineWidth = 0.8; ctxA.stroke();
      ctxA.restore();
    }

    ctxA.save(); ctxA.translate(ACX, ACY);
    ctxA.beginPath();
    ctxA.ellipse(a * ecc * 0.5, 0, a, a * Math.sqrt(Math.max(e2, 0.05)) * 0.88, 0, 0, Math.PI * 2);
    ctxA.strokeStyle = 'rgba(91,164,245,0.06)'; ctxA.lineWidth = 1; ctxA.stroke();
    ctxA.restore();

    drawBody(ctxA, x1, y1, 4 + 3 * Math.log(m1 + 1), 'rgba(200,225,255,0.95)', 'rgba(91,164,245,0.5)');
    drawBody(ctxA, x2, y2, 4 + 3 * Math.log(m2 + 1), 'rgba(255,210,160,0.95)', 'rgba(245,163,91,0.5)');

    const labelEl = document.getElementById('labelA');
    if (labelEl) {
      labelEl.textContent = ecc > 0.35 ? `Eccentric · e = ${ecc.toFixed(2)} · burst emission`
        : ecc > 0.05 ? `Eccentric · e = ${ecc.toFixed(2)}`
        : 'Quasi-circular inspiral';
    }
  }

  function loop() {
    if (!active) return;
    drawSF();
    if (runA && !prefersReduced) drawPanelA();
    rafId = requestAnimationFrame(loop);
  }

  const observer = new IntersectionObserver(entries => {
    const visible = entries[0].isIntersecting;
    if (visible && !rafId) { active = true; rafId = requestAnimationFrame(loop); }
    else if (!visible && rafId) { active = false; cancelAnimationFrame(rafId); rafId = null; }
  }, { threshold: 0.1 });
  observer.observe(cA);

  if (prefersReduced) {
    drawPanelA();
  } else {
    active = true;
    rafId = requestAnimationFrame(loop);
  }
})();
