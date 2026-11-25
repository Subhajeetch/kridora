export interface ControlSnapshot {
  moveX: number;
  boost: boolean;
  dropThrough: boolean;
  aimAngle: number;
  shooting: boolean;
  aimingGrenade: boolean;
  mouseScreenX: number;
  mouseScreenY: number;
}

export interface InputCallbacks {
  onThrowBomb: () => void;
  onReload: () => void;
  onMelee: () => void;
  onSwitchWeapon: (slot?: 0 | 1) => void;
  onToggleScope: () => void;
  onTogglePause: () => void;
  onScoreboardToggle: (open: boolean) => void;
  onOpenChat?: () => void;
  onToggleDebug?: () => void;
}

export class InputManager {
  private keys = new Set<string>();
  private mouseLeftDown = false;
  private mouseRightDown = false;
  private grenadeKeyDown = false;
  private mouseScreenX = 0;
  private mouseScreenY = 0;
  private hasMouseMoved = false;

  private suspendedForChat = false;
  private paused = false;

  // Virtual touch controls state (isolated per pointer in ArenaHud)
  private touchMoveX = 0;
  private touchBoost = false;
  private touchDrop = false;
  private touchAimAngle = 0;
  private touchAutoFire = false;
  private touchTapFire = false;
  private touchAimingGrenade = false;

  private callbacks: InputCallbacks;

  constructor(callbacks: InputCallbacks) {
    this.callbacks = callbacks;
  }

  public setSuspendedForChat(suspended: boolean): void {
    this.suspendedForChat = suspended;
    if (suspended) {
      this.clearHeldInputs();
    }
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.clearHeldInputs();
    }
  }

  private clearHeldInputs(): void {
    this.keys.clear();
    this.mouseLeftDown = false;
    this.mouseRightDown = false;
    this.grenadeKeyDown = false;
    this.touchMoveX = 0;
    this.touchBoost = false;
    this.touchDrop = false;
    this.touchAutoFire = false;
    this.touchTapFire = false;
    this.touchAimingGrenade = false;
  }

  public setLeftStick(dx: number, dy: number): void {
    if (this.paused || this.suspendedForChat) {
      this.touchMoveX = 0;
      this.touchBoost = false;
      this.touchDrop = false;
      return;
    }
    const deadzoneX = Math.abs(dx) < 0.08 ? 0 : dx;
    this.touchMoveX = Math.max(-1, Math.min(1, deadzoneX));
    this.touchBoost = dy < -0.26;
    this.touchDrop = dy > 0.65;
  }

  public setRightStick(dx: number, dy: number, active: boolean): void {
    if (!active || this.paused || this.suspendedForChat) {
      this.touchAutoFire = false;
      return;
    }
    const mag = Math.hypot(dx, dy);
    if (mag > 0.12) {
      this.touchAimAngle = Math.atan2(dy, dx);
    }
    this.touchAutoFire = mag > 0.44;
  }

  public setTapFire(active: boolean): void {
    if (this.paused || this.suspendedForChat) {
      this.touchTapFire = false;
      return;
    }
    this.touchTapFire = active;
  }

  public setTouchGrenadeAiming(active: boolean): void {
    if (this.paused || this.suspendedForChat) {
      this.touchAimingGrenade = false;
      return;
    }
    this.touchAimingGrenade = active;
  }

  public setInitialAimAngle(angle: number): void {
    this.touchAimAngle = angle;
  }

  public attach(target: HTMLElement): () => void {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;

      if (code === "Escape") {
        if (!this.suspendedForChat) {
          e.preventDefault();
          this.callbacks.onTogglePause();
        }
        return;
      }

      if (this.suspendedForChat) return;

      if (code === "F3") {
        e.preventDefault();
        this.callbacks.onToggleDebug?.();
        return;
      }

      if (this.paused) return;

      if (code === "Tab") {
        e.preventDefault();
        this.callbacks.onScoreboardToggle(true);
        return;
      }

      if (code === "KeyT" && !e.repeat) {
        e.preventDefault();
        this.callbacks.onOpenChat?.();
        return;
      }

      if (
        code === "Space" ||
        code === "ArrowUp" ||
        code === "ArrowDown" ||
        code === "ArrowLeft" ||
        code === "ArrowRight"
      ) {
        e.preventDefault();
      }

      if (!this.keys.has(code)) {
        if (code === "KeyG") {
          this.grenadeKeyDown = true;
        } else if (code === "KeyR") {
          this.callbacks.onReload();
        } else if (code === "KeyE" || code === "KeyF") {
          this.callbacks.onMelee();
        } else if (code === "KeyQ") {
          this.callbacks.onSwitchWeapon();
        } else if (code === "Digit1") {
          this.callbacks.onSwitchWeapon(0);
        } else if (code === "Digit2") {
          this.callbacks.onSwitchWeapon(1);
        } else if (
          code === "KeyZ" ||
          code === "ShiftLeft" ||
          code === "ShiftRight"
        ) {
          this.callbacks.onToggleScope();
        }
      }

      this.keys.add(code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === "Tab") {
        e.preventDefault();
        this.callbacks.onScoreboardToggle(false);
        return;
      }

      if (code === "KeyG" && this.grenadeKeyDown) {
        this.grenadeKeyDown = false;
        if (!this.paused && !this.suspendedForChat) {
          this.callbacks.onThrowBomb();
        }
      }

      this.keys.delete(code);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = target.getBoundingClientRect();
      this.mouseScreenX = e.clientX - rect.left;
      this.mouseScreenY = e.clientY - rect.top;
      this.hasMouseMoved = true;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (this.suspendedForChat || this.paused) return;
      const rect = target.getBoundingClientRect();
      this.mouseScreenX = e.clientX - rect.left;
      this.mouseScreenY = e.clientY - rect.top;
      this.hasMouseMoved = true;

      if (e.button === 0) {
        this.mouseLeftDown = true;
      } else if (e.button === 2) {
        this.mouseRightDown = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        this.mouseLeftDown = false;
      } else if (e.button === 2 && this.mouseRightDown) {
        this.mouseRightDown = false;
        if (!this.paused && !this.suspendedForChat) {
          this.callbacks.onThrowBomb();
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (this.suspendedForChat || this.paused) return;
      if (Math.abs(e.deltaY) > 6) {
        this.callbacks.onSwitchWeapon();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleBlur = () => {
      this.clearHeldInputs();
      this.callbacks.onScoreboardToggle(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    target.addEventListener("mousemove", handleMouseMove);
    target.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    target.addEventListener("wheel", handleWheel, { passive: true });
    target.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      target.removeEventListener("mousemove", handleMouseMove);
      target.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      target.removeEventListener("wheel", handleWheel);
      target.removeEventListener("contextmenu", handleContextMenu);
    };
  }

  public getSnapshot(
    playerScreenX: number,
    playerScreenY: number,
    isMobile: boolean,
  ): ControlSnapshot {
    if (this.paused || this.suspendedForChat) {
      return {
        moveX: 0,
        boost: false,
        dropThrough: false,
        aimAngle: this.touchAimAngle,
        shooting: false,
        aimingGrenade: false,
        mouseScreenX: this.mouseScreenX,
        mouseScreenY: this.mouseScreenY,
      };
    }

    if (isMobile) {
      return {
        moveX: this.touchMoveX,
        boost: this.touchBoost,
        dropThrough: this.touchDrop,
        aimAngle: this.touchAimAngle,
        shooting: this.touchAutoFire || this.touchTapFire,
        aimingGrenade: this.touchAimingGrenade,
        mouseScreenX: this.mouseScreenX,
        mouseScreenY: this.mouseScreenY,
      };
    }

    const left = this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? -1 : 0;
    const right = this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0;
    const boost =
      this.keys.has("KeyW") ||
      this.keys.has("ArrowUp") ||
      this.keys.has("Space");
    const dropThrough = this.keys.has("KeyS") || this.keys.has("ArrowDown");

    const aimAngle = this.hasMouseMoved
      ? Math.atan2(
          this.mouseScreenY - playerScreenY,
          this.mouseScreenX - playerScreenX,
        )
      : this.touchAimAngle;

    return {
      moveX: left + right,
      boost,
      dropThrough,
      aimAngle,
      shooting: this.mouseLeftDown,
      aimingGrenade: this.mouseRightDown || this.grenadeKeyDown,
      mouseScreenX: this.mouseScreenX,
      mouseScreenY: this.mouseScreenY,
    };
  }
}
