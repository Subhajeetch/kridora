import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface LeaveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLeaving: boolean;
}

export function LeaveConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isLeaving,
}: LeaveConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-rose-500/30 bg-slate-900 text-slate-100">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <LogOut className="size-5" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-white">
              Leave Active Match?
            </DialogTitle>
            <p className="text-xs text-rose-300">Leaving room confirmation</p>
          </div>
        </div>

        <DialogDescription className="mt-3 text-sm text-slate-300 leading-relaxed">
          If you intentionally leave the room now,{" "}
          <strong className="font-bold text-white">
            all your game pieces and progress will be permanently removed
          </strong>{" "}
          from this match.
        </DialogDescription>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isLeaving}
            className="rounded-xl text-slate-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isLeaving}
            className="rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white"
          >
            {isLeaving ? "Leaving..." : "Leave Match"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
