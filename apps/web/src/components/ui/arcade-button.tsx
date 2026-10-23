import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

const arcadeButtonVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-display uppercase tracking-wide transition-[transform,box-shadow,filter,background-color] duration-150 outline-none focus-visible:ring-4 focus-visible:ring-primary/50 active:translate-y-[3px] disabled:pointer-events-none disabled:opacity-50 disabled:grayscale [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "btn-shine bg-linear-to-b from-[#ffe27a] to-coin text-[#1a1033] shadow-[0_5px_0_0_#b86e00,0_14px_28px_-8px_rgba(255,210,63,0.55)] hover:brightness-110 active:shadow-[0_2px_0_0_#b86e00,0_8px_18px_-8px_rgba(255,210,63,0.45)]",
        secondary:
          "border-2 border-neon-cyan bg-neon-cyan/5 text-neon-cyan shadow-[0_4px_0_0_#0b7285,0_0_28px_-8px_rgba(34,228,255,0.6)] hover:bg-neon-cyan/15 active:shadow-[0_1px_0_0_#0b7285,0_0_18px_-8px_rgba(34,228,255,0.5)]",
        ghost: "text-foreground hover:bg-white/5",
      },
      size: {
        md: "h-11 rounded-xl px-5 text-sm",
        lg: "h-14 rounded-2xl px-8 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
)

type ArcadeButtonProps = ComponentProps<"button"> & VariantProps<typeof arcadeButtonVariants>

function ArcadeButton({ className, variant = "primary", size = "md", type = "button", ...props }: ArcadeButtonProps) {
  return <button type={type} className={cn(arcadeButtonVariants({ variant, size, className }))} {...props} />
}

export { ArcadeButton, arcadeButtonVariants }