import {
  CHARACTER_CATALOG,
  type PocketWarCharacterId,
  type RenderPlayerState,
  type WeaponId,
} from "../../types";

export interface CharacterShowcaseOptions {
  characterId: PocketWarCharacterId;
  aimAngle: number;
  timeSec: number;
  scale?: number;
  dimmed?: boolean;
  isBoosting?: boolean;
}

export interface SoldierRenderOptions {
  isLocal: boolean;
  timeSec: number;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawWeaponMesh(
  ctx: CanvasRenderingContext2D,
  weaponId: WeaponId,
  recoil: number,
  muzzleFlash: number,
): void {
  ctx.save();
  ctx.translate(-recoil, 0);

  switch (weaponId) {
    case "m4a1": {
      ctx.fillStyle = "#1E293B";
      drawRoundedRect(ctx, -6, -3.5, 24, 7, 2);
      ctx.fill();
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.fillStyle = "#475569";
      ctx.fillRect(18, -1.8, 12, 3.4);
      ctx.fillStyle = "#334155";
      ctx.fillRect(2, -6.5, 10, 3);
      ctx.fillStyle = "#0F172A";
      ctx.beginPath();
      ctx.moveTo(7, 3);
      ctx.lineTo(12, 3);
      ctx.lineTo(14, 11);
      ctx.lineTo(9, 11);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "vector_smg": {
      ctx.fillStyle = "#0F172A";
      drawRoundedRect(ctx, -4, -3.5, 19, 7, 2);
      ctx.fill();
      ctx.fillStyle = "#38BDF8";
      ctx.fillRect(4, -2, 6, 2);
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(9, 2);
      ctx.lineTo(14, 2);
      ctx.lineTo(11, 11);
      ctx.lineTo(6.5, 10.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#475569";
      ctx.fillRect(15, -2, 9, 4);
      break;
    }
    case "pistol": {
      ctx.fillStyle = "#334155";
      drawRoundedRect(ctx, 2, -3.2, 15, 5.2, 1.5);
      ctx.fill();
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(2, 1.5, 5.5, 7.5);
      ctx.fillStyle = "#94A3B8";
      ctx.fillRect(14, -2.5, 4, 2.2);
      break;
    }
    case "spas12": {
      ctx.fillStyle = "#1E293B";
      drawRoundedRect(ctx, -6, -3.8, 28, 7.2, 2);
      ctx.fill();
      ctx.fillStyle = "#64748B";
      ctx.fillRect(10, 1.5, 12, 3.2);
      ctx.fillStyle = "#EF4444";
      ctx.fillRect(1, -2.5, 5, 2.5);
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(22, -2.6, 8, 4.4);
      break;
    }
    case "barrett50": {
      ctx.fillStyle = "#1E293B";
      drawRoundedRect(ctx, -8, -4, 30, 7.5, 2);
      ctx.fill();
      ctx.fillStyle = "#475569";
      ctx.fillRect(22, -2, 17, 3.6);
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(36, -3.6, 5, 6.8);
      ctx.fillStyle = "#0F172A";
      drawRoundedRect(ctx, 1, -9.5, 17, 5, 2);
      ctx.fill();
      ctx.fillStyle = "#38BDF8";
      ctx.fillRect(16, -8.5, 2.2, 3);
      break;
    }
    case "rpg7": {
      ctx.fillStyle = "#3F6212";
      drawRoundedRect(ctx, -14, -4.5, 36, 9, 3);
      ctx.fill();
      ctx.strokeStyle = "#1A2E05";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(-14, -4.5);
      ctx.lineTo(-20, -6.5);
      ctx.lineTo(-20, 6.5);
      ctx.lineTo(-14, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#F97316";
      ctx.beginPath();
      ctx.moveTo(22, -5.5);
      ctx.lineTo(35, 0);
      ctx.lineTo(22, 5.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#FACC15";
      ctx.fillRect(21, -5.2, 3, 10.4);
      break;
    }
  }

  if (muzzleFlash > 0.05) {
    const tipX =
      weaponId === "barrett50"
        ? 42
        : weaponId === "rpg7"
          ? 35
          : weaponId === "pistol"
            ? 20
            : 31;
    const s = (0.7 + muzzleFlash * 0.7) * (weaponId === "spas12" ? 1.35 : 1);
    ctx.save();
    ctx.translate(tipX, -0.5);
    ctx.fillStyle = `rgba(255, 248, 170, ${Math.min(1, muzzleFlash * 1.2)})`;
    ctx.beginPath();
    ctx.moveTo(0, -6 * s);
    ctx.lineTo(15 * s, 0);
    ctx.lineTo(0, 6 * s);
    ctx.lineTo(4 * s, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgba(251, 146, 60, ${Math.min(0.9, muzzleFlash)})`;
    ctx.beginPath();
    ctx.arc(2 * s, 0, 5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawCoreSoldierBody(
  ctx: CanvasRenderingContext2D,
  characterId: PocketWarCharacterId,
  aimAngle: number,
  weaponId: WeaponId,
  opts: {
    runCycle: number;
    isBoosting: boolean;
    isGrounded: boolean;
    isOverheated: boolean;
    hitFlash: number;
    muzzleFlash: number;
    recoilOffset: number;
    meleeAnim: number;
    throwAnim: number;
    timeSec: number;
  },
): void {
  const charDef = CHARACTER_CATALOG[characterId];
  const pal = charDef.palette;
  const facingLeft = Math.cos(aimAngle) < 0;
  const localAim = facingLeft ? Math.PI - aimAngle : aimAngle;
  const bob = opts.isBoosting
    ? Math.sin(opts.timeSec * 14) * 1.4
    : opts.isGrounded
      ? Math.abs(Math.sin(opts.runCycle)) * -2.2
      : 0;

  ctx.save();
  if (facingLeft) {
    ctx.scale(-1, 1);
  }
  ctx.translate(0, bob);

  if (!opts.isGrounded) {
    ctx.rotate(opts.isBoosting ? 0.14 : 0.06);
  }

  // 1. Twin-tank Jetpack on back
  ctx.save();
  ctx.translate(-12, 1);
  ctx.fillStyle = "#334155";
  drawRoundedRect(ctx, -5.5, -10, 10, 19, 3.5);
  ctx.fill();
  ctx.strokeStyle = "#0F172A";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.fillStyle = opts.isOverheated ? "#F43F5E" : pal.sashColor;
  ctx.fillRect(-3.5, -6, 6, 3.2);

  ctx.fillStyle = "#0F172A";
  ctx.fillRect(-4, 8.5, 7, 3.5);
  if (opts.isBoosting) {
    const flick = 0.85 + Math.sin(opts.timeSec * 45) * 0.25;
    ctx.fillStyle = "#F97316";
    ctx.beginPath();
    ctx.moveTo(-4, 12);
    ctx.lineTo(-0.5, 12 + 16 * flick);
    ctx.lineTo(3, 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#FEF08A";
    ctx.beginPath();
    ctx.moveTo(-2.4, 12);
    ctx.lineTo(-0.5, 12 + 9.5 * flick);
    ctx.lineTo(1.4, 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 2. Animated Legs & Combat Boots
  const legSwing = opts.isGrounded
    ? Math.sin(opts.runCycle) * 6.5
    : opts.isBoosting
      ? -3.2
      : 2.5;
  ctx.lineCap = "round";

  ctx.strokeStyle = pal.suitSecondary;
  ctx.lineWidth = 5.4;
  ctx.beginPath();
  ctx.moveTo(-3, 10);
  ctx.lineTo(-4 - legSwing, 20);
  ctx.stroke();
  ctx.fillStyle = "#0F172A";
  drawRoundedRect(ctx, -7 - legSwing, 18.5, 8.5, 4.5, 2);
  ctx.fill();

  ctx.strokeStyle = pal.suitPrimary;
  ctx.lineWidth = 5.6;
  ctx.beginPath();
  ctx.moveTo(3, 10);
  ctx.lineTo(4 + legSwing, 20);
  ctx.stroke();
  ctx.fillStyle = "#0F172A";
  drawRoundedRect(ctx, 1 + legSwing, 18.5, 8.5, 4.5, 2);
  ctx.fill();

  // 3. Armored Chibi Torso
  ctx.fillStyle = pal.suitPrimary;
  drawRoundedRect(ctx, -9.5, -6, 19, 18, 6);
  ctx.fill();
  ctx.strokeStyle = "#0F172A";
  ctx.lineWidth = 1.7;
  ctx.stroke();

  ctx.fillStyle = pal.suitSecondary;
  drawRoundedRect(ctx, -7, -3.5, 14, 11.5, 3);
  ctx.fill();
  ctx.strokeStyle = pal.sashColor;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-7.5, -4);
  ctx.lineTo(7.5, 8.5);
  ctx.stroke();

  // 4. Expressive Chibi Head
  ctx.save();
  ctx.translate(0.5, -14.5);

  if (characterId === "nova") {
    const sway = Math.sin(opts.timeSec * 6.5 + opts.runCycle) * 2.4;
    ctx.fillStyle = pal.hairColor;
    ctx.beginPath();
    ctx.moveTo(-7, -3);
    ctx.quadraticCurveTo(-17, -6 + sway, -15, 5 + sway);
    ctx.quadraticCurveTo(-11, 4, -7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#0F172A";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  ctx.fillStyle = pal.skinColor;
  ctx.beginPath();
  ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0F172A";
  ctx.lineWidth = 1.7;
  ctx.stroke();

  if (characterId === "rex") {
    ctx.fillStyle = pal.headgearColor;
    ctx.beginPath();
    ctx.arc(0, -2, 11.2, Math.PI * 1.04, Math.PI * 1.98);
    ctx.lineTo(11, -1.5);
    ctx.lineTo(-11, -1.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#0F172A";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = pal.sashColor;
    ctx.fillRect(-10.5, -4.5, 21, 2.4);
    ctx.fillStyle = pal.visorOrEyeAccent;
    drawRoundedRect(ctx, 1.5, -6.2, 8.5, 4.6, 1.8);
    ctx.fill();
    ctx.strokeStyle = "#0F172A";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else {
    ctx.fillStyle = pal.hairColor;
    ctx.beginPath();
    ctx.arc(0, -1.5, 10.8, Math.PI * 0.95, Math.PI * 2.02);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.headgearColor;
    drawRoundedRect(ctx, -9.5, -5.5, 19.5, 4.2, 2);
    ctx.fill();
    ctx.fillStyle = pal.visorOrEyeAccent;
    drawRoundedRect(ctx, 2, -4.8, 7.8, 2.8, 1.2);
    ctx.fill();
  }

  ctx.fillStyle = "#0F172A";
  ctx.beginPath();
  ctx.arc(4.8, 1.8, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(5.4, 1.2, 0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#451A03";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(3.5, 6);
  ctx.quadraticCurveTo(6, 6.6, 7.6, 5.4);
  ctx.stroke();

  ctx.restore();

  // 5. Pivoting Weapon Arm & Active Firearm
  ctx.save();
  ctx.translate(2, 0.5);
  const swingBoost =
    opts.meleeAnim > 0 ? Math.sin(opts.meleeAnim * Math.PI) * 1.15 : 0;
  const throwPitch =
    opts.throwAnim > 0 ? -Math.sin(opts.throwAnim * Math.PI) * 0.85 : 0;
  ctx.rotate(localAim + swingBoost + throwPitch);

  drawWeaponMesh(ctx, weaponId, opts.recoilOffset, opts.muzzleFlash);

  ctx.fillStyle = pal.skinColor;
  ctx.strokeStyle = "#0F172A";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(4 - opts.recoilOffset * 0.6, 2.5, 3.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  // 6. White hit-flash overlay
  if (opts.hitFlash > 0.05) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.7, opts.hitFlash * 0.7);
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(0, -3, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Renders an animated hero rig on the SetupScreen character picker stage.
 */
export function drawCharacterShowcase(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: CharacterShowcaseOptions,
): void {
  const charDef = CHARACTER_CATALOG[opts.characterId];
  const scale = opts.scale ?? 2.4;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (opts.dimmed) {
    ctx.globalAlpha = 0.36;
  }

  drawCoreSoldierBody(
    ctx,
    opts.characterId,
    opts.aimAngle,
    charDef.primaryWeaponId,
    {
      runCycle: opts.timeSec * 2.2,
      isBoosting: Boolean(opts.isBoosting),
      isGrounded: !opts.isBoosting,
      isOverheated: false,
      hitFlash: 0,
      muzzleFlash: 0,
      recoilOffset: 0,
      meleeAnim: 0,
      throwAnim: 0,
      timeSec: opts.timeSec,
    },
  );

  ctx.restore();
}

/**
 * Renders a live combat soldier inside the 4400x1900 arena along with
 * spawn-protection shield, overhead HP bar, lives dots, reload ring, and nametag.
 */
export function drawSoldierRig(
  ctx: CanvasRenderingContext2D,
  player: RenderPlayerState,
  opts: SoldierRenderOptions,
): void {
  if (!player.isAlive) return;

  ctx.save();
  ctx.translate(player.x, player.y);

  if (player.isGrounded) {
    ctx.fillStyle = "rgba(2, 6, 23, 0.32)";
    ctx.beginPath();
    ctx.ellipse(0, 23, 15, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (player.isInvulnerable) {
    const pulse = 0.45 + Math.sin(opts.timeSec * 14) * 0.25;
    ctx.save();
    ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
    ctx.fillStyle = `rgba(56, 189, 248, ${pulse * 0.22})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -2, 29, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawCoreSoldierBody(
    ctx,
    player.characterId,
    player.aimAngle,
    player.activeWeaponId,
    {
      runCycle: player.runCycle,
      isBoosting: player.isBoosting,
      isGrounded: player.isGrounded,
      isOverheated: player.isOverheated,
      hitFlash: player.hitFlash,
      muzzleFlash: player.muzzleFlash,
      recoilOffset: player.recoilOffset,
      meleeAnim: player.meleeAnim,
      throwAnim: player.throwAnim,
      timeSec: opts.timeSec,
    },
  );

  const barW = 46;
  const barH = 5.5;
  const barY = -39;
  const hpRatio = Math.max(
    0,
    Math.min(1, player.hp / Math.max(1, player.maxHp)),
  );

  ctx.font = "800 11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const label = opts.isLocal ? "YOU" : player.username;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(2, 6, 23, 0.85)";
  ctx.strokeText(label, 0, barY - 4);
  ctx.fillStyle = opts.isLocal ? "#7DD3FC" : "#F8FAFC";
  ctx.fillText(label, 0, barY - 4);

  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  drawRoundedRect(ctx, -barW * 0.5 - 1, barY - 1, barW + 2, barH + 2, 3);
  ctx.fill();

  const fillColor = opts.isLocal
    ? hpRatio > 0.35
      ? "#22C55E"
      : "#F43F5E"
    : hpRatio > 0.35
      ? "#F97316"
      : "#EF4444";
  ctx.fillStyle = fillColor;
  drawRoundedRect(ctx, -barW * 0.5, barY, barW * hpRatio, barH, 2.2);
  ctx.fill();

  for (let i = 0; i < 3; i++) {
    const lx = (i - 1) * 8;
    const ly = barY + barH + 5;
    ctx.beginPath();
    ctx.arc(lx, ly, 2.3, 0, Math.PI * 2);
    ctx.fillStyle =
      i < player.livesLeft ? "#FB7185" : "rgba(148, 163, 184, 0.35)";
    ctx.fill();
  }

  if (player.isReloading) {
    ctx.save();
    ctx.strokeStyle = "#FACC15";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(
      0,
      -58,
      7,
      -Math.PI * 0.5,
      -Math.PI * 0.5 + (Math.max(5, player.reloadPct) / 100) * Math.PI * 2,
    );
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}
