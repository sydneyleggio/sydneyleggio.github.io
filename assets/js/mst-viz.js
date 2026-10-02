// ══════════════════════════════════════════
//  MST NETWORK VISUALIZATION
//  Reads: data/mst_crash.json
//  Animates rolling snapshots through 2020 crash
// ══════════════════════════════════════════
(function () {
  const canvas = document.getElementById('mstCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dateLabel = document.getElementById('mstDate');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let data = null;
  let nodePos = {};
  let snapshotIdx = 0;
  let rafId = null;
  let running = true;
  let frameTick = 0;
  const FRAMES_PER_SNAPSHOT = prefersReduced ? 1 : 38;

  function resize() {
    const parent = canvas.parentElement;
    canvas.width = Math.min(parent.offsetWidth || 540, 600);
    canvas.height = 340;
    if (data) layoutNodes();
  }

  function layoutNodes() {
    const W = canvas.width, H = canvas.height;
    const nodes = data.nodes;
    const n = nodes.length;
    // Force-directed-lite: place on circle, weight by centrality
    const cx = W / 2, cy = H / 2;
    const baseR = Math.min(W, H) * 0.38;
    nodes.forEach((node, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const r = baseR * (0.6 + 0.4 * (1 - node.centrality));
      nodePos[node.id] = {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        centrality: node.centrality
      };
    });
    // Anchor high-centrality nodes closer to center
    nodes.forEach(node => {
      const pos = nodePos[node.id];
      pos.x = pos.x * (1 - node.centrality * 0.25) + cx * node.centrality * 0.25;
      pos.y = pos.y * (1 - node.centrality * 0.25) + cy * node.centrality * 0.25;
    });
  }

  function edgeColor(dist) {
    // Low distance = high correlation = warmer color
    if (dist < 0.6) return 'rgba(125,232,160,0.65)';
    if (dist < 0.9) return 'rgba(91,164,245,0.50)';
    return 'rgba(245,163,91,0.40)';
  }

  function draw() {
    if (!data) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,13,30,0.6)';
    ctx.fillRect(0, 0, W, H);

    const snap = data.snapshots[snapshotIdx];
    if (!snap) return;

    // Edges
    for (const edge of snap.edges) {
      const a = nodePos[edge.source], b = nodePos[edge.target];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = edgeColor(edge.distance);
      ctx.lineWidth = Math.max(0.6, (1.2 - edge.distance) * 2.5);
      ctx.stroke();
    }

    // Compute degree in this snapshot
    const degree = {};
    for (const edge of snap.edges) {
      degree[edge.source] = (degree[edge.source] || 0) + 1;
      degree[edge.target] = (degree[edge.target] || 0) + 1;
    }
    const maxDeg = Math.max(...Object.values(degree), 1);

    // Nodes
    for (const [id, pos] of Object.entries(nodePos)) {
      const deg = degree[id] || 0;
      const r = 3 + (deg / maxDeg) * 5;
      const alpha = 0.55 + (deg / maxDeg) * 0.4;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(91,164,245,${alpha})`;
      ctx.fill();

      // Label for high-degree nodes
      if (deg >= maxDeg * 0.6) {
        ctx.fillStyle = 'rgba(200,216,255,0.85)';
        ctx.font = `bold 7px Space Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(id, pos.x, pos.y - r - 3);
      }
    }

    // Date label
    if (dateLabel) dateLabel.textContent = snap.date;

    // Legend
    ctx.font = '7px Space Mono, monospace'; ctx.textAlign = 'left';
    const legend = [
      ['rgba(125,232,160,0.65)', 'High corr (d<0.6)'],
      ['rgba(91,164,245,0.50)', 'Med corr'],
      ['rgba(245,163,91,0.40)', 'Low corr'],
    ];
    legend.forEach(([color, label], i) => {
      ctx.fillStyle = color;
      ctx.fillRect(10, 10 + i * 14, 12, 3);
      ctx.fillStyle = 'rgba(90,106,136,0.8)';
      ctx.fillText(label, 26, 13 + i * 14);
    });
  }

  function loop() {
    if (!running || !data) return;
    frameTick++;
    if (frameTick >= FRAMES_PER_SNAPSHOT) {
      frameTick = 0;
      snapshotIdx = (snapshotIdx + 1) % data.snapshots.length;
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  const observer = new IntersectionObserver(entries => {
    const visible = entries[0].isIntersecting;
    if (visible && !rafId && data) { running = true; rafId = requestAnimationFrame(loop); }
    else if (!visible && rafId) { running = false; cancelAnimationFrame(rafId); rafId = null; }
  }, { threshold: 0.1 });
  observer.observe(canvas);

  // Load data
  fetch('data/mst_crash.json')
    .then(r => r.json())
    .then(d => {
      data = d;
      resize();
      if (prefersReduced) { draw(); }
      else { running = true; rafId = requestAnimationFrame(loop); }
    })
    .catch(() => {
      ctx.fillStyle = 'rgba(90,106,136,0.6)';
      ctx.font = '9px Space Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MST data unavailable', canvas.width / 2, canvas.height / 2);
    });

  window.addEventListener('resize', () => { resize(); draw(); });
})();
