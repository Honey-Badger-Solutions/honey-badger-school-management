# Offline sync — design note

Decisions to settle **before the first table exists**, because most of them are
schema shape, not server logic.

**Scope.** This file owns the sync *protocol* — cursors, push/pull, conflict
rules. The **schema** lives in `DATABASE.md`, which is the single source of
truth for tables and RLS; the sketches below are illustrative only, and where
they differ, `DATABASE.md` wins.

**Status.** The server design (§2, §5) is still on paper — nothing is built.
The four *schema-shape* decisions have been applied to the prototype, so the
shape is already right when the Supabase migration happens: attendance grain
(§3), identity (§4b), receipt allocation (§4a) and the clock split (§1). Each
is marked **✅ applied** below with the commit.

---

## 0. What the constraint actually is

A teacher takes a register on a phone, standing in a classroom, usually with no
usable connection. The write is small, repeated daily, and **two devices can
legitimately touch the same class on the same day** — a homeroom teacher and a
subject teacher, or one teacher on a phone and the office on a laptop.

So this is not "cache and upload later". It is concurrent editing with long
partitions. The design has to answer: what happens when both sides wrote.

---

## 1. Time — three clocks, never conflated

| Field | Set by | Used for |
|---|---|---|
| `business_date` | client (user intent) | *which school day* a register is for |
| `client_recorded_at` | device clock | display only — "saved on this phone at…" |
| `server_seq`, `server_time` | server, at commit | ordering, cursors, conflict resolution |

**Rule: no server decision ever reads a client clock.** A phone three days fast
would win every last-write-wins conflict forever, silently, until someone
noticed a term of marks was wrong.

`business_date` is deliberately *not* derived from a timestamp. Ethiopia is
UTC+3 with no DST, so deriving it in UTC moves the **early morning** across the
boundary: 00:30 in Addis is 21:30 UTC the previous day, and the register lands
on yesterday. (An evening register at 23:50 is fine under UTC at this offset —
it is the mirror case, and the one that bites a school east of UTC+3.) Taking
the date from the device's own zone fails differently: a laptop still set to
Europe files a whole class under the wrong day.

**✅ applied** (`d46e620`) — `businessDate()` in `src/lib/dates.ts` pins
`Africa/Addis_Ababa` explicitly rather than trusting UTC or the device.
`clientRecordedAt` and `serverSeq` exist on attendance, `markAudit`, payments
and `auditLog`; `takeSeq()` in `services/db.ts` mocks the per-school commit
sequence. Three call sites that ordered on a clock now order on the sequence:
payment history, the fees "most recent" sort, and the staff audit log.

Store dates as ISO Gregorian; render Ethiopian calendar labels (`2018 E.C.`) at
the edge. Never store E.C. strings — they are a presentation format.

---

## 2. Change tracking — one log, one cursor per school

**Rejected: `WHERE updated_at > :since`.** Two independent failure modes, both
silent:

1. Clock skew between writers.
2. The commit-visibility gap — a transaction can take its timestamp at T1 and
   commit at T2. A client that already polled past T1 will *never* see that row.
   It is not late; it is lost.

**Adopted: a single append-only change log.**

```
changes(
  seq         bigint      -- per-school, allocated at commit (see below)
  school_id   uuid
  table_name  text
  row_id      uuid
  op          upsert | delete
  payload     jsonb       -- row after the change
  actor_id    uuid
  server_time timestamptz
)
```

One log rather than per-table logs: a client wants *everything since X* in one
round trip, in one order. Per-table cursors multiply round trips on exactly the
link that can least afford them.

### The sequence must match commit order

`bigserial` allocates **before** commit, so seq 105 can become visible while 104
is still in flight. A client that reads to 105 and asks for `since=105` never
sees 104.

Allocate `seq` from a **per-school counter row** (`UPDATE … RETURNING`), which
serialises allocation with commit order and removes the whole class of bug. This
is a write lock per school — at a few writes per second per school, irrelevant.
`school_id` is already the tenant boundary and the natural shard, so schools
never block each other. Revisit only if a single school ever becomes write-hot.

---

## 3. Conflict resolution — per entity, and mostly not LWW

### The decision that matters most is granularity

Resolve conflicts at **the cell the user touched**, not the aggregate the UI
renders.

The prototype stores `AttendanceDay.marks` as one map per (section, date)
(`src/types.ts`). Sync that as a unit and one teacher's register silently
overwrites the other's — every student, not just the disputed one.

→ **Attendance must be stored per (section, date, student).** One row per human
decision.

**✅ applied** (`08f1396`). And a lesson worth keeping: **storage grain alone
does not fix it.** A two-device test still showed a clobber, because the
service took the caller's whole view of the register. A stale device's
"unchanged" value for a student differs from what the other device just wrote,
and no comparison against stored state can separate an unchanged cell from a
deliberate one — that is only knowable at the tap. **The write API must be a
patch too.** `saveMarks(section, date, changes)` accepts only what the user
touched; silence about a student is not an opinion about that student. Carry
this into the HTTP API: never accept a whole-collection PUT for something two
devices can hold at once.

Same for `marks` and `assessmentScores`, which are keyed maps today
(`` `${examId}|${subjectId}|${studentId}` ``). The key is already the right
grain; it just needs to be rows.

### Per-entity strategy

| Data | Strategy | Why |
|---|---|---|
| Attendance mark | LWW per (section, date, student) | one cell, one decision |
| Register submission | monotonic latch, false→true only | "submitted" is a claim about work done; a stale device must not un-submit it |
| Mark / assessment score | LWW per (assessment, student) | teachers correct their own marks routinely |
| Payment | **append-only**, idempotent | a payment is an event, not a state — never LWW, never merged |
| Student registration | append-only | |
| Student field edits | LWW **per field** | guardian phone and section change independently and shouldn't clobber each other |
| Teacher status / assignments | server-authoritative, **online only** | a departure cascades (clears homeroom, releases assignments); merging that offline is not worth the failure modes |
| Grading weights, settings | admin + **online only** | a stale device silently re-grading a term is unacceptable |
| Deletes | tombstones | matches the existing "a teacher is never deleted" rule |

**Tie-break on `server_seq`, never on a timestamp.** Total order, no ties, no
clock trust.

**Never discard silently.** When LWW drops a value, write the loser to the audit
trail. The schema already has the shape for this — `markAudit` records who
entered each mark, and `auditLog` records staff changes. A conflict loser is the
same kind of fact, and the first time a teacher says "I entered that mark", the
answer needs to exist.

---

## 4. Two things in the prototype that cannot work offline

Not sync details — schema decisions that must change before the first table.

### a) `nextReceipt` — a client-side counter *(breaks offline)*

`src/services/fees.ts:10` builds `HB-0042` from a counter in the local DB. Two
offline devices both issue `HB-0042` for different families. The number is
printed and handed over, so it cannot be corrected afterwards.

| Option | Verdict |
|---|---|
| Server allocates on sync | **No.** The parent already left with a printed slip bearing a different number. |
| Per-device leased blocks (device A holds 4000–4999) | **Recommended.** Collision-free offline; gaps are visible and explainable to an auditor. |
| Per-device prefix (`HB-A-0042`) | Honest, works, ugly on a receipt. Fallback. |

Leased blocks need a `receipt_lease` table and a client that **refuses to issue a
receipt when its lease is exhausted** — fail loudly rather than guess. That
refusal is a product decision worth confirming with the school.

**Built in the prototype** (`src/services/receipts.ts`). A device leases a block
of 100, allocates inside it, and throws `ReceiptsExhausted` when the block is
spent and there is no connection; the payment modal surfaces that and records
nothing. The server side is mocked by a single `nextReceiptBlock` counter,
which is exactly the piece a real backend takes over.

*If the directors confirm fee collection is always done at a desk with
internet, this is removable in three steps* — delete the file and the two Db
fields, take the number from the server response in `recordPayment`, and drop
the `ReceiptsExhausted` branch in the modal. Nothing else reads a lease; the
question is still open, so the leasing is deliberately kept in one piece.

### b) Identity generated from array length *(breaks offline)*

```
src/services/staff.ts:106   id: `t${db.teachers.length + 1}…`
src/services/exams.ts:45    id: `ex${d.examPeriods.length + 1}…`
src/services/students.ts:59 id: `s${num}…`
```

Two offline devices with the same local state generate the same id for different
people. The `Date.now()` suffixes are a collision guard, not a solution.

**✅ applied** (`f4f3c44`) — `newId()` in `src/lib/id.ts`, used for students,
teachers, grades, sections, exam periods, assessments, fee items, payments and
audit entries. Two deliberate exclusions: `studentNo` stays a human-facing
sequence, and subjects keep readable ids (`amh`, `eng`) because they are a
fixed vocabulary with no create path — no device can mint one, so nothing can
collide. Seeded ids are UUID-shaped but deterministic, drawn from a separate
RNG stream so the demo school does not change.

→ **Client-generated UUIDs as primary keys** for anything a client can create.

`studentNo` is a separate, softer problem: it is a *human-facing* number that
appears on records, so it has the receipt problem in slower motion. Registration
is a deliberate act performed by a registrar at a desk, not by a teacher in a
classroom — **online-only registration** removes the problem entirely and is
probably the right trade. Product decision, not a technical one.

---

## 5. Client protocol

### Pull

```
GET /sync/changes?since=<cursor>&limit=500
→ { changes: [...], next_cursor, has_more, server_time }
```

- No `since` = bootstrap. Return a **snapshot plus the cursor it was taken at** —
  never replay history from zero.
- Always page. Metered, slow mobile data is the norm, not the edge case.
- `server_time` lets the client measure its own clock skew and warn, without ever
  being trusted for resolution.

### Push

```
POST /sync/mutations
{ ops: [ { op_id, table, row_id, op, payload, client_recorded_at }, … ] }
→ { results: [ { op_id, status, server_seq } ] }
```

`status` ∈ `applied | duplicate | rejected | superseded`.

- **`op_id` (client UUID) is the idempotency key.** On a bad link, a push that
  times out after the server committed is the *normal* case. Without this, every
  retry double-posts a payment.
- Retain seen `op_id`s ~30 days — long enough that a phone left in a drawer over
  a holiday cannot double-post on return. That retention window and the tombstone
  GC window are the same number, and it is set by "how long can a device be
  offline", which is a question for the schools.
- Apply in the order sent; one rejected op must not block independent later ones.

### Scope changes invalidate cursors — the subtle one

A teacher reassigned to a new section needs that section's history, which is
**older** than their cursor and will therefore never appear in `since=`. The
class silently looks empty.

→ Encode a `scope_version` in the cursor. When the server sees a stale one, it
returns the newly-visible rows as a bootstrap delta before resuming normal
paging. This interacts directly with the existing replace-teacher flow, which
already moves whole workloads between staff.

---

## 6. What lands in the first migration

Already the prototype's shape — translate it, do not redesign it:

- client-generated UUID pks for anything a client can create ✅
- attendance as **per-student rows**, not a map per day ✅
- `business_date` / `client_recorded_at` / `server_seq` as three columns ✅
- no `nextReceipt` column anywhere; `receipt_lease` instead ✅

Still to add, with no prototype counterpart:

- `school_id` on every table — tenant boundary, shard key, lock scope, cursor
  scope. The prototype is single-tenant, so nothing carries it yet.
- `changes` log + per-school sequence counter. `takeSeq()` mocks the counter;
  the log does not exist.
- tombstone column; no hard `DELETE`.
- marks and assessment scores as rows. Still keyed maps — the key is already
  the right grain, so this is mechanical.
- `sync: 'local' | 'synced'` becomes `pending | acked | conflict` — the current
  two states cannot express "the server disagreed".

---

## 7. Questions for the schools before this is final

1. **Can registration and fee collection be online-only?** Yes removes both
   hardest problems (receipt numbers, student numbers) outright.
2. **Do two people ever mark the same class on the same day?** If genuinely
   never, attendance conflict handling can be much simpler — but design the rows
   at per-student grain regardless, since that is not reversible later.
3. **How long can a device realistically stay offline?** Sets `op_id` retention
   and tombstone GC. A wrong guess here causes duplicate payments months later.
