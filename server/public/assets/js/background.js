const canvas = document.getElementById("bg");
const ctx = canvas.getContext("2d");

function resize() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
addEventListener("resize", resize);

const rand = (a,b)=>Math.random()*(b-a)+a;

// “Serio”: mais partículas pequenas, poucas médias, quase nada grande
const dots = [
  // poucas médias (bem discretas)
  ...Array.from({ length: 50 }, () => ({ r: rand(8, 14),  a: rand(0.035, 0.07), blur: rand(16, 28), sp: rand(0.08, 0.16) })),
  // muitas pequenas
  ...Array.from({ length: 85 }, () => ({ r: rand(2.2, 5.2), a: rand(0.025, 0.06), blur: rand(8, 16),  sp: rand(0.06, 0.14) })),
  // micro “poeira” bem suave
  ...Array.from({ length: 70 }, () => ({ r: rand(1.2, 2.2), a: rand(0.015, 0.04), blur: rand(4, 10),  sp: rand(0.05, 0.12) })),
].map(d => ({
  ...d,
  x: rand(0, innerWidth),
  y: rand(0, innerHeight),
  vx: rand(-0.04, 0.04),
  vy: -d.sp
}));

function drawVignette(){
  ctx.fillStyle = "#050505";
  ctx.fillRect(0,0,innerWidth,innerHeight);

  // vinheta sutil (seriedade)
  const g = ctx.createRadialGradient(
    innerWidth*0.5, innerHeight*0.4, 120,
    innerWidth*0.5, innerHeight*0.4, Math.max(innerWidth, innerHeight)*0.95
  );
  g.addColorStop(0, "rgba(0,0,0,0.00)");
  g.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,innerWidth,innerHeight);
}

function tick(){
  ctx.clearRect(0,0,innerWidth,innerHeight);
  drawVignette();

  for (const d of dots){
    d.x += d.vx;
    d.y += d.vy;

    if (d.y + d.r < -40) { d.y = innerHeight + 40; d.x = rand(0, innerWidth); }
    if (d.x < -60) d.x = innerWidth + 60;
    if (d.x > innerWidth + 60) d.x = -60;

    ctx.beginPath();
    ctx.fillStyle = `rgba(44,255,122,${d.a})`;
    ctx.shadowColor = "rgba(44,255,122,0.45)";
    ctx.shadowBlur = d.blur;
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  requestAnimationFrame(tick);
}

tick();
