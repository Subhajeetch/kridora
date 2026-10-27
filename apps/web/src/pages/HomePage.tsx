import { GAME_DEFINITIONS } from "@kridora/shared";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { ArrowRight, DoorOpen, Gamepad2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { JoinRoomDialog } from "@/components/JoinRoomDialog";
import { Logo } from "@/components/Logo";
import { FeaturedGames } from "@/components/home/FeaturedGames";
import { HeroScene } from "@/components/home/HeroScene";
import { HeroTitle } from "@/components/home/HeroTitle";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Marquee } from "@/components/home/Marquee";
import {
  ArcadeButton,
  arcadeButtonVariants,
} from "@/components/ui/arcade-button";
import { useRealtime } from "@/providers/realtime-context";

const subTransition: Transition = {
  duration: 0.4,
  delay: 0.8,
  ease: "easeOut",
};
const ctaPopTransition: Transition = {
  type: "spring",
  stiffness: 360,
  damping: 20,
  delay: 0.95,
};

export default function HomePage() {
  const { activeRoom } = useRealtime();
  const [joinOpen, setJoinOpen] = useState(false);
  const reduce = useReducedMotion();

  return (
    <div>
      <HeroScene>
        <HeroTitle />

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={subTransition}
          className="mt-6 max-w-xl text-balance text-lg text-muted-foreground"
        >
          Create a room, share the code and start playing in seconds. No
          download needed.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={ctaPopTransition}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <span className="cta-ping">
            <Link
              to="/games"
              className={arcadeButtonVariants({
                variant: "primary",
                size: "lg",
              })}
            >
              <Gamepad2 /> BROWSE GAMES
            </Link>
          </span>
          <ArcadeButton
            variant="secondary"
            size="lg"
            onClick={() => setJoinOpen(true)}
          >
            <DoorOpen /> JOIN A ROOM
          </ArcadeButton>
        </motion.div>

        {activeRoom && (
          <Link
            to={`/${activeRoom.gameSlug}/room`}
            className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ok/30 bg-ok/5 px-5 py-3 text-sm transition-colors hover:bg-ok/10"
          >
            <span className="inline-flex items-center gap-2 font-semibold uppercase tracking-wider text-ok">
              <span
                className="size-2.5 animate-pulse rounded-full bg-ok"
                aria-hidden="true"
              />
              IN PROGRESS
            </span>
            <span className="text-foreground">
              Room{" "}
              <strong className="font-display tracking-widest">
                {activeRoom.code}
              </strong>{" "}
              · {GAME_DEFINITIONS[activeRoom.gameSlug].name}
            </span>
            <span className="inline-flex items-center gap-1 font-display text-xs uppercase tracking-wider text-ok">
              RETURN <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </Link>
        )}
      </HeroScene>

      <Marquee />
      <HowItWorks />
      <FeaturedGames />

      <section className="mx-auto max-w-5xl px-4 py-20 sm:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-panel-2 to-panel px-6 py-14 text-center sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,61,184,0.18),transparent_55%),radial-gradient(circle_at_75%_80%,rgba(34,228,255,0.16),transparent_55%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-4 left-4 size-5 rounded-tl-lg border-t-2 border-l-2 border-primary/50"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-4 right-4 size-5 rounded-tr-lg border-t-2 border-r-2 border-primary/50"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-4 left-4 size-5 rounded-bl-lg border-b-2 border-l-2 border-primary/50"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-4 right-4 size-5 rounded-br-lg border-b-2 border-r-2 border-primary/50"
          />

          <div className="relative z-10 flex flex-col items-center">
            <h2 className="font-display text-3xl uppercase tracking-tight sm:text-5xl">
              READY, PLAYER ONE?
            </h2>
            <p className="mt-3 max-w-md text-balance text-muted-foreground">
              Grab a friend, open a room and let the match begin.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
              <Link
                to="/games"
                className={arcadeButtonVariants({
                  variant: "primary",
                  size: "lg",
                })}
              >
                <Gamepad2 /> BROWSE GAMES
              </Link>
              <ArcadeButton
                variant="secondary"
                size="lg"
                onClick={() => setJoinOpen(true)}
              >
                <DoorOpen /> JOIN A ROOM
              </ArcadeButton>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-muted-foreground">
          <Logo />
          <p>Games to play with friends.</p>
        </div>
      </footer>

      <JoinRoomDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  );
}
