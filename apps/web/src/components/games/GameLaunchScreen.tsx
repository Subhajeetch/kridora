import type { RoomSnapshot } from "@kridora/shared";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GameThumbnail } from "@/components/games/GameThumbnail";
import { RetroProgressBar } from "@/components/ui/retro-progress-bar";

interface GameLaunchScreenProps {
  room: RoomSnapshot;
  gameName: string;
  isReady?: boolean;
  onComplete?: () => void;
  onBackToRoom?: () => void;
  statusMessage?: string;
}

export function GameLaunchScreen({
  room,
  gameName,
  isReady = true,
  onComplete,
  onBackToRoom,
}: GameLaunchScreenProps) {
  const reduce = useReducedMotion();
  const [progress, setProgress] = useState(() => (reduce ? 100 : 0));
  const [slowLoading, setSlowLoading] = useState(false);
  const completedRef = useRef(false);

  // Preload any key background assets (e.g. ludo board asset)
  useEffect(() => {
    if (room.gameSlug === "ludo") {
      const img = new Image();
      img.src = "/games/ludo/bg.webp";
    }
  }, [room.gameSlug]);

  // Alert after long connection delay
  useEffect(() => {
    const slowTimer = setTimeout(() => {
      setSlowLoading(true);
    }, 8000);

    return () => clearTimeout(slowTimer);
  }, []);

  // Single continuous monotonic progress animation from 0 to 100%
  useEffect(() => {
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
          // If the game module is not loaded yet, progress smoothly to 88% and hold
          if (prev < 30) increment = 3.2;
          else if (prev < 65) increment = 2.2;
          else if (prev < 88) increment = 1.0;
          else increment = 0; // Hold at 88% waiting for module resolution
        } else {
          // Module is ready: smoothly advance to 100%
          if (prev < 88) increment = 4.0;
          else increment = 5.0;
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
    }, 28);

    return () => clearInterval(interval);
  }, [isReady, onComplete, reduce]);

  return (
    <div className="relative mx-auto flex w-full max-w-sm flex-col items-center justify-center py-10 px-4 text-center">
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="flex flex-col items-center text-center w-full"
      >
        {/* Game Thumbnail with Retro Frame */}
        <div className="pixel-corners-sm bg-[#facc15] p-[2px] shadow-[0_0_20px_rgba(250,204,21,0.35)]">
          <div className="pixel-corners-sm size-20 sm:size-24 bg-[#0a0b10] overflow-hidden flex items-center justify-center">
            <GameThumbnail
              slug={room.gameSlug}
              name={gameName}
              className="size-full object-cover"
            />
          </div>
        </div>

        {/* Game Name */}
        <h2 className="mt-4 font-retro text-2xl sm:text-3xl font-bold uppercase tracking-wide text-white drop-shadow-[0_2px_0_#1f2937]">
          {gameName}
        </h2>

        {/* Minimal Subtext */}
        <p className="mt-1.5 font-retro text-xs text-gray-400 tracking-wider">
          ROOM: <span className="text-[#facc15] font-bold">{room.code}</span>
        </p>

        {/* Clean Retro Progress Bar */}
        <div className="mt-6 w-56 sm:w-64">
          <RetroProgressBar
            progress={progress}
            showPercent={false}
            heightClass="h-2 sm:h-2.5"
          />
        </div>

        {/* Slow Network Recovery */}
        {slowLoading && onBackToRoom && (
          <button
            type="button"
            onClick={onBackToRoom}
            className="mt-6 inline-flex items-center gap-1.5 font-retro text-xs text-gray-400 hover:text-white transition-colors underline cursor-pointer"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Lobby</span>
          </button>
        )}
      </motion.div>
    </div>
  );
}
