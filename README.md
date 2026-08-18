# HoneyBadger School

A frontend-only prototype of a school management system for ordinary Ethiopian
schools — thin budgets, unreliable internet, non-technical staff. Phase 1 is a
clickable demo with realistic mock data (no backend, no real auth), styled to
match HoneyBadger Courses (honey-gold on warm paper, Montserrat + Inter +
Noto Sans Ethiopic).

## Run it

```bash
npm install
npm run dev        # http://localhost:5180
```

`npm run build` typechecks (strict TS) and produces `dist/`.

Demo data (~300 students in Grades 5–7 × sections A/B, 12 teachers, one term
of attendance, one exam period, fees in ETB) is seeded into localStorage on
first load. **Settings → Reset demo data** restores it at any time.

## Sign in

The login screen just picks a role — no password:

- **Administrator** — the office view (registrar, fees, reports, settings).
- **Teacher** — pick any of the 12 teachers; you see only their sections.

## Screen-by-screen walkthrough

### Shared
- **Login** — role select, language toggle (English / አማርኛ placeholder).
- **Shell** — sidebar on desktop; bottom navigation + top bar on phones
  (everything works at 360 px). Subtle Online/Offline pill; when offline,
  saves are labeled "Saved on this phone".

### Admin
1. **Dashboard** — today's attendance (per-section bars, sections not yet
   taken), fees collected vs outstanding this term, quick actions that jump
   straight into *Register student* and *Record payment*.
2. **Students** — search + grade/section filters; profile with Personal info /
   Attendance / Marks / Fees tabs; *Register student* form (forgiving,
   inline validation); *Promote class* bulk action (untick repeaters; top
   grade graduates off the roll); printable class roster.
3. **Fees** — fee structure per grade (add items); *Record payment*: find the
   student, tick what they're paying, get a numbered receipt (HB-0001…)
   with a print layout; *Outstanding balances* filterable by grade/section
   with a printable defaulters report (guardian phone numbers included).
4. **Exams** — exam periods (add more, e.g. Final); pick a section to see
   averages + ranks; open any student for the report card: marks, average,
   rank-in-section, class average, attendance %, homeroom-teacher comment;
   print one card or the whole section (one page per student).
5. **Staff** — teacher list; add/edit teacher and their section+subject
   assignments; homeroom badge.
6. **Settings** — school name (EN/አማ), year/term, receipt signature name,
   grade & section structure overview, language, **Reset demo data**.
7. **Print design** — every paper document (receipt, report card, defaulters,
   roster) shares the HB letterhead with the honey band; `@media print`
   hides the app and prints just the document.

### Teacher
1. **My classes** — assigned sections with one-tap paths into attendance/marks.
2. **Attendance** — pick a section chip, date defaults to today; everyone
   starts *Present* so a class of 60 is "Mark all present" + tap the two or
   three exceptions — well under a minute. Saves are optimistic:
   *Saving… → Saved on this phone → Synced*.
3. **Mark entry** — section + subject + exam; keyboard-first grid: type a
   mark, **Enter/Tab jumps to the next student**, values save optimistically,
   out-of-range marks are flagged inline and never saved; running class
   average and entered-count shown.
4. **My students** — read-only roster with guardian info and attendance %.

## Where the real backend plugs in

Everything the UI reads or writes goes through **`src/services/`**:

```
components ──read──▶ useDb()          src/services/db.ts   (client-side cache)
components ──write─▶ services/*.ts    async fns — the only mutation path
```

- `src/services/{students,attendance,exams,fees,staff,settings}.ts` — every
  function is `async` with the signature a real API client would have.
  Swap the bodies for `fetch()` calls; components don't change.
- `src/services/db.ts` — the in-memory + localStorage cache the services
  mutate today. With a server, this becomes the hydrated query cache.
- `src/data/seed.ts` — deterministic demo data. Only `db.ts` imports it;
  delete it when a backend exists.

Other planned swap points:

- **Dates** — all display goes through `src/lib/dates.ts` (`fmtDate`), the
  single place to add Ethiopian-calendar output.
- **i18n** — every UI string is a key in `src/i18n.ts`; fill in the `am`
  dictionary to ship Amharic.
- **Auth** — the role-select login writes a session store
  (`src/store/session.ts`); replace with a real login without touching pages.

See `CONVENTIONS.md` for the code patterns every screen follows.
