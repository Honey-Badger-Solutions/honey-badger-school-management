# Prompt

- prompts.md.prompts [6]

# Response

Phase 3 — Printing: complete
Build/type-check: `tsc --noEmit` clean, `vite build` passes, app boots with no
console errors. Verified additionally by rendering real PDFs through headless
Chrome and by driving the print-request and print-settings services directly.

## 0. The money mismatch, resolved first

The schema stores money as **integer santim** (`fee_items.amount_santim`,
`payments.total_santim`, `payment_lines.amount_santim`, all `bigint`). The
prototype held **whole Birr** — the same number divided by 100. That reads as
correct on every screen and then prints `ETB 1,250` where the ledger says
`125,000`. Receipts are exactly where it stops being recoverable, so it was
fixed before anything was printed.

- `FeeItem.amount` → `amountSantim`, `PaymentLine.amount` → `amountSantim`,
  `Payment.total` → `totalSantim`. The rename is the point: an `amount` with no
  unit is what allowed the two halves to disagree silently.
- `lib/money.ts` rewritten around santim: `birrToSantim`, `santimToBirr`,
  `fmtETB` (screen — `ETB 800`, or `ETB 1,250.50` when there are santim),
  `fmtAmount` (paper — always 2 dp so columns line up), `fmtBirr` (the KPI
  tiles, which render `ETB` at their own size), `parseBirrToSantim` and
  `birrInputFilter`.
- Conversion happens **only at the edges**: a form field parses to santim on the
  way in, a formatter renders Birr on the way out. Nothing in between sees Birr.
- Fee amount inputs now accept decimals (`inputMode="decimal"`), and reject
  rather than coerce — a silently truncated fee is worse than a form that will
  not submit.
- Seed multiplied through `birrToSantim` so the demo school still quotes
  ETB 800 / 300 / 250, now stored as 80000 / 30000 / 25000.
- `SCHEMA_VERSION` 19 → 20, so cached browsers rebuild rather than showing
  100× wrong balances.

Checked: all 9 fee items and 261 seeded payments are integer santim, every
payment's lines sum exactly to its total, no payment exceeds what is due, and
`fmtETB`/`parseBirrToSantim` round-trip (including `1,250.50`, `0.07`, and
rejecting `1.234`).

## Files changed

**New (5)**: `lib/print.ts`, `services/print.ts`, `services/printRequests.ts`,
`components/print/Receipt.tsx`, `components/print/ReportCard.tsx`,
`components/print/PrintByStaff.tsx`, `pages/admin/PrintSettings.tsx`

**Modified (19)**: `types.ts`, `data/seed.ts`, `services/db.ts`,
`services/fees.ts`, `config/permissions.ts`, `lib/money.ts`, `lib/derive.ts`,
`components/Print.tsx`, `components/Shell.tsx`, `App.tsx`, `i18n.ts`,
`index.css`, `pages/admin/{Fees,Exams,Dashboard,StudentProfile}.tsx`,
`pages/finance/{Fees,Dashboard}.tsx`, `pages/print_staff/Dashboard.tsx`,
`docs/CONVENTIONS.md`

## Features implemented

**Print settings** (`/school-admin/print-settings`) — pick one of the app's
layouts, then decide what appears inside it: logo upload, show/hide the Amharic
name, city and phone, accent colour (Honey or Ink for mono printers),
header/footer text, four receipt field toggles, five report-card field toggles,
and the principal's name. Changes save as you make them and the preview beside
them updates — a toggle you must save before you can see is a toggle nobody
trusts. The preview renders the **real print components**, not a mock-up, using
the school's most recent payment and a real report row.

**Receipt layouts (2)** — `Standard` (A4, full letterhead, the filing copy) and
`Thermal` (80mm roll, no letterhead graphics, for a counter printer). Chosen by
radio button. No designer.

**Report-card layouts (2)** — `Standard` (one mark per subject, summary band,
comment, signatures) and `Detailed` (adds out-of, per-subject class average and
a grade letter, plus the attendance breakdown). Chosen by radio button.

**Print by staff** — `<PrintByStaffButton>` on the receipt modal (both Fees
screens) and the report-card modal queues the document for the Print-Only Staff
member, with copies (capped at 20) and a note. The report-card version saves the
teacher comment first, since the desk prints from live data.

**Print-Only Staff dashboard** — was a placeholder, is now the queue. Empty when
there is nothing to print, which is the honest starting state and what the spec
asks for. Waiting / Completed / Cancelled tabs, one row per request showing the
document, who asked, when and how many copies. Opening a request shows the real
document plus the request details; Print emits one sheet per requested copy, and
Mark completed / Cancel request close it with attribution.

## Architectural / data-model changes

- **`Db.printSettings`** — one row per school; every field is either a choice
  between layouts the app owns or a show/hide/text option inside one. Nothing
  here can change a document's *structure*. That is deliberate: a school that
  can move the total off a receipt has produced something that is not a receipt,
  and a report card whose columns move is no longer comparable with the one the
  same school printed last term.
- **`Db.printRequests`** — a request stores a **reference**
  (`kind`, `subjectId`, `examId`), never a rendered document. The paper is
  re-derived when it prints. A snapshot would mean a corrected mark or a renamed
  cashier printing wrong hours later, with nothing on the sheet to say which
  version you are holding.
- **Paper moved into components.** `ReceiptPaper` and `ReportCardPaper` now live
  in `components/print/`, because three screens print a receipt (school admin,
  finance officer, print desk) and two print a report card. `ReportCardPaper`
  came out of `pages/admin/Exams.tsx`. Both take an optional `layout` prop used
  **only** by the settings preview.
- **`PrintHead`/`PrintFoot` read the settings themselves**, so any future paper
  document inherits the school's letterhead choices without knowing about them.
  Colours resolve through `ACCENT_BAND`/`ACCENT_TEXT` in `lib/print.ts` — never
  a hex in a component.
- `subjectAverages()` added to `lib/derive.ts`, rounded once at source to the
  same 1 dp everything else prints (CONVENTIONS "Numbers on paper").
- `gradeLetter()` in `lib/print.ts` is a **fixed** scale (90/80/70/60), not a
  school setting. A school that can redefine an A has made its report cards
  incomparable with every other school's, which is the one thing a printed grade
  is for.
- `addFeeItem` gained the `fees.configure` check it was missing.

## Permissions added/changed

New: `print.configure`, `print_requests.create`, `print_requests.view`,
`print_requests.process`.

| Role | Gains |
|---|---|
| school-admin | `print.configure`, `print_requests.create` |
| finance-officer | `print_requests.create` |
| print-only-staff | `print_requests.view`, `print_requests.process` |

The two queue permissions sit **outside** the `READ_ONLY` set on purpose:
closing a request changes a record, which is precisely what "read only" promises
it will not do. Service-layer guards, not just UI: `savePrintSettings`/`saveLogo`
assert `print.configure`, `requestStaffPrint` asserts `print_requests.create` and
refuses a null actor, and closing a request asserts `print_requests.process`,
checks the school, and is a no-op on an already-closed request rather than a
second attribution.

## Verified end-to-end

**Services** (real services, localStorage stubbed): finance officer queues a
receipt for 3 copies with a note → attributed to them, stamped with the school,
commit sequence allocated, queue shows 1 waiting → they are refused when they
try to complete it, and refused when they try to change print settings → copies
clamp 9999→20 and 0→1 → a report card with no exam is refused → school admin
queues a report card and changes layouts/accent/header (attributed and
timestamped), logo stored, cleared, and a 200 KB logo refused → print desk sees
4 waiting, completes one and cancels one (both attributed), queue reads
newest-first by commit order, re-closing a closed request changes nothing, and
the desk is refused when it tries to queue its own work. Money: a payment
recorded through the service is 12345 santim and moves the balance by exactly
12345; a fee added through the service stores 25050; print staff refused.

**Rendering** (`react-dom/server`): both receipt layouts and both report-card
layouts render; every show/hide option actually changes the output — hidden
fields disappear, the letterhead leaves no orphaned `·` separator, the summary
band collapses from four columns to one rather than printing empty boxes, the
ink accent replaces the honey band, header/footer text appears, the detailed
layout adds its columns and attendance breakdown, and no raw santim figure
reaches the paper.

**Real PDFs** (headless Chrome, per CONVENTIONS): 6 documents rendered — single
receipt = 1 page, 3 copies = 3 pages, single report card = 1 page, 4-card batch
= 4 pages, detailed report card = 1 page. No blank pages, nothing orphaned.

**In the browser**: the built app boots clean; the print queue renders its empty
state and three tabs as print-only staff; the print settings screen renders every
control and both live previews as school admin.

## Remaining limitations

1. **The thermal page size could not be proven here.** `@page thermal
   { size: 80mm auto }` and `page: thermal` are in the built CSS, but headless
   Chrome's `--print-to-pdf` ignores `@page size` entirely (confirmed: even a
   plain `@page { size: 80mm auto }` still emits Letter). The hard
   `width: 72mm` clamp means content cannot exceed the roll regardless, but the
   roll-size rule itself needs one check on a real thermal printer or the
   browser print dialog.
2. **A requester cannot see what happened to their request.** `print_requests.view`
   is granted only to the print desk, because only the print desk has a screen
   for it. A school admin or cashier gets a confirmation toast and nothing after
   that. This is the most obvious next increment.
3. **No batch print request.** "Print all report cards" still prints locally;
   you cannot hand the desk a whole class in one request.
4. Logo and layout choices are school-wide — no per-document logo, and no
   separate receipt/report-card letterhead.
5. The grade-letter scale is fixed in code (see above — deliberate, but a school
   wanting a different scale needs a schema change, not a setting).
6. The logo is a data URL in the same localStorage budget as the database.
7. Print settings changes are not written to `auditLog` — only
   `updatedAt`/`updatedByUserId` on the row itself.

---

# Supabase Changes Required (Phase 3)

## Definitely required

### Money — data migration, not a schema change
1. **No schema change needed** — `fee_items.amount_santim`,
   `payments.total_santim` and `payment_lines.amount_santim` already exist as
   `bigint`. The app now matches them. **But**: if any existing rows were
   written by a build that stored Birr, they are 100× too small and need
   `UPDATE … SET amount_santim = amount_santim * 100` for exactly those rows.
   Identify them before importing anything — this is the one migration that is
   silently wrong rather than loudly broken.
2. Consider `CHECK (amount_santim % 1 = 0)` is unnecessary (`bigint` is
   integral), but **do** keep the existing `> 0` / `>= 0` checks: the app relies
   on a payment total being positive.

### New table — print settings
3. **`public.school_print_settings`** — one row per school:
   `school_id uuid PRIMARY KEY REFERENCES public.schools(id)`,
   `receipt_layout text NOT NULL DEFAULT 'standard' CHECK (receipt_layout IN ('standard','thermal'))`,
   `report_card_layout text NOT NULL DEFAULT 'standard' CHECK (report_card_layout IN ('standard','detailed'))`,
   `logo_url text`,
   `show_logo boolean NOT NULL DEFAULT true`,
   `show_name_am boolean NOT NULL DEFAULT true`,
   `show_city boolean NOT NULL DEFAULT true`,
   `show_phone boolean NOT NULL DEFAULT true`,
   `accent text NOT NULL DEFAULT 'honey' CHECK (accent IN ('honey','ink'))`,
   `header_note text NOT NULL DEFAULT ''`,
   `footer_note text NOT NULL DEFAULT ''`,
   `receipt_show_cashier boolean NOT NULL DEFAULT true`,
   `receipt_show_method boolean NOT NULL DEFAULT true`,
   `receipt_show_balance boolean NOT NULL DEFAULT false`,
   `receipt_show_signature boolean NOT NULL DEFAULT true`,
   `report_show_rank boolean NOT NULL DEFAULT true`,
   `report_show_class_average boolean NOT NULL DEFAULT true`,
   `report_show_attendance boolean NOT NULL DEFAULT true`,
   `report_show_comment boolean NOT NULL DEFAULT true`,
   `report_show_signatures boolean NOT NULL DEFAULT true`,
   `principal_name text NOT NULL DEFAULT ''`,
   `updated_at timestamptz`, `updated_by uuid REFERENCES public.users(id)`,
   `server_seq bigint`.

   **Columns, not `jsonb`.** Each one is a named choice the printed document
   depends on; a typo in a jsonb key would fail silently on paper, which is the
   one place nobody is watching a console. A `PRIMARY KEY` on `school_id` is
   what enforces "one row per school" — do not let a second row exist.
4. Seed a row per existing school (`INSERT … SELECT id FROM public.schools`), or
   have the client treat a missing row as all-defaults. Pick one; the app
   currently assumes the row exists.

### New table — print requests
5. **`public.print_requests`**:
   `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`,
   `school_id uuid NOT NULL REFERENCES public.schools(id)`,
   `kind text NOT NULL CHECK (kind IN ('receipt','report_card'))`,
   `subject_id uuid NOT NULL` — a payment id or a student id,
   `exam_id uuid REFERENCES public.exam_periods(id)` (nullable; see 6),
   `copies integer NOT NULL DEFAULT 1 CHECK (copies BETWEEN 1 AND 20)`,
   `note text NOT NULL DEFAULT ''`,
   `status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled'))`,
   `requested_by uuid NOT NULL REFERENCES public.users(id)`,
   `requested_at timestamptz NOT NULL DEFAULT now()`,
   `processed_by uuid REFERENCES public.users(id)`,
   `processed_at timestamptz`,
   `server_seq bigint`,
   `op_id uuid NOT NULL UNIQUE` — match the idempotency pattern `payments`
   already uses, so a retried request does not queue the job twice.
6. `subject_id` is **deliberately not a foreign key**: it addresses two
   different tables, exactly as `audit_log.subject_id` does. Add
   `CHECK ((kind = 'report_card') = (exam_id IS NOT NULL))` so a report-card
   request cannot exist without an exam and a receipt cannot carry one — the app
   enforces this client-side today and that is not enough.
7. `CHECK ((status = 'pending') = (processed_by IS NULL))` — a closed request
   must say who closed it, and an open one must not claim to have been closed.
8. Note on `exam_periods`: the app's `ExamPeriod` is still local-only (see the
   carried-over items below). If that table does not exist yet, `exam_id` lands
   as a plain `uuid` and gains its FK with the exams work.

### Storage
9. **`school-logos` bucket** — one object per school id, mirroring the `avatars`
   bucket from Phase 1. RLS: public read (a logo is printed on documents handed
   to parents; it is not secret), write only by a `print.configure` holder in
   that school. `logo_url` then holds the object URL and the client stops
   holding a data URL.

### RLS
10. `school_print_settings` — `SELECT` for any member of that `school_id`
    (every role prints, so every role must read the settings);
    `INSERT`/`UPDATE` only for holders of `print.configure` in that school.
11. `print_requests` — `SELECT` scoped to `school_id` for
    `print_requests.view` holders; `INSERT` for `print_requests.create` holders
    in that school, with `requested_by = auth.uid()` forced by the policy rather
    than trusted from the client; `UPDATE` of `status`/`processed_by`/
    `processed_at` only for `print_requests.process` holders in that school. No
    `DELETE` — a cancelled request is a record that someone asked.
12. A closed request must not be reopened by a client: either a policy
    predicate `status = 'pending'` on the `UPDATE`, or a trigger. The app
    already treats this as a no-op; the server has to agree.

### Permissions vocabulary
13. Whatever mechanism ends up enforcing `ROLE_PERMISSIONS` server-side needs
    the four new keys: `print.configure`, `print_requests.create`,
    `print_requests.view`, `print_requests.process`.

## Verify only

14. **`payments.total_santim` / `payment_lines.amount_santim` semantics** —
    confirm the existing rows (if any) are santim and not Birr. This is the
    check that protects against item 1.
15. **`fee_items.amount_santim`** — same check, plus confirm no row relies on
    the app's old whole-Birr assumption.
16. Whether `report_comments` (which exists) should back
    `db.comments` — the report card prints a comment and the table is already
    shaped for it (`school_id`, `student_id`, `term_id`, `comment`,
    `updated_by`). The app still keys comments by `examId|studentId`, so
    confirm whether a comment belongs to a **term** (as the schema says) or an
    **exam period** (as the app assumes) before wiring it.
17. Indexes: `print_requests (school_id, status, server_seq DESC)` — that is
    exactly the queue query. Confirm nothing equivalent exists.
18. Storage: whether an `avatars`-style bucket policy pattern is already
    established that `school-logos` should copy verbatim.
19. `schools.name_amh` / `schools.phone` are printed on the letterhead — confirm
    they are populated for real schools, since the app now lets a school hide
    them but not invent them.
20. Whether a print job needs to survive a device reload as a **queue** rather
    than a row — i.e. whether Realtime should push new `print_requests` to the
    print desk. The app polls the local cache today; server-side this is a
    natural Realtime subscription and worth deciding before integration.

## Carried over, still required

- Phase 1: widen `user_roles.role` to the six app roles + data migration for
  existing `admin`/`registrar`/`cashier` rows; `public.users` gains
  `avatar_url`, `onboarding_completed_at`, `last_sign_in_at`, `account_status`;
  `avatars` bucket; users/user_roles RLS; Auth email/password config.
- Phase 2: `teacher_attendance` gains `mark` + `marked_by` +
  `UNIQUE (school_id, user_id, business_date)`; `public.users` gains
  `invited_by_user_id`, `invited_at`; invitation Edge Function; Auth invite
  template and OTP expiry; `set_user_roles` RPC; `teacher_attendance` RLS;
  server-side "cannot deactivate your own account".
- Still unmodelled server-side and needed before printing is fully wired:
  `exam_periods` / `marks` (the report card's source), academic years and terms,
  and `schools.city` (which the app keeps in `settings` because the schema has
  no column for it).

**Explicitly NOT needed**: no table for the receipt/report-card *layouts*
themselves — they are application code, and a school choosing between them is a
single text column. Do not let this become a template-storage feature.

Phase 3 is done and working. Phase 4 (SaaS platform) not started, as instructed.



# Printed response 
Phase 3 is complete. Type-check clean, production build passes.

The money fix came first
The schema stores integer santim (amount_santim, total_santim, all bigint); the prototype held whole Birr — the same number ÷ 100. That reads as correct on every screen and then prints ETB 1,250 where the ledger says 125,000. Fixed before anything was printed:

FeeItem.amount → amountSantim, PaymentLine.amount → amountSantim, Payment.total → totalSantim. The rename is the fix — an amount with no unit is what let the two halves disagree silently.
money.ts rebuilt around santim: fmtETB (screen), fmtAmount (paper, always 2 dp), fmtBirr (KPI tiles), parseBirrToSantim, birrInputFilter. Conversion happens only at the edges.
Seed multiplied through birrToSantim; SCHEMA_VERSION 19 → 20 so cached browsers rebuild rather than showing 100×-wrong balances.
Fee inputs now take decimals and reject bad input rather than coercing it.
Printing
Feature	Where
Print settings — layouts, logo, colour, header/footer, field toggles, live preview	PrintSettings.tsx → /school-admin/print-settings
Receipt: Standard (A4) / Thermal (80mm)	Receipt.tsx
Report card: Standard / Detailed	ReportCard.tsx
"Print by staff" button	PrintByStaff.tsx
Print queue	print_staff/Dashboard.tsx
Radio buttons, no designer. Two decisions worth calling out: a print request stores a reference (kind, subjectId, examId), never a rendered document — the paper is re-derived when it prints, so a corrected mark can't print stale with nothing on the sheet to say so. And the paper moved out of the page files into components/print/, because three screens print a receipt now.

Verified, not assumed
Services: finance officer queues 3 copies → refused when they try to complete it or change print settings → copies clamp 9999→20 → print desk completes/cancels with attribution → re-closing a closed request changes nothing → desk refused when queueing its own work. A service-recorded payment of 12345 santim moves the balance by exactly 12345.
Rendering (react-dom/server): every show/hide option actually changes output — the letterhead leaves no orphaned ·, the summary band collapses 4 columns → 1 rather than printing empty boxes, no raw santim reaches paper.
Real PDFs (headless Chrome, per CONVENTIONS): 1 receipt = 1 page, 3 copies = 3 pages, 4-card batch = 4 pages. No blanks.
Built app boots clean; both new screens render in-browser under the right roles.
Every CSS class checked against index.css first.
Two things to know
The thermal 80mm page size is unproven here. The CSS is in the build, but headless Chrome's --print-to-pdf ignores @page size outright — I confirmed even a bare @page { size: 80mm auto } still emits Letter. The hard width: 72mm clamp means content can't overflow the roll regardless, but the roll size itself needs one look at a real printer or the browser print dialog.
A requester can't see what happened to their request. print_requests.view went only to the print desk, because only the print desk has a screen for it — I'd rather not ship a permission with nothing behind it. A cashier gets a toast and nothing after. Most obvious next increment.
Supabase
Full checklist in report.3.md. The headlines:

Required — two new tables (school_print_settings, keyed PRIMARY KEY (school_id); print_requests with op_id idempotency and CHECKs tying exam_id to kind and processed_by to status), a school-logos Storage bucket, RLS on both tables (with requested_by forced by policy, not trusted from the client), and the four new permission keys.

The one that can bite silently: no money schema change is needed — the columns are already correct. But any rows written by a build that stored Birr are 100× too small and need a data migration. That's the item to check before importing anything, because it's wrong quietly rather than loudly.

Verify only — whether existing money rows are genuinely santim; whether report_comments (which exists, keyed by term) should back db.comments (keyed by exam) — those disagree and it needs a decision; a (school_id, status, server_seq DESC) index for the queue; and whether the print desk should get its queue over Realtime.

I did not start Phase 4.