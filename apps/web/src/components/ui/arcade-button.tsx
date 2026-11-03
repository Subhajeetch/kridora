import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const arcadeButtonVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2.5 whitespace-nowrap font-retro uppercase tracking-wider transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] disabled:pointer-events-none disabled:opacity-50 disabled:grayscale [&_svg]:size-5 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "pixel-corners-sm bg-[#facc15] hover:bg-[#fbbf24] text-black font-bold border-2 border-black filter drop-shadow-[0_4px_0_#78350f] active:translate-y-1 active:drop-shadow-[0_1px_0_#78350f]",
        secondary:
          "pixel-corners-sm bg-[#12131a] hover:bg-[#1a1b24] text-[#facc15] font-bold border-2 border-[#facc15] filter drop-shadow-[0_4px_0_#78350f] active:translate-y-1 active:drop-shadow-[0_1px_0_#78350f]",
        ghost: "text-foreground hover:bg-white/5",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        md: "h-11 px-5 text-xs sm:text-sm",
        lg: "h-12 sm:h-13 px-6 sm:px-7 text-xs sm:text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ArcadeButtonProps = ComponentProps<"button"> &
  VariantProps<typeof arcadeButtonVariants>;

function ArcadeButton({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ArcadeButtonProps) {
  return (
    <button
      type={type}
      className={cn(arcadeButtonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { ArcadeButton, arcadeButtonVariants };
