import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ArcadeCanvasProps {
  horizon: number;
  className?: string;
}

interface AmbientParticle {
  kind: 0 | 1 | 2;
  rotated: boolean;
  color: string;
  size: number;
  baseX: number;
  y: number;
  vy: number;
  amp: number;
  freq: number;
  phase: number;
  twinkleSpeed: number;
  baseAlpha: number;
  offsetX: number;
  offsetY: number;
  vx: number;
  vyImpulse: number;
}

interface BurstParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const PARTICLE_COLORS = [
  "#22e4ff",
  "#ff3db8",
  "#ffd23f",
  "#a78bfa",
  "#ffffff",
] as const;
const BURST_COLORS = ["#ffd23f", "#ff3db8", "#22e4ff"] as const;
const MAX_AMBIENT = 70;
const MAX_BURST = 80;
const HORIZONTAL_LINES = 14;

function populateAmbient(
  p: AmbientParticle,
  width: number,
  height: number,
  spawnAtBottom: boolean,
) {
  const kindRoll = Math.random();
  p.kind = kindRoll < 0.5 ? 0 : kindRoll < 0.8 ? 1 : 2;
  p.rotated = Math.random() > 0.5;
  p.color =
    p.kind === 2
      ? "#ffd23f"
      : (PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)] ??
        "#22e4ff");
  p.size = 2 + Math.random() * 2;
  p.baseX = Math.random() * Math.max(1, width);
  p.y = spawnAtBottom
    ? height + 6 + Math.random() * 18
    : Math.random() * Math.max(1, height);
  p.vy = -(12 + Math.random() * 26);
  p.amp = 10 + Math.random() * 16;
  p.freq = 0.4 + Math.random() * 0.7;
  p.phase = Math.random() * Math.PI * 2;
  p.twinkleSpeed = 1.2 + Math.random() * 1.6;
  p.baseAlpha = 0.4 + Math.random() * 0.45;
  p.offsetX = 0;
  p.offsetY = 0;
  p.vx = 0;
  p.vyImpulse = 0;
}

export function ArcadeCanvas({ horizon, className }: ArcadeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let activeAmbientCount = 36;
    let floorGradient: CanvasGradient | null = null;
    let horizonLineGradient: CanvasGradient | null = null;
    let horizonGlowGradient: CanvasGradient | null = null;
    let verticalLineGradient: CanvasGradient | null = null;

    const ambientPool: AmbientParticle[] = Array.from(
      { length: MAX_AMBIENT },
      () => ({
        kind: 0,
        rotated: false,
        color: "#22e4ff",
        size: 3,
        baseX: 0,
        y: 0,
        vy: -20,
        amp: 14,
        freq: 0.6,
        phase: 0,
        twinkleSpeed: 1.5,
        baseAlpha: 0.6,
        offsetX: 0,
        offsetY: 0,
        vx: 0,
        vyImpulse: 0,
      }),
    );

    const burstPool: BurstParticle[] = Array.from(
      { length: MAX_BURST },
      () => ({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 3,
        color: "#ffd23f",
      }),
    );
    let burstHead = 0;

    let initializedParticles = false;
    let phase = 0;
    let pointerNormX = 0;
    let smoothedPointerX = 0;
    let pointerX = -9999;
    let pointerY = -9999;
    let pointerActive = false;

    let rafId: number | null = null;
    let isIntersecting = true;
    let lastTime = 0;

    function rebuildGradients() {
      if (!ctx || width <= 0 || height <= 0) return;
      const horizonY = height * horizon;

      const fg = ctx.createLinearGradient(0, horizonY, 0, height);
      fg.addColorStop(0, "#1a0b3d");
      fg.addColorStop(1, "#07050f");
      floorGradient = fg;

      const hg = ctx.createLinearGradient(0, 0, width, 0);
      hg.addColorStop(0, "rgba(255,61,184,0)");
      hg.addColorStop(0.2, "#ff3db8");
      hg.addColorStop(0.5, "#22e4ff");
      hg.addColorStop(0.8, "#ff3db8");
      hg.addColorStop(1, "rgba(255,61,184,0)");
      horizonLineGradient = hg;

      const hGlow = ctx.createLinearGradient(0, horizonY - 24, 0, horizonY);
      hGlow.addColorStop(0, "rgba(255,61,184,0)");
      hGlow.addColorStop(1, "rgba(255,61,184,0.28)");
      horizonGlowGradient = hGlow;

      const vg = ctx.createLinearGradient(0, horizonY, 0, height);
      vg.addColorStop(0, "rgba(255,61,184,0)");
      vg.addColorStop(1, "rgba(255,61,184,0.55)");
      verticalLineGradient = vg;
    }

    function updateSize() {
      if (!canvas || !host || !ctx) return;
      const rect = host.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.floor(rect.width));
      const nextHeight = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(nextWidth * dpr);
      canvas.height = Math.floor(nextHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const prevWidth = width;
      width = nextWidth;
      height = nextHeight;
      activeAmbientCount = reduce ? 24 : width >= 768 ? 70 : 36;

      rebuildGradients();

      if (!initializedParticles) {
        for (let i = 0; i < MAX_AMBIENT; i++) {
          const item = ambientPool[i];
          if (item) populateAmbient(item, width, height, false);
        }
        initializedParticles = true;
      } else if (prevWidth > 0 && prevWidth !== width) {
        const scaleX = width / prevWidth;
        for (let i = 0; i < MAX_AMBIENT; i++) {
          const item = ambientPool[i];
          if (item) item.baseX *= scaleX;
        }
      }
    }

    function drawFrame(dt: number) {
      if (!ctx || width <= 0 || height <= 0) return;

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, height);

      smoothedPointerX +=
        (pointerNormX - smoothedPointerX) * Math.min(1, dt * 8);
      const horizonY = height * horizon;
      const cx = width * 0.5 + smoothedPointerX * width * 0.04;

      // 1. Opaque synthwave floor
      if (floorGradient) {
        ctx.fillStyle = floorGradient;
        ctx.fillRect(0, horizonY, width, height - horizonY);
      }

      // 2. Horizon glow & crisp horizon line
      if (horizonGlowGradient) {
        ctx.fillStyle = horizonGlowGradient;
        ctx.fillRect(0, horizonY - 24, width, 24);
      }
      if (horizonLineGradient) {
        ctx.fillStyle = horizonLineGradient;
        ctx.fillRect(0, horizonY - 1, width, 2);
      }

      // 3. Perspective vertical pink lines (15 lines)
      if (verticalLineGradient) {
        ctx.strokeStyle = verticalLineGradient;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        for (let j = 0; j < 15; j++) {
          ctx.moveTo(cx, horizonY);
          ctx.lineTo(cx + (j - 7) * width * 0.16, height);
        }
        ctx.stroke();
      }

      // 4. Perspective horizontal cyan lines (14 lines)
      ctx.strokeStyle = "#22e4ff";
      const floorSpan = height - horizonY;
      for (let i = 0; i < HORIZONTAL_LINES; i++) {
        const v = ((i + phase) % HORIZONTAL_LINES) / HORIZONTAL_LINES;
        const y = horizonY + floorSpan * v * v;
        const alpha = 0.15 + 0.85 * v;
        const lw = 0.6 + 1.6 * v;

        ctx.globalAlpha = alpha * 0.2;
        ctx.lineWidth = lw * 3;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        ctx.globalAlpha = alpha;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (!reduce) {
        phase = (phase + dt * 3.2) % HORIZONTAL_LINES;
      }

      // 5. Particles (additive blending)
      ctx.globalCompositeOperation = "lighter";
      const impulseDamping = Math.exp(-4.5 * dt);
      const offsetDamping = Math.exp(-2.2 * dt);

      for (let i = 0; i < activeAmbientCount; i++) {
        const p = ambientPool[i];
        if (!p) continue;

        if (!reduce) {
          p.y += p.vy * dt;
          p.phase += p.freq * dt * Math.PI * 2;
          if (p.y < -12) {
            populateAmbient(p, width, height, true);
          }
        }

        const nominalX = p.baseX + Math.sin(p.phase) * p.amp;
        const px = nominalX + p.offsetX;
        const py = p.y + p.offsetY;

        if (!reduce && pointerActive) {
          const dx = px - pointerX;
          const dy = py - pointerY;
          const distSq = dx * dx + dy * dy;
          if (distSq < 19600 && distSq > 1) {
            const dist = Math.sqrt(distSq);
            const push = (1 - dist / 140) * 260;
            p.vx += (dx / dist) * push * dt;
            p.vyImpulse += (dy / dist) * push * dt;
          }
        }

        if (!reduce) {
          p.offsetX += p.vx * dt;
          p.offsetY += p.vyImpulse * dt;
          p.vx *= impulseDamping;
          p.vyImpulse *= impulseDamping;
          p.offsetX *= offsetDamping;
          p.offsetY *= offsetDamping;
        }

        const twinkle = 0.65 + 0.35 * Math.sin(p.phase * p.twinkleSpeed);
        const alpha = p.baseAlpha * twinkle;
        ctx.fillStyle = p.color;

        if (p.kind === 0) {
          ctx.globalAlpha = alpha;
          if (p.rotated) {
            const r = p.size * 0.75;
            ctx.beginPath();
            ctx.moveTo(px, py - r);
            ctx.lineTo(px + r, py);
            ctx.lineTo(px, py + r);
            ctx.lineTo(px - r, py);
            ctx.closePath();
            ctx.fill();
          } else {
            const half = p.size * 0.5;
            ctx.fillRect(px - half, py - half, p.size, p.size);
          }
        } else if (p.kind === 1) {
          ctx.globalAlpha = alpha;
          const arm = p.size;
          ctx.fillRect(px - arm, py - 0.75, arm * 2, 1.5);
          ctx.fillRect(px - 0.75, py - arm, 1.5, arm * 2);
        } else {
          ctx.globalAlpha = alpha * 0.22;
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 6. Click burst particles
      if (!reduce) {
        for (let i = 0; i < MAX_BURST; i++) {
          const b = burstPool[i];
          if (!b || !b.active) continue;
          b.life += dt;
          if (b.life >= b.maxLife) {
            b.active = false;
            continue;
          }
          b.vy += 260 * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          const lifeRatio = 1 - b.life / b.maxLife;
          ctx.globalAlpha = lifeRatio;
          ctx.fillStyle = b.color;
          const half = b.size * 0.5;
          ctx.fillRect(b.x - half, b.y - half, b.size, b.size);
        }
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    function tick(now: number) {
      if (!isIntersecting || document.hidden) {
        rafId = null;
        return;
      }
      const rawDt = lastTime === 0 ? 1 / 60 : (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 1 / 30);
      drawFrame(dt);
      rafId = window.requestAnimationFrame(tick);
    }

    function syncLoop() {
      if (reduce) {
        drawFrame(0);
        return;
      }
      const shouldRun = isIntersecting && !document.hidden;
      if (shouldRun && rafId === null) {
        lastTime = 0;
        rafId = window.requestAnimationFrame(tick);
      } else if (!shouldRun && rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function onPointerMove(event: PointerEvent) {
      if (!host) return;
      const rect = host.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
      pointerNormX = Math.max(-0.5, Math.min(0.5, pointerX / rect.width - 0.5));
      pointerActive = true;
    }

    function onPointerLeave() {
      pointerActive = false;
      pointerNormX = 0;
    }

    function onPointerDown(event: PointerEvent) {
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const bx = event.clientX - rect.left;
      const by = event.clientY - rect.top;

      for (let i = 0; i < 18; i++) {
        const slot = burstPool[burstHead];
        burstHead = (burstHead + 1) % MAX_BURST;
        if (!slot) continue;
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 140;
        slot.active = true;
        slot.x = bx;
        slot.y = by;
        slot.vx = Math.cos(angle) * speed;
        slot.vy = Math.sin(angle) * speed;
        slot.life = 0;
        slot.maxLife = 0.7 + Math.random() * 0.4;
        slot.size = 3 + Math.random() * 2;
        slot.color =
          BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)] ??
          "#ffd23f";
      }
    }

    function onVisibilityChange() {
      syncLoop();
    }

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
      if (reduce) drawFrame(0);
    });
    resizeObserver.observe(host);

    let intersectionObserver: IntersectionObserver | null = null;
    if (!reduce) {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry) {
            isIntersecting = entry.isIntersecting;
            syncLoop();
          }
        },
        { threshold: 0.02 },
      );
      intersectionObserver.observe(host);

      host.addEventListener("pointermove", onPointerMove, { passive: true });
      host.addEventListener("pointerleave", onPointerLeave, { passive: true });
      host.addEventListener("pointerdown", onPointerDown, { passive: true });
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    syncLoop();

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      if (intersectionObserver) intersectionObserver.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      host.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [horizon, reduce]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none", className)}
    />
  );
}
