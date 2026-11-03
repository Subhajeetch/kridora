import { AlertCircle, Check, Loader2, Send, UserPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { describeError, request } from "@/lib/socket";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserDialog({
  open,
  onOpenChange,
}: InviteUserDialogProps) {
  const [targetId, setTargetId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!inviting) {
      if (!next) {
        setTargetId("");
        setError(null);
        setSuccess(null);
      }
      onOpenChange(next);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanId = targetId.trim();
    if (!cleanId || cleanId.length < 4) {
      setError("Please enter a valid User ID (minimum 4 digits).");
      return;
    }

    setInviting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await request("room:invite-user", {
        targetNumericId: cleanId,
      });
      setSuccess(`Invitation successfully sent to ${res.targetName}!`);
      setTargetId("");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setInviting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogCloseButton onClick={() => handleOpenChange(false)} />

        <div className="flex items-center gap-3 pr-6">
          <div className="pixel-corners-sm bg-[#facc15] p-[2px] shrink-0 filter drop-shadow-[0_2px_0_#78350f]">
            <div className="grid size-10 place-items-center pixel-corners-sm bg-[#12131a] text-[#facc15]">
              <UserPlus className="size-5" />
            </div>
          </div>
          <div>
            <DialogTitle className="font-retro text-base sm:text-lg font-bold uppercase tracking-wide text-white">
              Invite with User ID
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Send an instant real-time invitation to any online player.
            </DialogDescription>
          </div>
        </div>

        {error && (
          <div className="mt-4 pixel-corners-sm bg-destructive p-[2px] filter drop-shadow-[0_2px_0_#881337]">
            <div className="flex items-start gap-2.5 pixel-corners-sm bg-[#1a0a0d] px-3.5 py-2.5 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="mt-4 pixel-corners-sm bg-emerald-400 p-[2px] filter drop-shadow-[0_2px_0_#065f46]">
            <div className="flex items-start gap-2.5 pixel-corners-sm bg-[#062014] px-3.5 py-2.5 text-xs text-emerald-300">
              <Check className="size-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{success}</span>
            </div>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="target-user-id"
              className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
            >
              Numeric User ID
            </label>
            <Input
              id="target-user-id"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="e.g. 104829"
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value.replace(/\D/g, ""));
                if (error) setError(null);
              }}
              maxLength={10}
              className="h-12 font-mono text-xl tracking-[0.25em] text-center text-[#facc15] font-bold"
              disabled={inviting}
              autoFocus
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Players can find their numeric User ID by opening their Profile
              menu.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={inviting}
              className="pixel-corners-sm"
            >
              Cancel
            </Button>
            <button
              type="submit"
              className="filter drop-shadow-[0_4px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={inviting || targetId.length < 4}
            >
              <div className="pixel-corners-sm bg-black p-[2px]">
                <div className="pixel-corners-sm bg-[#facc15] hover:bg-[#fbbf24] text-black font-retro text-xs font-bold uppercase tracking-wider h-9 px-4 flex items-center justify-center gap-1.5">
                  {inviting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin text-black" />
                      <span>Inviting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      <span>Send Invite</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
