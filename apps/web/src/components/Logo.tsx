import { cn } from "@/lib/utils";

/** Two interlocked rings: the brand mark (and a nod to the Rings currency). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/kridora-logo.webp"
      alt="Kridora logo"
      aria-hidden="true"
      className={cn(
        "size-7 shrink-0 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]",
        className,
      )}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 select-none transition-transform group hover:scale-[1.02]",
        className,
      )}
    >
      <LogoMark />
      <span className="font-retro text-lg sm:text-xl font-bold uppercase tracking-wider text-[#facc15] drop-shadow-[0_2px_0_#b45309] group-hover:text-[#fde047] transition-colors">
        KRIDORA
      </span>
    </span>
  );
}
