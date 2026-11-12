import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeDiceProps {
  value: number; // 1..6
  isRolling: boolean;
  isMyTurn: boolean;
  canRoll: boolean;
  onRoll?: () => void;
  size?: number; // width & height in px, default 90
}

/**
 * Procedurally generates a crisp 256x256 die face canvas with rounded border & glossy pips.
 */
function createDiceFaceCanvas(value: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Background rounded square
  const r = 38;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(256 - r, 0);
  ctx.quadraticCurveTo(256, 0, 256, r);
  ctx.lineTo(256, 256 - r);
  ctx.quadraticCurveTo(256, 256, 256 - r, 256);
  ctx.lineTo(r, 256);
  ctx.quadraticCurveTo(0, 256, 0, 256 - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();

  // Subtle radial gradient for ivory look
  const bgGrad = ctx.createRadialGradient(128, 128, 20, 128, 128, 160);
  bgGrad.addColorStop(0, "#ffffff");
  bgGrad.addColorStop(0.85, "#f8fafc");
  bgGrad.addColorStop(1, "#e2e8f0");
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Soft inner border
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
  ctx.stroke();

  // Draw Pips
  const isOne = value === 1;
  const pipColor = isOne ? "#ef4444" : "#1e293b";
  const pipHighlight = isOne ? "#fca5a5" : "#64748b";
  const pipRadius = isOne ? 34 : 22;

  const drawPip = (x: number, y: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, pipRadius, 0, Math.PI * 2);
    ctx.fillStyle = pipColor;
    ctx.fill();

    // Specular highlight
    ctx.beginPath();
    ctx.arc(
      x - pipRadius * 0.3,
      y - pipRadius * 0.3,
      pipRadius * 0.35,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = pipHighlight;
    ctx.fill();
    ctx.restore();
  };

  const center = [128, 128] as const;
  const topLeft = [68, 68] as const;
  const topRight = [188, 68] as const;
  const bottomLeft = [68, 188] as const;
  const bottomRight = [188, 188] as const;
  const midLeft = [68, 128] as const;
  const midRight = [188, 128] as const;

  switch (value) {
    case 1:
      drawPip(center[0], center[1]);
      break;
    case 2:
      drawPip(topLeft[0], topLeft[1]);
      drawPip(bottomRight[0], bottomRight[1]);
      break;
    case 3:
      drawPip(topLeft[0], topLeft[1]);
      drawPip(center[0], center[1]);
      drawPip(bottomRight[0], bottomRight[1]);
      break;
    case 4:
      drawPip(topLeft[0], topLeft[1]);
      drawPip(topRight[0], topRight[1]);
      drawPip(bottomLeft[0], bottomLeft[1]);
      drawPip(bottomRight[0], bottomRight[1]);
      break;
    case 5:
      drawPip(topLeft[0], topLeft[1]);
      drawPip(topRight[0], topRight[1]);
      drawPip(center[0], center[1]);
      drawPip(bottomLeft[0], bottomLeft[1]);
      drawPip(bottomRight[0], bottomRight[1]);
      break;
    case 6:
      drawPip(topLeft[0], topLeft[1]);
      drawPip(topRight[0], topRight[1]);
      drawPip(midLeft[0], midLeft[1]);
      drawPip(midRight[0], midRight[1]);
      drawPip(bottomLeft[0], bottomLeft[1]);
      drawPip(bottomRight[0], bottomRight[1]);
      break;
  }

  return canvas;
}

/**
 * Three.js BoxGeometry material face mapping:
 * Material Index 0: +X (Right) -> 4
 * Material Index 1: -X (Left)  -> 3
 * Material Index 2: +Y (Top)   -> 1
 * Material Index 3: -Y (Bottom)-> 6
 * Material Index 4: +Z (Front) -> 2
 * Material Index 5: -Z (Back)  -> 5
 *
 * To face the camera (which looks down the Z axis with slight perspective tilt):
 */
const FACE_ROTATIONS: Record<number, [number, number, number]> = {
  1: [-Math.PI / 2 + 0.15, 0, 0.15],
  2: [0.15, 0, 0.15],
  3: [0.15, Math.PI / 2, 0.15],
  4: [0.15, -Math.PI / 2, 0.15],
  5: [0.15, Math.PI, 0.15],
  6: [Math.PI / 2 + 0.15, 0, 0.15],
};

export function ThreeDice({
  value,
  isRolling,
  isMyTurn,
  canRoll,
  onRoll,
  size = 90,
}: ThreeDiceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const isRollingRef = useRef(isRolling);
  const targetValueRef = useRef(value);
  const isMyTurnRef = useRef(isMyTurn);
  const canRollRef = useRef(canRoll);

  useEffect(() => {
    isRollingRef.current = isRolling;
    targetValueRef.current = value;
    isMyTurnRef.current = isMyTurn;
    canRollRef.current = canRoll;
  }, [isRolling, value, isMyTurn, canRoll]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0.3, 4.4);
    camera.lookAt(0, 0, 0);

    // Illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(4, 8, 6);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xa5b4fc, 0.6);
    fillLight.position.set(-4, -2, 2);
    scene.add(fillLight);

    // Create 6 face materials matching standard BoxGeometry ordering:
    // [ +X (4), -X (3), +Y (1), -Y (6), +Z (2), -Z (5) ]
    const faceValues = [4, 3, 1, 6, 2, 5];
    const materials: THREE.MeshStandardMaterial[] = faceValues.map((val) => {
      const faceCanvas = createDiceFaceCanvas(val);
      const texture = new THREE.CanvasTexture(faceCanvas);
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.15,
        metalness: 0.05,
      });
    });

    // Box Geometry
    const geometry = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const mesh = new THREE.Mesh(geometry, materials);
    scene.add(mesh);
    meshRef.current = mesh;

    // Initial rotation
    const initRot =
      FACE_ROTATIONS[targetValueRef.current] ?? FACE_ROTATIONS[1]!;
    mesh.rotation.set(initRot[0], initRot[1], initRot[2]);

    let animId: number;
    let rollT = 0;
    let spinVelocityX = 0;
    let spinVelocityY = 0;
    let spinVelocityZ = 0;
    let wasRolling = false;

    const animate = (time: number) => {
      animId = requestAnimationFrame(animate);

      if (isRollingRef.current) {
        if (!wasRolling) {
          wasRolling = true;
          rollT = 0;
          spinVelocityX = 15 + Math.random() * 8;
          spinVelocityY = 18 + Math.random() * 8;
          spinVelocityZ = 12 + Math.random() * 6;
        }

        rollT += 0.035;
        mesh.rotation.x += spinVelocityX * 0.04;
        mesh.rotation.y += spinVelocityY * 0.04;
        mesh.rotation.z += spinVelocityZ * 0.04;

        // Jump physics arc
        mesh.position.y = Math.sin(rollT * 4) * 0.35;
        mesh.scale.set(1.08, 1.08, 1.08);
      } else {
        if (wasRolling) {
          wasRolling = false;
        }

        const targetRot =
          FACE_ROTATIONS[targetValueRef.current] ?? FACE_ROTATIONS[1]!;

        // Smooth slerp/lerp toward final target face
        mesh.rotation.x += (targetRot[0] - mesh.rotation.x) * 0.14;
        mesh.rotation.y += (targetRot[1] - mesh.rotation.y) * 0.14;
        mesh.rotation.z += (targetRot[2] - mesh.rotation.z) * 0.14;
        mesh.position.y += (0 - mesh.position.y) * 0.15;

        // "when it's our turn, our dice should shake and grow in a blink way.. so we know it's our turn.."
        if (isMyTurnRef.current && canRollRef.current) {
          const t = time * 0.005;
          // Pulsing breathe scale: oscillating between 1.02 and 1.22
          const breathe = 1.12 + Math.sin(t * 3.5) * 0.1;
          mesh.scale.set(breathe, breathe, breathe);

          // Periodic wobble / shake: rapid jitter every 1.6 seconds
          const shakePeriod = (time * 0.001) % 1.6;
          if (shakePeriod < 0.3) {
            const jitter = Math.sin(shakePeriod * Math.PI * 24) * 0.14;
            mesh.rotation.z += jitter;
            mesh.rotation.x += jitter * 0.5;
          }
        } else {
          mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        }
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      geometry.dispose();
      materials.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
      renderer.dispose();
    };
  }, [size]);

  return (
    <div
      onClick={canRoll ? onRoll : undefined}
      className={`relative flex items-center justify-center select-none transition-all ${
        canRoll
          ? "cursor-pointer hover:scale-105 active:scale-95"
          : "cursor-default"
      }`}
      style={{ width: size, height: size }}
      title={canRoll ? "Click or tap to Roll the 3D Dice!" : `Dice: ${value}`}
    >
      {/* Golden halo ring when it is our turn */}
      {isMyTurn && canRoll && (
        <span className="absolute inset-0 rounded-2xl bg-amber-400/25 blur-md animate-pulse pointer-events-none" />
      )}

      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="relative z-10 pointer-events-auto"
      />
    </div>
  );
}
