(() => {
  const canvas = document.querySelector('#particle-field');
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0, height = 0, spin = 0, pointerX = 0, pointerY = 0, dragging = false, previous = null;
  const points = [];
  const count = 430;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const angle = golden * i;
    points.push({ x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius, phase: Math.random() * Math.PI * 2 });
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width; height = rect.height;
    canvas.width = width * ratio; canvas.height = height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  function draw(time = 0) {
    context.clearRect(0, 0, width, height);
    const cx = width * 0.5, cy = height * 0.48;
    const base = Math.min(width, height) * 0.34;
    const rotY = spin + pointerX * 0.35;
    const rotX = 0.3 + pointerY * 0.3;
    const projected = points.map((point) => {
      const x1 = point.x * Math.cos(rotY) - point.z * Math.sin(rotY);
      const z1 = point.x * Math.sin(rotY) + point.z * Math.cos(rotY);
      const y2 = point.y * Math.cos(rotX) - z1 * Math.sin(rotX);
      const z2 = point.y * Math.sin(rotX) + z1 * Math.cos(rotX);
      const depth = 2.5 / (2.5 - z2 * 0.65);
      return { x: cx + x1 * base * depth, y: cy + y2 * base * depth, z: z2, size: (0.7 + (z2 + 1) * 1.0) * depth, phase: point.phase };
    }).sort((a, b) => a.z - b.z);
    projected.forEach((point, index) => {
      const alpha = 0.3 + ((point.z + 1) / 2) * 0.58;
      const shimmer = reduceMotion ? 1 : 0.76 + Math.sin(time * 0.0012 + point.phase) * 0.22;
      context.beginPath();
      context.arc(point.x, point.y, point.size, 0, Math.PI * 2);
      context.fillStyle = index % 11 === 0 ? `rgba(255,158,115,${alpha * shimmer})` : `rgba(206,190,255,${alpha * shimmer})`;
      context.fill();
      if (index % 10 === 0 && point.z > 0.15) {
        const next = projected[index + 4];
        if (next && Math.hypot(next.x - point.x, next.y - point.y) < 28) {
          context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(next.x, next.y);
          context.strokeStyle = `rgba(194,173,255,${0.1 * alpha})`; context.lineWidth = 0.55; context.stroke();
        }
      }
    });
    if (!reduceMotion) spin += 0.0018;
    if (!reduceMotion) requestAnimationFrame(draw);
  }
  canvas.addEventListener('pointerdown', (event) => { dragging = true; previous = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    if (dragging && previous) { spin += (event.clientX - previous.x) * 0.009; pointerY += (event.clientY - previous.y) * 0.004; previous = { x: event.clientX, y: event.clientY }; }
    else { pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2; pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2; }
  });
  canvas.addEventListener('pointerup', () => { dragging = false; previous = null; });
  canvas.addEventListener('pointercancel', () => { dragging = false; previous = null; });
  window.addEventListener('resize', resize);
  resize(); draw();
})();
