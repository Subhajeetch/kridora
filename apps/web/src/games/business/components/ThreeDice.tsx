import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

interface ThreeDiceProps {
  value: number; // 1..6
  isRolling: boolean;
  isMyTurn: boolean;
  canRoll: boolean;
  onRoll?: () => void;
  size?: number; // width & height in px, default 90
}

/**
 * Procedurally generates a crisp 256x256 die face canvas with smooth porcelain gradient & glossy pips.
 */
function createDiceFaceCanvas(value: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Background smooth porcelain fill
  const bgGrad = ctx.createRadialGradient(128, 128, 20, 128, 128, 160);
  bgGrad.addColorStop(0, "#ffffff");
  bgGrad.addColorStop(0.75, "#f8fafc");
  bgGrad.addColorStop(1, "#e2e8f0");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 256, 256);

  // Soft subtle inner edge shadow to complement the 3D rounded geometry
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
  ctx.strokeRect(5, 5, 246, 246);

  // Draw Pips
  const isOne = value === 1;
  const pipColor = isOne ? "#ef4444" : "#1e293b";
  const pipHighlight = isOne ? "#fca5a5" : "#64748b";
  const pipRadius = isOne ? 34 : 22;

  const drawPip = (x: number, y: number) => {
    ctx.save();

    // Subtle drop shadow under pip for tactile inset depth
    ctx.beginPath();
    ctx.arc(x, y + 1.5, pipRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    ctx.fill();

    // Main pip body
    ctx.beginPath();
    ctx.arc(x, y, pipRadius, 0, Math.PI * 2);
    ctx.fillStyle = pipColor;
    ctx.fill();

    // Specular highlight on top-left
    ctx.beginPath();
    ctx.arc(
      x - pipRadius * 0.32,
      y - pipRadius * 0.32,
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
 * Three.js material face mapping:
 * Material Index 0: +X (Right) -> 4
 * Material Index 1: -X (Left)  -> 3
 * Material Index 2: +Y (Top)   -> 1
 * Material Index 3: -Y (Bottom)-> 6
 * Material Index 4: +Z (Front) -> 2
 * Material Index 5: -Z (Back)  -> 5
 */
const FACE_ROTATIONS: Record<number, [number, number, number]> = {
  1: [-Math.PI / 2 + 0.12, 0, 0.1],
  2: [0.12, 0, 0.1],
  3: [0.12, Math.PI / 2, 0.1],
  4: [0.12, -Math.PI / 2, 0.1],
  5: [0.12, Math.PI, 0.1],
  6: [Math.PI / 2 + 0.12, 0, 0.1],
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

    // Illumination: Ambient + Directional + Fill lights for soft specular glints
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(5, 9, 6);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xa5b4fc, 0.7);
    fillLight.position.set(-5, -2, 3);
    scene.add(fillLight);

    // Create 6 face materials matching standard Box ordering:
    // [ +X (4), -X (3), +Y (1), -Y (6), +Z (2), -Z (5) ]
    const faceValues = [4, 3, 1, 6, 2, 5];
    const materials: THREE.MeshStandardMaterial[] = faceValues.map((val) => {
      const faceCanvas = createDiceFaceCanvas(val);
      const texture = new THREE.CanvasTexture(faceCanvas);
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.18,
        metalness: 0.04,
      });
    });

    // Rounded Box Geometry with smooth curved edges
    const geometry = new RoundedBoxGeometry(1.6, 1.6, 1.6, 6, 0.24);
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
          // Slower, smoother tumbling speeds
          spinVelocityX = 8 + Math.random() * 4;
          spinVelocityY = 10 + Math.random() * 4;
          spinVelocityZ = 6 + Math.random() * 3;
        }

        rollT += 0.025;
        // Smooth deceleration
        spinVelocityX = Math.max(2, spinVelocityX * 0.985);
        spinVelocityY = Math.max(2, spinVelocityY * 0.985);
        spinVelocityZ = Math.max(1.5, spinVelocityZ * 0.985);

        mesh.rotation.x += spinVelocityX * 0.035;
        mesh.rotation.y += spinVelocityY * 0.035;
        mesh.rotation.z += spinVelocityZ * 0.035;

        // Smooth parabolic jump arc
        mesh.position.y = Math.sin(Math.min(Math.PI, rollT * 2.8)) * 0.38;
        mesh.scale.set(1.06, 1.06, 1.06);
      } else {
        if (wasRolling) {
          wasRolling = false;
        }

        const baseRot =
          FACE_ROTATIONS[targetValueRef.current] ?? FACE_ROTATIONS[1]!;
        let targetRotX = baseRot[0];
        const targetRotY = baseRot[1];
        let targetRotZ = baseRot[2];

        // "when it's our turn, our dice should shake and grow in a blink way.. so we know it's our turn.."
        // Slower, smoother breathing and playful gentle wobble ONLY on our turn when we can roll
        if (isMyTurnRef.current && canRollRef.current) {
          // Gentle smooth breathe: oscillates between 1.02 and 1.12
          const breathe = 1.07 + Math.sin(time * 0.0025) * 0.05;
          mesh.scale.set(breathe, breathe, breathe);

          // Slower, smoother playful wobble every 2.4 seconds
          const wobbleCycle = (time * 0.001) % 2.4;
          if (wobbleCycle < 0.7) {
            const progress = wobbleCycle / 0.7;
            const decay = 1 - progress;
            const wobble = Math.sin(progress * Math.PI * 4) * 0.09 * decay;
            targetRotZ += wobble;
            targetRotX += wobble * 0.35;
          }
        } else {
          mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.08);
        }

        // Smooth, damped settling toward the face (deterministic, no rotational drift!)
        mesh.rotation.x += (targetRotX - mesh.rotation.x) * 0.12;
        mesh.rotation.y += (targetRotY - mesh.rotation.y) * 0.12;
        mesh.rotation.z += (targetRotZ - mesh.rotation.z) * 0.12;
        mesh.position.y += (0 - mesh.position.y) * 0.12;
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
      {/* Soft golden halo glow when it is our turn */}
      {isMyTurn && canRoll && (
        <span className="absolute inset-0 rounded-3xl bg-amber-400/25 blur-lg animate-pulse pointer-events-none" />
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
