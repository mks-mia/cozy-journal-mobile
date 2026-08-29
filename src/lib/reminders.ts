import type { Task } from "./diary-store";

export const SOON_WINDOW_MS = 60 * 60 * 1000; // 1 hour before deadline

export type Buckets = {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  someday: Task[];
  done: Task[];
};

function endOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function bucketTasks(tasks: Task[], now: number): Buckets {
  const buckets: Buckets = {
    overdue: [],
    today: [],
    upcoming: [],
    someday: [],
    done: [],
  };
  const dayEnd = endOfDay(now);

  for (const t of tasks) {
    if (t.completed) {
      buckets.done.push(t);
    } else if (t.dueAt === null) {
      buckets.someday.push(t);
    } else if (t.dueAt < now) {
      buckets.overdue.push(t);
    } else if (t.dueAt <= dayEnd) {
      buckets.today.push(t);
    } else {
      buckets.upcoming.push(t);
    }
  }

  const byDue = (a: Task, b: Task) => (a.dueAt ?? 0) - (b.dueAt ?? 0);
  buckets.overdue.sort(byDue);
  buckets.today.sort(byDue);
  buckets.upcoming.sort(byDue);
  buckets.someday.sort((a, b) => b.createdAt - a.createdAt);
  buckets.done.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  return buckets;
}

export function relativeDue(dueAt: number, now: number): string {
  const diff = dueAt - now;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);

  let span: string;
  if (mins < 1) span = "less than a minute";
  else if (mins < 60) span = `${mins} min`;
  else if (hours < 24) span = `${hours} hour${hours === 1 ? "" : "s"}`;
  else span = `${days} day${days === 1 ? "" : "s"}`;

  return diff < 0 ? `${span} overdue` : `in ${span}`;
}

export type Urgency = "overdue" | "soon" | "later" | "none";

export function urgency(task: Task, now: number): Urgency {
  if (task.completed || task.dueAt === null) return "none";
  if (task.dueAt < now) return "overdue";
  if (task.dueAt - now <= SOON_WINDOW_MS) return "soon";
  return "later";
}

export type DueNotification = { task: Task; threshold: "soon" | "due" };

/**
 * Which task/threshold pairs should fire a notification right now.
 * "soon" fires once the deadline is within the soon window, "due" once passed.
 */
export function dueNotifications(tasks: Task[], now: number): DueNotification[] {
  const out: DueNotification[] = [];
  for (const t of tasks) {
    if (t.completed || t.dueAt === null) continue;
    if (t.dueAt <= now) {
      if (!t.notified.includes("due")) out.push({ task: t, threshold: "due" });
    } else if (t.dueAt - now <= SOON_WINDOW_MS) {
      if (!t.notified.includes("soon")) out.push({ task: t, threshold: "soon" });
    }
  }
  return out;
}

export function dueTime(dueAt: number): string {
  return new Date(dueAt).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Convert <input type="datetime-local"> value to a timestamp. */
export function parseDueInput(value: string): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? null : ts;
}
