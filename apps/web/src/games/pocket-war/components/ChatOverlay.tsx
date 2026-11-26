import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import {
  POCKET_WAR_LIMITS,
  sanitizeChatMessage,
  type PocketWarChatMessage,
} from "../types";

export interface ChatOverlayProps {
  messages: readonly PocketWarChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
  onFocusChange?: (focused: boolean) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  placement: "setup" | "arena" | "gameover";
  isMobile: boolean;
}

export function ChatOverlay({
  messages,
  currentUserId,
  onSendMessage,
  onFocusChange,
  isOpen,
  onOpenChange,
  placement,
  isMobile,
}: ChatOverlayProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    if (!isOpen) return;
    if (!isMobile) {
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 40);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, isMobile]);

  const handleClose = () => {
    onFocusChange?.(false);
    onOpenChange(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeChatMessage(draft);
    if (!cleaned) return;
    onSendMessage(cleaned);
    setDraft("");
    if (isMobile) {
      inputRef.current?.blur();
    }
  };

  // In active arena, ArenaHud owns the top-left Chat button so nothing overlaps on mobile landscape.
  if (!isOpen) {
    if (placement === "arena") {
      return null;
    }

    const buttonPosClass =
      placement === "setup"
        ? "bottom-18 left-3 sm:bottom-24 sm:left-5"
        : "bottom-4 right-4";

    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className={`fixed z-30 flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-900/85 px-3 py-2 text-xs font-black text-white shadow-xl backdrop-blur-md transition hover:bg-slate-800 active:scale-95 ${buttonPosClass}`}
        aria-label="Open match chat"
      >
        <MessageSquare className="h-4 w-4 text-sky-300" />
        <span>Chat</span>
        {messages.length > 0 && (
          <span className="rounded-full bg-sky-500/25 px-1.5 py-0.5 font-mono text-[10px] text-sky-200">
            {messages.length}
          </span>
        )}
      </button>
    );
  }

  // Positioned strictly clear of top HUD and bottom touch joysticks (safe at 667x375 & 844x390)
  const panelPosClass =
    placement === "arena"
      ? "top-14 left-2 sm:top-16 sm:left-3"
      : placement === "setup"
        ? "bottom-18 left-2 sm:bottom-24 sm:left-5"
        : "bottom-4 right-3 sm:right-5";

  return (
    <div
      className={`fixed z-40 flex w-[min(310px,calc(100vw-16px))] flex-col overflow-hidden rounded-2xl border border-white/20 bg-slate-950/92 text-white shadow-2xl backdrop-blur-md ${panelPosClass}`}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          handleClose();
        }
      }}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/90 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-sky-400" />
          <span className="text-[11px] font-black tracking-wider uppercase">
            Squad Chat
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            ({messages.length})
          </span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[min(145px,calc(100dvh-200px))] min-h-24 space-y-1.5 overflow-y-auto px-3 py-2 text-xs sm:max-h-52"
      >
        {messages.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-slate-500">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === currentUserId;
            return (
              <div
                key={msg.id}
                className="break-words leading-snug text-slate-200"
              >
                <span
                  className={`mr-1.5 font-black ${
                    isMe ? "text-sky-300" : "text-amber-300"
                  }`}
                >
                  {msg.username}:
                </span>
                <span>{msg.text}</span>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-1.5 border-t border-white/10 bg-slate-900/80 p-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          maxLength={POCKET_WAR_LIMITS.MAX_CHAT_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          placeholder="Type message..."
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-slate-950/90 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={draft.trim().length === 0}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white transition hover:bg-sky-400 active:scale-95 disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
