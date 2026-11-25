import {
  CHARACTER_CATALOG,
  WEAPON_CATALOG,
} from "@kridora/shared/games/pocket-war";
import type {
  PocketWarCharacterId,
  RenderPlayerState,
  WeaponId,
} from "../../types";

const OUTLINE = "#18181B";

export interface CharacterPreviewOptions {
  characterId: PocketWarCharacterId;
  aimAngle?: number;
  timeSec: number;
  scale?: number;
  dimmed?: boolean;
  isBoosting?: boolean;
  weaponId?: WeaponId;
}

/**
 * Draws the equipped weapon with crisp cartoon outlines, shading, barrel details,
 * and optional muzzle flash. Centered at the soldier's shoulder/grip pivot.
 */
function drawWeaponArt(
  ctx: CanvasRenderingContext2D,
  weaponId: WeaponId,
  recoilOffset: number,
  muzzleFlash: number,
): void {
  const rx = -recoilOffset;
  ctx.save();
  ctx.translate(rx, 0);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (weaponId === "barrett50") {
    // Heavy Sniper Rifle
    ctx.fillStyle = "#57534E";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-12, -3, 14, 8, 2);
    ctx.fill();
    ctx.stroke();

    // Receiver body
    ctx.fillStyle = "#78716C";
    ctx.beginPath();
    ctx.roundRect(0, -4.5, 18, 8.5, 2);
    ctx.fill();
    ctx.stroke();

    // Magazine
    ctx.fillStyle = "#27272A";
    ctx.fillRect(6, 3.5, 6, 7);
    ctx.strokeRect(6, 3.5, 6, 7);

    // Long heavy barrel + muzzle brake
    ctx.fillStyle = "#A8A29E";
    ctx.fillRect(18, -2.5, 21, 4);
    ctx.strokeRect(18, -2.5, 21, 4);
    ctx.fillStyle = "#27272A";
    ctx.fillRect(37, -3.5, 5, 6);
    ctx.strokeRect(37, -3.5, 5, 6);

    // Tactical scope
    ctx.fillStyle = "#18181B";
    ctx.fillRect(4, -9.5, 14, 4);
    ctx.fillStyle = "#38BDF8";
    ctx.fillRect(16, -9, 2, 3);

    // Bipod legs folded forward
    ctx.strokeStyle = "#27272A";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(23, 1.5);
    ctx.lineTo(19, 8);
    ctx.moveTo(24, 1.5);
    ctx.lineTo(27, 8);
    ctx.stroke();

    drawMuzzleBurst(ctx, 43, -0.5, muzzleFlash, 14);
  } else if (weaponId === "rpg7") {
    // RPG-7 Rocket Launcher
    ctx.fillStyle = "#57534E";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-14, -4.5, 42, 9, 3);
    ctx.fill();
    ctx.stroke();

    // Wooden heat shield
    ctx.fillStyle = "#B45309";
    ctx.fillRect(2, -4.5, 14, 9);
    ctx.strokeRect(2, -4.5, 14, 9);

    // Flared exhaust bell
    ctx.fillStyle = "#27272A";
    ctx.beginPath();
    ctx.moveTo(-14, -4.5);
    ctx.lineTo(-19, -7);
    ctx.lineTo(-19, 7);
    ctx.lineTo(-14, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Olive warhead nose cone
    ctx.fillStyle = "#4D7C0F";
    ctx.beginPath();
    ctx.moveTo(28, -5.5);
    ctx.lineTo(38, 0);
    ctx.lineTo(28, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    drawMuzzleBurst(ctx, 39, 0, muzzleFlash, 16);
  } else if (weaponId === "spas12") {
    // SPAS-12 Combat Shotgun
    ctx.fillStyle = "#27272A";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-10, -3.5, 36, 7.5, 2);
    ctx.fill();
    ctx.stroke();

    // Ribbed pump forend
    ctx.fillStyle = "#52525B";
    ctx.fillRect(10, -1, 12, 6.5);
    ctx.strokeRect(10, -1, 12, 6.5);

    // Heat shield vents
    ctx.fillStyle = "#94A3B8";
    ctx.fillRect(8, -4.5, 16, 2);

    drawMuzzleBurst(ctx, 27, 0, muzzleFlash, 13);
  } else if (weaponId === "vector_smg") {
    // Compact Vector SMG
    ctx.fillStyle = "#334155";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-8, -4, 28, 7.5, 2.5);
    ctx.fill();
    ctx.stroke();

    // Angled extended magazine
    ctx.fillStyle = "#0F172A";
    ctx.beginPath();
    ctx.moveTo(7, 3);
    ctx.lineTo(13, 3);
    ctx.lineTo(10, 13);
    ctx.lineTo(4, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Suppressor / short barrel
    ctx.fillStyle = "#1E293B";
    ctx.fillRect(20, -3, 8, 5.5);
    ctx.strokeRect(20, -3, 8, 5.5);

    // Cyan reflex dot
    ctx.fillStyle = "#38BDF8";
    ctx.fillRect(4, -6.5, 6, 2.5);

    drawMuzzleBurst(ctx, 29, -0.5, muzzleFlash, 9);
  } else if (weaponId === "pistol") {
    // Tactical 9mm Pistol
    ctx.fillStyle = "#475569";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(0, -4.5, 17, 6.5, 2);
    ctx.fill();
    ctx.stroke();

    // Grip
    ctx.fillStyle = "#1E293B";
    ctx.beginPath();
    ctx.moveTo(1, 2);
    ctx.lineTo(7, 2);
    ctx.lineTo(5, 10);
    ctx.lineTo(-1, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    drawMuzzleBurst(ctx, 18, -1.5, muzzleFlash, 8);
  } else {
    // M4A1 Carbine
    ctx.fillStyle = "#27272A";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;

    // Buttstock
    ctx.beginPath();
    ctx.moveTo(-11, -3);
    ctx.lineTo(-2, -3);
    ctx.lineTo(-2, 4);
    ctx.lineTo(-11, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Upper/lower receiver + carry handle
    ctx.fillStyle = "#3F3F46";
    ctx.beginPath();
    ctx.roundRect(-2, -4, 17, 7.5, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#18181B";
    ctx.fillRect(1, -7.5, 10, 3.5);
    ctx.strokeRect(1, -7.5, 10, 3.5);

    // Curved 30-rd magazine
    ctx.fillStyle = "#18181B";
    ctx.beginPath();
    ctx.moveTo(8, 3.5);
    ctx.lineTo(13, 3.5);
    ctx.lineTo(15, 12);
    ctx.lineTo(10, 12.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Handguard + barrel + front sight
    ctx.fillStyle = "#27272A";
    ctx.fillRect(15, -3.5, 11, 6);
    ctx.strokeRect(15, -3.5, 11, 6);
    ctx.fillStyle = "#71717A";
    ctx.fillRect(26, -2, 8, 3);
    ctx.strokeRect(26, -2, 8, 3);
    ctx.fillStyle = "#18181B";
    ctx.fillRect(26, -5.5, 2.5, 3.5);

    drawMuzzleBurst(ctx, 35, -0.5, muzzleFlash, 11);
  }

  ctx.restore();
}

function drawMuzzleBurst(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  intensity: number,
  radius: number,
): void {
  if (intensity <= 0.02) return;
  const r = radius * (0.65 + intensity * 0.55);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = Math.min(1, intensity * 1.2);

  // Outer warm orange burst
  ctx.fillStyle = "#FF7300";
  ctx.beginPath();
  ctx.arc(r * 0.35, 0, r * 0.72, 0, Math.PI * 2);
  ctx.fill();

  // Inner lemon-yellow spike
  ctx.fillStyle = "#FFF933";
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.45);
  ctx.lineTo(r * 1.25, 0);
  ctx.lineTo(0, r * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draws the slung backup weapon strapped diagonally behind the soldier's back.
 */
function drawSlungBackupWeapon(
  ctx: CanvasRenderingContext2D,
  secondaryWeaponId: WeaponId,
): void {
  ctx.save();
  ctx.translate(-8, -2);
  ctx.rotate(-1.05);
  ctx.fillStyle = "#3F3F46";
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(-12, -3, 24, 6, 2);
  ctx.fill();
  ctx.stroke();

  if (secondaryWeaponId !== "pistol") {
    ctx.fillStyle = "#18181B";
    ctx.fillRect(2, 2, 5, 6);
  }
  ctx.restore();
}

/**
 * Core chibi character artist: renders either Rex (boy) or Nova (girl) centered at (0, 0)
 * facing right (+X); caller mirrors via `ctx.scale(-1, 1)` when aiming left.
 */
function drawChibiBody(
  ctx: CanvasRenderingContext2D,
  characterId: PocketWarCharacterId,
  aimAngle: number,
  activeWeaponId: WeaponId,
  secondaryWeaponId: WeaponId,
  isBoosting: boolean,
  isGrounded: boolean,
  runCycle: number,
  recoilOffset: number,
  muzzleFlash: number,
  meleeAnim: number,
  timeSec: number,
): void {
  const charDef = CHARACTER_CATALOG[characterId];
  const pal = charDef.palette;
  const idleBob = isGrounded ? Math.sin(timeSec * 4.5) * 1.1 : 0;

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // 1. Slung backup gun behind torso
  drawSlungBackupWeapon(ctx, secondaryWeaponId);

  // 2. Twin-thruster jetpack on the back
  ctx.fillStyle = pal.suitSecondary;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(-17, -9 + idleBob * 0.5, 9, 20, 3.5);
  ctx.fill();
  ctx.stroke();

  // Metallic tank highlight & nozzle
  ctx.fillStyle = "#64748B";
  ctx.fillRect(-15, -6 + idleBob * 0.5, 3, 13);
  ctx.fillStyle = "#27272A";
  ctx.fillRect(-16, 10 + idleBob * 0.5, 7, 3);

  // Animated 3-layer thruster flame when boosting
  if (isBoosting) {
    const flicker = 14 + Math.sin(timeSec * 65) * 5.5;
    const nozzleX = -12.5;
    const nozzleY = 13 + idleBob * 0.5;

    // Crimson outer plume
    ctx.fillStyle = "#FF2200";
    ctx.beginPath();
    ctx.moveTo(nozzleX - 6.5, nozzleY);
    ctx.lineTo(nozzleX + 6.5, nozzleY);
    ctx.lineTo(nozzleX, nozzleY + flicker + 13);
    ctx.closePath();
    ctx.fill();

    // Tangerine mid plume
    ctx.fillStyle = "#FF7300";
    ctx.beginPath();
    ctx.moveTo(nozzleX - 4.5, nozzleY);
    ctx.lineTo(nozzleX + 4.5, nozzleY);
    ctx.lineTo(nozzleX, nozzleY + flicker + 7);
    ctx.closePath();
    ctx.fill();

    // Lemon-yellow hot core
    ctx.fillStyle = "#FFF933";
    ctx.beginPath();
    ctx.moveTo(nozzleX - 2.6, nozzleY);
    ctx.lineTo(nozzleX + 2.6, nozzleY);
    ctx.lineTo(nozzleX, nozzleY + flicker * 0.85);
    ctx.closePath();
    ctx.fill();
  }

  // 3. Stubby chibi legs & combat boots
  const stride = isGrounded ? Math.sin(runCycle) * 5.5 : -2.5;
  const liftLeft = isGrounded ? Math.max(0, -Math.cos(runCycle)) * 2.5 : 3;
  const liftRight = isGrounded ? Math.max(0, Math.cos(runCycle)) * 2.5 : 1.5;

  // Back leg
  ctx.fillStyle = pal.suitSecondary;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(-7 - stride * 0.7, 9 - liftLeft, 7.5, 11, 2.5);
  ctx.fill();
  ctx.stroke();

  // Back boot
  ctx.fillStyle = "#18181B";
  ctx.beginPath();
  ctx.roundRect(-7 - stride * 0.7, 17 - liftLeft, 9.5, 6.5, 2.5);
  ctx.fill();
  ctx.stroke();

  // Front leg
  ctx.fillStyle = pal.suitPrimary;
  ctx.beginPath();
  ctx.roundRect(0.5 + stride * 0.7, 9 - liftRight, 7.5, 11, 2.5);
  ctx.fill();
  ctx.stroke();

  // Front boot
  ctx.fillStyle = "#18181B";
  ctx.beginPath();
  ctx.roundRect(0.5 + stride * 0.7, 17 - liftRight, 9.5, 6.5, 2.5);
  ctx.fill();
  ctx.stroke();

  // 4. Compact armored chibi torso + bold tactical waist sash
  ctx.save();
  ctx.translate(0, idleBob);

  ctx.fillStyle = pal.suitPrimary;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.roundRect(-10.5, -8, 21, 20, 6);
  ctx.fill();
  ctx.stroke();

  // Chest armor plate detail
  ctx.fillStyle = pal.suitSecondary;
  ctx.beginPath();
  ctx.roundRect(-6.5, -5.5, 13, 8, 2.5);
  ctx.fill();

  // Bold colored tactical belt/sash
  ctx.fillStyle = pal.sashColor;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.roundRect(-10.5, 4.5, 21, 5.5, 2);
  ctx.fill();
  ctx.stroke();

  // 5. Big chibi head (~45% of silhouette)
  const headY = -18.5;

  // Nova's flowing chestnut ponytail behind head
  if (characterId === "nova") {
    const hairWave = Math.sin(timeSec * 6 + runCycle * 0.5) * 2.5;
    ctx.fillStyle = pal.hairColor;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(-10, headY - 3);
    ctx.quadraticCurveTo(
      -21,
      headY - 2 + hairWave,
      -18,
      headY + 11 + hairWave,
    );
    ctx.quadraticCurveTo(-13, headY + 12, -10, headY + 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Head circle
  ctx.fillStyle = pal.skinColor;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, headY, 12.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Soft cheek shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
  ctx.beginPath();
  ctx.arc(-2, headY + 3, 9.5, 0.2, Math.PI * 0.95);
  ctx.fill();

  // Expressive eyes & brows (blink briefly every ~4s)
  const isBlinking = Math.sin(timeSec * 1.55) > 0.985;
  if (isBlinking) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(1.5, headY - 1);
    ctx.lineTo(5.5, headY - 1);
    ctx.moveTo(7.5, headY - 1);
    ctx.lineTo(11, headY - 1);
    ctx.stroke();
  } else {
    // Eye whites
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(3.5, headY - 1.2, 2.6, 2.2, 0, 0, Math.PI * 2);
    ctx.ellipse(9.2, headY - 1.2, 2.3, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(4.2, headY - 1.2, 1.35, 0, Math.PI * 2);
    ctx.arc(9.8, headY - 1.2, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Determined eyebrows
    ctx.strokeStyle = pal.hairColor;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(1.2, headY - 4.6);
    ctx.lineTo(5.8, headY - 3.6);
    ctx.moveTo(7.4, headY - 3.6);
    ctx.lineTo(11.3, headY - 4.6);
    ctx.stroke();
  }

  // Mouth expression: confident grin for Rex, focused smirk for Nova
  if (characterId === "rex") {
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(2.5, headY + 3.2, 7.2, 3.2, 1.5);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(3.5, headY + 4.8);
    ctx.quadraticCurveTo(6.8, headY + 5.8, 9.6, headY + 4.2);
    ctx.stroke();
  }

  // Headgear: Olive Commando Beret (Rex) vs Tactical Cap + Bangs (Nova)
  if (characterId === "rex") {
    ctx.fillStyle = pal.headgearColor;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.moveTo(-12.5, headY - 4.5);
    ctx.quadraticCurveTo(-13, headY - 15.5, 2, headY - 14.5);
    ctx.quadraticCurveTo(14.5, headY - 13, 12.5, headY - 5);
    ctx.quadraticCurveTo(0, headY - 6.5, -12.5, headY - 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Silver commando badge on beret
    ctx.fillStyle = "#E2E8F0";
    ctx.beginPath();
    ctx.arc(5.5, headY - 9.2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Side hair lock framing cheek
    ctx.fillStyle = pal.hairColor;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-11.5, headY - 4);
    ctx.quadraticCurveTo(-11, headY + 4, -6.5, headY + 6);
    ctx.lineTo(-6, headY - 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Dark tactical cap dome + forward visor brim
    ctx.fillStyle = pal.headgearColor;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.arc(0, headY - 3.5, 12.2, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cap brim
    ctx.fillStyle = "#1E293B";
    ctx.beginPath();
    ctx.moveTo(3, headY - 4.8);
    ctx.lineTo(16.5, headY - 3.2);
    ctx.quadraticCurveTo(15, headY - 1.2, 4, headY - 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();

  // 6. 360-degree aiming arm + equipped weapon + colored tactical wrist cuffs
  const facingLeft = Math.cos(aimAngle) < 0;
  const localAim = facingLeft
    ? Math.atan2(Math.sin(aimAngle), -Math.cos(aimAngle))
    : aimAngle;
  const meleeSwing = meleeAnim > 0 ? Math.sin(meleeAnim * Math.PI) * 0.95 : 0;

  ctx.save();
  ctx.translate(1, -1.5 + idleBob);
  ctx.rotate(localAim + meleeSwing);

  // Back support hand
  ctx.fillStyle = pal.skinColor;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.arc(11 - recoilOffset * 0.5, 2.5, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Weapon art
  drawWeaponArt(ctx, activeWeaponId, recoilOffset, muzzleFlash);

  // Trigger hand + colored tactical sleeve cuff
  ctx.fillStyle = pal.sashColor;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(-2 - recoilOffset * 0.5, -2.5, 6.5, 5.5, 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = pal.skinColor;
  ctx.beginPath();
  ctx.arc(4.5 - recoilOffset * 0.5, 1, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders a live soldier inside the game world, including local blue triangle marker,
 * spawn invulnerability bubble, hit flash, water immersion line, name & health bar.
 */
export function drawWorldSoldier(
  ctx: CanvasRenderingContext2D,
  player: RenderPlayerState,
  isLocal: boolean,
  timeSec: number,
  nowMs: number,
): void {
  const charDef = CHARACTER_CATALOG[player.characterId];
  const activeSlot = player.weapons[player.activeSlot];
  const secondarySlot = player.weapons[player.activeSlot === 0 ? 1 : 0];
  const facingLeft = Math.cos(player.aimAngle) < 0;
  const tilt = Math.max(-0.26, Math.min(0.26, player.vx * 0.00072));

  ctx.save();
  ctx.translate(player.x, player.y);

  // Spawn invulnerability shimmer bubble
  if (nowMs < player.invulnerableUntil) {
    const pulse = 0.55 + Math.sin(timeSec * 16) * 0.25;
    ctx.save();
    ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
    ctx.fillStyle = `rgba(56, 189, 248, ${pulse * 0.16})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -3, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Soldier body with flight pitch and horizontal mirror
  ctx.save();
  ctx.rotate(tilt);
  if (facingLeft) {
    ctx.scale(-1, 1);
  }

  drawChibiBody(
    ctx,
    player.characterId,
    player.aimAngle,
    activeSlot.weaponId,
    secondarySlot.weaponId,
    player.isBoosting,
    player.isGrounded,
    player.runCycle,
    player.recoilOffset,
    player.muzzleFlash,
    player.meleeAnim,
    timeSec,
  );

  // Brief white damage flash overlay
  if (player.hitFlash > 0.02) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.65, player.hitFlash * 0.7)})`;
    ctx.beginPath();
    ctx.arc(0, -6, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Subtle turquoise water ripple across boots when wading
  if (player.inWater) {
    ctx.save();
    ctx.strokeStyle = "rgba(224, 242, 254, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(
      0,
      14,
      16 + Math.sin(timeSec * 8) * 2,
      4,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.restore();
  }

  // Reloading progress bar above head
  if (activeSlot.reloadingUntil > nowMs) {
    const def = WEAPON_CATALOG[activeSlot.weaponId];
    const remaining = activeSlot.reloadingUntil - nowMs;
    const progress = Math.max(0, Math.min(1, 1 - remaining / def.reloadTimeMs));
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(-18, -42, 36, 4);
    ctx.fillStyle = "#38BDF8";
    ctx.fillRect(-17, -41, 34 * progress, 2);
  }

  // Local player blue hollow triangle marker vs enemy name & HP bar
  if (isLocal) {
    const markerBob = Math.sin(timeSec * 5) * 2.5;
    const my = -52 + markerBob;
    ctx.save();
    ctx.strokeStyle = charDef.palette.markerColor;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-9, my - 9);
    ctx.lineTo(9, my - 9);
    ctx.lineTo(0, my + 4);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  } else {
    const hpRatio = Math.max(
      0,
      Math.min(1, player.hp / Math.max(1, player.maxHp)),
    );
    ctx.font = "800 11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
    ctx.lineWidth = 3;
    ctx.strokeText(player.username, 0, -49);
    ctx.fillStyle = "#F8FAFC";
    ctx.fillText(player.username, 0, -49);

    ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
    ctx.beginPath();
    ctx.roundRect(-22, -44, 44, 6, 2);
    ctx.fill();

    ctx.fillStyle =
      hpRatio > 0.5 ? "#22C55E" : hpRatio > 0.25 ? "#F59E0B" : "#EF4444";
    ctx.beginPath();
    ctx.roundRect(-21, -43, 42 * hpRatio, 4, 1.5);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Renders a large, crisp, live-animated character showcase for the Setup Screen
 * (both the centered active hero and the dimmed side hero).
 */
export function drawCharacterShowcase(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  options: CharacterPreviewOptions,
): void {
  const charDef = CHARACTER_CATALOG[options.characterId];
  const scale = options.scale ?? 3.2;
  const aimAngle = options.aimAngle ?? -0.08;
  const weaponId = options.weaponId ?? charDef.primaryWeaponId;

  ctx.save();
  ctx.translate(centerX, centerY);

  // Soft ground shadow oval
  ctx.fillStyle = options.dimmed
    ? "rgba(0, 0, 0, 0.28)"
    : "rgba(0, 0, 0, 0.42)";
  ctx.beginPath();
  ctx.ellipse(0, 26 * scale, 22 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (options.dimmed) {
    ctx.globalAlpha = 0.42;
  }

  ctx.scale(scale, scale);
  drawChibiBody(
    ctx,
    options.characterId,
    aimAngle,
    weaponId,
    charDef.secondaryWeaponId,
    options.isBoosting ?? false,
    true,
    0,
    0,
    0,
    0,
    options.timeSec,
  );

  ctx.restore();
}
