import { useEffect, useRef } from "react";

interface UseDebugKeySequenceOptions {
  /** Callback fired when the debug sequence is successfully entered */
  onTrigger: () => void;
  /** Max time in ms between consecutive keystrokes (default 5000ms) */
  intervalMs?: number;
}

const SEQUENCE = ["d", "e", "b", "u", "g"] as const;

/**
 * Listens for the secret debug key sequence:
 * - Hold the "x" key down
 * - While holding "x", type "d", then "e", then "b", then "u", then "g"
 * - Max 5-second interval between each letter
 * - If the interval expires, a wrong key is pressed, or "x" is released, the sequence is dropped.
 * - Non-case sensitive (works with lowercase or uppercase).
 * - Ignores keystrokes when the user is typing in form inputs.
 */
export function useDebugKeySequence({
  onTrigger,
  intervalMs = 5000,
}: UseDebugKeySequenceOptions) {
  const isHoldingXRef = useRef(false);
  const stepIndexRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const onTriggerRef = useRef(onTrigger);

  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  useEffect(() => {
    function clearSequenceTimer() {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function resetSequence() {
      clearSequenceTimer();
      stepIndexRef.current = 0;
    }

    function startSequenceTimer() {
      clearSequenceTimer();
      timerRef.current = window.setTimeout(() => {
        resetSequence();
      }, intervalMs);
    }

    function isInputFocused(e: KeyboardEvent): boolean {
      const target = e.target as HTMLElement | null;
      if (!target) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isInputFocused(e)) return;

      const key = e.key.toLowerCase();

      // Track 'x' press
      if (key === "x") {
        isHoldingXRef.current = true;
        // Don't reset sequence if it's OS key-repeat while holding 'x'
        return;
      }

      // Ignore modifier keys so Shift/Alt/Ctrl won't break the sequence
      if (
        e.key === "Shift" ||
        e.key === "Control" ||
        e.key === "Alt" ||
        e.key === "Meta" ||
        e.key === "CapsLock"
      ) {
        return;
      }

      // If 'x' is not held down, any keystroke resets sequence
      if (!isHoldingXRef.current) {
        resetSequence();
        return;
      }

      // While holding 'x', check sequence progression
      const currentExpectedKey = SEQUENCE[stepIndexRef.current];

      if (key === currentExpectedKey) {
        // Step matched!
        const nextStep = stepIndexRef.current + 1;

        if (nextStep === SEQUENCE.length) {
          // Completed full "debug" sequence!
          resetSequence();
          onTriggerRef.current();
        } else {
          // Advance to next step and restart the 5-second window
          stepIndexRef.current = nextStep;
          startSequenceTimer();
        }
      } else {
        // Wrong key while holding 'x' -> drop sequence
        resetSequence();
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key === "x") {
        isHoldingXRef.current = false;
        // Releasing 'x' drops the sequence immediately
        resetSequence();
      }
    }

    function onBlur() {
      isHoldingXRef.current = false;
      resetSequence();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      clearSequenceTimer();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [intervalMs]);
}
