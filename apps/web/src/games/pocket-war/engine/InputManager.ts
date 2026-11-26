import {
  INPUT_FLAG_BOOST,
  INPUT_FLAG_DROP,
  INPUT_FLAG_MELEE,
  INPUT_FLAG_PICKUP,
  INPUT_FLAG_RELOAD,
  INPUT_FLAG_SCOPED,
  INPUT_FLAG_SHOOT,
  INPUT_FLAG_SWITCH_WEAPON,
  INPUT_FLAG_THROW_BOMB,
  type InputControlFrame,
  type TouchControllerVisualState,
  type VirtualStickVisual,
} from "../types";

export interface InputManagerCallbacks {
  onThrowBomb: () => void;
  onReload: () => void;
  onMelee: () => void;
  onPickup?: () => void;
  onSwitchWeapon: (slot?: 0 | 1) => void;
  onToggleScope: () => void;
  onTogglePause: () => void;
  onScoreboardToggle: (open: boolean) => void;
  onOpenChat: () => void;
  onToggleDebug: () => void;
  onDebugCanvasClick?: (clientX: number, clientY: number) => void;
  onFirstInteraction?: () => void;
}

const STICK_MAX_RADIUS = 56;
const STICK_DEADZONE = 0.14;
const STICK_FIRE_THRESHOLD = 0.54;
const STICK_BOOST_THRESHOLD = -0.34;
const STICK_DROP_THRESHOLD = 0.64;

function createEmptyStick(): VirtualStickVisual {
  return {
    active: false,
    pointerId: null,
    originX: 0,
    originY: 0,
    currentX: 0,
    currentY: 0,
    dx: 0,
    dy: 0,
  };
}

/**
 * Unified desktop + multi-touch input controller for Pocket War.
 * - Supports >= 3 simultaneous touch pointers via `setPointerCapture` & `touch-action: none`:
 *   left move/jetpack stick + right aim/auto-fire stick + concurrent HUD action taps.
 * - Edge-latches discrete combat triggers (`RELOAD`, `THROW_BOMB`, `MELEE`, `SWITCH_WEAPON`)
 *   so fast taps between 30 Hz binary packets are never dropped.
 */
export class InputManager {
  private readonly callbacks: InputManagerCallbacks;
  private keys = new Set<string>();
  private mouseScreenX = 0;
  private mouseScreenY = 0;
  private hasMouseMoved = false;
  private mouseLeftDown = false;

  private aimAngle = 0;
  private activeSlot: 0 | 1 = 0;
  private isScoped = false;
  private paused = false;
  private suspendedForChat = false;
  private debugClickMode = false;

  private latchedEdgeFlags = 0;
  private shootEdgePressed = false;
  private wasAimAutoFiring = false;

  private moveStick: VirtualStickVisual = createEmptyStick();
  private aimStick: VirtualStickVisual = createEmptyStick();
  private canvasEl: HTMLElement | null = null;
  private detachFns: Array<() => void> = [];

  constructor(callbacks: InputManagerCallbacks) {
    this.callbacks = callbacks;
  }

  public setInitialAimAngle(angle: number): void {
    this.aimAngle = angle;
  }

  public setActiveSlot(slot: 0 | 1): void {
    this.activeSlot = slot;
  }

  public getActiveSlot(): 0 | 1 {
    return this.activeSlot;
  }

  public setScoped(scoped: boolean): void {
    this.isScoped = scoped;
  }

  public getScoped(): boolean {
    return this.isScoped;
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.clearHeldInputs();
    }
  }

  public setSuspendedForChat(suspended: boolean): void {
    this.suspendedForChat = suspended;
    if (suspended) {
      this.clearHeldInputs();
    }
  }

  public setDebugClickMode(enabled: boolean): void {
    this.debugClickMode = enabled;
  }

  public latchEdgeFlag(flag: number): void {
    this.latchedEdgeFlags |= flag;
  }

  public consumeEdgeFlags(): number {
    const flags = this.latchedEdgeFlags;
    this.latchedEdgeFlags = 0;
    return flags;
  }

  public consumeShootEdgePressed(): boolean {
    const v = this.shootEdgePressed;
    this.shootEdgePressed = false;
    return v;
  }

  public clearHeldInputs(): void {
    this.keys.clear();
    this.mouseLeftDown = false;
    this.shootEdgePressed = false;
    this.wasAimAutoFiring = false;
    this.moveStick = createEmptyStick();
    this.aimStick = createEmptyStick();
  }

  public attach(targetEl: HTMLElement): () => void {
    this.canvasEl = targetEl;

    const onKeyDown = (e: KeyboardEvent) => {
      this.callbacks.onFirstInteraction?.();

      if (e.code === "F3") {
        e.preventDefault();
        this.callbacks.onToggleDebug();
        return;
      }

      if (e.code === "Escape") {
        if (!this.suspendedForChat) {
          e.preventDefault();
          this.callbacks.onTogglePause();
        }
        return;
      }

      if (this.suspendedForChat || this.paused) return;

      if (e.code === "Tab") {
        e.preventDefault();
        this.callbacks.onScoreboardToggle(true);
        return;
      }

      if ((e.code === "KeyT" || e.code === "Enter") && !e.repeat) {
        e.preventDefault();
        this.callbacks.onOpenChat();
        return;
      }

      if (
        e.code === "Space" ||
        e.code === "ArrowUp" ||
        e.code === "ArrowDown" ||
        e.code === "ArrowLeft" ||
        e.code === "ArrowRight"
      ) {
        e.preventDefault();
      }

      this.keys.add(e.code);

      if (e.repeat) return;

      if (e.code === "KeyG") {
        this.callbacks.onThrowBomb();
      } else if (e.code === "KeyR") {
        this.callbacks.onReload();
      } else if (e.code === "KeyE") {
        this.callbacks.onMelee();
      } else if (e.code === "KeyX") {
        this.callbacks.onPickup?.();
      } else if (e.code === "KeyQ") {
        this.callbacks.onSwitchWeapon();
      } else if (e.code === "Digit1") {
        this.callbacks.onSwitchWeapon(0);
      } else if (e.code === "Digit2") {
        this.callbacks.onSwitchWeapon(1);
      } else if (
        e.code === "KeyF" ||
        e.code === "ShiftLeft" ||
        e.code === "ShiftRight"
      ) {
        this.callbacks.onToggleScope();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Tab") {
        e.preventDefault();
        this.callbacks.onScoreboardToggle(false);
        return;
      }
      this.keys.delete(e.code);
    };

    const onWindowBlur = () => {
      this.clearHeldInputs();
      this.callbacks.onScoreboardToggle(false);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = targetEl.getBoundingClientRect();
      this.mouseScreenX = e.clientX - rect.left;
      this.mouseScreenY = e.clientY - rect.top;
      this.hasMouseMoved = true;
    };

    const onPointerDown = (e: PointerEvent) => {
      this.callbacks.onFirstInteraction?.();
      if (this.paused || this.suspendedForChat) return;

      if (e.pointerType === "mouse") {
        const rect = targetEl.getBoundingClientRect();
        this.mouseScreenX = e.clientX - rect.left;
        this.mouseScreenY = e.clientY - rect.top;
        this.hasMouseMoved = true;

        if (e.button === 0) {
          if (this.debugClickMode) {
            this.callbacks.onDebugCanvasClick?.(e.clientX, e.clientY);
          }
          if (!this.mouseLeftDown) {
            this.shootEdgePressed = true;
            this.latchEdgeFlag(INPUT_FLAG_SHOOT);
          }
          this.mouseLeftDown = true;
        } else if (e.button === 2) {
          this.callbacks.onThrowBomb();
        }
        return;
      }

      // Direct canvas touch fallback if user touches outside dedicated HUD stick rings
      if (this.debugClickMode) {
        this.callbacks.onDebugCanvasClick?.(e.clientX, e.clientY);
      }
      const rect = targetEl.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      if (localX < rect.width * 0.5) {
        this.beginStick(this.moveStick, targetEl, e);
      } else {
        this.beginStick(this.aimStick, targetEl, e);
      }
    };

    const onPointerMoveTouch = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if (this.moveStick.pointerId === e.pointerId) {
        this.updateStick(this.moveStick, e);
      } else if (this.aimStick.pointerId === e.pointerId) {
        this.updateStick(this.aimStick, e);
      }
    };

    const onPointerUpOrCancel = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        if (e.button === 0) {
          this.mouseLeftDown = false;
        }
        return;
      }
      if (this.moveStick.pointerId === e.pointerId) {
        this.endStick(this.moveStick);
      } else if (this.aimStick.pointerId === e.pointerId) {
        this.endStick(this.aimStick);
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onWheel = (e: WheelEvent) => {
      if (this.paused || this.suspendedForChat) return;
      if (Math.abs(e.deltaY) >= 4) {
        this.callbacks.onSwitchWeapon();
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    targetEl.addEventListener("pointermove", onPointerMove);
    targetEl.addEventListener("pointermove", onPointerMoveTouch);
    targetEl.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUpOrCancel);
    window.addEventListener("pointercancel", onPointerUpOrCancel);
    targetEl.addEventListener("contextmenu", onContextMenu);
    targetEl.addEventListener("wheel", onWheel, { passive: true });

    const cleanup = () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      targetEl.removeEventListener("pointermove", onPointerMove);
      targetEl.removeEventListener("pointermove", onPointerMoveTouch);
      targetEl.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUpOrCancel);
      window.removeEventListener("pointercancel", onPointerUpOrCancel);
      targetEl.removeEventListener("contextmenu", onContextMenu);
      targetEl.removeEventListener("wheel", onWheel);
      this.canvasEl = null;
    };

    this.detachFns.push(cleanup);
    return cleanup;
  }

  /**
   * Binds a dedicated multi-touch HUD zone element for the left movement/jetpack joystick.
   * Uses `setPointerCapture` so dragging out of the ring stays locked smoothly alongside
   * the right aim stick and concurrent action buttons (>= 3 pointers).
   */
  public bindMoveStickZone(el: HTMLElement): () => void {
    return this.bindStickElement(el, "move");
  }

  /**
   * Binds a dedicated multi-touch HUD zone element for the right aim/auto-fire joystick.
   */
  public bindAimStickZone(el: HTMLElement): () => void {
    return this.bindStickElement(el, "aim");
  }

  private bindStickElement(el: HTMLElement, kind: "move" | "aim"): () => void {
    const getStick = () => (kind === "move" ? this.moveStick : this.aimStick);

    const onDown = (e: PointerEvent) => {
      this.callbacks.onFirstInteraction?.();
      if (this.paused || this.suspendedForChat) return;
      e.stopPropagation();
      e.preventDefault();
      this.beginStick(getStick(), el, e, true);
    };

    const onMove = (e: PointerEvent) => {
      const stick = getStick();
      if (stick.pointerId !== e.pointerId) return;
      e.stopPropagation();
      this.updateStick(stick, e);
    };

    const onEnd = (e: PointerEvent) => {
      const stick = getStick();
      if (stick.pointerId !== e.pointerId) return;
      e.stopPropagation();
      this.endStick(stick);
    };

    el.addEventListener("pointerdown", onDown, { passive: false });
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onEnd);
    el.addEventListener("pointercancel", onEnd);
    el.addEventListener("lostpointercapture", onEnd);

    const cleanup = () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onEnd);
      el.removeEventListener("pointercancel", onEnd);
      el.removeEventListener("lostpointercapture", onEnd);
    };
    this.detachFns.push(cleanup);
    return cleanup;
  }

  private beginStick(
    stick: VirtualStickVisual,
    captureEl: HTMLElement,
    e: PointerEvent,
    centerOnElement = false,
  ): void {
    if (stick.active && stick.pointerId !== null) return;
    try {
      captureEl.setPointerCapture(e.pointerId);
    } catch {
      // Some synthetic pointer events cannot be captured
    }

    const rect = captureEl.getBoundingClientRect();
    const ox = centerOnElement ? rect.left + rect.width * 0.5 : e.clientX;
    const oy = centerOnElement ? rect.top + rect.height * 0.5 : e.clientY;

    stick.active = true;
    stick.pointerId = e.pointerId;
    stick.originX = ox;
    stick.originY = oy;
    stick.currentX = e.clientX;
    stick.currentY = e.clientY;
    this.updateStick(stick, e);
  }

  private updateStick(stick: VirtualStickVisual, e: PointerEvent): void {
    const rawDx = e.clientX - stick.originX;
    const rawDy = e.clientY - stick.originY;
    const dist = Math.hypot(rawDx, rawDy);
    const clamped = Math.min(dist, STICK_MAX_RADIUS);
    const angle = dist > 0.001 ? Math.atan2(rawDy, rawDx) : 0;

    stick.currentX = stick.originX + Math.cos(angle) * clamped;
    stick.currentY = stick.originY + Math.sin(angle) * clamped;
    stick.dx = (Math.cos(angle) * clamped) / STICK_MAX_RADIUS;
    stick.dy = (Math.sin(angle) * clamped) / STICK_MAX_RADIUS;

    if (stick === this.aimStick) {
      const mag = Math.hypot(stick.dx, stick.dy);
      const isFiring = stick.active && mag >= STICK_FIRE_THRESHOLD;
      if (isFiring && !this.wasAimAutoFiring) {
        this.shootEdgePressed = true;
        this.latchEdgeFlag(INPUT_FLAG_SHOOT);
      }
      this.wasAimAutoFiring = isFiring;
    }
  }

  private endStick(stick: VirtualStickVisual): void {
    stick.active = false;
    stick.pointerId = null;
    stick.dx = 0;
    stick.dy = 0;
    if (stick === this.aimStick) {
      this.wasAimAutoFiring = false;
    }
  }

  public getTouchVisualState(): TouchControllerVisualState {
    const aimMag = Math.hypot(this.aimStick.dx, this.aimStick.dy);
    return {
      moveStick: { ...this.moveStick },
      aimStick: { ...this.aimStick },
      autoFiring: this.aimStick.active && aimMag >= STICK_FIRE_THRESHOLD,
      boosting:
        this.moveStick.active && this.moveStick.dy <= STICK_BOOST_THRESHOLD,
    };
  }

  public getSnapshot(
    playerScreenX: number,
    playerScreenY: number,
    isMobile: boolean,
  ): InputControlFrame {
    if (this.paused || this.suspendedForChat) {
      return {
        moveX: 0,
        boost: false,
        dropThrough: false,
        shooting: false,
        isScoped: this.isScoped,
        aimAngle: this.aimAngle,
        activeSlot: this.activeSlot,
      };
    }

    let moveX = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) moveX -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) moveX += 1;

    if (this.moveStick.active && Math.abs(this.moveStick.dx) > STICK_DEADZONE) {
      moveX = this.moveStick.dx;
    }

    const boost =
      this.keys.has("KeyW") ||
      this.keys.has("ArrowUp") ||
      this.keys.has("Space") ||
      (this.moveStick.active && this.moveStick.dy <= STICK_BOOST_THRESHOLD);

    const dropThrough =
      this.keys.has("KeyS") ||
      this.keys.has("ArrowDown") ||
      (this.moveStick.active && this.moveStick.dy >= STICK_DROP_THRESHOLD);

    let shooting = this.mouseLeftDown;

    if (this.aimStick.active) {
      const mag = Math.hypot(this.aimStick.dx, this.aimStick.dy);
      if (mag >= STICK_DEADZONE) {
        this.aimAngle = Math.atan2(this.aimStick.dy, this.aimStick.dx);
      }
      if (mag >= STICK_FIRE_THRESHOLD) {
        shooting = true;
      }
    } else if (!isMobile && this.hasMouseMoved && this.canvasEl) {
      this.aimAngle = Math.atan2(
        this.mouseScreenY - playerScreenY,
        this.mouseScreenX - playerScreenX,
      );
    }

    return {
      moveX: Math.max(-1, Math.min(1, moveX)),
      boost,
      dropThrough,
      shooting,
      isScoped: this.isScoped,
      aimAngle: this.aimAngle,
      activeSlot: this.activeSlot,
    };
  }

  /**
   * Builds the binary `fl` bitmask for `ClientInputPacket` combining held controls
   * and any edge-latched discrete actions triggered since the last packet.
   */
  public buildPacketFlags(frame: InputControlFrame): number {
    let fl = this.consumeEdgeFlags();
    if (frame.boost) fl |= INPUT_FLAG_BOOST;
    if (frame.dropThrough) fl |= INPUT_FLAG_DROP;
    if (frame.shooting) fl |= INPUT_FLAG_SHOOT;
    if (frame.isScoped) fl |= INPUT_FLAG_SCOPED;
    return fl;
  }

  public triggerReloadFlag(): void {
    this.latchEdgeFlag(INPUT_FLAG_RELOAD);
  }

  public triggerThrowBombFlag(): void {
    this.latchEdgeFlag(INPUT_FLAG_THROW_BOMB);
  }

  public triggerMeleeFlag(): void {
    this.latchEdgeFlag(INPUT_FLAG_MELEE);
  }

  public triggerPickupFlag(): void {
    this.latchEdgeFlag(INPUT_FLAG_PICKUP);
  }

  public triggerSwitchWeaponFlag(): void {
    this.latchEdgeFlag(INPUT_FLAG_SWITCH_WEAPON);
  }

  public destroy(): void {
    for (const fn of this.detachFns) {
      fn();
    }
    this.detachFns = [];
    this.clearHeldInputs();
  }
}
