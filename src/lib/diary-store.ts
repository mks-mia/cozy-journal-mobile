export type DiaryEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  content: string;
  createdAt: number;
};

export type LogEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH : mm
  content: string;
  createdAt: number;
};

const STORAGE_KEY = "lamplit.diary.entries.v1";
const NAME_KEY = "lamplit.diary.userName.v1";
const LOG_KEY = "lamplit.diary.logs.v1";

export function getUserName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveUserName(name: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAME_KEY, name.trim());
  } catch {
    // ignore
  }
}

function loadEntries(): DiaryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: DiaryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage full or unavailable — ignore silently
  }
}

export function getEntries(): DiaryEntry[] {
  return loadEntries().sort((a, b) => b.date.localeCompare(a.date));
}

export function getEntryForDate(date: string): DiaryEntry | undefined {
  return loadEntries().find((e) => e.date === date);
}

export function upsertEntry(date: string, content: string): DiaryEntry {
  const entries = loadEntries();
  const time = formatNow();
  const existing = entries.find((e) => e.date === date);
  let saved: DiaryEntry;

  if (existing) {
    saved = { ...existing, content, time };
    const idx = entries.findIndex((e) => e.id === existing.id);
    entries[idx] = saved;
  } else {
    saved = {
      id: `${date}-${Date.now()}`,
      date,
      time,
      content,
      createdAt: Date.now(),
    };
    entries.push(saved);
  }

  saveEntries(entries);
  return saved;
}

export function deleteEntry(id: string) {
  const entries = loadEntries().filter((e) => e.id !== id);
  saveEntries(entries);
}

function loadLogs(): LogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLogs(logs: LogEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  } catch {
    // ignore
  }
}

export function getLogs(): LogEntry[] {
  return loadLogs().sort((a, b) => b.createdAt - a.createdAt);
}

export function addLog(content: string): LogEntry {
  const logs = loadLogs();
  const entry: LogEntry = {
    id: `log-${Date.now()}`,
    date: todayKey(),
    time: formatNow(),
    content,
    createdAt: Date.now(),
  };
  logs.push(entry);
  saveLogs(logs);
  return entry;
}

export function deleteLog(id: string) {
  saveLogs(loadLogs().filter((l) => l.id !== id));
}

export function todayKey(): string {
  const d = new Date();
  return formatDateKey(d);
}

export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatNow(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h} : ${m}`;
}

export function prettyDate(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function shortDate(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
/* ---------------------------------- tasks --------------------------------- */

export type Task = {
  id: string;
  title: string;
  dueAt: number | null;
  completed: boolean;
  completedAt: number | null;
  createdAt: number;
  notified: string[]; // thresholds already fired, e.g. ["soon", "due"]
};

const TASK_KEY = "lamplit.diary.tasks.v1";
const REMINDER_KEY = "lamplit.diary.reminders.v1";

function loadTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TASK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks: Task[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TASK_KEY, JSON.stringify(tasks));
  } catch {
    // ignore
  }
}

export function getTasks(): Task[] {
  return loadTasks();
}

export function addTask(title: string, dueAt: number | null): Task {
  const tasks = loadTasks();
  const task: Task = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim(),
    dueAt,
    completed: false,
    completedAt: null,
    createdAt: Date.now(),
    notified: [],
  };
  tasks.push(task);
  saveTasks(tasks);
  return task;
}

export function updateTask(id: string, patch: Partial<Omit<Task, "id">>) {
  const tasks = loadTasks().map((t) => (t.id === id ? { ...t, ...patch } : t));
  saveTasks(tasks);
}

export function toggleTask(id: string) {
  const tasks = loadTasks().map((t) =>
    t.id === id
      ? {
          ...t,
          completed: !t.completed,
          completedAt: !t.completed ? Date.now() : null,
        }
      : t,
  );
  saveTasks(tasks);
}

export function deleteTask(id: string) {
  saveTasks(loadTasks().filter((t) => t.id !== id));
}

export function markNotified(id: string, threshold: string) {
  const tasks = loadTasks().map((t) =>
    t.id === id && !t.notified.includes(threshold)
      ? { ...t, notified: [...t.notified, threshold] }
      : t,
  );
  saveTasks(tasks);
}

/* -------------------------------- reminders ------------------------------- */

export type ReminderState = { enabled: boolean };

export function getReminderState(): ReminderState {
  if (typeof window === "undefined") return { enabled: false };
  try {
    const raw = window.localStorage.getItem(REMINDER_KEY);
    if (!raw) return { enabled: false };
    const parsed = JSON.parse(raw);
    return { enabled: Boolean(parsed?.enabled) };
  } catch {
    return { enabled: false };
  }
}

export function setReminderState(state: ReminderState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMINDER_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/* ---------------------------------- data ---------------------------------- */

export function exportData(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      name: getUserName(),
      pages: loadPages(),
      entries: loadEntries(),
      logs: loadLogs(),
      tasks: loadTasks(),
    },
    null,
    2,
  );
}

export function clearAllData() {
  if (typeof window === "undefined") return;
  for (const key of [
    STORAGE_KEY,
    LOG_KEY,
    TASK_KEY,
    REMINDER_KEY,
    NAME_KEY,
    PAGE_KEY,
    PAGE_MIGRATION_KEY,
  ]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

/* --------------------------------- pages ---------------------------------- */

export type DiaryPage = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

const PAGE_KEY = "lamplit.diary.pages.v1";
const PAGE_MIGRATION_KEY = "lamplit.diary.pagesMigrated.v1";

function loadPages(): DiaryPage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const pages: DiaryPage[] = Array.isArray(parsed) ? parsed : [];
    return migratePages(pages);
  } catch {
    return [];
  }
}

function migratePages(pages: DiaryPage[]): DiaryPage[] {
  try {
    if (window.localStorage.getItem(PAGE_MIGRATION_KEY)) return pages;
    const legacy = loadEntries();
    const converted: DiaryPage[] = legacy.map((e) => ({
      id: `page-${e.id}`,
      title: prettyDate(e.date),
      content: e.content,
      createdAt: e.createdAt,
      updatedAt: e.createdAt,
    }));
    const merged = [...pages, ...converted];
    window.localStorage.setItem(PAGE_KEY, JSON.stringify(merged));
    window.localStorage.setItem(PAGE_MIGRATION_KEY, "1");
    return merged;
  } catch {
    return pages;
  }
}

function savePages(pages: DiaryPage[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PAGE_KEY, JSON.stringify(pages));
  } catch {
    // ignore
  }
}

export function getPages(): DiaryPage[] {
  return loadPages().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getPage(id: string): DiaryPage | undefined {
  return loadPages().find((p) => p.id === id);
}

export function createPage(title: string): DiaryPage {
  const pages = loadPages();
  const now = Date.now();
  const page: DiaryPage = {
    id: `page-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim() || prettyDate(todayKey()),
    content: "",
    createdAt: now,
    updatedAt: now,
  };
  pages.push(page);
  savePages(pages);
  return page;
}

export function updatePage(id: string, content: string): DiaryPage | undefined {
  let saved: DiaryPage | undefined;
  const pages = loadPages().map((p) => {
    if (p.id !== id) return p;
    saved = { ...p, content, updatedAt: Date.now() };
    return saved;
  });
  savePages(pages);
  return saved;
}

export function renamePage(id: string, title: string) {
  const clean = title.trim();
  const pages = loadPages().map((p) =>
    p.id === id ? { ...p, title: clean || prettyDate(todayKey()), updatedAt: Date.now() } : p,
  );
  savePages(pages);
}

export function deletePage(id: string) {
  savePages(loadPages().filter((p) => p.id !== id));
}

export function stamp(ts: number): string {
  const d = new Date(ts);
  const time = `${String(d.getHours()).padStart(2, "0")} : ${String(d.getMinutes()).padStart(
    2,
    "0",
  )}`;
  const key = formatDateKey(d);
  if (key === todayKey()) return `Today, ${time}`;
  return `${shortDate(key)}, ${time}`;
}
