import type {
  Assessment, AttendanceBook, AttendanceMark, Db, FeeItem, Grade, MarkBook, Payment, RegisterBook, Section,
  MarkAudit, Student, Subject, Teacher,
} from '../types'
import { schoolDays, addDays, todayISO } from '../lib/dates'

/* Deterministic RNG so "Reset demo data" always rebuilds the same school. */
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20180901)
/**
 * Ids are drawn from their OWN stream. Sharing `rnd` would shift every draw
 * after the first id and rebuild a different school — different names, marks,
 * attendance, and the two carefully constructed rank ties would vanish.
 *
 * Seeded ids are UUID-shaped and deterministic so "Reset demo data" reproduces
 * the same school. Records created by a user get genuinely random ones from
 * lib/id.ts; nothing in the app may depend on the difference.
 */
const idRnd = mulberry32(0x5EEDB1D)
const seedId = (): string => {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(idRnd() * 16).toString(16)).join('')
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))

const MALE = ['Abebe', 'Bekele', 'Dawit', 'Ephrem', 'Fitsum', 'Getachew', 'Henok', 'Kebede', 'Lemma', 'Mulugeta', 'Nahom', 'Robel', 'Samuel', 'Tesfaye', 'Yared', 'Yonas', 'Biruk', 'Eyob', 'Kaleb', 'Natnael', 'Abel', 'Dagim', 'Estifanos', 'Girma', 'Haile', 'Mikias', 'Solomon', 'Tewodros', 'Zerihun', 'Amanuel']
const FEMALE = ['Abeba', 'Bethlehem', 'Chaltu', 'Eden', 'Feven', 'Genet', 'Hanna', 'Kidist', 'Liya', 'Mahlet', 'Meron', 'Rahel', 'Selam', 'Tigist', 'Winta', 'Yordanos', 'Bezawit', 'Eleni', 'Hiwot', 'Lidya', 'Marta', 'Meskerem', 'Ruth', 'Saron', 'Semret', 'Tsion', 'Almaz', 'Birtukan', 'Frehiwot', 'Zewditu']
const FATHERS = ['Alemu', 'Assefa', 'Bekele', 'Demissie', 'Fikadu', 'Gebre', 'Gizaw', 'Hailu', 'Kassa', 'Lemma', 'Mekonnen', 'Mengistu', 'Negash', 'Regassa', 'Shiferaw', 'Tadesse', 'Tesfaye', 'Wolde', 'Worku', 'Yohannes', 'Zeleke', 'Abera', 'Desta', 'Girma', 'Kebede']

const YEAR = '2018 E.C.'

export function buildSeed(): Db {
  const grades: Grade[] = [5, 6, 7].map((lvl) => ({ id: seedId(), level: lvl, name: `Grade ${lvl}` }))

  const sections: Section[] = grades.flatMap((g) =>
    ['A', 'B'].map((name) => ({ id: seedId(), gradeId: g.id, name, homeroomTeacherId: null, previousHomeroomTeacherId: null })),
  )

  const subjects: Subject[] = [
    { id: 'amh', name: 'Amharic' },
    { id: 'eng', name: 'English' },
    { id: 'mat', name: 'Mathematics' },
    { id: 'sci', name: 'Science' },
    { id: 'soc', name: 'Social Studies' },
    { id: 'civ', name: 'Citizenship' },
  ]

  /* ---- students: 40–60 per section ---- */
  const students: Student[] = []
  let sid = 1
  for (const sec of sections) {
    const count = int(42, 58)
    for (let i = 0; i < count; i++) {
      const sex = rnd() < 0.5 ? 'M' : 'F'
      const firstName = sex === 'M' ? pick(MALE) : pick(FEMALE)
      const fatherName = pick(FATHERS)
      const guardianSex = rnd() < 0.7 ? 'M' : 'F'
      const seq = sid++
      students.push({
        id: seedId(),
        studentNo: `${YEAR.slice(0, 4)}/${String(seq).padStart(4, '0')}`,
        // ~1 in 8 arrived from another school carrying its number, or was
        // registered on paper before this system — that is what the school's
        // own reference is for.
        schoolRefNo: rnd() < 0.12 ? `${pick(['ABC', 'KID', 'MED', 'STG'])}-${int(1000, 9999)}` : '',
        firstName,
        fatherName,
        sex,
        gradeId: sec.gradeId,
        sectionId: sec.id,
        guardianName: `${guardianSex === 'M' ? pick(MALE) : pick(FEMALE)} ${pick(FATHERS)}`,
        guardianPhone: `09${int(10, 94)} ${int(100, 999)} ${int(100, 999)}`,
        joinedYear: YEAR,
        status: 'active',
      })
    }
  }

  /* ---- 12 teachers, 2 per section-pair roughly; assignments cover every section×subject ---- */
  const teachers: Teacher[] = []
  // One vice principal, two heads of department, a few senior teachers.
  const POSITIONS: Teacher['position'][] = [
    'vice_principal', 'head_of_department', 'head_of_department', 'senior_teacher',
    'senior_teacher', 'teacher', 'teacher', 'teacher', 'teacher', 'teacher', 'teacher', 'teacher',
  ]
  const EMPLOYMENT: Teacher['employmentType'][] = [
    'full_time', 'full_time', 'full_time', 'full_time', 'full_time', 'full_time',
    'full_time', 'part_time', 'full_time', 'contract', 'full_time', 'part_time',
  ]
  for (let i = 0; i < 12; i++) {
    const sex = i % 3 === 2 ? 'F' : rnd() < 0.5 ? 'F' : 'M'
    const firstName = sex === 'M' ? pick(MALE) : pick(FEMALE)
    const fatherName = pick(FATHERS)
    teachers.push({
      id: seedId(),
      firstName,
      fatherName,
      sex,
      position: POSITIONS[i],
      employmentType: EMPLOYMENT[i],
      hireDate: `${2016 + int(0, 9)}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`,
      phone: `09${int(10, 94)} ${int(100, 999)} ${int(100, 999)}`,
      email: `${firstName}.${fatherName}`.toLowerCase() + '@honeybadger.et',
      status: 'active',
      departedOn: null,
      assignments: [],
    })
  }
  // Each of the 6 subjects gets 2 teachers; each teacher takes the subject in 3 sections.
  // `taughtBy` is captured here, BEFORE any departure clears assignments, so
  // historical marks stay attributed to whoever actually entered them.
  const taughtBy = new Map<string, string>()
  subjects.forEach((sub, si) => {
    const t1 = teachers[si * 2]
    const t2 = teachers[si * 2 + 1]
    sections.forEach((sec, ci) => {
      const owner = ci < 3 ? t1 : t2
      owner.assignments.push({ sectionId: sec.id, subjectId: sub.id })
      taughtBy.set(`${sec.id}|${sub.id}`, owner.id)
    })
  })
  // Homerooms: first 6 teachers each take one section.
  sections.forEach((sec, i) => { sec.homeroomTeacherId = teachers[i].id })

  // Both non-active states are visible in the demo from the start.
  // On leave keeps their classes (they are coming back); departed released
  // theirs, which is exactly what the replace-teacher flow is for.
  teachers[10].status = 'on_leave'
  const departed = teachers[11]
  departed.status = 'departed'
  departed.departedOn = addDays(todayISO(), -21)
  departed.assignments = []

  /* ---- attendance: last 25 school days per section ----
   * One record per student per day. The RNG is drawn in exactly the same
   * order as before, so a reseed reproduces the same marks it always did —
   * only the storage shape changed. */
  const attendance: AttendanceBook = {}
  const registers: RegisterBook = {}
  const markRoster = (sectionId: string, date: string, markedBy: string | null) => {
    for (const st of students) {
      if (st.sectionId !== sectionId) continue
      const r = rnd()
      const mark: AttendanceMark = r < 0.93 ? 'P' : r < 0.97 ? 'A' : 'L'
      attendance[`${sectionId}|${date}|${st.id}`] = {
        date, sectionId, studentId: st.id, mark, markedBy,
        // registers are taken in the morning of their own school day
        clientRecordedAt: `${date}T08:20:00.000Z`,
        serverSeq: 0, // assigned in timestamp order at the end
        sync: 'synced',
      }
    }
  }

  const days = schoolDays(25, addDays(todayISO(), -1)) // up to yesterday; today is taken live in the demo
  for (const sec of sections) {
    for (const date of days) {
      markRoster(sec.id, date, sec.homeroomTeacherId)
      registers[`${sec.id}|${date}`] = { date, sectionId: sec.id, submittedAt: `${date}T16:20:00` }
    }
  }
  // Today: mark 3 sections (demo shows a half-taken day on the dashboard)
  for (const sec of sections.slice(0, 3)) {
    markRoster(sec.id, todayISO(), sec.homeroomTeacherId)
    // the third class is left mid-register on purpose: the dashboard should
    // show not started / in progress / submitted side by side in the demo
    const submitted = sections.indexOf(sec) < 2
    registers[`${sec.id}|${todayISO()}`] = {
      date: todayISO(), sectionId: sec.id,
      submittedAt: submitted ? `${todayISO()}T08:45:00` : null,
    }
  }

  /* ---- one exam period with marks ---- */
  const examPeriods = [{ id: seedId(), name: 'First Semester Exam', term: 'Term 1', maxMark: 100 }]
  const examId = examPeriods[0].id
  // One class is left without Citizenship marks so the compliance panel and
  // the mark-entry screens have real outstanding work to show. Grade 6B — held
  // by position now that ids are opaque.
  const blankSubjectSection = sections[3]
  const marks: MarkBook = {}
  for (const st of students) {
    const ability = 40 + rnd() * 50 // student-level ability so averages/ranks look real
    for (const sub of subjects) {
      // ~8% left blank in one subject block so teachers have something to enter
      if (sub.id === 'civ' && st.sectionId === blankSubjectSection.id) continue
      const score = Math.round(Math.min(100, Math.max(21, ability + (rnd() - 0.5) * 24)))
      marks[`${examId}|${sub.id}|${st.id}`] = score
    }
  }

  // Seeded tie #1 — identical scores in every subject: competition ranking
  // must give these two the same rank and skip the next (n, n, n+2).
  const g5a = students.filter((s) => s.sectionId === sections[0].id)
  const [tieA, tieB] = g5a.slice(2, 4)
  for (const sub of subjects) {
    const src = marks[`${examId}|${sub.id}|${tieA.id}`]
    if (src !== undefined) marks[`${examId}|${sub.id}|${tieB.id}`] = src
  }

  // Seeded tie #2 — DIFFERENT raw averages that round to the same printed one.
  // roundA sits 6 subjects totalling 469 (78.1666…), roundB sits 5 (one exam
  // missed) totalling 391 (78.2). Both print 78.2, so they must share a rank.
  const [roundA, roundB] = g5a.slice(6, 8)
  const sixScores = [78, 78, 78, 78, 78, 79] // → 469 / 6 = 78.1666…
  const fiveScores = [78, 78, 78, 78, 79] //    → 391 / 5 = 78.2
  subjects.forEach((sub, i) => { marks[`${examId}|${sub.id}|${roundA.id}`] = sixScores[i] })
  subjects.forEach((sub, i) => {
    const key = `${examId}|${sub.id}|${roundB.id}`
    if (i < fiveScores.length) marks[key] = fiveScores[i]
    else delete marks[key] // absent for the last subject
  })

  // Attribute every seeded mark to the teacher who taught that section+subject,
  // with a plausible entry time. Done once at the end so the tie fix-ups above
  // are covered too. Marks for a teacher who has since departed stay attributed
  // to them — that is exactly the record a grade dispute needs.
  const sectionOfStudent = new Map(students.map((s) => [s.id, s.sectionId]))
  const teacherById = new Map(teachers.map((x) => [x.id, x]))

  // A teacher marks one class in a single sitting, so each section+subject gets
  // its own slot and students are stamped a few seconds apart within it. The
  // window ends before the teacher's departure date where there is one —
  // otherwise a departed teacher would appear to have entered marks after
  // leaving, which is the first thing anyone checks in a dispute.
  const slotFor = new Map<string, { day: string; hour: number; minute: number }>()
  const slotOf = (pairKey: string, ownerId: string) => {
    const cached = slotFor.get(pairKey)
    if (cached) return cached
    const owner = teacherById.get(ownerId)
    const windowEnd = owner?.departedOn ? addDays(owner.departedOn, -2) : addDays(todayISO(), -3)
    const days = schoolDays(10, windowEnd)
    const slot = { day: days[int(0, days.length - 1)], hour: int(9, 16), minute: int(0, 59) }
    slotFor.set(pairKey, slot)
    return slot
  }

  const markAudit: MarkAudit = {}
  let seatIndex = 0
  for (const key of Object.keys(marks)) {
    const [, subjectId, studentId] = key.split('|')
    const sectionId = sectionOfStudent.get(studentId)
    const ownerId = sectionId ? taughtBy.get(`${sectionId}|${subjectId}`) : undefined
    if (!ownerId) continue
    const owner = teacherById.get(ownerId)!
    const slot = slotOf(`${sectionId}|${subjectId}`, ownerId)
    // ~25s per student through the register; local time (no Z) so the demo
    // reads the same hour in any timezone
    const sec = (seatIndex++ % 120) * 25
    const two = (n: number) => String(n).padStart(2, '0')
    const at = `${slot.day}T${two(slot.hour)}:${two(slot.minute)}:00`
    markAudit[key] = {
      teacherId: ownerId,
      actor: `${owner.firstName} ${owner.fatherName}`,
      at: new Date(new Date(at).getTime() + sec * 1000).toISOString(),
      serverSeq: 0, // assigned in timestamp order at the end
    }
  }

  // Assessments start empty: teachers create them per class+subject as the term
  // runs. The subject marks above are the seeded starting point.
  const assessments: Assessment[] = []
  const assessmentScores: Record<string, number> = {}

  /* ---- fees ---- */
  const feeItems: FeeItem[] = grades.flatMap((g): FeeItem[] => [
    { id: seedId(), gradeId: g.id, name: `Tuition — Term 1`, amount: 800 + (g.level - 5) * 100, kind: 'term' },
    { id: seedId(), gradeId: g.id, name: 'Registration', amount: 300, kind: 'annual' },
    { id: seedId(), gradeId: g.id, name: 'Books & materials', amount: 250, kind: 'annual' },
  ])

  const payments: Payment[] = []
  let receipt = 1
  const start = addDays(todayISO(), -55)
  for (const st of students) {
    const items = feeItems.filter((f) => f.gradeId === st.gradeId)
    const totalDue = items.reduce((a, f) => a + f.amount, 0)
    const r = rnd()
    let payNow = 0
    if (r < 0.62) payNow = totalDue // fully paid
    else if (r < 0.85) payNow = items[0].amount + (rnd() < 0.5 ? items[1].amount : 0) // partial
    // else unpaid
    if (payNow > 0) {
      const payDate = addDays(start, int(0, 50))
      const lines = []
      let remaining = payNow
      for (const f of items) {
        if (remaining <= 0) break
        const amt = Math.min(f.amount, remaining)
        lines.push({ feeItemId: f.id, label: f.name, amount: amt })
        remaining -= amt
      }
      payments.push({
        id: seedId(),
        receiptNo: `HB-${String(receipt).padStart(4, '0')}`,
        studentId: st.id,
        lines,
        total: payNow,
        date: payDate,
        method: pick(['cash', 'cash', 'cash', 'telebirr', 'bank'] as const),
        receivedBy: 'Hiwot Assefa',
        clientRecordedAt: `${payDate}T10:00:00.000Z`,
        serverSeq: 0, // set below, in business-date order
      })
      receipt++
    }
  }
  payments.sort((a, b) => (a.date < b.date ? -1 : 1))

  /* ---- mock server commit sequence ----
   * One monotonic counter across every seeded write, assigned in timestamp
   * order so the demo history is internally consistent — including the rule
   * that a departed teacher's marks sit before their departure date.
   *
   * In production the server allocates this at commit and it agrees with the
   * device clocks only by luck. That is the whole reason resolution reads the
   * sequence and never a clock. */
  const stamped: { at: string; set: (n: number) => void }[] = []
  for (const k in attendance) stamped.push({ at: attendance[k].clientRecordedAt, set: (n) => { attendance[k].serverSeq = n } })
  for (const k in markAudit) stamped.push({ at: markAudit[k].at, set: (n) => { markAudit[k].serverSeq = n } })
  for (const p of payments) stamped.push({ at: p.clientRecordedAt, set: (n) => { p.serverSeq = n } })
  stamped.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  let seq = 1
  for (const item of stamped) item.set(seq++)

  return {
    version: 0, // stamped with SCHEMA_VERSION by services/db.ts
    grades,
    sections,
    subjects,
    students,
    teachers,
    attendance,
    registers,
    examPeriods,
    grading: {
      homework: 5, classwork: 5, exercise_book: 5, worksheets: 5,
      assignments: 10, tests: 20, exams: 20, final_exam: 30,
    },
    assessments,
    assessmentScores,
    marks,
    markAudit,
    comments: {},
    feeItems,
    payments,
    settings: {
      schoolName: 'Honey Badger Academy',
      schoolNameAm: 'ሐኒባጀር አካዳሚ',
      city: 'Addis Ababa',
      phone: '011 554 2211',
      academicYear: '2018 E.C. (2025/26)',
      term: 'Term 1',
      currentUser: 'Hiwot Assefa',
    },
    // The seeded history was issued before this school had a second device.
    // The next block starts clear of it, rounded up so block boundaries stay
    // legible in a ledger.
    receiptLeases: {},
    nextReceiptBlock: Math.ceil(receipt / 100) * 100,
    nextServerSeq: seq,
    auditLog: [],
  }
}
