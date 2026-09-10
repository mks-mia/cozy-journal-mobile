import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";

import { dueMindfulPhrase, markMindfulShown } from "../lib/diary-store";

let mindfulShownThisVisit = false;

type Session = { id: string; title: string; createdAt: number };

const newSession = (): Session => ({
  id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title: "New chat",
  createdAt: Date.now(),
});

export function FriendChat({ name }: { name: string }) {
  const [sessions, setSessions] = useState<Session[]>(() => [newSession()]);
  const [activeId, setActiveId] = useState<string>(() => sessions[0]!.id);
  const [listOpen, setListOpen] = useState(false);

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0]!;

  const startChat = () => {
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
    setListOpen(false);
  };

  const titleFor = (id: string, text: string) =>
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id && s.title === "New chat" ? { ...s, title: text.slice(0, 34) } : s,
      ),
    );

  const removeSession = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      const list = next.length > 0 ? next : [newSession()];
      if (id === activeId) setActiveId(list[0]!.id);
      return list;
    });
  };

  return (
    <section className="mt-4 flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-[22px] leading-none text-ink">Lumen</h2>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
            a friend to talk to
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setListOpen((v) => !v)}
            className="rounded-full bg-white/55 px-3.5 py-2 text-[12px] font-medium text-ink-soft ring-1 ring-ink/10 backdrop-blur-md transition-colors hover:bg-white/85"
          >
            Chats
          </button>
          <button
            onClick={startChat}
            className="rounded-full bg-ink px-3.5 py-2 text-[12px] font-medium text-vellum transition-opacity hover:opacity-90"
          >
            New
          </button>
        </div>
      </div>

      {listOpen && (
        <ul className="glass mt-3 space-y-1 rounded-2xl p-2 ring-1 ring-white/70">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-1">
              <button
                onClick={() => {
                  setActiveId(s.id);
                  setListOpen(false);
                }}
                className={`flex-1 truncate rounded-xl px-3 py-2 text-left text-[13px] ${
                  s.id === activeId ? "bg-ink text-vellum" : "text-ink-soft hover:bg-white/70"
                }`}
              >
                {s.title}
              </button>
              <button
                onClick={() => removeSession(s.id)}
                aria-label="Delete chat"
                className="rounded-xl px-2.5 py-2 font-mono text-[11px] text-ink-soft hover:text-alert"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <ChatWindow
        key={active.id}
        sessionId={active.id}
        name={name}
        onFirstMessage={(text) => titleFor(active.id, text)}
      />
    </section>
  );
}

function ChatWindow({
  sessionId,
  name,
  onFirstMessage,
}: {
  sessionId: string;
  name: string;
  onFirstMessage: (text: string) => void;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { name },
      }),
    [name],
  );

  const { messages, setMessages, sendMessage, status } = useChat({
    id: sessionId,
    transport,
    onError: (e) => setError(e.message || "Something went wrong."),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    inputRef.current?.focus();
  }, [sessionId]);

  // Every two weeks, Lumen opens with a mindfulness / motivational thought.
  useEffect(() => {
    if (mindfulShownThisVisit) return;
    const phrase = dueMindfulPhrase();
    if (!phrase) return;
    mindfulShownThisVisit = true;
    markMindfulShown();
    setMessages([
      {
        id: `mindful-${Date.now()}`,
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `Something I've been sitting with${name ? `, ${name}` : ""}:\n\n${phrase}`,
          },
        ],
      },
    ]);
    onFirstMessage("A thought for this fortnight");
  }, [name, setMessages, onFirstMessage]);

  useEffect(() => {
    boxRef.current?.scrollTo({
      top: boxRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    if (messages.length === 0) onFirstMessage(text);
    void sendMessage({ text });
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <>
      <div
        ref={boxRef}
        className="glass mt-3 flex-1 space-y-3 overflow-y-auto rounded-3xl p-4 ring-1 ring-white/70"
      >
        {messages.length === 0 && (
          <p className="mt-6 text-center font-serif text-[17px] leading-relaxed text-ink-soft">
            Hey{name ? ` ${name}` : ""} — how&apos;s your day going?
          </p>
        )}

        {messages.map((m: UIMessage) => (
          <Bubble key={m.id} role={m.role} text={textOf(m)} />
        ))}

        {status === "submitted" && <Bubble role="assistant" text="…" />}

        {error && (
          <p className="rounded-2xl bg-alert/10 px-3 py-2 text-[12px] text-alert">{error}</p>
        )}
      </div>

      <div className="glass mt-3 flex items-end gap-2 rounded-3xl p-2 ring-1 ring-white/70">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Say something…"
          className="max-h-28 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-soft/60"
        />
        <button
          onClick={submit}
          disabled={busy || input.trim().length === 0}
          className="rounded-full bg-ink px-4 py-2.5 text-[13px] font-medium text-vellum transition-opacity disabled:opacity-40"
        >
          {busy ? "…" : "Send"}
        </button>
      </div>
    </>
  );
}

function textOf(m: UIMessage): string {
  return m.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/g;

function linkify(text: string, mine: boolean) {
  const parts = text.split(URL_RE);
  return parts.map((part, i) => {
    if (!URL_RE.test(part)) return part;
    URL_RE.lastIndex = 0;
    const href = part.startsWith("http") ? part : `https://${part}`;
    return (
      <a
        key={i}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline underline-offset-2 ${mine ? "text-vellum" : "text-accent"}`}
      >
        {part}
      </a>
    );
  });
}

function Bubble({ role, text }: { role: string; text: string }) {
  if (!text) return null;
  const mine = role === "user";
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <p
        className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${
          mine ? "bg-ink text-vellum" : "bg-white/70 text-ink ring-1 ring-ink/5"
        }`}
      >
        {linkify(text, mine)}
      </p>
    </div>
  );
}
