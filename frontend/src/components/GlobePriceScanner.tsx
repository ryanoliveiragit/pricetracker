"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

// ── Geometry helpers ──────────────────────────────────────────────────────────

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const NUM_DOTS = 1100;
const NUM_PARTICLES = 64;

function fibonacciSphere(n: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const t = GOLDEN * i;
    pts.push([r * Math.cos(t), y, r * Math.sin(t)]);
  }
  return pts;
}

const GLOBE_DOTS = fibonacciSphere(NUM_DOTS);

function rotY(x: number, y: number, z: number, a: number): [number, number, number] {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}
function rotX(x: number, y: number, z: number, a: number): [number, number, number] {
  const c = Math.cos(a), s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}
function project(x: number, y: number, z: number, depth: number, scale: number) {
  const w = depth / (depth + z * 0.55);
  return { sx: x * w * scale, sy: y * w * scale, sz: z };
}

// ── Particles ─────────────────────────────────────────────────────────────────

interface Particle {
  theta: number; phi: number; r: number;
  vTheta: number; vPhi: number; vR: number;
  size: number; alpha: number;
}

function mkParticles(): Particle[] {
  return Array.from({ length: NUM_PARTICLES }, () => ({
    theta: Math.random() * TAU,
    phi: Math.random() * Math.PI,
    r: 1.12 + Math.random() * 0.52,
    vTheta: (Math.random() - 0.5) * 0.005,
    vPhi: (Math.random() - 0.5) * 0.003,
    vR: (Math.random() - 0.5) * 0.0012,
    size: 0.8 + Math.random() * 1.5,
    alpha: 0.3 + Math.random() * 0.65,
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Metrics { latency: number; collected: number; stores: number; uptime: number }

export default function GlobePriceScannerSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  // primary RGB read from CSS var at mount; fallback = orange
  const primaryRGB = useRef<[number, number, number]>([250, 93, 25]);

  const stateRef = useRef({
    rot: 0, tilt: 0.30, scan: 0,
    litDots: new Float32Array(NUM_DOTS),
    particles: mkParticles(),
  });

  const [metrics, setMetrics] = useState<Metrics>({
    latency: 118, collected: 3_241, stores: 23, uptime: 99,
  });
  const [scanPct, setScanPct] = useState(42);

  // Read CSS variable for primary color
  useEffect(() => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--primary-500").trim();
    if (raw) {
      const parts = raw.split(" ").map(Number);
      if (parts.length === 3 && parts.every(isFinite))
        primaryRGB.current = parts as [number, number, number];
    }
  }, []);

  // Animate metrics
  useEffect(() => {
    const iv = setInterval(() => {
      setMetrics(prev => ({
        latency: 72 + Math.floor(Math.random() * 110),
        collected: prev.collected + Math.floor(Math.random() * 14 + 2),
        stores: 23,
        uptime: 99,
      }));
      setScanPct(prev => (prev + (Math.random() > 0.55 ? 1 : 0)) % 100);
    }, 800);
    return () => clearInterval(iv);
  }, []);

  // Canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width || 480;
      canvas.height = rect.height || 480;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.36;
      const depth = 700;
      const st = stateRef.current;
      const [pr, pg, pb] = primaryRGB.current;

      // ── Background ──
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.8);
      bg.addColorStop(0, `rgba(${pr},${pg},${pb},0.06)`);
      bg.addColorStop(0.5, "#0d0d0d");
      bg.addColorStop(1, "#080808");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Advance ──
      st.rot += 0.0030;
      st.scan += 0.012;

      // ── Rings ──
      const rings = [
        { tilt: 0.28,  rF: 1.22, spd: 0.38,  a: 0.22 },
        { tilt: -0.52, rF: 1.14, spd: -0.52, a: 0.16 },
        { tilt: 1.05,  rF: 1.28, spd: 0.18,  a: 0.14 },
      ];
      rings.forEach(ring => {
        const rRot = st.rot * ring.spd;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rRot);
        const rx = ring.rF * R;
        const ry = rx * Math.abs(Math.cos(ring.tilt));
        ctx.strokeStyle = `rgba(${pr},${pg},${pb},${ring.a})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 10]);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, ring.tilt * 0.25, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        // orbiting node
        const nx = Math.cos(rRot * 0.9 + st.rot) * rx;
        const ny = Math.sin(rRot * 0.9 + st.rot) * ry * Math.sign(Math.cos(ring.tilt));
        ctx.fillStyle = `rgba(${pr},${pg},${pb},0.85)`;
        ctx.shadowColor = `rgba(${pr},${pg},${pb},0.7)`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(nx, ny, 2.2, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      });

      // ── Decay lit ──
      for (let i = 0; i < NUM_DOTS; i++) st.litDots[i] *= 0.93;

      // ── Globe dots ──
      type Dot = { sx: number; sy: number; sz: number; bf: number; lit: number };
      const dots: Dot[] = new Array(NUM_DOTS);

      for (let i = 0; i < NUM_DOTS; i++) {
        let [x, y, z] = GLOBE_DOTS[i];
        [x, y, z] = rotY(x, y, z, st.rot);
        [x, y, z] = rotX(x, y, z, st.tilt);
        // scan hit
        const da = Math.atan2(x, z);
        const sn = ((st.scan % TAU) + TAU) % TAU;
        const dn = ((da % TAU) + TAU) % TAU;
        let diff = Math.abs(dn - sn);
        if (diff > Math.PI) diff = TAU - diff;
        if (diff < 0.10) st.litDots[i] = Math.max(st.litDots[i], 1 - diff / 0.10);
        const p = project(x, y, z, depth, R);
        dots[i] = { sx: p.sx, sy: p.sy, sz: p.sz, bf: (z + 1) * 0.5, lit: st.litDots[i] };
      }
      dots.sort((a, b) => a.sz - b.sz);

      for (const d of dots) {
        const lit = d.lit;
        const sz = 0.5 + d.bf * 1.1 + (lit > 0.5 ? 0.7 : 0);
        let alpha: number;
        if (lit > 0.05) {
          // bright: use primary color
          alpha = 0.20 + d.bf * 0.30 + lit * 0.65;
          ctx.fillStyle = `rgba(${pr},${pg},${pb},${alpha.toFixed(2)})`;
          ctx.shadowColor = `rgba(${pr},${pg},${pb},0.85)`;
          ctx.shadowBlur = 3 + lit * 10;
        } else {
          // dim: primary at low opacity
          alpha = 0.05 + d.bf * 0.22;
          ctx.fillStyle = `rgba(${pr},${pg},${pb},${alpha.toFixed(2)})`;
          ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.arc(cx + d.sx, cy + d.sy, Math.max(0.4, sz), 0, TAU);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // ── Scan beam ──
      const bx = Math.cos(st.scan) * R * 0.96;
      const beam = ctx.createLinearGradient(cx + bx - 4, cy - R, cx + bx - 4, cy + R);
      beam.addColorStop(0, "transparent");
      beam.addColorStop(0.3, `rgba(${pr},${pg},${pb},0.07)`);
      beam.addColorStop(0.5, `rgba(${pr},${pg},${pb},0.18)`);
      beam.addColorStop(0.7, `rgba(${pr},${pg},${pb},0.07)`);
      beam.addColorStop(1, "transparent");
      ctx.fillStyle = beam;
      ctx.fillRect(cx + bx - 5, cy - R * 1.05, 10, R * 2.1);

      // ── Particles ──
      for (const p of st.particles) {
        p.theta += p.vTheta; p.phi += p.vPhi; p.r += p.vR;
        if (p.r > 1.65) p.vR = -Math.abs(p.vR);
        if (p.r < 1.1) p.vR = Math.abs(p.vR);
        const sp = Math.sin(p.phi);
        let px = sp * Math.cos(p.theta) * p.r;
        let py = Math.cos(p.phi) * p.r;
        let pz = sp * Math.sin(p.theta) * p.r;
        [px, py, pz] = rotY(px, py, pz, st.rot * 0.22);
        [px, py, pz] = rotX(px, py, pz, st.tilt);
        const pp = project(px, py, pz, depth, R);
        const depA = (pz + 1.65) / 2.65;
        ctx.fillStyle = `rgba(${pr},${pg},${pb},${(p.alpha * depA * 0.75).toFixed(2)})`;
        ctx.shadowColor = `rgba(${pr},${pg},${pb},0.6)`;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(cx + pp.sx, cy + pp.sy, p.size * 0.6, 0, TAU);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // ── Outer halo ──
      const halo = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.5);
      halo.addColorStop(0, `rgba(${pr},${pg},${pb},0.00)`);
      halo.addColorStop(0.5, `rgba(${pr},${pg},${pb},0.045)`);
      halo.addColorStop(1, `rgba(${pr},${pg},${pb},0.00)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.5, 0, TAU);
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);

  // ── Stats for left column ──
  const stats = [
    { label: "Latência média",    value: `${metrics.latency}ms`,                      warn: metrics.latency > 180 },
    { label: "Preços coletados",  value: metrics.collected.toLocaleString("pt-BR"),   warn: false },
    { label: "Lojas monitoradas", value: `${metrics.stores}`,                         warn: false },
    { label: "Disponibilidade",   value: `${metrics.uptime}%`,                        warn: false },
  ];

  return (
    <section className="relative overflow-hidden bg-neutral-950 py-20 lg:py-28">
      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">

          {/* ── Left: copy + stats ── */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--primary-500))]/25 bg-[rgb(var(--primary-500))]/10 px-3.5 py-1.5">
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--primary-500))]"
              />
              <span className="text-xs font-semibold text-[rgb(var(--primary-500))] tracking-wide uppercase">
                Motor de scraping ativo
              </span>
            </div>

            {/* Heading */}
            <div className="space-y-4">
              <h2 className="text-4xl font-bold leading-tight tracking-tight text-white lg:text-5xl">
                Coleta de preços{" "}
                <span className="text-[rgb(var(--primary-500))]">em tempo real</span>
              </h2>
              <p className="text-base text-neutral-400 leading-relaxed max-w-md">
                O Construct Price varre automaticamente dezenas de fornecedores
                simultaneamente, entregando os melhores preços do mercado para
                sua obra sem esforço manual.
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
                >
                  <p className="text-[11px] text-neutral-500 uppercase tracking-widest mb-1">
                    {s.label}
                  </p>
                  <motion.p
                    key={s.value}
                    initial={{ opacity: 0.6 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className={`text-2xl font-bold tabular-nums ${
                      s.warn
                        ? "text-amber-400"
                        : "text-[rgb(var(--primary-500))]"
                    }`}
                  >
                    {s.value}
                  </motion.p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500 uppercase tracking-wider">Varredura global</span>
                <motion.span
                  key={scanPct}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  className="font-semibold tabular-nums text-[rgb(var(--primary-500))]"
                >
                  {scanPct}%
                </motion.span>
              </div>
              <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-[rgb(var(--primary-500))]"
                  animate={{ width: `${scanPct}%` }}
                  transition={{ duration: 0.6 }}
                  style={{ boxShadow: "0 0 10px rgba(var(--primary-500),0.5)" }}
                />
              </div>
            </div>
          </motion.div>

          {/* ── Right: globe canvas ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
          >
            {/* Canvas wrapper */}
            <div className="relative h-[420px] lg:h-[500px] rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800/60">
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

              {/* Globe overlay: top-left label */}
              <div className="absolute top-4 left-4 space-y-0.5">
                <p className="text-[10px] text-neutral-600 uppercase tracking-widest">
                  Construct Price
                </p>
                <div className="flex items-center gap-1.5">
                  <motion.div
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                    className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--primary-500))]"
                  />
                  <span className="text-xs font-medium text-[rgb(var(--primary-500))]">
                    Scraping ativo
                  </span>
                </div>
              </div>

              {/* Globe overlay: top-right elapsed */}
              <motion.div
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="absolute top-4 right-4 text-right"
              >
                <p className="text-[10px] text-neutral-600 uppercase tracking-widest">
                  Latência
                </p>
                <p className="text-sm font-bold tabular-nums text-[rgb(var(--primary-500))]">
                  {metrics.latency}ms
                </p>
              </motion.div>

              {/* Floating store labels */}
              {["Leroy Merlin", "C&C", "Telhanorte", "Quero Quero"].map((store, i) => (
                <motion.div
                  key={store}
                  className="absolute text-[10px] font-medium text-neutral-500 pointer-events-none"
                  style={{
                    top: `${20 + i * 18}%`,
                    right: i % 2 === 0 ? "8px" : undefined,
                    left: i % 2 !== 0 ? "8px" : undefined,
                  }}
                  animate={{ opacity: [0.2, 0.6, 0.2] }}
                  transition={{
                    duration: 2 + i * 0.6,
                    repeat: Infinity,
                    delay: i * 0.8,
                  }}
                >
                  {store}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
