import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends ComponentProps<"input"> {
  containerClassName?: string;
  wrapperClassName?: string;
}

export function Input({
  className,
  type = "text",
  disabled,
  containerClassName,
  wrapperClassName,
  ...props
}: InputProps) {
  const isInvalid = Boolean(props["aria-invalid"]);

  const heightClass = className?.includes("h-8")
    ? "h-8"
    : className?.includes("h-14")
      ? "h-14"
      : className?.includes("h-12")
        ? "h-12"
        : className?.includes("h-9")
          ? "h-9"
          : "h-10 sm:h-11";

  // Strip height, border, background, and corner classes from input so the outer dual-container handles them cleanly
  const cleanInputClass = className
    ?.replace(/\bh-(?:8|9|10|11|12|14)\b/g, "")
    ?.replace(/\bborder(?:-[0-9a-z/]+)?\b/g, "")
    ?.replace(/\bpixel-corners-[a-z]+\b/g, "")
    ?.replace(/\bbg-[a-z0-9/\[\]#]+\b/g, "")
    ?.replace(/\brounded-[a-z0-9]+\b/g, "");

  return (
    <div
      className={cn(
        "group relative w-full filter drop-shadow-[0_3px_0_#000000] focus-within:drop-shadow-[0_3px_0_#78350f] transition-all",
        disabled && "opacity-50 cursor-not-allowed",
        containerClassName,
      )}
    >
      <div
        className={cn(
          "pixel-corners-sm p-[2px] transition-colors",
          isInvalid
            ? "bg-destructive"
            : "bg-[#facc15]/40 hover:bg-[#facc15]/70 focus-within:bg-[#facc15]",
          wrapperClassName,
        )}
      >
        <div
          className={cn(
            "pixel-corners-sm bg-[#12131a] flex items-center w-full px-3.5",
            heightClass,
          )}
        >
          <input
            type={type}
            disabled={disabled}
            className={cn(
              "w-full bg-transparent text-sm text-white placeholder:text-gray-400 outline-none font-sans",
              cleanInputClass,
            )}
            {...props}
          />
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}

export function Field({ label, error, children }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
      {error ? (
        <span className="block text-xs font-medium text-destructive">
          {error}
        </span>
      ) : null}
    </label>
  );
}
