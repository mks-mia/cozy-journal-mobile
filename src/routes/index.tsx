import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getPages,
  getPage,
  createPage,
  updatePage,
  renamePage,
  deletePage,
  stamp,
  todayKey,
  prettyDate,
  shortDate,
  getUserName,
  saveUserName,
  getLogs,
  addLog,
  deleteLog,
  getTrackers,
  addTracker,
  deleteTracker,
  getProgressFor,
  getProgressMap,
  bumpProgress,
  shiftDateKey,
  lastDays,
  getTasks,
  addTask,
  toggleTask,
  deleteTask,
  markNotified,
  getReminderState,
  setReminderState,
  exportData,
  clearAllData,
  type DiaryPage,
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

type View = "pages" | "page" | "log" | "tasks" | "friend" | "stats" | "settings";

function DiaryApp() {
  const [view, setView] = useState<View>("pages");
  const [openId, setOpenId] = useState<string | null>(null);
  const [, forceTick] = useState(0);
  const refresh = () => forceTick((n) => n + 1);

  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    setName(getUserName());
    setHydrated(true);
  }, []);

  // Read fresh every render — small data set, always in sync with storage.
  const pages = hydrated ? getPages() : [];
  const tasks = hydrated ? getTasks() : [];
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
        new Notification(threshold === "due" ? "Deadline reached" : "Deadline coming up", {
          body:
            threshold === "due"
              ? `${task.title} — due now`
              : `${task.title} — ${relativeDue(task.dueAt!, now)}`,
          tag: `${task.id}-${threshold}`,
        });
      } catch {
        // notification blocked — in-app banner still covers it
      }
      markNotified(task.id, threshold);
    }
    refresh();
  }, [now]);

  const openPage = (id: string) => {
    setOpenId(id);
    setView("page");
  };

  const go = (next: View) => {
    setOpenId(null);
    setView(next);
  };

  const handleNameSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    saveUserName(trimmed);
    setName(trimmed);
  };

  if (!hydrated) {
    return <div className="min-h-dvh bg-vellum" />;
  }

  if (!name) {
    return <WelcomeScreen onDone={handleNameSubmit} />;
  }

  const tab: "diary" | "log" | "tasks" | "friend" | "stats" =
    view === "log"
      ? "log"
      : view === "tasks"
        ? "tasks"
        : view === "friend"
          ? "friend"
          : view === "stats"
            ? "stats"
            : "diary";

  const open = openId ? getPage(openId) : undefined;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-vellum text-ink font-sans">
      <div className="lamp" />
      <div className="absolute -left-24 -top-24 size-72 rounded-full bg-lamplight/15 blur-3xl animate-sheen" />
      <div
        className="absolute -right-16 top-40 size-64 rounded-full bg-vellum-deep/40 blur-3xl animate-sheen"
        style={{ animationDelay: "3s" }}
      />

      <div className="relative z-10 flex min-h-dvh flex-col px-5 pb-4 pt-5">
        <Header name={name} onHome={() => go("pages")} onSettings={() => go("settings")} />

        {!bannerDismissed && dueSoonCount > 0 && view !== "tasks" && (
          <DueBanner
            overdue={buckets.overdue.length}
            today={buckets.today.length}
            onOpen={() => go("tasks")}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}

        {view === "log" ? (
          <LogView onChanged={refresh} />
        ) : view === "tasks" ? (
          <TasksView now={now} buckets={buckets} onChanged={refresh} />
        ) : view === "friend" ? (
          <FriendChat name={name} />
        ) : view === "stats" ? (
          <StatsView />
        ) : view === "settings" ? (
          <SettingsView
            name={name}
            onRename={(value) => {
              handleNameSubmit(value);
            }}
            onBack={() => go("pages")}
            onCleared={() => {
              setName("");
              refresh();
            }}
          />
        ) : view === "page" && open ? (
          <PageView
            page={open}
            onBack={() => go("pages")}
            onChanged={refresh}
            onDeleted={() => go("pages")}
          />
        ) : (
          <PagesList
            pages={pages}
            onOpen={openPage}
            onCreate={(title) => {
              const created = createPage(title);
              openPage(created.id);
            }}
          />
        )}

        <BottomNav
          tab={tab}
          taskBadge={dueSoonCount}
          onDiary={() => go("pages")}
          onLog={() => go("log")}
          onTasks={() => go("tasks")}
          onFriend={() => go("friend")}
          onStats={() => go("stats")}
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
          <span className="block font-serif text-[19px] font-semibold tracking-tight">Lamplit</span>
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
        <p className="font-sans text-[13px] font-medium text-ink">{parts.join(" · ")}</p>
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

function PageTitle({ eyebrow, title, meta }: { eyebrow: string; title: string; meta?: string }) {
  return (
    <section className="mt-5 animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lamplight">{eyebrow}</p>
      <div className="mt-1.5 flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-serif text-[32px] font-semibold leading-none tracking-tight text-balance">
          {title}
        </h1>
        {meta && <p className="font-mono text-[11px] text-ink-soft">{meta}</p>}
      </div>
    </section>
  );
}

function LogView({ onChanged }: { onChanged: () => void }) {
  const [text, setText] = useState("");
  const [date, setDate] = useState(() => todayKey());
  const [addingTracker, setAddingTracker] = useState(false);
  const [tName, setTName] = useState("");
  const [tTarget, setTTarget] = useState("");
  const [tUnit, setTUnit] = useState("");

  const today = todayKey();
  const logs = getLogs().filter((l) => l.date === date);
  const trackers = getTrackers();
  const progress = getProgressFor(date);
  const week = lastDays(date, 7);
  const progressMap = getProgressMap();
  const canAdd = text.trim().length > 0;

  const submit = () => {
    if (!canAdd) return;
    addLog(text.trim(), date);
    setText("");
    onChanged();
  };

  const submitTracker = () => {
    if (!tName.trim()) return;
    addTracker(tName.trim(), Number(tTarget) || 1, tUnit.trim());
    setTName("");
    setTTarget("");
    setTUnit("");
    setAddingTracker(false);
    onChanged();
  };

  const done = trackers.filter((t) => (progress[t.id] ?? 0) >= t.target).length;

  return (
    <>
      <PageTitle
        eyebrow="Daily log"
        title={date === today ? "Today" : shortDate(date)}
        meta={`${done}/${trackers.length} done`}
      />

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          onClick={() => setDate(shiftDateKey(date, -1))}
          aria-label="Previous day"
          className="glass rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft ring-1 ring-white/70"
        >
          &larr; Prev
        </button>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
          {prettyDate(date)}
        </p>
        <button
          onClick={() => setDate(shiftDateKey(date, 1))}
          disabled={date >= today}
          aria-label="Next day"
          className="glass rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft ring-1 ring-white/70 disabled:opacity-30"
        >
          Next &rarr;
        </button>
      </div>

      <section className="mt-4 flex-1 min-h-0 overflow-y-auto pb-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-lamplight">
          Tracked actions
        </p>

        <div className="mt-2 space-y-2">
          {trackers.length === 0 && !addingTracker && (
            <p className="font-sans text-[13px] leading-relaxed text-ink-soft">
              Add something you want to keep up daily — water glasses, pages read, minutes walked —
              and count it off each day.
            </p>
          )}

          {trackers.map((t) => {
            const value = progress[t.id] ?? 0;
            const pct = Math.min(100, Math.round((value / t.target) * 100));
            return (
              <div key={t.id} className="glass rounded-[14px] px-4 py-3 ring-1 ring-white/70">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-[16px] font-semibold text-ink">
                      {t.name}
                    </p>
                    <p className="font-mono text-[10px] text-ink-soft">
                      {value} / {t.target}
                      {t.unit ? ` ${t.unit}` : ""} · {pct}%
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      bumpProgress(date, t.id, -1);
                      onChanged();
                    }}
                    aria-label={`Remove one from ${t.name}`}
                    className="grid size-8 place-items-center rounded-full bg-white/70 font-sans text-[16px] text-ink ring-1 ring-ink/10"
                  >
                    &minus;
                  </button>
                  <button
                    onClick={() => {
                      bumpProgress(date, t.id, 1);
                      onChanged();
                    }}
                    aria-label={`Add one to ${t.name}`}
                    className="grid size-8 place-items-center rounded-full bg-ink font-sans text-[16px] text-vellum"
                  >
                    +
                  </button>
                </div>

                <div className="mt-2.5 h-[6px] overflow-hidden rounded-full bg-ink/10">
                  <div
                    className="h-full rounded-full bg-lamplight transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="mt-2.5 flex items-end justify-between gap-1">
                  {week.map((d) => {
                    const v = progressMap[d]?.[t.id] ?? 0;
                    const h = Math.max(3, Math.min(24, Math.round((v / t.target) * 24)));
                    return (
                      <span key={d} className="flex flex-1 flex-col items-center gap-1">
                        <span
                          className={`block w-full rounded-[3px] ${
                            v >= t.target ? "bg-lamplight" : "bg-ink/20"
                          }`}
                          style={{ height: `${h}px` }}
                          title={`${shortDate(d)}: ${v}`}
                        />
                        <span className="font-mono text-[8px] text-ink-soft">
                          {shortDate(d).slice(0, 2)}
                        </span>
                      </span>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    deleteTracker(t.id);
                    onChanged();
                  }}
                  className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft"
                  aria-label={`Delete tracker ${t.name}`}
                >
                  Remove action
                </button>
              </div>
            );
          })}

          {addingTracker ? (
            <form
              className="glass rounded-[14px] p-3 ring-1 ring-white/70"
              onSubmit={(e) => {
                e.preventDefault();
                submitTracker();
              }}
            >
              <input
                value={tName}
                onChange={(e) => setTName(e.target.value)}
                placeholder="Action — e.g. Drink water"
                aria-label="Action name"
                className="w-full bg-transparent px-1 font-serif text-[16px] font-medium text-ink placeholder:text-ink-soft/50 focus:outline-none"
              />
              <div className="mt-2.5 flex items-center gap-2 border-t border-line pt-2.5">
                <input
                  value={tTarget}
                  onChange={(e) => setTTarget(e.target.value)}
                  inputMode="numeric"
                  placeholder="8"
                  aria-label="Daily target"
                  className="w-14 bg-transparent px-1 font-mono text-[12px] text-ink placeholder:text-ink-soft/50 focus:outline-none"
                />
                <input
                  value={tUnit}
                  onChange={(e) => setTUnit(e.target.value)}
                  placeholder="glasses"
                  aria-label="Unit (optional)"
                  className="min-w-0 flex-1 bg-transparent px-1 font-mono text-[12px] text-ink placeholder:text-ink-soft/50 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-full bg-ink px-4 py-2 font-sans text-[13px] font-medium text-vellum"
                >
                  Save
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAddingTracker(true)}
              className="glass w-full rounded-[14px] px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft ring-1 ring-white/70"
            >
              + Track a daily action
            </button>
          )}
        </div>

        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-lamplight">
          Notes
        </p>

        <form
          className="mt-2"
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

        <div className="mt-3 space-y-2">
          {logs.length === 0 ? (
            <p className="font-sans text-[13px] leading-relaxed text-ink-soft">
              Nothing logged on this day yet.
            </p>
          ) : (
            logs.map((l) => (
              <div
                key={l.id}
                className="glass flex items-start gap-3 rounded-[14px] px-4 py-3 ring-1 ring-white/70"
              >
                <p className="mt-[3px] shrink-0 font-mono text-[10px] text-ink-soft">{l.time}</p>
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
            ))
          )}
        </div>
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
            <TaskGroup label="Overdue" tasks={buckets.overdue} now={now} onChanged={onChanged} />
            <TaskGroup label="Today" tasks={buckets.today} now={now} onChanged={onChanged} />
            <TaskGroup label="Upcoming" tasks={buckets.upcoming} now={now} onChanged={onChanged} />
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
                      <TaskRow key={t.id} task={t} now={now} onChanged={onChanged} />
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
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">{label}</p>
      <div className="mt-2 space-y-2">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} now={now} onChanged={onChanged} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task, now, onChanged }: { task: Task; now: number; onChanged: () => void }) {
  const level = urgency(task, now);
  const ring =
    level === "overdue"
      ? "ring-1 ring-alert/50"
      : level === "soon"
        ? "ring-1 ring-lamplight/50"
        : "ring-1 ring-white/70";
  const dueColor =
    level === "overdue" ? "text-alert" : level === "soon" ? "text-lamplight" : "text-ink-soft";

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
            In-app reminders always work: due and overdue tasks show a banner and a badge whenever
            you open Lamplit. You can also allow device notifications for a nudge an hour before
            each deadline.
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
            Because everything stays on your device with no account or server, notifications can
            only fire while Lamplit is open or recently used — iPhone home-screen apps in particular
            won&apos;t wake it in the background. The in-app banner is the reliable layer.
          </p>
        </div>

        <div className="glass rounded-[16px] p-4 ring-1 ring-white/70">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-lamplight">
            Your data
          </p>
          <p className="mt-2 font-sans text-[13px] leading-relaxed text-ink-soft">
            Entries, logs and tasks live only in this device&apos;s storage — no login, no cloud.
            Clearing your browser or switching phone loses them, so keep a backup.
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
      <p className="mt-2 font-sans text-[13px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function PageView({
  page,
  onBack,
  onChanged,
  onDeleted,
}: {
  page: DiaryPage;
  onBack: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [text, setText] = useState(page.content);
  const [title, setTitle] = useState(page.title);
  const [updatedAt, setUpdatedAt] = useState(page.updatedAt);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(page.content);
    setTitle(page.title);
    setUpdatedAt(page.updatedAt);
  }, [page.id]);

  const handleChange = (value: string) => {
    setText(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const saved = updatePage(page.id, value);
      if (saved) setUpdatedAt(saved.updatedAt);
      onChanged();
    }, 600);
  };

  const commitTitle = () => {
    const clean = title.trim();
    if (clean === page.title) return;
    renamePage(page.id, clean);
    setTitle(clean || page.title);
    onChanged();
  };

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return (
    <>
      <section className="mt-5 animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lamplight">
          Diary page
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          aria-label="Page title"
          placeholder="Untitled page"
          className="mt-1.5 w-full bg-transparent font-serif text-[30px] font-semibold leading-tight tracking-tight text-ink placeholder:text-ink-soft/40 focus:outline-none"
        />
        <p className="mt-1 font-mono text-[10px] text-ink-soft">
          Updated {stamp(updatedAt)} · Started {stamp(page.createdAt)}
        </p>
      </section>

      <section className="mt-3 flex-1 min-h-0">
        <div className="glass flex h-full min-h-[38vh] flex-col overflow-hidden rounded-[20px] p-5 ring-1 ring-white/70">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">Entry</p>
            <p className="font-mono text-[10px] text-ink-soft">autosaved</p>
          </div>
          <div className="ruled mt-1 min-h-0 flex-1">
            <textarea
              value={text}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="What stayed with you?"
              aria-label="Page content"
              className="h-full w-full resize-none bg-transparent font-serif text-[20px] font-medium leading-[46px] text-ink placeholder:text-ink-soft/50 focus:outline-none"
            />
          </div>
        </div>
      </section>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onBack}
          className="grid size-11 place-items-center rounded-full bg-white/55 text-ink ring-1 ring-ink/10 backdrop-blur-md transition-colors hover:bg-white/85"
          aria-label="Back to pages"
        >
          <span className="mt-0.5 block h-2.5 w-2.5 rotate-45 border-b border-r border-current" />
        </button>
        <button
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            deletePage(page.id);
            onDeleted();
          }}
          className="ml-auto rounded-full bg-white/40 px-4 py-2 text-[12px] font-medium text-ink-soft ring-1 ring-ink/10 backdrop-blur-md transition-colors hover:bg-ink/10"
        >
          {confirmDelete ? "Tap again to delete" : "Delete page"}
        </button>
      </div>
    </>
  );
}

function PagesList({
  pages,
  onOpen,
  onCreate,
}: {
  pages: DiaryPage[];
  onOpen: (id: string) => void;
  onCreate: (title: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  return (
    <>
      <PageTitle eyebrow="Diary" title="Your pages" meta={`${pages.length}`} />

      {adding ? (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            onCreate(title);
            setTitle("");
            setAdding(false);
          }}
        >
          <div className="glass flex items-center gap-2 rounded-[16px] p-2 pl-4 ring-1 ring-white/70">
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Page title — e.g. ${prettyDate(todayKey())}`}
              aria-label="New page title"
              className="min-w-0 flex-1 bg-transparent font-serif text-[17px] font-medium text-ink placeholder:text-ink-soft/50 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-ink px-4 py-2.5 font-sans text-[13px] font-medium text-vellum"
            >
              Create
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 w-full rounded-[16px] bg-ink py-3.5 font-sans text-[14px] font-medium text-vellum transition-opacity active:opacity-80"
        >
          + New page
        </button>
      )}

      <section className="mt-4 flex-1 min-h-0 overflow-y-auto pb-2">
        {pages.length === 0 ? (
          <EmptyCard
            title="No pages yet"
            body="Make a page for anything — work, travel, a quiet thought. Each one keeps its own title and dates."
          />
        ) : (
          <div className="space-y-2.5">
            {pages.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpen(p.id)}
                className="glass w-full rounded-[16px] p-4 text-left ring-1 ring-white/70 transition-transform active:scale-[0.99]"
              >
                <p className="font-serif text-[18px] font-semibold leading-snug text-ink line-clamp-1">
                  {p.title}
                </p>
                <p className="mt-1 font-sans text-[13px] leading-relaxed text-ink-soft line-clamp-2">
                  {p.content.trim() || "Empty page"}
                </p>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
                  Updated {stamp(p.updatedAt)} · Started {stamp(p.createdAt)}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function BottomNav({
  tab,
  taskBadge,
  onDiary,
  onLog,
  onTasks,
  onFriend,
}: {
  tab: "diary" | "log" | "tasks" | "friend";
  taskBadge: number;
  onDiary: () => void;
  onLog: () => void;
  onTasks: () => void;
  onFriend: () => void;
}) {
  const item = (active: boolean) =>
    `relative flex-1 rounded-full py-2.5 text-center font-sans text-[13px] font-medium transition-colors ${
      active ? "bg-ink text-vellum" : "text-ink-soft hover:bg-white/60"
    }`;

  return (
    <nav className="glass mt-3 flex items-center gap-1 rounded-full p-1 ring-1 ring-white/70">
      <button onClick={onDiary} className={item(tab === "diary")}>
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
          Everything stays on this device. Just tell us who you are and we&apos;ll set the page for
          you.
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
