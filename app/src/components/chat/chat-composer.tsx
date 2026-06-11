"use client";

import { useEffect, useRef } from "react";
import { Loader2, Send } from "lucide-react";

export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea up to a max height.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-white/[0.06] p-3">
      <div className="flex items-end gap-2 rounded-2xl glass border-white/[0.08] px-3 py-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          placeholder="Ask for tactical, no-BS advice…"
          className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-sm text-foreground/90 placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white transition-opacity disabled:opacity-30"
          aria-label="Send"
        >
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[10px] text-muted-foreground/50">
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  );
}
