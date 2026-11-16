import { createClient } from "./supabase";

const supabase = createClient();

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
const LOG_MIGRATION_KEY = "lamplit.diary.logsMigrated.v1";

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

type DailyLogRow = {
  id: string;
  date: string;
  time: string;
  content: string;
  created_at: string;
};

function rowToLog(row: DailyLogRow): LogEntry {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    content: row.content,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// Load logs from Supabase and migrate existing local logs if needed.
export async function syncLogs(userId: string): Promise<LogEntry[]> {
  const { data: remoteLogs, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load daily logs:", error);
    return getLogs();
  }

  const localLogs = loadLogs();
  const migrationKey = `${LOG_MIGRATION_KEY}.${userId}`;

  let alreadyMigrated = false;

  try {
    alreadyMigrated =
      window.localStorage.getItem(migrationKey) === "1";
  } catch {
    // ignore
  }

  // First-time migration of existing local logs.
  if (
    remoteLogs.length === 0 &&
    localLogs.length > 0 &&
    !alreadyMigrated
  ) {
    const rows = localLogs.map((log) => ({
      user_id: userId,
      date: log.date,
      time: log.time,
      content: log.content,
      created_at: new Date(log.createdAt).toISOString(),
    }));

    const { data: uploaded, error: uploadError } = await supabase
      .from("daily_logs")
      .insert(rows)
      .select("*");

    if (uploadError) {
      console.error("Failed to migrate daily logs:", uploadError);
      return getLogs();
    }

    const migratedLogs = (uploaded as DailyLogRow[]).map(rowToLog);
    saveLogs(migratedLogs);

    try {
      window.localStorage.setItem(migrationKey, "1");
    } catch {
      // ignore
    }

    return getLogs();
  }

  // Supabase is the source of truth after migration.
  const logs = (remoteLogs as DailyLogRow[]).map(rowToLog);
  saveLogs(logs);

  try {
    window.localStorage.setItem(migrationKey, "1");
  } catch {
    // ignore
  }

  return getLogs();
}

// Create a new log in Supabase.
export async function addLogToSupabase(
  userId: string,
  content: string,
  date?: string,
): Promise<LogEntry | null> {
  const { data, error } = await supabase
    .from("daily_logs")
    .insert({
      user_id: userId,
      date: date ?? todayKey(),
      time: formatNow(),
      content,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to add daily log:", error);
    return null;
  }

  const entry = rowToLog(data as DailyLogRow);
  saveLogs([entry, ...loadLogs()]);

  return entry;
}

// Delete a log from Supabase.
export async function deleteLogFromSupabase(
  userId: string,
  id: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("daily_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete daily log:", error);
    return false;
  }

  saveLogs(loadLogs().filter((log) => log.id !== id));

  return true;
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

/* ---------------------------- mindfulness nudge --------------------------- */

const MINDFUL_KEY = "lamplit.diary.mindful.v1";
const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

const MINDFUL_PHRASES = [
  "“You do not have to be calm to be kind to yourself.” What's one small thing that steadied you this week?",
  "“Almost everything will work again if you unplug it for a few minutes — including you.” Where could you unplug today?",
  "“Progress is quiet.” What has quietly changed for you lately?",
  "“Feelings are visitors. Let them come and go.” Which one has been visiting most?",
  "“You are allowed to rest without earning it.” When did you last really rest?",
  "“Start where you are, use what you have.” What's the next tiny step you could take?",
  "“Breathe. You've handled harder days than this one.” What's weighing on you right now?",
  "“Comparison is a thief.” What would enough look like for you this fortnight?",
  "“Be gentle with yourself; you're doing the best you can with what you know.” What deserves a bit more kindness?",
  "“Attention is the rarest form of generosity.” What's worth your full attention today?",
];

export function getMindfulPhrase(now = Date.now()): string {
  const index = Math.floor(now / TWO_WEEKS) % MINDFUL_PHRASES.length;
  return MINDFUL_PHRASES[index]!;
}

/** Returns a phrase when at least two weeks have passed since the last nudge. */
export function dueMindfulPhrase(now = Date.now()): string | null {
  if (typeof window === "undefined") return null;
  let last = 0;
  try {
    last = Number(window.localStorage.getItem(MINDFUL_KEY) ?? 0) || 0;
  } catch {
    last = 0;
  }
  if (last === 0) {
    // First ever chat: don't wait two weeks, greet with one right away.
    return getMindfulPhrase(now);
  }
  return now - last >= TWO_WEEKS ? getMindfulPhrase(now) : null;
}

export function markMindfulShown(now = Date.now()) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MINDFUL_KEY, String(now));
  } catch {
    // ignore
  }
}

const MINDFUL_NOTIFIED_KEY = "lamplit.diary.mindful.notified.v1";

/**
 * Phrase due for a device notification, tracked separately from the chat
 * nudge so each channel keeps its own two-week rhythm.
 */
export function dueMindfulNotification(now = Date.now()): string | null {
  if (typeof window === "undefined") return null;
  let last = 0;
  try {
    last = Number(window.localStorage.getItem(MINDFUL_NOTIFIED_KEY) ?? 0) || 0;
  } catch {
    last = 0;
  }
  if (last === 0) return getMindfulPhrase(now);
  return now - last >= TWO_WEEKS ? getMindfulPhrase(now) : null;
}

export function markMindfulNotified(now = Date.now()) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MINDFUL_NOTIFIED_KEY, String(now));
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
      trackers: getTrackers(),
      trackerProgress: getProgressMap(),
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
    TRACKER_KEY,
    PROGRESS_KEY,
    MINDFUL_KEY,
    MINDFUL_NOTIFIED_KEY,
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
  fontSize?: number;
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
    id: crypto.randomUUID(),
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

export function setPageFontSize(id: string, fontSize: number): DiaryPage | undefined {
  let saved: DiaryPage | undefined;
  const pages = loadPages().map((p) => {
    if (p.id !== id) return p;
    saved = { ...p, fontSize };
    return saved;
  });
  savePages(pages);
  return saved;
}

export function renamePage(id: string, title: string): DiaryPage | undefined {
  const clean = title.trim();
  let saved: DiaryPage | undefined;
  const pages = loadPages().map((p) => {
    if (p.id !== id) return p;
    saved = {
      ...p,
      title: clean || prettyDate(todayKey()),
      updatedAt: Date.now(),
    };
    return saved;
  });
  savePages(pages);
  return saved;
}

export function deletePage(id: string) {
  savePages(loadPages().filter((p) => p.id !== id));
}

function pageToRow(page: DiaryPage, userId: string) {
  return {
    id: page.id,
    user_id: userId,
    title: page.title,
    content: page.content,
    created_at: new Date(page.createdAt).toISOString(),
    updated_at: new Date(page.updatedAt).toISOString(),
    font_size: page.fontSize ?? null,
  };
}

function rowToPage(row: {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  font_size: number | null;
}): DiaryPage {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    ...(row.font_size !== null ? { fontSize: row.font_size } : {}),
  };
}

export async function syncPages(userId: string): Promise<void> {
  const { data: remotePages, error } = await supabase
    .from("diary_pages")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    //console.error("Failed to load diary pages:", error);
    
    console.error("Failed to load diary pages:", JSON.stringify(error, null, 2));

    return;
  }

  const localPages = loadPages();

  // First-time migration:
  // if Supabase is empty but this device has pages, upload them.
  if (remotePages.length === 0 && localPages.length > 0) {
    const migratedPages = localPages.map((page) => ({
      ...page,
      // Old local IDs such as "page-123..." are not UUIDs.
      // Generate UUIDs before inserting into Supabase.
      id:
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(page.id)
          ? page.id
          : crypto.randomUUID(),
    }));

    savePages(migratedPages);
    const { data: uploaded, error: uploadError } = await supabase
      .from("diary_pages")
      .upsert(migratedPages.map((page) => pageToRow(page, userId)))
      .select();
    if (uploadError) {
      console.error("Failed to migrate diary pages:", uploadError);
      return;
    }
    if (uploaded) {
      savePages(uploaded.map(rowToPage));
    }
    return;
  }
  // Supabase already has the account's pages.
  savePages(remotePages.map(rowToPage));
}

export async function syncPage(
  userId: string,
  page: DiaryPage,
): Promise<void> {
  const { error } = await supabase
    .from("diary_pages")
    .upsert(pageToRow(page, userId));

  if (error) {
    console.error("Failed to sync diary page:", error);
  }
}

export async function deletePageFromSupabase(
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("diary_pages")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    console.error("Failed to delete diary page:", error);
  }
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

/* -------------------------------- trackers -------------------------------- */

export type Tracker = {
  id: string;
  name: string;
  unit: string;
  target: number;
  createdAt: number;
};

export type ProgressMap = Record<string, Record<string, number>>;
type TrackerRow = {
  id: string;
  user_id: string;
  name: string;
  unit: string;
  target: number | null;
  created_at: string;
};

function rowToTracker(row: TrackerRow): Tracker {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    target: row.target ?? 0,
    createdAt: new Date(row.created_at).getTime(),
  };
}

const TRACKER_KEY = "lamplit.diary.trackers.v1";
const PROGRESS_KEY = "lamplit.diary.trackerProgress.v1";
const TRACKER_MIGRATION_KEY = "lamplit.diary.trackersMigrated.v1";
const PROGRESS_MIGRATION_KEY = "lamplit.diary.progressMigrated.v1";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function getTrackers(): Tracker[] {
  const list = readJSON<Tracker[]>(TRACKER_KEY, []);
  return Array.isArray(list) ? list : [];
}

export async function syncTrackers(userId: string): Promise<Tracker[]> {
  const { data, error } = await supabase
    .from("trackers")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load trackers:", error);
    return getTrackers();
  }

  const trackers = (data as TrackerRow[]).map(rowToTracker);

  writeJSON(TRACKER_KEY, trackers);

  return trackers;
}

export function addTracker(name: string, target: number, unit: string): Tracker {
  const trackers = getTrackers();
  const tracker: Tracker = {
    id: `trk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    unit: unit.trim(),
    target: Math.max(1, Math.round(target) || 1),
    createdAt: Date.now(),
  };
  trackers.push(tracker);
  writeJSON(TRACKER_KEY, trackers);
  return tracker;
}

export async function addTrackerToSupabase(
  userId: string,
  name: string,
  target: number,
  unit: string,
): Promise<Tracker | null> {
  const { data, error } = await supabase
    .from("trackers")
    .insert({
      user_id: userId,
      name: name.trim(),
      unit: unit.trim(),
      target: Math.max(1, Math.round(target) || 1),
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to add tracker:", error);
    return null;
  }

  const tracker = rowToTracker(data as TrackerRow);

  writeJSON(TRACKER_KEY, [...getTrackers(), tracker]);

  return tracker;
}

export function deleteTracker(id: string) {
  writeJSON(
    TRACKER_KEY,
    getTrackers().filter((t) => t.id !== id),
  );
  const progress = getProgressMap();
  for (const date of Object.keys(progress)) {
    if (progress[date] && id in progress[date]) delete progress[date][id];
  }
  writeJSON(PROGRESS_KEY, progress);
}

export async function deleteTrackerFromSupabase(
  userId: string,
  id: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("trackers")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete tracker:", error);
    return false;
  }

  writeJSON(
    TRACKER_KEY,
    getTrackers().filter((tracker) => tracker.id !== id),
  );

  const progress = getProgressMap();

  for (const date of Object.keys(progress)) {
    if (progress[date]) {
      delete progress[date][id];
    }
  }

  writeJSON(PROGRESS_KEY, progress);

  return true;
}

export function getProgressMap(): ProgressMap {
  const map = readJSON<ProgressMap>(PROGRESS_KEY, {});
  return map && typeof map === "object" ? map : {};
}

type TrackerProgressRow = {
  id: string;
  user_id: string;
  tracker_id: string;
  date: string;
  value: number;
};

export async function syncTrackerProgress(
  userId: string,
): Promise<ProgressMap> {
  const { data, error } = await supabase
    .from("tracker_progress")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to load tracker progress:", error);
    return getProgressMap();
  }

  const progress: ProgressMap = {};

  for (const row of data as TrackerProgressRow[]) {
  const day = progress[row.date] ?? {};
  day[row.tracker_id] = Number(row.value);
  progress[row.date] = day;
}

  writeJSON(PROGRESS_KEY, progress);

  return progress;
}


export async function migrateTrackersToSupabase(
  userId: string,
): Promise<boolean> {
  const trackerMigrationKey = `${TRACKER_MIGRATION_KEY}.${userId}`;
  const progressMigrationKey = `${PROGRESS_MIGRATION_KEY}.${userId}`;

  const alreadyMigrated =
    window.localStorage.getItem(trackerMigrationKey) === "1" &&
    window.localStorage.getItem(progressMigrationKey) === "1";

  if (alreadyMigrated) return true;

  const localTrackers = getTrackers();
  const localProgress = getProgressMap();

  const { data: remoteTrackers, error: trackerError } = await supabase
    .from("trackers")
    .select("*")
    .eq("user_id", userId);

  if (trackerError) {
    console.error("Failed to check existing trackers:", trackerError);
    return false;
  }

  const idMap = new Map<string, string>();
  const existingRemoteTrackers = remoteTrackers ?? [];

  // Match existing local trackers to remote trackers by name and unit.
  for (const local of localTrackers) {
    const existing = existingRemoteTrackers.find(
      (remote) => remote.name === local.name && remote.unit === local.unit,
    );

    if (existing) {
      idMap.set(local.id, existing.id);
    }
  }

  // Create trackers that do not already exist remotely.
  const missingTrackers = localTrackers.filter(
    (local) => !idMap.has(local.id),
  );

  for (const tracker of missingTrackers) {
    const { data: inserted, error: insertError } = await supabase
      .from("trackers")
      .insert({
        user_id: userId,
        name: tracker.name,
        unit: tracker.unit,
        target: tracker.target,
        created_at: new Date(tracker.createdAt).toISOString(),
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      console.error("Failed to migrate tracker:", insertError);
      return false;
    }

    idMap.set(tracker.id, inserted.id);
  }

  // Prepare progress records after all tracker IDs have been mapped.
  const progressRows: {
    user_id: string;
    tracker_id: string;
    date: string;
    value: number;
  }[] = [];

  for (const [date, day] of Object.entries(localProgress)) {
    for (const [oldTrackerId, value] of Object.entries(day)) {
      const newTrackerId = idMap.get(oldTrackerId);

      if (!newTrackerId) continue;

      progressRows.push({
        user_id: userId,
        tracker_id: newTrackerId,
        date,
        value,
      });
    }
  }

  if (progressRows.length > 0) {
    const { error: progressError } = await supabase
      .from("tracker_progress")
      .upsert(progressRows, {
        onConflict: "user_id,tracker_id,date",
      });

    if (progressError) {
      console.error("Failed to migrate tracker progress:", progressError);
      return false;
    }
  }

  window.localStorage.setItem(trackerMigrationKey, "1");
  window.localStorage.setItem(progressMigrationKey, "1");

  return true;
}


export function getProgressFor(date: string): Record<string, number> {
  return getProgressMap()[date] ?? {};
}

export function setProgress(date: string, trackerId: string, value: number) {
  const map = getProgressMap();
  const day = { ...(map[date] ?? {}) };
  const next = Math.max(0, Math.round(value));
  if (next === 0) delete day[trackerId];
  else day[trackerId] = next;
  map[date] = day;
  writeJSON(PROGRESS_KEY, map);
}

export async function setProgressInSupabase(
  userId: string,
  date: string,
  trackerId: string,
  value: number,
): Promise<boolean> {
  const next = Math.max(0, Math.round(value));

  if (next === 0) {
    const { error } = await supabase
      .from("tracker_progress")
      .delete()
      .eq("user_id", userId)
      .eq("tracker_id", trackerId)
      .eq("date", date);

    if (error) {
      console.error("Failed to delete tracker progress:", error);
      return false;
    }
  } else {
    const { error } = await supabase
      .from("tracker_progress")
      .upsert(
        {
          user_id: userId,
          tracker_id: trackerId,
          date,
          value: next,
        },
        {
          onConflict: "user_id,tracker_id,date",
        },
      );

    if (error) {
      console.error("Failed to save tracker progress:", error);
      return false;
    }
  }

  setProgress(date, trackerId, next);
  return true;
}

export function bumpProgress(date: string, trackerId: string, delta: number) {
  const current = getProgressFor(date)[trackerId] ?? 0;
  setProgress(date, trackerId, current + delta);
}

export function shiftDateKey(dateKey: string, days: number): string {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() + days);
  return formatDateKey(d);
}

export function lastDays(dateKey: string, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(shiftDateKey(dateKey, -i));
  return out;
}
