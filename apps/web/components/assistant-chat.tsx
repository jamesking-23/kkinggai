"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { blocks, greeting, type Span } from "../lib/assistant-format";

export type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  failed?: boolean;
};

const STARTERS = [
  { label: "What can you do?", text: "What can you do?" },
  { label: "My tasks", text: "My tasks" },
  { label: "Add a task", text: "Add task " },
  { label: "Calculate", text: "Calculate 15% of 80000" },
  { label: "Running report", text: "Running report" },
  { label: "Explain something", text: "Explain compound interest simply" },
];

function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) =>
        s.code ? (
          <code key={i} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.9em]">
            {s.text}
          </code>
        ) : s.bold ? (
          <strong key={i}>{s.text}</strong>
        ) : s.italic ? (
          <em key={i}>{s.text}</em>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
      className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-white/10 hover:text-text"
    >
      {done ? "Copied" : label}
    </button>
  );
}

/** Light markdown: paragraphs, headings, lists, code blocks, bold, italic, inline code. */
function Rich({ text }: { text: string }) {
  return (
    <div className="space-y-2.5">
      {blocks(text).map((b, i) => {
        if (b.type === "code")
          return (
            <div key={i} className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
              <div className="flex justify-end border-b border-white/10 px-1">
                <CopyButton text={b.text} label="Copy code" />
              </div>
              <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
                <code>{b.text}</code>
              </pre>
            </div>
          );
        if (b.type === "h")
          return (
            <p key={i} className="pt-1 text-base font-semibold">
              <Spans spans={b.spans} />
            </p>
          );
        if (b.type === "li")
          return (
            <p key={i} className="flex gap-2 pl-1">
              <span className="w-5 shrink-0 text-muted">{b.marker}</span>
              <span className="min-w-0 whitespace-pre-wrap">
                <Spans spans={b.spans} />
              </span>
            </p>
          );
        return (
          <p key={i} className="whitespace-pre-wrap">
            <Spans spans={b.spans} />
          </p>
        );
      })}
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex items-center gap-1.5 py-1" role="status" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <i
          key={i}
          className="block h-2 w-2 animate-bounce rounded-full bg-[#7c93ff]"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </span>
  );
}

let counter = 0;
const uid = () => `local-${Date.now()}-${counter++}`;

/**
 * Full chat: messages stay on the page (no reload), replies render as markdown with Copy, a stop button cancels the wait,
 * a failed send can be retried, and the box stays above the on-screen keyboard.
 */
export function AssistantChat(props: {
  initialMessages: ChatMsg[];
  conversationId: string | null;
  maxLength: number;
  name: string;
}) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<ChatMsg[]>(props.initialMessages);
  const [convId, setConvId] = useState<string | null>(props.conversationId);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [shown, setShown] = useState<{ id: string; n: number } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  // Keep the whole chat above the on-screen keyboard (iOS does not shrink the page; Android may).
  useLayoutEffect(() => {
    const vv = window.visualViewport;
    const el = root.current;
    if (!vv || !el) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top;
      const h = Math.max(260, Math.floor(vv.height - Math.max(0, top) - 8));
      el.style.height = `${Math.min(h, window.innerHeight - 8)}px`;
    };
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    window.addEventListener("resize", fit);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
    };
  }, []);

  // Auto-grow the box (up to about 8 lines).
  useLayoutEffect(() => {
    const t = box.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 180)}px`;
  }, [text]);

  const toBottom = useCallback((smooth = true) => {
    const s = scroller.current;
    if (s) s.scrollTo({ top: s.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (stick.current) toBottom(msgs.length <= props.initialMessages.length);
  }, [msgs, busy, shown, toBottom, props.initialMessages.length]);

  // Reveal a new answer word by word so it reads as it arrives.
  useEffect(() => {
    if (!shown) return;
    const m = msgs.find((x) => x.id === shown.id);
    if (!m) return;
    const total = m.content.length;
    if (shown.n >= total) {
      setShown(null);
      return;
    }
    const step = Math.max(6, Math.ceil(total / 90));
    const t = setTimeout(() => setShown({ id: shown.id, n: Math.min(total, shown.n + step) }), 16);
    return () => clearTimeout(t);
  }, [shown, msgs]);

  async function send(raw: string, retryId?: string) {
    const message = raw.trim();
    if (!message || busy) return;
    stick.current = true;
    setBusy(true);
    if (!retryId) {
      setMsgs((m) => [...m, { id: uid(), role: "user", content: message }]);
      setText("");
    } else {
      setMsgs((m) => m.filter((x) => x.id !== retryId));
    }
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, conversationId: convId }),
        signal: ctl.signal,
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
        conversationId?: string;
      };
      if (!res.ok || !data.reply) throw new Error(data.error || "Something went wrong.");
      const id = uid();
      setMsgs((m) => [...m, { id, role: "assistant", content: data.reply! }]);
      setShown({ id, n: 0 });
      if (data.conversationId && data.conversationId !== convId) {
        setConvId(data.conversationId);
        window.history.replaceState(null, "", `/assistant?c=${data.conversationId}`);
      }
      router.refresh();
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setMsgs((m) => [...m, { id: uid(), role: "assistant", content: "Stopped.", failed: true }]);
      } else {
        setMsgs((m) => [
          ...m,
          {
            id: uid(),
            role: "assistant",
            content: (e as Error).message || "Something went wrong.",
            failed: true,
          },
        ]);
      }
    } finally {
      abort.current = null;
      setBusy(false);
      setTimeout(() => box.current?.focus(), 0);
    }
  }

  const empty = msgs.length === 0;
  const lastUser = [...msgs].reverse().find((m) => m.role === "user");

  return (
    <div
      ref={root}
      className="flex min-h-[320px] flex-col"
      style={{ height: "calc(100dvh - 8rem)" }}
    >
      <div
        ref={scroller}
        onScroll={(e) => {
          const s = e.currentTarget;
          const near = s.scrollHeight - s.scrollTop - s.clientHeight < 80;
          stick.current = near;
          setAtBottom(near);
        }}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-4"
      >
        {empty ? (
          <div className="flex min-h-full flex-col items-center justify-center py-6 text-center">
            <div className="orb" aria-hidden />
            <h1 className="hero-title mt-12 text-3xl md:text-5xl">
              {greeting(new Date().getHours())}, {props.name}
            </h1>
            <p className="mt-2 text-lg text-muted">What&apos;s on your mind today?</p>
            <div className="mt-8 grid w-full max-w-xl grid-cols-2 gap-2.5 sm:grid-cols-3">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setText(s.text);
                    box.current?.focus();
                  }}
                  className="chip rounded-2xl px-4 py-3 text-left text-sm text-muted transition hover:text-text"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5 pt-2">
            {msgs.map((m) => {
              const reveal = shown && shown.id === m.id ? m.content.slice(0, shown.n) : m.content;
              return m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="btn-primary max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg px-4 py-2.5 text-[15px] leading-relaxed text-white">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-3">
                  <span
                    aria-hidden
                    className="brand-mark mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
                  >
                    K
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-[15px] leading-relaxed ${m.failed ? "text-[#ff8a8a]" : ""}`}
                    >
                      <Rich text={reveal} />
                    </div>
                    {!m.failed && (!shown || shown.id !== m.id) && (
                      <div className="mt-1 flex items-center gap-1 -ml-2">
                        <CopyButton text={m.content} />
                        {m.model && (
                          <span className="text-[11px] uppercase tracking-wider text-muted">
                            {m.model}
                          </span>
                        )}
                      </div>
                    )}
                    {m.failed && m.content !== "Stopped." && lastUser && (
                      <button
                        type="button"
                        onClick={() => void send(lastUser.content, m.id)}
                        className="mt-1 rounded-md px-2 py-1 text-xs text-[#7c93ff] hover:bg-white/10"
                      >
                        Try again
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {busy && (
              <div className="flex gap-3">
                <span
                  aria-hidden
                  className="brand-mark mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
                >
                  K
                </span>
                <Dots />
              </div>
            )}
          </div>
        )}
        {!atBottom && !empty && (
          <button
            type="button"
            onClick={() => {
              stick.current = true;
              toBottom();
            }}
            aria-label="Scroll to latest"
            className="glass sticky bottom-2 left-full -mt-10 grid h-9 w-9 place-items-center rounded-full"
          >
            ↓
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="glass mx-auto w-full max-w-3xl rounded-3xl p-2 pl-4"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={box}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            maxLength={props.maxLength}
            placeholder="Ask anything…"
            aria-label="Message"
            enterKeyHint="send"
            autoComplete="off"
            className="max-h-[180px] min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-base placeholder:text-muted"
            onFocus={() => setTimeout(() => toBottom(false), 250)}
            onKeyDown={(e) => {
              const desktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
              if (desktop && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(text);
              }
            }}
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              aria-label="Stop"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/20 text-text"
            >
              <span className="block h-3 w-3 rounded-sm bg-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!text.trim()}
              aria-label="Send message"
              className="btn-primary grid h-10 w-10 shrink-0 place-items-center rounded-full text-white disabled:opacity-40"
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
          )}
        </div>
      </form>
    </div>
  );
}
