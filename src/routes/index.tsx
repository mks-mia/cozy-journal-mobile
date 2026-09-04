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
  getTasks,
  addTask,
  toggleTask,
  deleteTask,
  markNotified,
  getReminderState,
  setReminderState,
  exportData,
  clearAllData,
  type DiaryEntry,
  type LogEntry,
  type Task,
} from "../lib/diary-store";
import {
  bucketTasks,
  dueNotifications,
  dueTime,
  parseDueInput,
  relativeDue,
  urgency,
} from "../lib/reminders";
import { FriendChat } from "../components/friend-chat";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lamplit — Private Diary, Daily Log & Tasks" },
      {
        name: "description",
        content:
          "A calm, private space to write a little each day, log what happened, and keep deadlines in sight. Everything stays on your device.",
      },
      {
        property: "og:title",
        content: "Lamplit — Private Diary, Daily Log & Tasks",
      },
      {
        property: "og:description",
        content:
          "Write your daily page, log the day as it happens, and get reminded before deadlines. Private and on-device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <DiaryApp />;
}

type View =
  | "today"
  | "entries"
  | "read"
  | "log"
  | "tasks"
  | "friend"
  | "settings";

function DiaryApp() {
  const [view, setView] = useState<View>("today");
  const [reading, setReading] = useState<DiaryEntry | null>(null);
  const [, forceTick] = useState(0);
  const refresh = () => forceTick((n) => n + 1);

  const [name, setName] = useState<string>(() => getUserName());
  const [now, setNow] = useState(() => Date.now());
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Read fresh every render — small data set, always in sync with storage.
  const entries = getEntries();
  const tasks = getTasks();
  const buckets = bucketTasks(tasks, now);
  const dueSoonCount = buckets.overdue.length + buckets.today.length;

  // Tick every minute so relative labels and reminders stay current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Device notifications (opt-in) for tasks crossing a reminder threshold.
  useEffect(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return;
    }
    if (!getReminderState().enabled || Notification.permission !== "granted") {
      return;
    }
    const pending = dueNotifications(getTasks(), now);
    if (pending.length === 0) return;
    for (const { task, threshold } of pending) {
      try {
        new Notification(
          threshold === "due" ? "Deadline reached" : "Deadline coming up",
          {
            body:
              threshold === "due"
                ? `${task.title} — due now`
                : `${task.title} — ${relativeDue(task.dueAt!, now)}`,
            tag: `${task.id}-${threshold}`,
          },
        );
      } catch {
        // notification blocked — in-app banner still covers it
      }
      markNotified(task.id, threshold);
    }
    refresh();
  }, [now]);

  const openEntry = (e: DiaryEntry) => {
    setReading(e);
    setView("read");
  };

  const go = (next: View) => {
    setReading(null);
    setView(next);
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

  const tab: "today" | "log" | "tasks" | "friend" =
    view === "log"
      ? "log"
      : view === "tasks"
        ? "tasks"
        : view === "friend"
          ? "friend"
          : "today";

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
          onHome={() => go("today")}
          onSettings={() => go("settings")}
        />

        {!bannerDismissed && dueSoonCount > 0 && view !== "tasks" && (
          <DueBanner
            overdue={buckets.overdue.length}
            today={buckets.today.length}
            onOpen={() => go("tasks")}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}

        {view === "today" ? (
          <TodayView onGoEntries={() => go("entries")} onSaved={refresh} />
        ) : view === "log" ? (
          <LogView onChanged={refresh} />
        ) : view === "tasks" ? (
          <TasksView now={now} buckets={buckets} onChanged={refresh} />
        ) : view === "friend" ? (
          <FriendChat name={name} />
        ) : view === "settings" ? (
          <SettingsView
            name={name}
            onRename={(value) => {
              handleNameSubmit(value);
            }}
            onBack={() => go("today")}
            onCleared={() => {
              setName("");
              refresh();
            }}
          />
        ) : view === "read" && reading ? (
          <ReadView
            entry={reading}
            onBack={() => go("today")}
            onDelete={() => {
              deleteEntry(reading.id);
              go("entries");
            }}
          />
        ) : (
          <EntriesList
            entries={entries}
            onOpen={openEntry}
            onToday={() => go("today")}
          />
        )}

        <BottomNav
          tab={tab}
          taskBadge={dueSoonCount}
          onToday={() => go("today")}
          onLog={() => go("log")}
          onTasks={() => go("tasks")}
          onFriend={() => go("friend")}
        />
      </div>
    </div>
  );
}

function Header({
  name,
  onHome,
  onSettings,
}: {
  name: string;
  onHome: () => void;
  onSettings: () => void;
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
        onClick={onSettings}
        className="grid size-10 place-items-center rounded-full bg-white/55 text-ink ring-1 ring-ink/10 backdrop-blur-md transition-colors hover:bg-white/85"
        aria-label="Settings"
      >
        <span className="grid gap-[3px]">
          <span className="block h-[2px] w-4 rounded-full bg-current" />
          <span className="block h-[2px] w-4 rounded-full bg-current opacity-60" />
          <span className="block h-[2px] w-4 rounded-full bg-current" />
        </span>
      </button>
    </header>
  );
}

function DueBanner({
  overdue,
  today,
  onOpen,
  onDismiss,
}: {
  overdue: number;
  today: number;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} overdue`);
  if (today > 0) parts.push(`${today} due today`);

  return (
    <div className="glass mt-3 flex items-center gap-3 rounded-[14px] px-4 py-3 ring-1 ring-lamplight/40">
      <span className="block size-2 shrink-0 rounded-full bg-lamplight" />
      <button onClick={onOpen} className="flex-1 text-left">
        <p className="font-sans text-[13px] font-medium text-ink">
          {parts.join(" · ")}
        </p>
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
          tap to open tasks
        </p>
      </button>
      <button
        onClick={onDismiss}
        className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft"
        aria-label="Dismiss reminder"
      >
        Hide
      </button>
    </div>
  );
}

function PageTitle({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string;
  title: string;
  meta?: string;
}) {
  return (
    <section className="mt-5 animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lamplight">
        {eyebrow}
      </p>
      <div className="mt-1.5 flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-serif text-[32px] font-semibold leading-none tracking-tight text-balance">
          {title}
        </h1>
        {meta && (
          <p className="font-mono text-[11px] text-ink-soft">{meta}</p>
        )}
      </div>
    </section>
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

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const hasText = text.trim().length > 0;

  return (
    <>
      <PageTitle eyebrow="Today" title={prettyDate(key)} meta={time} />

      <section className="mt-4 flex-1 min-h-0">
        <div className="glass flex h-full min-h-[42vh] flex-col overflow-hidden rounded-[20px] p-5 ring-1 ring-white/70">
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
              aria-label="Today's diary entry"
              className="h-full w-full resize-none bg-transparent font-serif text-[20px] font-medium leading-[46px] text-ink placeholder:text-ink-soft/50 focus:outline-none"
            />
          </div>
        </div>
      </section>

      <div className="mt-3 flex justify-center">
        <button
          onClick={onGoEntries}
          className="rounded-full bg-white/55 px-5 py-2.5 text-[13px] font-medium text-ink ring-1 ring-ink/10 backdrop-blur-md transition-colors hover:bg-white/85"
        >
          Past entries
        </button>
      </div>
    </>
  );
}

function LogView({ onChanged }: { onChanged: () => void }) {
  const [text, setText] = useState("");
  const logs = getLogs();
  const canAdd = text.trim().length > 0;

  const submit = () => {
    if (!canAdd) return;
    addLog(text.trim());
    setText("");
    onChanged();
  };

  const grouped = useMemo(() => {
    const map = new Map<string, LogEntry[]>();
    for (const l of logs) {
      const list = map.get(l.date) ?? [];
      list.push(l);
      map.set(l.date, list);
    }
    return Array.from(map.entries());
  }, [logs]);

  return (
    <>
      <PageTitle
        eyebrow="Daily log"
        title="What happened"
        meta={`${logs.length}`}
      />

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="glass flex items-center gap-2 rounded-[16px] p-2 pl-4 ring-1 ring-white/70">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Anything at all…"
            aria-label="New log item"
            className="min-w-0 flex-1 bg-transparent font-serif text-[17px] font-medium text-ink placeholder:text-ink-soft/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!canAdd}
            className="rounded-full bg-ink px-4 py-2.5 font-sans text-[13px] font-medium text-vellum transition-opacity disabled:opacity-30"
          >
            Add
          </button>
        </div>
      </form>

      <section className="mt-4 flex-1 min-h-0 overflow-y-auto pb-2">
        {logs.length === 0 ? (
          <EmptyCard
            title="Nothing logged yet"
            body="Jot down whatever the day brings — a thought, a task done, a small moment. Each item is stamped with the time."
          />
        ) : (
          <div className="space-y-4">
            {grouped.map(([date, items]) => (
              <div key={date}>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
                  {date === todayKey() ? "Today" : shortDate(date)}
                </p>
                <div className="mt-2 space-y-2">
                  {items.map((l) => (
                    <div
                      key={l.id}
                      className="glass flex items-start gap-3 rounded-[14px] px-4 py-3 ring-1 ring-white/70"
                    >
                      <p className="mt-[3px] shrink-0 font-mono text-[10px] text-ink-soft">
                        {l.time}
                      </p>
                      <p className="flex-1 whitespace-pre-wrap font-serif text-[16px] font-medium leading-snug text-ink">
                        {l.content}
                      </p>
                      <button
                        onClick={() => {
                          deleteLog(l.id);
                          onChanged();
                        }}
                        className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft"
                        aria-label={`Delete log ${l.content}`}
                      >
                        Del
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function TasksView({
  now,
  buckets,
  onChanged,
}: {
  now: number;
  buckets: ReturnType<typeof bucketTasks>;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [showDone, setShowDone] = useState(false);
  const canAdd = title.trim().length > 0;

  const submit = () => {
    if (!canAdd) return;
    addTask(title.trim(), parseDueInput(due));
    setTitle("");
    setDue("");
    onChanged();
  };

  const open =
    buckets.overdue.length +
    buckets.today.length +
    buckets.upcoming.length +
    buckets.someday.length;

  return (
    <>
      <PageTitle eyebrow="To do" title="Tasks" meta={`${open} open`} />

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="glass rounded-[16px] p-3 ring-1 ring-white/70">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            aria-label="New task"
            className="w-full bg-transparent px-1 font-serif text-[17px] font-medium text-ink placeholder:text-ink-soft/50 focus:outline-none"
          />
          <div className="mt-2.5 flex items-center gap-2 border-t border-line pt-2.5">
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              aria-label="Deadline (optional)"
              className="min-w-0 flex-1 rounded-[10px] bg-white/50 px-2.5 py-2 font-mono text-[11px] text-ink ring-1 ring-ink/10 focus:outline-none focus:ring-2 focus:ring-lamplight/50"
            />
            <button
              type="submit"
              disabled={!canAdd}
              className="rounded-full bg-ink px-4 py-2.5 font-sans text-[13px] font-medium text-vellum transition-opacity disabled:opacity-30"
            >
              Add
            </button>
          </div>
        </div>
      </form>

      <section className="mt-4 flex-1 min-h-0 overflow-y-auto pb-2">
        {open === 0 && buckets.done.length === 0 ? (
          <EmptyCard
            title="Nothing on the list"
            body="Add a task above. Give it a deadline and Lamplit will nudge you as it draws closer."
          />
        ) : (
          <div className="space-y-4">
            <TaskGroup
              label="Overdue"
              tasks={buckets.overdue}
              now={now}
              onChanged={onChanged}
            />
            <TaskGroup
              label="Today"
              tasks={buckets.today}
              now={now}
              onChanged={onChanged}
            />
            <TaskGroup
              label="Upcoming"
              tasks={buckets.upcoming}
              now={now}
              onChanged={onChanged}
            />
            <TaskGroup
              label="No deadline"
              tasks={buckets.someday}
              now={now}
              onChanged={onChanged}
            />

            {buckets.done.length > 0 && (
              <div>
                <button
                  onClick={() => setShowDone((v) => !v)}
                  className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft"
                >
                  Completed ({buckets.done.length}) {showDone ? "−" : "+"}
                </button>
                {showDone && (
                  <div className="mt-2 space-y-2">
                    {buckets.done.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        now={now}
                        onChanged={onChanged}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}

function TaskGroup({
  label,
  tasks,
  now,
  onChanged,
}: {
  label: string;
  tasks: Task[];
  now: number;
  onChanged: () => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
        {label}
      </p>
      <div className="mt-2 space-y-2">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} now={now} onChanged={onChanged} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  now,
  onChanged,
}: {
  task: Task;
  now: number;
  onChanged: () => void;
}) {
  const level = urgency(task, now);
  const ring =
    level === "overdue"
      ? "ring-1 ring-alert/50"
      : level === "soon"
        ? "ring-1 ring-lamplight/50"
        : "ring-1 ring-white/70";
  const dueColor =
    level === "overdue"
      ? "text-alert"
      : level === "soon"
        ? "text-lamplight"
        : "text-ink-soft";

  return (
    <div className={`glass flex items-start gap-3 rounded-[14px] px-4 py-3 ${ring}`}>
      <button
        onClick={() => {
          toggleTask(task.id);
          onChanged();
        }}
        aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className={`mt-[2px] grid size-5 shrink-0 place-items-center rounded-full ring-1 transition-colors ${
          task.completed
            ? "bg-ink text-vellum ring-ink"
            : "bg-white/60 text-transparent ring-ink/20"
        }`}
      >
        <span className="block h-[6px] w-[10px] -translate-y-[1px] rotate-[-45deg] border-b-2 border-l-2 border-current" />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`font-serif text-[16px] font-medium leading-snug ${
            task.completed ? "text-ink-soft line-through" : "text-ink"
          }`}
        >
          {task.title}
        </p>
        {task.dueAt !== null && (
          <p className={`mt-0.5 font-mono text-[10px] ${dueColor}`}>
            {dueTime(task.dueAt)}
            {!task.completed && ` · ${relativeDue(task.dueAt, now)}`}
          </p>
        )}
      </div>

      <button
        onClick={() => {
          deleteTask(task.id);
          onChanged();
        }}
        className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft"
        aria-label={`Delete task ${task.title}`}
      >
        Del
      </button>
    </div>
  );
}

function SettingsView({
  name,
  onRename,
  onBack,
  onCleared,
}: {
  name: string;
  onRename: (value: string) => void;
  onBack: () => void;
  onCleared: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const [saved, setSaved] = useState(false);
  const [permission, setPermission] = useState<string>(() =>
    typeof window !== "undefined" && typeof Notification !== "undefined"
      ? Notification.permission
      : "unsupported",
  );
  const [enabled, setEnabled] = useState(() => getReminderState().enabled);
  const [confirming, setConfirming] = useState(false);

  const enableReminders = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    const on = result === "granted";
    setReminderState({ enabled: on });
    setEnabled(on);
  };

  const download = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lamplit-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageTitle eyebrow="Settings" title="Your setup" />

      <section className="mt-4 flex-1 min-h-0 space-y-3 overflow-y-auto pb-2">
        <div className="glass rounded-[16px] p-4 ring-1 ring-white/70">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-lamplight">
            Your name
          </p>
          <form
            className="mt-2 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              onRename(draft);
              setSaved(true);
            }}
          >
            <input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setSaved(false);
              }}
              aria-label="Your name"
              className="min-w-0 flex-1 rounded-[12px] bg-white/60 px-3 py-2.5 font-serif text-[17px] font-medium text-ink ring-1 ring-ink/10 focus:outline-none focus:ring-2 focus:ring-lamplight/50"
            />
            <button
              type="submit"
              className="rounded-full bg-ink px-4 py-2.5 font-sans text-[13px] font-medium text-vellum"
            >
              Save
            </button>
          </form>
          {saved && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
              Name updated
            </p>
          )}
        </div>

        <div className="glass rounded-[16px] p-4 ring-1 ring-white/70">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-lamplight">
            Deadline reminders
          </p>
          <p className="mt-2 font-sans text-[13px] leading-relaxed text-ink-soft">
            In-app reminders always work: due and overdue tasks show a banner and
            a badge whenever you open Lamplit. You can also allow device
            notifications for a nudge an hour before each deadline.
          </p>
          {permission === "granted" && enabled ? (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
              Device notifications on
            </p>
          ) : permission === "denied" ? (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
              Blocked in browser settings
            </p>
          ) : permission === "unsupported" ? (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
              Not supported on this device
            </p>
          ) : (
            <button
              onClick={enableReminders}
              className="mt-3 rounded-full bg-ink px-4 py-2.5 font-sans text-[13px] font-medium text-vellum"
            >
              Enable reminders
            </button>
          )}
          <p className="mt-3 font-sans text-[12px] leading-relaxed text-ink-soft">
            Because everything stays on your device with no account or server,
            notifications can only fire while Lamplit is open or recently used —
            iPhone home-screen apps in particular won&apos;t wake it in the
            background. The in-app banner is the reliable layer.
          </p>
        </div>

        <div className="glass rounded-[16px] p-4 ring-1 ring-white/70">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-lamplight">
            Your data
          </p>
          <p className="mt-2 font-sans text-[13px] leading-relaxed text-ink-soft">
            Entries, logs and tasks live only in this device&apos;s storage — no
            login, no cloud. Clearing your browser or switching phone loses them,
            so keep a backup.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={download}
              className="rounded-full bg-white/60 px-4 py-2.5 font-sans text-[13px] font-medium text-ink ring-1 ring-ink/10"
            >
              Export my data
            </button>
            {confirming ? (
              <button
                onClick={() => {
                  clearAllData();
                  onCleared();
                }}
                className="rounded-full bg-alert px-4 py-2.5 font-sans text-[13px] font-medium text-vellum"
              >
                Tap again to erase everything
              </button>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="rounded-full bg-white/40 px-4 py-2.5 font-sans text-[13px] font-medium text-ink-soft ring-1 ring-ink/10"
              >
                Clear all data
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="mt-3 flex justify-center">
        <button
          onClick={onBack}
          className="rounded-full bg-white/55 px-5 py-2.5 text-[13px] font-medium text-ink ring-1 ring-ink/10 backdrop-blur-md transition-colors hover:bg-white/85"
        >
          Back to diary
        </button>
      </div>
    </>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass mt-2 rounded-[16px] p-6 text-center ring-1 ring-white/70">
      <p className="font-serif text-[20px] font-semibold text-ink">{title}</p>
      <p className="mt-2 font-sans text-[13px] leading-relaxed text-ink-soft">
        {body}
      </p>
    </div>
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
      <PageTitle
        eyebrow={shortDate(entry.date)}
        title={prettyDate(entry.date)}
        meta={entry.time}
      />

      <section className="mt-4 flex-1 min-h-0">
        <div className="glass flex h-full min-h-[42vh] flex-col overflow-hidden rounded-[20px] p-5 ring-1 ring-white/70">
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
      <PageTitle
        eyebrow="Archive"
        title="Past entries"
        meta={`${entries.length}`}
      />

      <section className="mt-4 flex-1 min-h-0 overflow-y-auto pb-2">
        {entries.length === 0 ? (
          <EmptyCard
            title="No entries yet"
            body="Your diary is empty and waiting. Write your first page whenever you're ready."
          />
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
                  <p className="font-mono text-[10px] text-ink-soft">{e.time}</p>
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
          Write today&apos;s page
        </button>
      </div>
    </>
  );
}

function BottomNav({
  tab,
  taskBadge,
  onToday,
  onLog,
  onTasks,
  onFriend,
}: {
  tab: "today" | "log" | "tasks" | "friend";
  taskBadge: number;
  onToday: () => void;
  onLog: () => void;
  onTasks: () => void;
  onFriend: () => void;
}) {
  const item = (active: boolean) =>
    `relative flex-1 rounded-full py-2.5 text-center font-sans text-[13px] font-medium transition-colors ${
      active
        ? "bg-ink text-vellum"
        : "text-ink-soft hover:bg-white/60"
    }`;

  return (
    <nav className="glass mt-3 flex items-center gap-1 rounded-full p-1 ring-1 ring-white/70">
      <button onClick={onToday} className={item(tab === "today")}>
        Diary
      </button>
      <button onClick={onLog} className={item(tab === "log")}>
        Log
      </button>
      <button onClick={onTasks} className={item(tab === "tasks")}>
        Tasks
        {taskBadge > 0 && (
          <span
            className={`ml-1.5 font-mono text-[10px] ${
              tab === "tasks" ? "text-vellum/70" : "text-lamplight"
            }`}
          >
            {taskBadge}
          </span>
        )}
      </button>
      <button onClick={onFriend} className={item(tab === "friend")}>
        Friend
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
