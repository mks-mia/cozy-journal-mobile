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
  type DiaryEntry,
} from "../lib/diary-store";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <DiaryApp />;
}

type View = "today" | "entries";

function DiaryApp() {
  const [view, setView] = useState<View>("today");
  const [reading, setReading] = useState<DiaryEntry | null>(null);
  const [, forceTick] = useState(0);

  const entries = useMemo(() => getEntries(), [forceTick]);

  const openEntry = (e: DiaryEntry) => {
    setReading(e);
    setView("entries");
  };

  const goToday = () => {
    setReading(null);
    setView("today");
  };

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
          view={view}
          reading={reading}
          entryCount={entries.length}
          onEntries={() => {
            setReading(null);
            setView("entries");
          }}
          onHome={goToday}
        />

        {view === "today" ? (
          <TodayView
            onViewEntry={openEntry}
            onSaved={() => forceTick((n) => n + 1)}
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
  entryCount,
  onEntries,
  onHome,
}: {
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
          <span className="block font-mono text-[9px] uppercase tracking-[0.22em] text-ink-soft">
            private diary
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
  onViewEntry,
  onSaved,
}: {
  onViewEntry: (e: DiaryEntry) => void;
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
        onEntries={() => {
          /* switch handled by parent via header; nav just for visual rhythm */
        }}
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