import { AlertCircle, Check, Loader2, Send, UserPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
      <DialogContent className="max-w-md p-6 sm:p-7">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-primary/15 text-primary shadow-sm">
            <UserPlus className="size-5" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight">
              Invite with User ID
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Send an instant real-time invitation to any online player.
            </DialogDescription>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive"
          >
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mt-4 flex items-start gap-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-2.5 text-xs text-emerald-300"
          >
            <Check className="size-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{success}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="target-user-id"
              className="block text-xs font-medium text-foreground mb-1.5"
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
              className="h-10 rounded-xl font-mono text-sm tracking-wider"
              disabled={inviting}
              autoFocus
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Players can find their numeric User ID by opening their Profile
              menu.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={inviting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="gap-1.5 rounded-xl px-4"
              disabled={inviting || targetId.length < 4}
            >
              {inviting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Inviting...</span>
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  <span>Send Invite</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
