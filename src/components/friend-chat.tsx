
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../components/auth";
import { createClient } from "../lib/supabase";
import { dueMindfulPhrase, markMindfulShown } from "../lib/diary-store";

let mindfulShownThisVisit = false;

type Session = {
  id: string;
  title: string;
  createdAt: number;
};

const newSession = (): Session => ({
  id: crypto.randomUUID(),
  title: "New chat",
  createdAt: Date.now(),
});

export function FriendChat({ name }: { name: string }) {
  const [listOpen, setListOpen] = useState(false);

  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      const saved = localStorage.getItem("lamplit.chat.sessions.v1");
      if (saved) {
        const parsed = JSON.parse(saved) as Session[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Start a fresh session if stored data is invalid.
    }

    return [newSession()];
  });

  const [activeId, setActiveId] = useState<string>(() => {
    const saved = localStorage.getItem("lamplit.chat.active.v1");
    const storedSessions = (() => {
      try {
        const value = localStorage.getItem("lamplit.chat.sessions.v1");
        return value ? (JSON.parse(value) as Session[]) : [];
      } catch {
        return [];
      }
    })();

    return saved && storedSessions.some((s) => s.id === saved)
      ? saved
      : "";
  });

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0]!;

  useEffect(() => {
    if (!sessions.some((s) => s.id === activeId)) {
      setActiveId(sessions[0]!.id);
    }
  }, [sessions, activeId]);

  useEffect(() => {
    localStorage.setItem(
      "lamplit.chat.sessions.v1",
      JSON.stringify(sessions),
    );
  }, [sessions]);

  useEffect(() => {
    if (activeId) {
      localStorage.setItem("lamplit.chat.active.v1", activeId);
    }
  }, [activeId]);

  const startChat = () => {
    const session = newSession();
    setSessions((previous) => [session, ...previous]);
    setActiveId(session.id);
    setListOpen(false);
  };

  const titleFor = (id: string, text: string) => {
    setSessions((previous) =>
      previous.map((session) =>
        session.id === id && session.title === "New chat"
          ? { ...session, title: text.slice(0, 34) }
          : session,
      ),
    );
  };

  const removeSession = (id: string) => {
    const remaining = sessions.filter((session) => session.id !== id);

    if (remaining.length > 0) {
      setSessions(remaining);

      if (id === activeId) {
        setActiveId(remaining[0]!.id);
      }
    } else {
      const replacement = newSession();
      setSessions([replacement]);
      setActiveId(replacement.id);
    }
  };

  return (
    <section className="mt-4 flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-[22px] leading-none text-ink">
            Lumen
          </h2>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
            a friend to talk to
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setListOpen((value) => !value)}
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
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center gap-1">
              <button
                onClick={() => {
                  setActiveId(session.id);
                  setListOpen(false);
                }}
                className={`flex-1 truncate rounded-xl px-3 py-2 text-left text-[13px] ${
                  session.id === active.id
                    ? "bg-ink text-vellum"
                    : "text-ink-soft hover:bg-white/70"
                }`}
              >
                {session.title}
              </button>
              <button
                onClick={() => removeSession(session.id)}
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
  const user = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const savedMessageIds = useRef(new Set<string>());
  const savingMessageIds = useRef(new Set<string>());

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

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
    onError: (chatError) =>
      setError(chatError.message || "Something went wrong."),
  });

  const busy = status === "submitted" || status === "streaming";

  // Ensure the database session exists before loading its messages.
  useEffect(() => {
    let cancelled = false;

    async function prepareSessionAndLoadMessages() {
      if (!user) {
        setHistoryLoading(false);
        return;
      }

      setHistoryLoading(true);
      savedMessageIds.current = new Set();
      savingMessageIds.current = new Set();

      const { data: existingSession, error: checkError } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (checkError) {
        console.error("Failed to check chat session:", checkError.message);
        setError("Unable to load this chat. Please refresh and try again.");
        setHistoryLoading(false);
        return;
      }

      if (!existingSession) {
        const { error: insertError } = await supabase
          .from("chat_sessions")
          .insert({
            id: sessionId,
            user_id: user.id,
            title: "New chat",
          });

        if (cancelled) return;

        if (insertError) {
          console.error(
            "Failed to create chat session:",
            insertError.message,
          );
          setError("Unable to create this chat. Please refresh and try again.");
          setHistoryLoading(false);
          return;
        }
      }

      const { data, error: loadError } = await supabase
        .from("chat_messages")
        .select("id, client_message_id, role, content")
        .eq("user_id", user.id)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (loadError) {
        console.error("Failed to load chat history:", loadError.message);
        setError("Unable to load your chat history.");
      } else {
        savedMessageIds.current = new Set(
          (data ?? []).map((row) => row.client_message_id ?? row.id),
        );

        const loadedMessages = (data ?? []).map((row) => ({
          id: row.client_message_id ?? row.id,
          role: row.role as "user" | "assistant",
          parts: [{ type: "text" as const, text: row.content }],
        }));
        const uniqueMessages = Array.from(
          new Map(loadedMessages.map((message) => [message.id, message])).values(),
        );
        setMessages(uniqueMessages);
      }

      setHistoryLoading(false);
    }

    void prepareSessionAndLoadMessages();

    return () => {
      cancelled = true;
    };
  }, [sessionId, user, supabase, setMessages]);

  // Persist completed messages after the database history has loaded.
  useEffect(() => {
    if (historyLoading || busy || !user || messages.length === 0) {
      return;
    }

    let cancelled = false;
    const currentUser = user;

    async function saveMessages() {
      for (const message of messages) {
        if (cancelled) return;

        if (
          savedMessageIds.current.has(message.id) ||
          savingMessageIds.current.has(message.id) ||
          (message.role !== "user" && message.role !== "assistant")
        ) {
          continue;
        }

        const content = message.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("")
          .trim();

        if (!content) continue;

        savingMessageIds.current.add(message.id);

        const { error: saveError } = await supabase
          .from("chat_messages")
          .upsert(
            {
              session_id: sessionId,
              user_id: currentUser.id,
              client_message_id: message.id,
              role: message.role,
              content,
            },
            {
              onConflict: "session_id,client_message_id",
              ignoreDuplicates: true,
            },
          );

        savingMessageIds.current.delete(message.id);

        if (saveError) {
          console.error("Failed to save chat message:", saveError.message);
        } else {
          savedMessageIds.current.add(message.id);
        }
      }
    }

    void saveMessages();

    return () => {
      cancelled = true;
    };
  }, [messages, busy, historyLoading, user, supabase, sessionId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [sessionId]);

  // Show a mindfulness thought at most once per visit when one is due.
  useEffect(() => {
    if (mindfulShownThisVisit || historyLoading || messages.length > 0) {
      return;
    }

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
  }, [name, historyLoading, messages.length, setMessages, onFirstMessage]);

  useEffect(() => {
    boxRef.current?.scrollTo({
      top: boxRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  const submit = () => {
    const text = input.trim();

    if (!text || busy || historyLoading || !user) return;

    setError(null);

    if (messages.length === 0) {
      onFirstMessage(text);
    }

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
        {historyLoading && (
          <p className="mt-6 text-center text-[13px] text-ink-soft">
            Loading conversation…
          </p>
        )}

        {!historyLoading && messages.length === 0 && (
          <p className="mt-6 text-center font-serif text-[17px] leading-relaxed text-ink-soft">
            Hey{name ? ` ${name}` : ""} — how&apos;s your day going?
          </p>
        )}

        {messages.map((message: UIMessage) => (
          <Bubble
            key={message.id}
            role={message.role}
            text={textOf(message)}
          />
        ))}

        {status === "submitted" && <Bubble role="assistant" text="…" />}

        {error && (
          <p className="rounded-2xl bg-alert/10 px-3 py-2 text-[12px] text-alert">
            {error}
          </p>
        )}
      </div>

      <div className="glass mt-3 flex items-end gap-2 rounded-3xl p-2 ring-1 ring-white/70">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Say something…"
          disabled={historyLoading || !user}
          className="max-h-28 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-soft/60"
        />

        <button
          onClick={submit}
          disabled={busy || historyLoading || !user || input.trim().length === 0}
          className="rounded-full bg-ink px-4 py-2.5 text-[13px] font-medium text-vellum transition-opacity disabled:opacity-40"
        >
          {busy ? "…" : "Send"}
        </button>
      </div>
    </>
  );
}

function textOf(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/g;

function linkify(text: string, mine: boolean) {
  const parts = text.split(URL_RE);

  return parts.map((part, index) => {
    if (!URL_RE.test(part)) return part;

    URL_RE.lastIndex = 0;
    const href = part.startsWith("http") ? part : `https://${part}`;

    return (
      <a
        key={index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`break-all underline underline-offset-2 ${
          mine ? "text-vellum" : "text-ink"
        }`}
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
          mine
            ? "bg-ink text-vellum"
            : "bg-white/70 text-ink ring-1 ring-ink/5"
        }`}
      >
        {linkify(text, mine)}
      </p>
    </div>
  );
}
