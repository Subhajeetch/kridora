import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { POCKET_WAR_LIMITS } from "@kridora/shared/games/pocket-war";
import type { PocketWarChatMessage } from "../types";

export type ChatOverlayPlacement = "arena" | "setup" | "gameover";

export interface ChatOverlayProps {
  messages: PocketWarChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
  onFocusChange?: (focused: boolean) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: ChatOverlayPlacement;
  isMobile?: boolean;
}

export function ChatOverlay({
  messages,
  currentUserId,
  onSendMessage,
  onFocusChange,
  isOpen: controlledOpen,
  onOpenChange,
  placement = "gameover",
  isMobile = false,
}: ChatOverlayProps) {
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>("");
  const [lastReadCount, setLastReadCount] = useState<number>(messages.length);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isOpen = controlledOpen ?? internalOpen;
  const unreadCount = isOpen ? 0 : Math.max(0, messages.length - lastReadCount);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen]);

  const setOpenState = (next: boolean) => {
    setLastReadCount(messages.length);
    if (controlledOpen === undefined) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
    if (!next) {
      onFocusChange?.(false);
    }
  };

  const handleToggle = () => {
    setOpenState(!isOpen);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = draft.trim().slice(0, POCKET_WAR_LIMITS.MAX_CHAT_LENGTH);
    if (!trimmed) return;
    onSendMessage(trimmed);
    setDraft("");
    setLastReadCount(messages.length + 1);
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      inputRef.current?.blur();
      setOpenState(false);
    }
  };

  // Position chat clear of mobile joysticks, desktop keycap dock, and setup CONFIRM button
  const containerPositionClass =
    placement === "arena"
      ? isMobile
        ? "top-2 left-1/2 -translate-x-1/2 items-center"
        : "bottom-16 right-4 items-end"
      : placement === "setup"
        ? "bottom-24 right-4 items-end"
        : "bottom-4 right-4 items-end";

  const openPanelAbove = !(placement === "arena" && isMobile);

  const panelNode = isOpen ? (
    <div className="flex h-64 w-76 max-w-[88vw] flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950/92 shadow-2xl backdrop-blur-md sm:h-72 sm:w-80">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs font-black tracking-wider text-amber-300 uppercase">
          Squad Chat ({messages.length}/{POCKET_WAR_LIMITS.MAX_CHAT_MESSAGES})
        </span>
        <button
          type="button"
          onClick={() => setOpenState(false)}
          className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2 text-xs"
      >
        {messages.length === 0 ? (
          <p className="py-6 text-center text-slate-500">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.userId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`rounded-lg px-2.5 py-1.5 break-words ${
                  isSelf
                    ? "bg-sky-500/15 text-sky-50"
                    : "bg-white/5 text-slate-100"
                }`}
              >
                <span
                  className={`mr-1.5 font-bold ${
                    isSelf ? "text-amber-300" : "text-sky-300"
                  }`}
                >
                  {msg.username}:
                </span>
                {/* Strictly rendered as a React text node to prevent XSS */}
                <span>{msg.text}</span>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-white/10 bg-slate-900/85 p-2"
      >
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            maxLength={POCKET_WAR_LIMITS.MAX_CHAT_LENGTH}
            onFocus={() => onFocusChange?.(true)}
            onBlur={() => onFocusChange?.(false)}
            onKeyDown={handleInputKeyDown}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type message... (Esc to close)"
            className="flex-1 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-lg bg-sky-500 p-1.5 text-slate-950 transition hover:bg-sky-400 disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-1 text-right text-[10px] text-slate-400">
          {draft.length}/{POCKET_WAR_LIMITS.MAX_CHAT_LENGTH}
        </div>
      </form>
    </div>
  ) : null;

  return (
    <div
      className={`pointer-events-auto fixed z-40 flex flex-col gap-2 ${containerPositionClass}`}
    >
      {openPanelAbove && panelNode}

      <button
        type="button"
        onClick={handleToggle}
        className="relative flex items-center gap-1.5 rounded-full border border-white/25 bg-slate-950/80 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur transition hover:bg-slate-900 active:scale-95"
      >
        <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
        <span>Chat</span>
        {unreadCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {!openPanelAbove && panelNode}
    </div>
  );
}
