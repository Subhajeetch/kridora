import { cn } from "@/lib/utils";

/** Two interlocked rings: the brand mark (and a nod to the Rings currency). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/kridora-logo.webp"
      alt="Kridora logo"
      aria-hidden="true"
      className={cn("size-6 shrink-0 object-contain", className)}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-xl uppercase tracking-wide">
        KRIDORA
      </span>
    </span>
  );
}
