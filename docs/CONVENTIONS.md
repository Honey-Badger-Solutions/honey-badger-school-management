# HoneyBadger School — Code Conventions

Every screen follows these rules. If you add a screen, copy an existing one and
keep the shape. (Rules verified against all 11 current screens.)

## Stack
React 18 + Vite + TypeScript (strict, `noUnusedLocals`) · Tailwind CSS ·
react-router v6 (HashRouter) · zustand. **No other runtime dependencies — never
import a package that isn't already in `package.json`.**

## Data flow — the one pattern

```
components ──read──▶ useDb()            (src/services/db.ts — client cache)
components ──write─▶ services/*.ts      (async fns; the ONLY mutation path)
services   ──mutate─▶ update(draft)     (commits snapshot → localStorage → re-render)
```

- **Reads**: call `useDb()` and derive with the pure helpers in `src/lib/derive.ts`
  (`rosterOf`, `sectionLabel`, `sectionReport`, `studentAttendance`, …).
  Components never import `src/data/` — the seed is wired into `db.ts` only.
- **Writes**: components call an async function from `src/services/`
  (`registerStudent`, `recordPayment`, `saveAttendance`, `saveMark`, …).
  Components never call `update()` directly.
- **Backend swap later**: reimplement `services/*.ts` bodies with `fetch()` and
  hydrate the `db.ts` cache from the server. No component changes.

### Authorship trails
Records that could be disputed carry who produced them and when, written by the
service, never by a component. **Every one of them stores a user id, never a
name** — see "Identity" below:
- `db.markAudit[examId|subjectId|studentId]` → `{ enteredByUserId, teacherId,
  at }` for every score (parallel to `db.marks` so ranking and report cards keep
  reading plain numbers). Kept in step by `saveMark`: re-entering re-attributes,
  clearing deletes it.
- `AttendanceRecord.markedByUserId` → the user who marked that student.
- `Payment.receivedByUserId` → the cashier who took the money.
- `Assessment.createdByUserId` → who set the work.
- `db.auditLog` → every staff change (`actorUserId`, subject, before, after).

**Never leave a hole in the trail.** An administrator editing a mark is recorded
as that administrator — *not* dropped. A missing attribution is worse than a
correctly identified admin edit, because a dispute turns on exactly that case.
On `markAudit`, `teacherId` stays null for an office edit: the identity is
already carried by `enteredByUserId`, so that field only records whether the
mark came from the person who teaches the class.

### Identity
Everyone who can sign in is a `User` (`db.users`), mirroring `public.users` in
Supabase — whose `id` is also the `auth.users` id. A teacher's `Teacher` record
and their `User` share **one uuid**, because server-side they are one row.

- **Attribute writes to `actingUserId()`** (`services/users.ts`), never to a
  name and never to a role. A name captured at write time is not an identity:
  rename the person and the history silently re-attributes itself.
- **Resolve names at render** with `userName(db, id)`.
- Every record carries `schoolId`; it is the column RLS filters on server-side.

### Authorization
Permissions live in `src/config/permissions.ts` — named capabilities mapped to
roles, using the vocabulary in `ROLES_AND_RBAC.md`. Ask what someone may *do*,
never what they *are*:
- components: `const can = useCan()` → `can('fees.record_payment')`
- services: `assertPermission('staff.update', 'editing a teacher')`

Do not write `role === 'school-admin'` in a screen. Route matching and the
sign-in picker are the only places a role name is legitimately compared.
None of this is security — it decides what the UI offers. The same map has to
exist as RLS policies and server-side checks before it is enforceable.

Seeded history must stay internally consistent: mark timestamps sit inside a
plausible marking window and, for a teacher who has since left, always *before*
their `departedOn`. Check this when changing the seed — a departed teacher
appearing to enter marks after leaving is the first thing anyone checks.

These outlive the teacher: staff are never hard-deleted, so a departed
teacher's ID still resolves to their name. Do not "clean up" attributions when
someone leaves.

## State
- **Domain data**: the single `useDb()` store. No per-screen copies of domain
  data — derive on render.
- **Session** (userId, schoolId, role, teacherId, language): `useSession`
  zustand store, persisted to `localStorage` as `hbs_session_v2`.
- **Screen-local UI state** (open modal, filter values, form drafts):
  `useState` inside the component. Filters that should survive navigation
  (active tab, selected section, "open register modal") go in the URL via
  `useSearchParams`.
- Exception (documented): `MarkEntry` keeps a local `draft` map so half-typed
  numbers aren't clobbered by db re-renders; `Attendance` mirrors marks in
  local state for the same reason. Both still persist only through services.

## Loading, saving, errors
- Data is local, so there are **no loading spinners for reads** — reads are
  synchronous from the cache. (A real backend would add skeletons at the
  `useDb` boundary.)
- **Form submits**: a `busy` boolean disables the primary button and swaps its
  label to `t('saving')`. Always `await` the service before closing a modal.
- **Bulk entry** (attendance, marks): optimistic saves surfaced through the
  shared `<SaveChip state>` (`idle → saving → local → synced`,
  `src/components/bits.tsx`). Offline (navigator.onLine false) shows
  "Saved on this phone".
- **Success feedback**: `toast(t('key'))` from `src/components/Toast.tsx`.
- **Validation**: inline, forgiving — red `.err` line under the field
  (register form) or `pill-warn` + red border (mark entry). Never a blocking
  alert; invalid values simply don't save.

## i18n & formatting — no hardcoded UI strings
- Every user-facing string is a key in `src/i18n.ts`, read via
  `const t = useT()`. Amharic goes in the `am` dict later; missing keys fall
  back to English.
- Dates: store ISO strings; display ONLY via `fmtDate`/`fmtDateShort`
  (`src/lib/dates.ts`) — the Ethiopian-calendar swap point.
- Money: whole ETB integers; display via `fmtETB`/`fmtAmount` (`src/lib/money.ts`).

## Components & naming
- Pages: `src/pages/<role>/<Screen>.tsx`, default export, one file per route
  registered in `App.tsx`. Private sub-components (modals, print bodies) live
  in the same file below the page component.
- Shared pieces: `src/components/` — `PascalCase.tsx` for single components,
  `bits.tsx` for the small shared atoms (`Avatar`, `PageTitle`, `EmptyState`,
  `OnlineDot`, `SaveChip`, `personName`).
- Pure derivation helpers: `src/lib/` (no React imports except types).
- Icons: only `<Icon name>` from `src/components/Icon.tsx` (inline stroke SVGs).

## Styling

**Verify every class name against this project before using it.** A class that
looks familiar may belong to the HoneyBadger *Courses* app, not this one — the
two share a palette and a look but not a stylesheet. An unknown class fails
silently: no error, no build warning, just an unstyled element that has to be
caught by eye. This has happened twice (`.backlink`, `.chip` — both invented
here, both shipped visibly broken). Before writing a class, confirm it:

```bash
grep -n "\.classname" src/index.css
```

This project's complete set of UI primitives — everything else is a Tailwind
utility:

| Class | Use |
|---|---|
| `.btn` `.btn-gold` `.btn-ghost` `.btn-danger` `.btn-sm` | buttons; `-gold` is the primary action |
| `.card` `.card-pad` | surfaces; `-pad` adds interior padding, plain `.card` is for flush list rows |
| `.lrow` | a tappable list row (≥56px, chevron on the right) |
| `.field` | label + input wrapper |
| `.seg` (+ `button.on`) | segmented control — **the filter/toggle primitive** |
| `.tabbar` | underlined tab strip within a page |
| `.pill` `.pill-gold` `.pill-good` `.pill-warn` `.pill-neutral` `.pill-dim` | status chips |
| `.kpi` | dashboard stat tile |
| `.tbl` `.table-wrap` | printable tables |
| `.att-btn` | attendance P/A/L toggle |
| `.av` | avatar circle |
| `.sec-h` | small uppercase section heading |
| `.scrim` `.sheet` | modal backdrop + panel (use `<Modal>`, not these directly) |
| `.print-page` `.no-print` | print pagination + screen-only elements |

There is no `.chip`, no `.chips`, no `.backlink`, no `.grid` here. For a row of
filters use `.seg`; for a back link copy the inline utilities used in
`StudentProfile`/`StaffProfile`.
- Palette is locked to the HoneyBadger honey-on-paper tokens in
  `tailwind.config.js` (`paper/surface/ink/soft/dim/gold/honey/good/warn`).
  Never hardcode other hex colors in components.
- Touch targets ≥ 44px (`min-h-[46px]` buttons, `min-h-[56px]` list rows).
  Mobile-first: base styles are the 360px layout; `sm:`/`md:`/`lg:` add on.

## Printing
- Paper documents render inside `<PrintArea>` (a portal under `<body>`, hidden
  on screen) with `<PrintHead doc>` letterhead + `<PrintFoot>`, triggered by
  `printNow()`. On print the app root is `display:none` — never
  `visibility:hidden`, which leaves layout boxes behind and emits blank pages.
### Which print component to reach for
Ask one question: **is this one document about one thing, or a list of many?**

| The document is… | Use | Examples |
|---|---|---|
| A list of rows that keeps going until the data runs out | `<PaginatedReport doc summary headRow rows>` | defaulters report, class roster |
| One record, one sheet — even when batched | `<PrintHead doc>` + body + `<PrintFoot>` inside `.print-page` | receipt, report card |

- `PaginatedReport` chunks rows at a fixed `rowsPerPage` (18 fits A4 under the
  letterhead) and puts the full letterhead **and a real `Page N of M`** on every
  sheet. Do not hand-roll a long `<table>` and lean on CSS page breaks — Chrome
  cannot number pages from CSS, and schools file these sheet by sheet.
- The per-record form takes `PrintHead`/`PrintFoot` directly because pagination
  is not its problem: each record already owns exactly one page. Batching many
  (50 report cards) means repeating that whole block inside `.print-page`, which
  `page-break-after: always` turns into 50 sheets. Passing `page`/`of` to
  `PrintFoot` here would be wrong — "Page 1 of 50" on a single child's report
  card is meaningless to the parent holding it.
- Rule of thumb: if a row could ever be orphaned across a page boundary, it
  belongs in `PaginatedReport`.
- Chrome that must never print carries `.no-print`.
- After changing anything printable, verify by rendering real A4 PDFs, not by
  reading the DOM (`scratchpad/printcheck/render.mjs` drives headless Chrome).

## Numbers on paper
- Averages are rounded ONCE, at source, in `sectionReport()` via `roundAvg`
  (1 dp — the precision that gets printed). Ranking compares those same
  rounded values, so a report card can never show two equal averages at
  different ranks. Never re-round a raw average in a component.
- Ties share a rank and the next rank skips (competition ranking: 11, 11, 13).

## Workflow
- After each screen: `npm run build` (must pass), check at 360px, then commit.
