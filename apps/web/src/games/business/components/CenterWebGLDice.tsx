import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export interface CenterDiceRollTrigger {
  rollId: string;
  value: number; // 1..6
  fromSide: "left" | "right";
  rollerName: string;
  rollerColor: string;
  isBonus: boolean;
  sentToJail: boolean;
}

interface CenterWebGLDiceProps {
  trigger: CenterDiceRollTrigger | null;
}

function createDiceFaceCanvas(value: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const grad = ctx.createRadialGradient(118, 114, 16, 128, 128, 170);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.75, "#f8fafc");
  grad.addColorStop(1, "#e2e8f0");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
  ctx.strokeRect(4, 4, 248, 248);

  const isAccent = value === 1 || value === 6;
  const pipColor = isAccent ? "#ef4444" : "#1e293b";
  const pipHighlight = isAccent ? "#fca5a5" : "#64748b";
  const pipRadius = value === 1 ? 35 : 22;

  const drawPip = (x: number, y: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y + 2, pipRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15, 23, 42, 0.14)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, pipRadius, 0, Math.PI * 2);
    ctx.fillStyle = pipColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(
      x - pipRadius * 0.3,
      y - pipRadius * 0.3,
      pipRadius * 0.32,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = pipHighlight;
    ctx.fill();
    ctx.restore();
  };

  const c = 128;
  const lo = 66;
  const hi = 190;

  switch (value) {
    case 1:
      drawPip(c, c);
      break;
    case 2:
      drawPip(lo, lo);
      drawPip(hi, hi);
      break;
    case 3:
      drawPip(lo, lo);
      drawPip(c, c);
      drawPip(hi, hi);
      break;
    case 4:
      drawPip(lo, lo);
      drawPip(hi, lo);
      drawPip(lo, hi);
      drawPip(hi, hi);
      break;
    case 5:
      drawPip(lo, lo);
      drawPip(hi, lo);
      drawPip(c, c);
      drawPip(lo, hi);
      drawPip(hi, hi);
      break;
    case 6:
      drawPip(lo, lo);
      drawPip(hi, lo);
      drawPip(lo, c);
      drawPip(hi, c);
      drawPip(lo, hi);
      drawPip(hi, hi);
      break;
  }

  return canvas;
}

function getTargetQuaternion(value: number): THREE.Quaternion {
  const eulerMap: Record<number, [number, number, number]> = {
    1: [Math.PI / 2 - 0.14, 0.08, -0.06],
    2: [-0.14, 0.12, -0.04],
    3: [-0.12, Math.PI / 2 + 0.12, -0.04],
    4: [-0.12, -Math.PI / 2 + 0.12, -0.04],
    5: [-0.14, Math.PI + 0.12, -0.04],
    6: [-Math.PI / 2 - 0.14, 0.08, -0.06],
  };
  const [rx, ry, rz] = eulerMap[value] ?? eulerMap[1]!;
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rx, ry, rz, "YXZ"),
  );
}

const FLIGHT_MS = 740;
const HOLD_MS = 440;
const EXIT_MS = 220;
const TOTAL_MS = FLIGHT_MS + HOLD_MS + EXIT_MS;

export function CenterWebGLDice({ trigger }: CenterWebGLDiceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const engineRef = useRef<{
    startAnim: (t: CenterDiceRollTrigger) => void;
    stopAnim: () => void;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 1.05, 6.8);
    camera.lookAt(0, 0, 0);

    const resize = () => {
      const w = Math.max(120, container.clientWidth);
      const h = Math.max(120, container.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.55);
    keyLight.position.set(4, 8, 6);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    rimLight.position.set(-5, 2, 4);
    scene.add(rimLight);

    const faceValues = [4, 3, 1, 6, 2, 5];
    const materials = faceValues.map((val) => {
      const tex = new THREE.CanvasTexture(createDiceFaceCanvas(val));
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.2,
        metalness: 0.03,
      });
    });

    // Sleek compact die geometry (~38% smaller than before!)
    const geometry = new RoundedBoxGeometry(0.86, 0.86, 0.86, 4, 0.16);
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.visible = false;
    scene.add(mesh);

    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext("2d");
    if (sCtx) {
      const sg = sCtx.createRadialGradient(64, 64, 6, 64, 64, 56);
      sg.addColorStop(0, "rgba(15, 23, 42, 0.34)");
      sg.addColorStop(0.55, "rgba(15, 23, 42, 0.12)");
      sg.addColorStop(1, "rgba(15, 23, 42, 0)");
      sCtx.fillStyle = sg;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(1.35, 1.35);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.52;
    shadowMesh.visible = false;
    scene.add(shadowMesh);

    let rafId: number | null = null;

    const stopAnim = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      mesh.visible = false;
      shadowMesh.visible = false;
      renderer.clear();
    };

    const startAnim = (t: CenterDiceRollTrigger) => {
      stopAnim();

      const startX = t.fromSide === "left" ? -3.4 : 3.4;
      const exitX = t.fromSide === "left" ? -3.1 : 3.1;
      const targetQuat = getTargetQuaternion(t.value);
      const startEuler = new THREE.Euler(
        (t.fromSide === "left" ? 1 : -1) * 5.0,
        (t.fromSide === "left" ? -1 : 1) * 6.2,
        2.6,
      );
      const startTime = performance.now();

      mesh.visible = true;
      shadowMesh.visible = true;

      const tick = (now: number) => {
        const elapsed = now - startTime;
        if (elapsed >= TOTAL_MS) {
          stopAnim();
          return;
        }

        if (elapsed <= FLIGHT_MS) {
          const p = elapsed / FLIGHT_MS;
          const easeOutCubic = 1 - Math.pow(1 - p, 3);

          const x = THREE.MathUtils.lerp(startX, 0, easeOutCubic);
          const bounceHeight =
            Math.abs(Math.sin(p * Math.PI * 2.5)) * Math.exp(-p * 3.1) * 1.0;
          const z = Math.sin(p * Math.PI) * 0.4;

          mesh.position.set(x, bounceHeight, z);
          mesh.scale.setScalar(THREE.MathUtils.lerp(0.58, 0.96, easeOutCubic));

          const spinDecay = Math.pow(1 - p, 2.2);
          const spinQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(
              startEuler.x * spinDecay,
              startEuler.y * spinDecay,
              startEuler.z * spinDecay,
            ),
          );
          mesh.quaternion.copy(targetQuat).multiply(spinQuat);

          shadowMesh.position.set(x, -0.54, z);
          shadowMesh.scale.setScalar(
            Math.max(0.45, 0.98 - bounceHeight * 0.35),
          );
          shadowMat.opacity = Math.max(0.18, 0.85 - bounceHeight * 0.45);
        } else if (elapsed <= FLIGHT_MS + HOLD_MS) {
          const hp = (elapsed - FLIGHT_MS) / HOLD_MS;
          const pop = 0.96 + Math.sin(Math.min(1, hp * 3.5) * Math.PI) * 0.06;
          mesh.position.set(0, 0, 0.08);
          mesh.scale.setScalar(pop);
          mesh.quaternion.copy(targetQuat);

          shadowMesh.position.set(0, -0.54, 0.08);
          shadowMesh.scale.setScalar(0.98);
          shadowMat.opacity = 0.82;
        } else {
          const ep = (elapsed - FLIGHT_MS - HOLD_MS) / EXIT_MS;
          const easeIn = ep * ep;
          const x = THREE.MathUtils.lerp(0, exitX, easeIn);
          mesh.position.set(x, easeIn * 0.2, 0.08);
          mesh.scale.setScalar(Math.max(0.01, 0.96 * (1 - easeIn * 0.78)));
          mesh.quaternion.copy(targetQuat);

          shadowMesh.position.set(x, -0.54, 0.08);
          shadowMat.opacity = Math.max(0, 0.82 * (1 - ep));
        }

        renderer.render(scene, camera);
        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
    };

    engineRef.current = { startAnim, stopAnim };

    return () => {
      stopAnim();
      resizeObserver.disconnect();
      geometry.dispose();
      shadowGeo.dispose();
      shadowTex.dispose();
      shadowMat.dispose();
      materials.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
      renderer.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!trigger) {
      engine.stopAnim();
      return;
    }
    engine.startAnim(trigger);
  }, [trigger]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center overflow-hidden"
    >
      <canvas ref={canvasRef} className="h-full w-full" />

      {trigger && (
        <div
          key={trigger.rollId}
          className="animate-in fade-in zoom-in-95 duration-200 absolute bottom-2.5 flex items-center gap-1.5 rounded-full border border-white/85 bg-white/96 px-3 py-1 text-[11px] font-black text-slate-800 shadow-lg sm:bottom-4 sm:px-3.5 sm:py-1.5 sm:text-xs"
        >
          <span
            style={{ backgroundColor: trigger.rollerColor }}
            className="h-2.5 w-2.5 shrink-0 rounded-full"
          />
          <span className="max-w-[85px] truncate">{trigger.rollerName}</span>
          <span className="text-slate-400">•</span>
          <span className="text-[#1885f2]">Rolled {trigger.value}</span>
          {trigger.sentToJail ? (
            <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rose-600">
              3×6 JAIL!
            </span>
          ) : trigger.isBonus ? (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-700">
              BONUS!
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
