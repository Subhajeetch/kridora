import {
  BUSINESS_CHAT_MAX_LENGTH,
  type BusinessChatMessage,
} from "@kridora/shared";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquareText, SendHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { isSafeAvatarUrl } from "../utils";

interface BusinessChatBarProps {
  messages: readonly BusinessChatMessage[];
  activePopup: BusinessChatMessage | null;
  currentUserId: string;
  onSendMessage: (text: string) => void;
}

export function BusinessChatBar({
  messages,
  activePopup,
  currentUserId,
  onSendMessage,
}: BusinessChatBarProps) {
  const [draft, setDraft] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = isOpen ? 0 : Math.max(0, messages.length - seenCount);

  useEffect(() => {
    if (isOpen) {
      listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages.length]);

  const handleToggleHistory = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setSeenCount(messages.length);
      }
      return next;
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = draft.trim().slice(0, BUSINESS_CHAT_MAX_LENGTH);
    if (!cleaned) return;
    onSendMessage(cleaned);
    setDraft("");
    setSeenCount(messages.length + 1);
  };

  return (
    <div className="relative z-40 w-full shrink-0">
      {/* 1-Second Bottom-Right Floating Chat Popup Toast */}
      <div className="pointer-events-none fixed right-3 bottom-14 z-50 flex flex-col items-end sm:right-5 sm:bottom-16">
        <AnimatePresence mode="wait">
          {activePopup && !isOpen && (
            <motion.div
              key={activePopup.id}
              initial={{ opacity: 0, y: 12, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex max-w-[260px] items-center gap-2 rounded-2xl border border-white/15 bg-[#1e1d24]/95 px-3 py-2 text-white shadow-2xl backdrop-blur-md sm:max-w-[310px]"
            >
              <div
                style={{ borderColor: activePopup.color }}
                className="h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 bg-slate-800"
              >
                {isSafeAvatarUrl(activePopup.avatarUrl) ? (
                  <img
                    src={activePopup.avatarUrl ?? undefined}
                    alt={activePopup.username}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    style={{ backgroundColor: activePopup.color }}
                    className="flex h-full w-full items-center justify-center text-[10px] font-black text-white"
                  >
                    {activePopup.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0 text-left">
                <div className="truncate text-[10px] font-extrabold text-slate-300">
                  {activePopup.username}
                </div>
                <p className="break-words text-xs font-semibold leading-snug text-white">
                  {activePopup.text}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ephemeral In-Memory Chat History Drawer (Max 250 Messages) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.18 }}
            className="mx-auto mb-1.5 w-[calc(100%-16px)] max-w-2xl overflow-hidden rounded-2xl border border-white/15 bg-[#1c1b22]/96 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-white">
                <MessageSquareText className="h-3.5 w-3.5 text-[#8ee04e]" />
                <span>Table Chat</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="cursor-pointer rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Close chat history"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex max-h-48 flex-col gap-2 overflow-y-auto px-3.5 py-2.5 sm:max-h-56">
              {messages.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  No messages yet. Say hello to the table!
                </p>
              ) : (
                messages.map((msg) => {
                  const mine = msg.userId === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 ${
                        mine ? "flex-row-reverse text-right" : ""
                      }`}
                    >
                      <div
                        style={{ borderColor: msg.color }}
                        className="mt-0.5 h-6 w-6 shrink-0 overflow-hidden rounded-full border bg-slate-800"
                      >
                        {isSafeAvatarUrl(msg.avatarUrl) ? (
                          <img
                            src={msg.avatarUrl ?? undefined}
                            alt={msg.username}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            style={{ backgroundColor: msg.color }}
                            className="flex h-full w-full items-center justify-center text-[9px] font-black text-white"
                          >
                            {msg.username.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div
                        className={`max-w-[78%] rounded-2xl px-3 py-1.5 text-xs ${
                          mine
                            ? "bg-[#1885f2] text-white"
                            : "bg-white/10 text-slate-100"
                        }`}
                      >
                        {!mine && (
                          <div className="mb-0.5 text-[10px] font-extrabold text-slate-300">
                            {msg.username}
                          </div>
                        )}
                        <p className="break-words leading-snug">{msg.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={listEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Chat Input Bar Matching Reference UI */}
      <div className="w-full border-t border-white/10 bg-[#17161c] px-2.5 py-2 sm:px-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-2xl items-center gap-2"
        >
          <button
            type="button"
            onClick={handleToggleHistory}
            className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#8ee04e] transition hover:bg-white/10 active:scale-95"
            title="Toggle chat history"
            aria-label="Toggle chat history"
          >
            <MessageSquareText className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <div className="relative flex flex-1 items-center">
            <input
              type="text"
              value={draft}
              onChange={(e) =>
                setDraft(e.target.value.slice(0, BUSINESS_CHAT_MAX_LENGTH))
              }
              maxLength={BUSINESS_CHAT_MAX_LENGTH}
              placeholder="Say hello..."
              autoComplete="off"
              className="w-full rounded-xl outline-none bg-white/4 px-2.5 py-1.5 text-sm text-white"
            />
            {draft.length >= BUSINESS_CHAT_MAX_LENGTH - 25 && (
              <span className="absolute right-3 text-[10px] font-bold text-slate-400">
                {BUSINESS_CHAT_MAX_LENGTH - draft.length}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-35"
            title="Send message"
            aria-label="Send message"
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
