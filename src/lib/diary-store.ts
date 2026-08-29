export type DiaryEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  content: string;
  createdAt: number;
};

const STORAGE_KEY = "lamplit.diary.entries.v1";

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