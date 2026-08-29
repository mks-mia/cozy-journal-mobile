# Lamplit — Diary, Log, Tasks

A private, on-device daily companion in the existing Lamplit Vellum style, organised as three tabs with a settings screen.

## Structure

```text
Bottom nav:  Diary   |   Log   |   Tasks        (+ gear icon -> Settings)
```

- **Diary** — today's entry on a ruled writing surface with autosave (already built), plus the archive list and full-entry read view.
- **Log** — a blank quick-input box: type anything, tap Add, and it is stamped with the time. Today's items sit at the top, grouped by day, each removable.
- **Tasks** — a to-do list with optional deadlines.
- **Settings** — change your name any time; also shows notification permission and a way to clear all data.

## Tasks screen

- Add a task with just a title; optionally set a due date and time.
- Tap to complete / un-complete; swipe-free delete button on each row.
- Sections: **Overdue**, **Today**, **Upcoming**, **No deadline**, **Completed** (collapsed).
- Each dated task shows a relative label ("in 3 hours", "tomorrow", "2 days overdue") and a colour cue: overdue = warm alert, due within 24h = lamplight amber, otherwise muted ink.

## Reminders

Both layers, as chosen:

1. **In-app** (always works): on open, a soft banner at the top — "2 tasks due soon, 1 overdue" — tapping it jumps to Tasks. Plus the colour cues and a small count badge on the Tasks tab. Re-checked every minute while the app is open.
2. **Device notifications** (opt-in): Settings has an "Enable reminders" button that requests permission. Once granted, the app fires a notification when a task crosses its reminder threshold (default 1 hour before, and again at the deadline) while the app is open or recently backgrounded. Each task+threshold only fires once.

Honest limitation stated in Settings: because everything stays on your device with no account or server, notifications can only fire while the app is running or recently used — iPhone home-screen apps in particular won't wake it in the background. The in-app banner is the reliable layer.

## Name editing

The first-run welcome screen stays. The name is now also editable from Settings, so a typo can be fixed; the header greeting updates immediately.

## Data

Everything stays in this device's local storage — no login, no cloud. Settings notes that clearing the browser or switching phone loses the data, and offers "Export my data" as a downloadable JSON backup so you aren't stuck.

## Technical notes

- `src/lib/diary-store.ts`: add `Task` type (`id, title, dueAt: number | null, completed, completedAt, createdAt, notifiedAt: string[]`) with `getTasks/addTask/updateTask/toggleTask/deleteTask`, plus `getReminderState/setReminderState` and `exportData()`. Keep the existing entry/log/name functions and `localStorage` keys.
- `src/lib/reminders.ts`: pure helpers — `bucketTasks(tasks, now)` returning the section split, `relativeDue(dueAt, now)` for labels, and `dueNotifications(tasks, now)` returning which task/threshold pairs should fire. Unit-testable without the DOM.
- `src/routes/index.tsx`: extend `View` to `"today" | "entries" | "read" | "log" | "tasks" | "settings"`; finish the existing `LogView`, add `TasksView`, `SettingsView`, `DueBanner`; wire `BottomNav` to the three tabs with an active state.
- Notification permission and firing live in a `useEffect` interval in the tasks/app shell, guarded by `typeof Notification !== "undefined"` so SSR and unsupported browsers are safe.
- Reuse existing tokens and `.glass` / `.ruled` / `.lamp` utilities; no new colour values hardcoded in components.
- No backend, no new dependencies. PWA manifest and icons stay as they are.

## Verification

Playwright run covering: first-run name entry, renaming from Settings, diary autosave, adding and deleting a log item, adding a task with a deadline, overdue/due-soon bucketing, completing a task, and the due banner appearing.
