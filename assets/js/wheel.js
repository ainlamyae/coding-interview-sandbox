/* Wheel of challenges: spins and stops on `target`, then resolves. */
function spinWheel(canvas, labels, target, ms) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width, c = size / 2, r = c - 6;
  const n = labels.length, seg = (Math.PI * 2) / n;
  const colors = ["#ffa116", "#2cbb5d", "#3b82f6", "#a855f7", "#ef4743", "#14b8a6"];
  // stop inside the target segment, a little off-centre so it looks natural
  const jitter = (Math.random() - 0.5) * seg * 0.6;
  const final = -Math.PI / 2 - (target + 0.5) * seg + jitter + Math.PI * 2 * 6;
  const fontPx = Math.max(11, Math.min(18, Math.floor(r * seg * 0.45)));

  function draw(rot) {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(rot);
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, i * seg, (i + 1) * seg);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.rotate((i + 0.5) * seg);
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${fontPx}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      let text = labels[i];
      while (text.length > 3 && ctx.measureText(text).width > r - 40) text = text.slice(0, -2);
      if (text !== labels[i]) text += "…";
      ctx.fillText(text, r - 16, 0);
      ctx.restore();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(c, c, 22, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a1a";
    ctx.fill();
  }

  return new Promise((resolve) => {
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    (function frame(now) {
      const t = Math.min(1, (now - t0) / ms);
      draw(final * ease(t));
      if (t < 1) requestAnimationFrame(frame); else resolve();
    })(t0);
  });
}
