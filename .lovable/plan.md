# Diary: many pages instead of one

Turn the Diary tab into a collection of pages you create yourself, each with its own title, so you can keep separate pages for different parts of your life (work, travel, thoughts) and as many as you like on the same day.

## What changes

- **Diary tab shows your pages.** A list of all pages, newest activity first, each row showing the title, a short preview of the writing, and the dates.
- **New page button.** A clear "+ New page" that opens a blank page and asks for a title (blank title falls back to the date).
- **Timestamps on every page.** Each page keeps:
  - Created — the day and time it was first started
  - Last updated — the day and time of the most recent edit, updated as you write
  Both shown on the page itself and in the list ("Updated today, 21:40 · Started 2 Sep").
- **Writing the page.** Same ruled writing surface and quiet autosave as now; the title can be renamed at any time from the page.
- **Delete.** Each page can be deleted from the page view, with a confirm tap.

## Keeping what you already wrote

Existing daily entries are carried over automatically as pages, titled with their date, so nothing is lost.

## Not changing

Log, Tasks, Friend, Settings, reminders, and the on-device-only storage all stay exactly as they are.

## Technical notes

- `src/lib/diary-store.ts`: add `DiaryPage` (`id, title, content, createdAt, updatedAt`) at key `lamplit.diary.pages.v1` with `getPages/getPage/createPage/updatePage/renamePage/deletePage`. Add a one-time migration that converts existing `DiaryEntry[]` records into pages (title = `prettyDate(date)`, `createdAt`/`updatedAt` from the entry) and marks the migration done so it never re-runs; keep the old key intact and include pages in `exportData()`.
- `src/routes/index.tsx`: replace views `today`/`entries`/`read` with `pages` (list) and `page` (single page editor) holding the selected page id; keep the Diary tab pointing at the list. Reuse the existing autosave debounce, `.ruled` surface, and `PageTitle` styling; add a `relativeStamp(ts)` helper for "Updated today, 21:40".
- Also fix the existing hydration mismatch: read the stored name in a `useEffect` (or `useHydrated` gate) rather than in the `useState` initializer, so server and client first render match.
- No backend, no new dependencies.

## Verification

Playwright: create two pages with different titles, write in one and confirm the updated stamp changes while the created stamp stays, reload to confirm persistence, rename a page, delete a page, and confirm no console/hydration errors.
