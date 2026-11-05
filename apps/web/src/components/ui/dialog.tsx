import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  /** Omit to make the dialog impossible to dismiss (e.g. the "pick a name" gate). */
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (onOpenChange) onOpenChange(next);
      }}
      // Non-dismissible dialogs ignore Escape and outside clicks because onOpenChange is a no-op.
    >
      {children}
    </DialogPrimitive.Root>
  );
}

export interface DialogContentProps extends ComponentProps<
  typeof DialogPrimitive.Popup
> {
  raw?: boolean;
}

export function DialogContent({
  className,
  children,
  raw,
  ...props
}: DialogContentProps) {
  const classStr = typeof className === "string" ? className : "";
  const isRaw = raw || classStr.includes("bg-transparent");

  if (isRaw) {
    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 outline-none",
            "transition duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    );
  }

  const isDestructive =
    classStr.includes("border-rose") ||
    classStr.includes("destructive") ||
    classStr.includes("border-destructive");
  const isMaxW5xl = classStr.includes("max-w-5xl");
  const isMaxW4xl = classStr.includes("max-w-4xl");
  const isMaxW3xl = classStr.includes("max-w-3xl");
  const isMaxW2xl = classStr.includes("max-w-2xl");
  const isMaxWxl = classStr.includes("max-w-xl");
  const isMaxWLg = classStr.includes("max-w-lg");
  const isMaxWSm = classStr.includes("max-w-sm");

  const maxWidthClass = isMaxW5xl
    ? "max-w-5xl"
    : isMaxW4xl
      ? "max-w-4xl"
      : isMaxW3xl
        ? "max-w-3xl"
        : isMaxW2xl
          ? "max-w-2xl"
          : isMaxWxl
            ? "max-w-xl"
            : isMaxWLg
              ? "max-w-lg"
              : isMaxWSm
                ? "max-w-sm"
                : "max-w-md";

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <DialogPrimitive.Popup
        className={cn(
          "fixed top-1/2 left-1/2 z-50 max-h-[92dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 outline-none p-0 bg-transparent border-0 shadow-none",
          "transition duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          isDestructive
            ? "filter drop-shadow-[0_8px_0_#881337] drop-shadow(0 20px 30px rgba(0,0,0,0.85))"
            : "filter drop-shadow-[0_8px_0_#78350f] drop-shadow(0 20px 30px rgba(0,0,0,0.85))",
          maxWidthClass,
        )}
        {...props}
      >
        <div
          className={cn(
            "pixel-corners-lg p-[3px] w-full max-h-[92dvh] flex flex-col",
            isDestructive ? "bg-rose-500" : "bg-[#facc15]",
          )}
        >
          <div
            className={cn(
              "pixel-corners-md bg-[#0e0f16] p-6 sm:p-7 text-foreground w-full overflow-y-auto max-h-[calc(92dvh-6px)] relative flex flex-col",
              className,
            )}
          >
            {children}
          </div>
        </div>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export function DialogCloseButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label="Close dialog"
      className={cn(
        "absolute top-4 right-4 z-20 size-8 filter drop-shadow-[0_2px_0_#000000] active:translate-y-0.5 active:drop-shadow-none transition-all cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      <div className="pixel-corners-sm bg-[#facc15]/40 hover:bg-[#facc15] p-[1.5px] transition-colors size-full">
        <div className="pixel-corners-sm bg-[#12131a] hover:bg-[#1a1b24] text-gray-300 hover:text-[#facc15] size-full flex items-center justify-center transition-colors">
          <X className="size-4" />
        </div>
      </div>
    </button>
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        "text-xl font-bold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn(
        "mt-1.5 text-xs text-muted-foreground leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}
