const canvas = document.getElementById("bg");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

const particles = Array.from({ length: 70 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: Math.random() * 2 + 1,
  speed: Math.random() * 0.3 + 0.1,
  alpha: Math.random() * 0.6 + 0.3
}));

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const p of particles) {
    const g = ctx.createRadialGradient(
      p.x, p.y, 0,
      p.x, p.y, p.r * 8
    );

    g.addColorStop(0, `rgba(0,204,102,${p.alpha})`);
    g.addColorStop(0.4, `rgba(0,204,102,${p.alpha * 0.4})`);
    g.addColorStop(1, "rgba(0,204,102,0)");

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 8, 0, Math.PI * 2);
    ctx.fill();

    p.y -= p.speed;
    if (p.y < -20) {
      p.y = canvas.height + 20;
      p.x = Math.random() * canvas.width;
    }
  }

  requestAnimationFrame(draw);
}

draw();
