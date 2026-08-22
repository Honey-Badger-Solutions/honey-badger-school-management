# School Management System — Roles & RBAC



## Role Overview

| Role | Main Responsibility |
|---|---|
| SaaS Admin | Manage the overall SaaS platform and schools |
| School Admin | Manage the school, users, academic structure, and overall operations |
| Principal / Head of School | Oversee academic and administrative operations |
| Academic Admin | Manage academic structure, teachers, classes, subjects, and assessments |
| Teacher | Teach assigned classes/subjects, record attendance, and enter assessments |
| Homeroom Teacher | Manage the assigned class's day-to-day academic records |
| Finance Officer | Manage fees, payments, balances, receipts, and financial reports |
| Registrar / Student Affairs | Manage student registration, enrollment, guardians, IDs, and student records |
| Report / Read-Only Staff | View permitted reports without modifying operational data |

> Recommended starting roles: **SaaS Admin, School Admin, Teacher, Finance Officer, and Registrar**. Principal, Academic Admin, Homeroom Teacher, and Report/Read-Only Staff can be introduced as separate roles when the product needs finer-grained permissions.

---

# 1. SaaS Admin

### Main responsibility

Manage the SaaS platform itself rather than the daily operations of an individual school.

### Permissions

- Create and manage schools
- Activate/deactivate schools
- Manage school subscriptions
- View platform-level usage
- Manage platform configuration
- Manage school-level administrators
- View platform-wide operational information
- Access support/diagnostic information
- Manage platform-level settings

### Restrictions

- Should not normally perform day-to-day school operations
- Access to school data should be controlled and audited

---

# 2. School Admin

### Main responsibility

Manage the overall operation and configuration of a school.

### Permissions

- Manage school profile/settings
- Manage users and school memberships
- Assign roles
- Manage academic years
- Manage terms
- Manage grades
- Manage classes/sections
- Manage subjects
- Manage students
- Manage staff
- Manage teacher assignments
- Manage homeroom assignments
- Manage student promotion
- Configure grading
- View dashboards
- View attendance
- Correct attendance when authorized
- View marks and assessments
- Manage exams
- View fees and financial reports
- View compliance reports
- Generate reports
- View audit history
- Manage school-level configuration

### Restrictions

- Cannot access another school's data
- Sensitive operations should be audited

---

# 3. Principal / Head of School

### Main responsibility

Oversee the academic and administrative performance of the school.

### Permissions

- View school dashboard
- View student records
- View staff records
- View attendance
- View assessments and marks
- View exam results
- View rankings
- View fee summaries
- View compliance reports
- Generate reports
- View audit history
- Approve/review important academic operations

### Restrictions

- Preferably read-heavy rather than unrestricted administrative access
- Should not manage platform-level settings
- Financial modification permissions should be separate unless explicitly granted

---

# 4. Academic Admin

### Main responsibility

Manage the academic structure and academic operations of the school.

### Permissions

- Manage academic years
- Manage terms
- Manage grades
- Manage classes/sections
- Manage subjects
- Assign teachers to subjects/classes
- Assign homeroom teachers
- Manage student class placement
- Manage student promotion
- Configure grading
- Manage assessment configuration
- Manage exam periods
- View marks
- View rankings
- Generate academic reports
- View academic compliance

### Restrictions

- No financial modification permissions by default
- No platform-level permissions
- No access to unrelated schools

---

# 5. Teacher

### Main responsibility

Teach assigned students/classes and maintain their academic records.

### Permissions

- View assigned classes
- View assigned students
- View permitted student information
- Record attendance
- Edit today's attendance
- Submit attendance registers
- View attendance history for assigned classes
- Create permitted assessments
- Enter marks for assigned subjects/classes
- Edit marks according to allowed rules
- View assessment results
- View relevant rankings/results
- View student academic information needed for teaching
- Add teacher comments to report cards where permitted

### Restrictions

- Cannot access unrelated classes
- Cannot access another teacher's restricted information
- Cannot manage school configuration
- Cannot manage users
- Cannot modify fees
- Cannot change academic structure
- Cannot access another school's data

---

# 6. Homeroom Teacher

### Main responsibility

Manage the day-to-day academic records of an assigned homeroom/class.

### Permissions

All normal Teacher permissions, plus:

- View the full assigned homeroom roster
- View homeroom attendance
- Monitor attendance completion
- View permitted student information
- Monitor missing assessments/marks
- View class-level academic summaries
- Perform permitted class-level administrative actions

### Restrictions

- Permissions apply only to assigned homeroom classes
- Does not automatically gain school-wide teacher/admin permissions

> Implementation note: Homeroom Teacher does not necessarily need to be a completely separate account role. It can be a **Teacher + homeroom assignment**.

---

# 7. Finance Officer

### Main responsibility

Manage student fees and school payment records.

### Permissions

- View student fee information
- Configure fee structures
- Assign fees
- Record payments
- Correct payments according to authorization rules
- View paid balances
- View outstanding balances
- View defaulters
- Generate payment reports
- Generate defaulter reports
- Generate receipts
- View financial dashboard information
- View relevant financial audit history

### Restrictions

- Cannot modify academic records
- Cannot enter marks
- Cannot record attendance
- Cannot manage teachers unless separately authorized
- Cannot access another school's finances

---

# 8. Registrar / Student Affairs

### Main responsibility

Manage student registration and official student records.

### Permissions

- Register students
- Edit student demographic information
- Manage guardians
- Manage enrollment
- Manage student IDs
- Search students
- View student profiles
- Manage class placement where authorized
- Manage student promotion where authorized
- Manage student status
- View student attendance
- View student academic records
- Generate student lists
- Generate student documents

### Restrictions

- Cannot enter marks
- Cannot record attendance unless separately authorized
- Cannot modify financial records
- Cannot manage platform settings

---

# 9. Report / Read-Only Staff

### Main responsibility

View information and generate reports without modifying operational records.

### Permissions

- View permitted students
- View permitted staff information
- View attendance
- View marks
- View assessments
- View fees
- View reports
- Generate/print reports

### Restrictions

- No create/update/delete permissions
- No configuration changes
- No payment recording
- No mark entry
- No attendance modification

---

# Permission Categories

Permissions should be implemented as explicit capabilities rather than relying only on role names.

## Student Permissions

- `students.view`
- `students.create`
- `students.update`
- `students.enroll`
- `students.promote`
- `students.manage_guardians`
- `students.manage_ids`

## Staff Permissions

- `staff.view`
- `staff.create`
- `staff.update`
- `staff.assign`
- `staff.manage_status`
- `staff.transfer_workload`

## Academic Structure Permissions

- `academic.view`
- `academic.manage_years`
- `academic.manage_terms`
- `academic.manage_grades`
- `academic.manage_sections`
- `academic.manage_subjects`
- `academic.assign_teachers`

## Attendance Permissions

- `attendance.view`
- `attendance.record`
- `attendance.update`
- `attendance.submit`
- `attendance.correct`

## Assessment Permissions

- `assessments.view`
- `assessments.create`
- `assessments.update`
- `assessments.enter_marks`
- `assessments.correct_marks`

## Exam Permissions

- `exams.view`
- `exams.create`
- `exams.update`
- `exams.manage_marks`
- `exams.publish`

## Finance Permissions

- `fees.view`
- `fees.configure`
- `fees.record_payment`
- `fees.correct_payment`
- `fees.view_reports`
- `fees.generate_receipts`

## Reports Permissions

- `reports.view`
- `reports.generate`
- `reports.print`

## User & Security Permissions

- `users.view`
- `users.create`
- `users.update`
- `users.disable`
- `users.assign_roles`
- `audit.view`

## School Configuration Permissions

- `school.view`
- `school.update`
- `school.manage_settings`

---

# Recommended Initial RBAC Model

Do not make the first version unnecessarily complicated.

Start with these five actual roles:

```text
SaaS Admin
School Admin
Teacher
Finance Officer
Registrar
```

Then use **assignments/attributes** for specialized responsibilities:

```text
Teacher
├── Homeroom assignment
├── Class assignments
└── Subject assignments

School Admin
└── Full school administration

Teacher + Academic Admin assignment
└── Academic management permissions
```

If the product later needs stronger separation, promote these into separate roles:

```text
Principal
Academic Admin
Homeroom Teacher
Report / Read-Only Staff
```

This keeps the initial RBAC system manageable while still allowing it to grow.

---

# Security Rules

1. **Every user belongs to a school.**
2. **Users must never access another school's data.**
3. **Frontend role checks are not security.**
4. **Authorization must be enforced by the backend/database.**
5. **RLS must enforce tenant isolation.**
6. **Sensitive actions must be audited.**
7. **Teachers only access students/classes/subjects assigned to them unless explicitly authorized.**
8. **Financial permissions must be separated from academic permissions.**
9. **Read-only roles must not receive write permissions.**
10. **Administrative privileges should follow least-privilege principles.**
