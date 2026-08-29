import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getEntries,
  getEntryForDate,
  upsertEntry,
  deleteEntry,
  todayKey,
  prettyDate,
  shortDate,
  getUserName,
  saveUserName,
  getLogs,
  addLog,
  deleteLog,
  type DiaryEntry,
} from "../lib/diary-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lamplit — Private Daily Diary" },
      {
        name: "description",
        content:
          "A calm, private space to write a little each day. Your diary stays on this device — nothing is sent anywhere.",
      },
      { property: "og:title", content: "Lamplit — Private Daily Diary" },
      {
        property: "og:description",
        content:
          "A calm, private space to write a little each day. Your diary stays on this device.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <DiaryApp />;
}

type View = "today" | "entries" | "log";

function DiaryApp() {
  const [view, setView] = useState<View>("today");
  const [reading, setReading] = useState<DiaryEntry | null>(null);
  const [, forceTick] = useState(0);

  // Onboarding: ask for the user's name on first open.
  const [name, setName] = useState<string>(() => getUserName());

  // Read fresh on every render — entries are few and this keeps the list
  // in sync with localStorage after autosave.
  const entries = getEntries();

  const openEntry = (e: DiaryEntry) => {
    setReading(e);
    setView("entries");
  };

  const goToday = () => {
    setReading(null);
    setView("today");
  };

  const goLog = () => {
    setReading(null);
    setView("log");
  };

  const handleNameSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    saveUserName(trimmed);
    setName(trimmed);
  };

  if (!name) {
    return <WelcomeScreen onDone={handleNameSubmit} />;
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-vellum text-ink font-sans">
      <div className="lamp" />
      <div className="absolute -left-24 -top-24 size-72 rounded-full bg-lamplight/15 blur-3xl animate-sheen" />
      <div
        className="absolute -right-16 top-40 size-64 rounded-full bg-vellum-deep/40 blur-3xl animate-sheen"
        style={{ animationDelay: "3s" }}
      />

      <div className="relative z-10 flex min-h-dvh flex-col px-5 pb-4 pt-5">
<Header
          name={name}
          entryCount={entries.length}
          onEntries={() => {
            setReading(null);
            setView("entries");
          }}
          onHome={goToday}
        />

{view === "today" ? (
          <TodayView
            onGoEntries={() => {
              setReading(null);
              setView("entries");
            }}
            onGoLog={goLog}
            onSaved={() => forceTick((n) => n + 1)}
          />
        ) : view === "log" ? (
          <LogView
            onToday={goToday}
            onChanged={() => forceTick((n) => n + 1)}
          />
        ) : reading ? (
          <ReadView
            entry={reading}
            onBack={goToday}
            onDelete={() => {
              deleteEntry(reading.id);
              setReading(null);
              forceTick((n) => n + 1);
            }}
          />
        ) : (
          <EntriesList
            entries={entries}
            onOpen={openEntry}
            onToday={goToday}
          />
        )}
      </div>
    </div>
  );
}

function Header({
  name,
  entryCount,
  onEntries,
  onHome,
}: {
  name: string;
  entryCount: number;
  onEntries: () => void;
  onHome: () => void;
}) {
  return (
    <header className="flex items-center justify-between">
      <button
        onClick={onHome}
        className="flex items-center gap-2.5 text-left"
        aria-label="Lamplit home"
      >
        <span className="grid size-9 place-items-center rounded-[12px] bg-ink text-vellum font-serif text-lg">
          L
        </span>
<span className="leading-tight">
          <span className="block font-serif text-[19px] font-semibold tracking-tight">
            Lamplit
          </span>
          <span className="block max-w-[150px] truncate font-mono text-[9px] uppercase tracking-[0.22em] text-ink-soft">
            {name}&apos;s diary
          </span>
        </span>
      </button>

<button
        onClick={onEntries}
        className="rounded-full bg-white/55 px-3.5 py-2 text-[13px] font-medium text-ink ring-1 ring-ink/10 backdrop-blur-md transition-colors hover:bg-white/80"
      >
        Entries
        {entryCount > 0 && (
          <span className="ml-1.5 font-mono text-[11px] text-ink-soft">
            {entryCount}
          </span>
        )}
      </button>
    </header>
  );
}

function TodayView({
  onGoEntries,
  onSaved,
}: {
  onGoEntries: () => void;
  onSaved: () => void;
}) {
  const key = todayKey();
  const existing = useMemo(() => getEntryForDate(key), [key]);
  const [text, setText] = useState(existing?.content ?? "");
  const [savedAt, setSavedAt] = useState<string>(existing?.time ?? "19 : 00");
  const [time, setTime] = useState(formatClock());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (value: string) => {
    setText(value);
    setTime(formatClock());
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const saved = upsertEntry(key, value.trim());
      setSavedAt(saved.time);
      onSaved();
    }, 600);
  };

  // Save any remaining content on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const hasText = text.trim().length > 0;

  return (
    <>
      <section className="mt-5 animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lamplight">
          Today
        </p>
        <div className="mt-1.5 flex flex-wrap items-end justify-between gap-2">
          <h1 className="font-serif text-[32px] font-semibold leading-none tracking-tight text-balance">
            {prettyDate(key)}
          </h1>
          <p className="font-mono text-[11px] text-ink-soft">{time}</p>
        </div>
      </section>

      <section className="mt-4 flex-1 min-h-0">
        <div className="glass flex h-full min-h-[46vh] flex-col overflow-hidden rounded-[20px] p-5 ring-1 ring-white/70">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
              Entry
            </p>
            <p className="font-mono text-[10px] text-ink-soft">
              {hasText ? `saved ${savedAt}` : "autosaved"}
            </p>
          </div>
          <div className="ruled mt-1 min-h-0 flex-1">
            <textarea
              value={text}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="What stayed with you today?"
              className="h-full w-full resize-none bg-transparent font-serif text-[20px] font-medium leading-[46px] text-ink placeholder:text-ink-soft/50 focus:outline-none"
              autoFocus={false}
            />
          </div>
        </div>
      </section>

<BottomNav
        mode="today"
        onEntries={onGoEntries}
        hasTodayEntry={hasText}
      />
    </>
  );
}

function ReadView({
  entry,
  onBack,
  onDelete,
}: {
  entry: DiaryEntry;
  onBack: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <section className="mt-5 animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lamplight">
          {shortDate(entry.date)}
        </p>
        <div className="mt-1.5 flex items-end justify-between gap-2">
          <h1 className="font-serif text-[32px] font-semibold leading-none tracking-tight text-balance">
            {prettyDate(entry.date)}
          </h1>
          <p className="font-mono text-[11px] text-ink-soft">{entry.time}</p>
        </div>
      </section>

      <section className="mt-4 flex-1 min-h-0">
        <div className="glass flex h-full min-h-[46vh] flex-col overflow-hidden rounded-[20px] p-5 ring-1 ring-white/70">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
              Entry
            </p>
            <p className="font-mono text-[10px] text-ink-soft">
              {readingTime(entry.content)} min read
            </p>
          </div>
          <div className="ruled mt-1 min-h-0 flex-1 overflow-y-auto">
            <p className="whitespace-pre-wrap font-serif text-[20px] font-medium leading-[46px] text-ink text-pretty">
              {entry.content}
            </p>
          </div>
        </div>
      </section>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onBack}
          className="grid size-11 place-items-center rounded-full bg-white/55 text-ink ring-1 ring-ink/10 backdrop-blur-md transition-colors hover:bg-white/85"
          aria-label="Back to today"
        >
          <span className="mt-0.5 block h-2.5 w-2.5 rotate-45 border-b border-r border-current" />
        </button>
        <button
          onClick={onDelete}
          className="ml-auto rounded-full bg-white/40 px-4 py-2 text-[12px] font-medium text-ink-soft ring-1 ring-ink/10 backdrop-blur-md transition-colors hover:bg-ink/10"
        >
          Delete
        </button>
      </div>
    </>
  );
}

function EntriesList({
  entries,
  onOpen,
  onToday,
}: {
  entries: DiaryEntry[];
  onOpen: (e: DiaryEntry) => void;
  onToday: () => void;
}) {
  return (
    <>
      <section className="mt-5 animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lamplight">
          Archive
        </p>
        <div className="mt-1.5 flex items-end justify-between gap-2">
          <h1 className="font-serif text-[34px] font-semibold leading-none tracking-tight">
            Past entries
          </h1>
          <p className="font-mono text-[11px] text-ink-soft">{entries.length}</p>
        </div>
      </section>

      <section className="mt-4 flex-1 min-h-0 overflow-y-auto pb-2">
        {entries.length === 0 ? (
          <div className="glass mt-2 rounded-[16px] p-6 text-center ring-1 ring-white/70">
            <p className="font-serif text-[20px] font-semibold text-ink">
              No entries yet
            </p>
            <p className="mt-2 font-sans text-[13px] leading-relaxed text-ink-soft">
              Your diary is empty and waiting. Write your first page whenever
              you're ready.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {entries.map((e) => (
              <button
                key={e.id}
                onClick={() => onOpen(e)}
                className="glass w-full rounded-[16px] p-4 text-left ring-1 ring-white/70 transition-transform active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
                    {shortDate(e.date)}
                  </p>
                  <p className="font-mono text-[10px] text-ink-soft">
                    {e.time}
                  </p>
                </div>
                <p className="mt-1.5 font-serif text-[17px] font-semibold leading-snug text-ink line-clamp-1">
                  {e.content}
                </p>
                <p className="mt-1 font-sans text-[13px] leading-relaxed text-ink-soft line-clamp-2">
                  {e.content}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="mt-3 flex justify-center">
        <button
          onClick={onToday}
          className="rounded-full bg-white/55 px-5 py-2.5 text-[13px] font-medium text-ink ring-1 ring-ink/10 backdrop-blur-md transition-colors hover:bg-white/85"
        >
          Write today's page
        </button>
      </div>
    </>
  );
}

function BottomNav({
  mode,
  hasTodayEntry,
  onEntries,
}: {
  mode: "today" | "entries";
  hasTodayEntry: boolean;
  onEntries: () => void;
}) {
  return (
    <nav className="mt-3 flex items-center gap-1">
      <button
        className="grid size-11 place-items-center rounded-full bg-white/55 text-ink ring-1 ring-ink/10 backdrop-blur-md transition-colors hover:bg-white/85"
        aria-label="Write today's entry"
      >
        <span className="block h-3 w-0.5 -translate-y-[1px] bg-lamplight" />
      </button>
      <button
        onClick={onEntries}
        className="grid size-11 place-items-center rounded-full bg-white/40 text-ink-soft ring-1 ring-ink/10 backdrop-blur-md transition-colors hover:bg-white/70"
        aria-label="Entries"
      >
        <span className="grid gap-[3px]">
          <span className="block size-[6px] rounded-full bg-current" />
          <span className="block size-[6px] rounded-full bg-current" />
        </span>
      </button>
      <button
        className="grid size-11 place-items-center rounded-full bg-white/40 text-ink-soft ring-1 ring-ink/10 backdrop-blur-md transition-colors hover:bg-white/70"
        aria-label="Search"
      >
        <span className="mt-0.5 block h-2.5 w-2.5 rotate-45 border-b border-r border-current" />
      </button>
    </nav>
  );
}

function WelcomeScreen({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canSubmit = name.trim().length > 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (canSubmit) onDone(name);
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-vellum px-6 pb-8 pt-10 font-sans text-ink">
      <div className="lamp" />
      <div className="absolute -left-24 -top-24 size-72 rounded-full bg-lamplight/15 blur-3xl animate-sheen" />

      <div className="relative z-10 flex flex-1 flex-col justify-center">
        <span className="grid size-14 place-items-center rounded-[16px] bg-ink font-serif text-2xl text-vellum">
          L
        </span>

        <h1 className="mt-7 font-serif text-[42px] font-semibold leading-[1.05] tracking-tight text-balance animate-fade-up">
          Your diary,
          <br />
          waiting for a name.
        </h1>
        <p className="mt-4 max-w-xs font-sans text-[15px] leading-relaxed text-ink-soft animate-fade-up">
          Everything stays on this device. Just tell us who you are and we&apos;ll
          set the page for you.
        </p>

        <form
          className="mt-9 animate-fade-up"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label
            htmlFor="welcome-name"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-lamplight"
          >
            Your name
          </label>
          <input
            id="welcome-name"
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Maya"
            autoComplete="given-name"
            enterKeyHint="done"
            className="mt-2 w-full rounded-[14px] border-0 bg-white/55 px-4 py-3.5 font-serif text-[20px] font-medium text-ink placeholder:text-ink-soft/40 ring-1 ring-white/70 backdrop-blur-md transition focus:ring-2 focus:ring-lamplight/50 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-6 w-full rounded-full bg-ink py-3.5 font-sans text-[15px] font-medium text-vellum transition-opacity disabled:opacity-35"
          >
            Open my diary
          </button>
        </form>
      </div>

      <p className="relative z-10 mt-8 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-ink-soft">
        private · on-device · no account
      </p>
    </div>
  );
}

function formatClock(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h} : ${m}`;
}

function readingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}