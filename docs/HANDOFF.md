# Handoff — August 2026

Where the work stands mid-batch, so the next session can pick up without
re-deriving anything. Read `CONVENTIONS.md` first (the rules), then
`ARCHITECTURE.md` (the map). This file is only the current state of play.

Delete it once the open items land.

---

## Done and committed

| Item | Commit | Notes |
|---|---|---|
| Branding — "HoneyBadger School Management" | `5a85fc4` | title, login, shell, printed letterheads |
| Logo | `5a85fc4` | see **Logo** below — processed, not raw |
| Add grades and classes (Settings) | `f5925f0` | one **+ Add class** button, then a class/grade choice |
| Grading weights config (Settings) | `f5925f0` | built, validated, **deliberately disabled** — see below |
| Fees: Paid + Outstanding tabs | `1fecc55` | + de-duplicated the defaulters derivation |
| Attendance history + Submit register | `2edfb88` | see **Item 4** below for what shipped |
| Offline sync design note | `d7aacd3` | `SYNC-DESIGN.md` — decisions only, no server built |
| Schema shape: attendance per student-day | `08f1396` | see **Schema-shape fixes** below |
| Schema shape: UUID ids | `f4f3c44` | |
| Schema shape: receipt block leasing | `cc563b8` | |
| Schema shape: business date / clock / sequence | `d46e620` | |

Earlier work (student IDs, staff management, audit trails, print pagination,
the identity-fallback fix) is described in `ARCHITECTURE.md` and the git log.

### Logo
`src/assets/logo.png` is **not** the file the user supplied. The original
(`~/Downloads/honeybadger-school-site/Honey badger final logo.png`, 1080×579)
had no alpha channel and 63% of the canvas was empty white margin. It was
flood-filled from the corners to transparency, feathered, and cropped to the
artwork. Two variants exist — the full badger and a tighter mark for small
sizes. **If the user supplies new artwork, re-run that processing**; do not
drop a raw white-background PNG onto the honey-paper background.

Measured for print: 68% of the artwork is near-black in greyscale. It reads
correctly on the A4 letterhead at the size currently used. Do not enlarge it
there without re-proofing on a mono printer.

---

## Open

### Item 5 — Assessments and weighted subject averages  *(deferred)*
Deferred by the user pending school feedback on how they actually weight work.
**Do not start it without confirming the weighting model is settled.**

---

## Item 4 — what shipped  *(`2edfb88`)*

- `AttendanceDay.submittedAt: string | null`. Three states, derived by
  `registerState()` in `services/attendance.ts`: no record = **not started**,
  record with `submittedAt: null` = **in progress**, else **submitted**.
- A recent-days chip row (last 6 school days) on the teacher screen, each chip
  carrying a state dot — green submitted, amber in progress, grey none.
- **Only today is editable.** The guard is `isEditable(date)` in the service,
  not only in the markup: `persist()` returns early, the P/A/L buttons are
  `disabled`, and "Mark all present" and the submit bar are not rendered.
- A past day with **no** register shows an empty state, *not* the all-present
  default — otherwise it would display a full register for a day nobody took.
- Per-tap autosave is untouched. `submitRegister()` only stamps `submittedAt`;
  the marks were already saved, so submitting is not a save path that can lose
  work.
- Compliance panel and the per-class list now separate not started from in
  progress, and name the responsible teacher on each row.
- Seed leaves the third section mid-register on purpose so all three states are
  visible in the demo at once. `SCHEMA_VERSION` bumped to **12**.

**Admin correction is deliberately not built.** `services/attendance.ts` carries
a `TODO(admin correction)` recording its required shape: a `correctAttendance`
that takes a reason, is admin-guarded, and writes to `db.auditLog` — attendance
feeds fee waivers and truancy reports, so a silent edit is not acceptable. The
teacher screens must keep calling `saveAttendance` and stay locked out.

---

## Item 5 — what is already in place

Schema and services exist. Nothing is wired to a screen, and no calculation
consumes it yet.

**In `src/types.ts`:**
- `AssessmentTypeId` — fixed vocabulary of 8: homework, classwork,
  exercise_book, worksheets, assignments, tests, exams, final_exam. Schools
  tune weights, not the vocabulary, so report cards stay comparable.
- `GradingWeights` = `Record<AssessmentTypeId, number>`, must total exactly 100.
- `Assessment` — `{ id, sectionId, subjectId, type, name, maxMark, date, createdBy }`.
- `AssessmentScores` — `` `${assessmentId}|${studentId}` `` → **raw** score out
  of that assessment's own `maxMark`. Percentage conversion happens at read
  time, so editing a maximum never rewrites stored data.
- `Db` carries `grading`, `assessments`, `assessmentScores`.

**In `src/services/grading.ts`:** `weightsTotal`, `weightsProblem` (returns
`{total, diff}`, never silently normalises), `saveGrading` (throws unless 100),
`assessmentsFor`, `addAssessment`, `deleteAssessment`, `saveScore`.
`saveScore` already writes `markAudit`, so assessment scores inherit the
authorship trail.

**In the seed:** `grading` defaults to
`homework 5, classwork 5, exercise_book 5, worksheets 5, assignments 10,
tests 20, exams 20, final_exam 30` (= 100). `assessments` and
`assessmentScores` are seeded **empty**.

**In Settings:** the Grading card renders all 8 weights and blocks a save that
doesn't total 100. It is **disabled** with a "Not in use yet" pill and a note,
because configuring something with no visible consequence is worse than hiding
it. A code comment in `src/pages/admin/Settings.tsx` marks exactly what to
remove — the `disabled` props on the inputs and the Save button, the pill, and
the explanatory paragraph.

### What still needs doing for item 5

1. **The calculation.** `lib/derive.ts` has **zero** references to assessments
   today; `sectionReport` still reads `db.marks` (the flat
   `examId|subjectId|studentId` map). Add: per type, average the student's
   percentage scores across that type's assessments; multiply by the type
   weight; sum. See the re-basing rule below — it is decided, not open.
2. **Teacher UI.** Tapping a student in Mark entry opens their assessments;
   creating an assessment; the fast grid validating against **that
   assessment's** `maxMark`, Enter advancing.
3. **Report cards** and the student profile Marks tab must read the weighted
   average, not `db.marks`.
4. **Migration.** `db.marks` and the exam-period model still exist and still
   drive report cards. Decide whether the old exam mark becomes a seeded
   `final_exam` assessment per subject, or the two models coexist. Coexistence
   is the trap: two sources of truth for one subject mark. Prefer migrating the
   seed and retiring `db.marks`.
5. **Bump `SCHEMA_VERSION`** in `services/db.ts` (currently **12**) so cached
   browsers reseed.

### Partial terms — re-base, never cap  *(decided, user-directed)*

A subject mark is the weighted sum over the types that **actually have marks**,
with the remaining weights re-based to 100:

```
average = Σ(typeAvg × weight) / Σ(weight)      over qualifying types only
```

Not `Σ(typeAvg × weight) / 100`. Mid-term, most types are empty; dividing by
the full 100 would cap every student below full marks and produce a report card
nobody in the school can explain. A student is never penalised for work their
teacher hasn't assigned.

Three consequences to implement together:

1. **Qualifying is per student, not per class.** A type qualifies for a student
   only if that student has at least one score in it. A type whose assessments
   exist but which a student missed entirely is excluded from *their*
   re-basing — the same rule as a single missing assessment, where empty ≠ zero.
   So the divisor can legitimately differ between two students in one class.
2. **Show the basis.** The report card and the student profile Marks tab must
   state what the average rests on — "from 4 of 8 assessment types" — so a
   partial term is never mistaken for a final result. Print it near the
   average, not in a footnote.
3. **No qualifying types → absent average, not zero.** A subject with no marks
   at all yields `null`, renders as "—", and is excluded from the student's
   overall average and from ranking, exactly as a missing exam is today. Zero
   is a score a student earned; absent is the absence of one. Never conflate
   them.

### Rank ties — a hard requirement

Two ties are seeded in Grade 5A today and both are asserted by the evidence
checks:
- **Tie 1** — identical scores in every subject → equal rank, next student
  skips (competition ranking, `n, n, n+2`).
- **Tie 2** — *different* raw averages that round to the *same printed*
  1-decimal average → must share a rank, because `lib/derive.ts` ranks on the
  rounded value that actually gets printed. A report card can never show two
  equal averages at different ranks.

**When item 5 lands, re-engineer both ties in the new weighted arithmetic —
do not carry the old numbers across.** A tie that survives only because it was
copied from the previous model tests nothing. Construct assessment scores whose
*weighted* averages genuinely collide, including the rounding case, and re-run
the arithmetic proof for one student by hand against the configured weights.

---

## Schema-shape fixes  *(ahead of the Supabase backend)*

Four data-shape decisions applied so the shape is right before there is real
school data to migrate. Full rationale in `SYNC-DESIGN.md`; what changed:

1. **Attendance is one record per student per day** (`08f1396`).
   `db.attendance` is a keyed map (`sectionId|date|studentId`), `db.registers`
   holds submission per class-day. **`saveMarks` takes a patch, not a
   snapshot** — callers may name only what the user touched. That second part
   is the one that actually prevents the clobber; storage grain alone did not,
   and a two-device test proved it. Don't "helpfully" reintroduce a
   whole-register save.
2. **All internal ids are UUIDs** (`f4f3c44`) via `newId()` in `lib/id.ts`.
   `studentNo` stays a human-facing sequence. Subjects keep readable ids —
   fixed vocabulary, no create path. Seeded ids come from a **separate RNG
   stream** (`idRnd`); sharing the main stream would rebuild a different demo
   school and destroy the rank ties.
3. **Receipt numbers are leased in blocks** (`cc563b8`, `services/receipts.ts`).
   Self-contained and removable in three steps if directors confirm fee
   collection is always online — the file header lists them.
4. **Business date / clientRecordedAt / serverSeq are three separate things**
   (`d46e620`). `businessDate()` pins `Africa/Addis_Ababa`. **Nothing orders or
   resolves on a client clock** — if you add a sort, sort on `serverSeq`.

`SCHEMA_VERSION` is **16**.

### Known workflow hazard — Vite module skew

Verifying services by `await import('/src/services/…')` in the browser console
gives a **different module instance** from the running app once Vite has
invalidated a file (it serves `?t=` variants). Symptom: a write appears to
succeed and the read shows stale data. Restart the dev server before trusting
any console-driven evidence, and assert that the handles agree first — a probe
write that the other handle can see. This cost real time twice.

---

## Session conventions worth repeating

- `npm run build` runs `tsc --noEmit` first; both must be clean before commit.
- Verify at **360px and 1280px** — a phone is the teacher's real device.
- Print changes are verified by rendering **real A4 PDFs**
  (`scratchpad/printcheck/*.mjs` drives headless Chrome), never by reading DOM.
- Grep CSS class names against `src/index.css` before using them; unknown
  classes fail silently. There is no `.chip`, `.backlink` or `.grid` here.
- **Tailwind opacity modifiers must be multiples of 5** (`/15`, `/20`). An
  off-scale value like `bg-warn/12` generates *no rule at all* and renders
  fully transparent — it does not error, and it survives review because the
  markup looks right. `2edfb88` fixed two of these. Use `/[0.12]` if a
  non-scale value is genuinely wanted.
- Deploy folder: `~/Downloads/honeybadger-school-site` — rebuilt by copying
  `dist/`. It is wiped on each refresh, so never store source assets in it.
