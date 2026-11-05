import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Background } from "@/components/Background";
import { LogoMark } from "@/components/Logo";
import { RetroProgressBar } from "@/components/ui/retro-progress-bar";

interface SplashScreenProps {
  /** Flag indicating background initialization / session verification is ready */
  isReady?: boolean;
  /** Callback fired once the loading bar reaches 100% and finishes its single run */
  onComplete?: () => void;
}

export function SplashScreen({ isReady = true, onComplete }: SplashScreenProps) {
  const reduce = useReducedMotion();
  const [progress, setProgress] = useState(() => (reduce ? 100 : 0));
  const completedRef = useRef(false);

  useEffect(() => {
    // If reduced motion is preferred, complete smoothly
    if (reduce) {
      const timer = setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
      }, 300);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (completedRef.current) return 100;

        let increment: number;
        if (!isReady) {
          if (prev < 40) increment = 4.5;
          else if (prev < 70) increment = 2.5;
          else if (prev < 84) increment = 1.0;
          else increment = 0; // Hold at 84% waiting for isReady
        } else {
          if (prev < 84) increment = 5.0;
          else increment = 6.0;
        }

        const next = Math.min(100, prev + increment);

        if (next >= 100 && !completedRef.current) {
          completedRef.current = true;
          clearInterval(interval);
          setTimeout(() => {
            onComplete?.();
          }, 160);
        }

        return next;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [isReady, onComplete, reduce]);

  return (
    <div className="relative grid min-h-dvh place-items-center px-4 overflow-hidden">
      <Background />

      <motion.div
        className="relative z-10 flex flex-col items-center text-center max-w-xs sm:max-w-sm w-full"
        initial={reduce ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        {/* Logo */}
        <LogoMark className="size-16 sm:size-20 object-contain drop-shadow-[0_0_24px_rgba(250,204,21,0.45)]" />

        {/* App Name */}
        <h1 className="mt-4 font-retro text-2xl sm:text-3xl font-bold uppercase tracking-wider text-[#facc15] drop-shadow-[0_2px_0_#b45309]">
          KRIDORA
        </h1>

        {/* Subtitle text */}
        <p className="mt-1.5 font-retro text-xs sm:text-sm text-gray-300 font-medium tracking-wide">
          Play games together
        </p>

        {/* Minimal retro progress bar below */}
        <div className="mt-6 w-56 sm:w-64">
          <RetroProgressBar
            progress={progress}
            showPercent={false}
            heightClass="h-2 sm:h-2.5"
          />
        </div>
      </motion.div>
    </div>
  );
}
