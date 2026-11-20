"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";

const SUGGESTIONS = [
  "Help me plan my week",
  "Explain a concept simply",
  "Draft a polite follow-up email",
  "Brainstorm ideas with me",
];

function Thinking() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 px-2 pb-3">
      <span className="think-orbs" aria-hidden>
        <i />
        <i />
      </span>
      <span className="shimmer-text text-lg font-light">Thinking…</span>
    </div>
  );
}

function Send({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-label="Send message"
      className="btn-primary grid h-9 w-9 place-items-center rounded-full text-white disabled:opacity-40"
    >
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden>
        <path
          d="M10 16V4m0 0-5 5m5-5 5 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/** Glass prompt box. Enter sends, Shift+Enter adds a line; suggestion chips fill the box. */
export function AssistantComposer(props: {
  action: (formData: FormData) => void | Promise<void>;
  conversationId: string | null;
  maxLength: number;
  disabled: boolean;
  showSuggestions: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div>
      <form action={props.action} className="glass rounded-2xl p-3">
        {props.conversationId && (
          <input type="hidden" name="conversationId" value={props.conversationId} />
        )}
        <Thinking />
        <textarea
          ref={ref}
          name="message"
          required
          rows={2}
          maxLength={props.maxLength}
          placeholder="Ask anything…"
          aria-label="Message"
          className="w-full resize-none bg-transparent px-2 py-1 text-[15px] placeholder:text-muted"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between px-1">
          <span className="text-xs text-muted">Enter to send · Shift+Enter for a new line</span>
          <Send disabled={props.disabled} />
        </div>
      </form>
      {props.showSuggestions && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="chip rounded-full px-3.5 py-1.5 text-xs text-muted hover:text-text"
              onClick={() => {
                if (!ref.current) return;
                ref.current.value = s;
                ref.current.focus();
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
