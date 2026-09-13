# prompt 1

Implement the following features in the existing HoneyBadger School Management project.

Use the existing codebase, types, routing, UI components, and design system. Do not rewrite unrelated parts of the application.

## 1. Marketing Page

Create a single public marketing/landing page for HoneyBadger School Management.

It should:
- Explain what the product does
- Highlight the main school-management features
- Have clear Login and Get Started/Register actions
- Allow a school owner to start the process of creating a school
- Match the existing HoneyBadger visual design
- Be accessible without authentication

Make this the public landing page at `/`.

note, keep the current codding style and logic

# prompt 2

## Prepare Prototype for Production Users & Supabase

Refactor the existing HoneyBadger School Management prototype so its local/mock backend is structurally ready to be replaced by the existing Supabase backend.

### Important

You have Supabase MCP access.

The Supabase project already contains the database schema, tables, relationships, RLS policies, triggers, functions, indexes, etc.

Before changing the code:

1. Inspect the existing codebase, especially `types.ts`, mock DB, services/repositories, session store, routing, audit/history and staff/teacher logic.
2. Inspect the existing Supabase schema through MCP.
3. Make the local models/services match the existing Supabase structure as closely as possible.

**Do NOT connect the application to Supabase yet.**
The goal is to make the codebase completely ready for the later Supabase integration.

---

### 1. Proper User Identity

Replace the current fake single-user model with a real `User` model:

```ts
User {
  id: string;        // UUID
  name: string;
  email: string;
  role: Role;
  schoolId: string;
  status: ...;
  createdAt: ...
}
````

Roles:

* `saas-admin`
* `school-admin`
* `staff-admin`
* `teacher`
* `finance-officer`
* `print-only-staff`

Use stable IDs for identity. Never use names, emails or roles as identity.

Add a proper `schoolId` to the local database.

---

### 2. User ↔ Teacher

Keep `Teacher` as a separate domain entity.

A teacher should have:

```ts
teacher.id
teacher.userId
```

Relationship:

```text
User → Teacher
```

Not every user is a teacher.

The existing seeded teachers should continue working, with each applicable teacher linked to a seeded User.

---

### 3. Demo Users & Session

Create deterministic demo users for every role.

The local login should select a **demo User**, not simply a role.

The session should represent:

```ts
userId
schoolId
role
teacherId?   // only for teachers
```

The current user's name, role, school and teacher information should be derived from the User/Teacher records.

Remove the application's dependency on:

* `settings.currentUser`
* role being the user's identity
* hard-coded user names
* teacher ID being the primary authentication identity

Keep the local demo login so the prototype remains usable.

---

### 4. Audit & Actions

Refactor existing audit/history/action fields to use stable IDs.

For example:

```text
userId
teacherId
receivedByUserId
```

where appropriate.

For teacher actions, preserve both the User identity and Teacher identity when useful.

Historical records must continue to identify who performed an action even if their name later changes.

Do not break existing attendance, marks, payments or audit functionality.

---

### 5. Roles & Authorization

Keep the existing role-based routing/navigation.

Create or update a dedicated permissions configuration such as:

```text
src/config/permissions.ts
```

Define the application's permissions and map them to the six roles.

Provide reusable helpers such as:

```ts
hasPermission()
hasAnyPermission()
hasAllPermissions()
```

Do not scatter authorization logic unnecessarily throughout the UI.

---

### 6. Match Supabase

Use the Supabase MCP to verify that the local models and relationships correspond to the **actual existing Supabase schema**.

Pay particular attention to:

* users/auth identity
* schools
* school memberships
* roles
* teachers/staff
* foreign keys
* audit fields
* RLS expectations
* database functions/triggers
* UUIDs
* indexes

Do not invent a competing schema if the Supabase project already provides the appropriate structure.

The final local architecture should make the future transition:

```text
Local User        → Supabase Auth user
schoolId          → schools.id
User + schoolId   → school membership
Teacher.userId    → user/membership relationship
```

as straightforward as possible.

---

### Constraints

* Do NOT implement Supabase Auth yet.
* Do NOT connect the application to Supabase yet.
* Do NOT redesign the UI.
* Do NOT rewrite unrelated features.
* Keep the existing Zustand/session architecture.
* Keep all existing prototype features working.
* Preserve the current design and routing.

After implementation:

1. Run TypeScript checks.
2. Run the production build.
3. Fix all errors.
4. Verify all roles can use the prototype.

Finally give me a short report with:

* files changed
* data-model changes
* User/Teacher/School relationships
* Supabase schema alignment
* remaining prototype-only behavior
* what will be needed for the next step: connecting Supabase Auth and the Supabase backend


# prompt 3

i coppied the schema as sql from my schema visualizer in supabase 

**[docs/reports/orignal_sql.md]**

now using this continue from where i interrupted you 
note: keep the roles as follows 
export type Role =
  | "saas-admin"
  | "school-admin"
  | "finance-officer"
  | "staff-admin"
  | "teacher"
  | "print-only-staff";

note: the DbRoles will be changed to match the current export type Role =
  | "saas-admin"
  | "school-admin"
  | "finance-officer"
  | "staff-admin"
  | "teacher"
  | "print-only-staff";

now continue from where you stopped


# prompt 4

## Implementation Roadmap

The previous identity/data-model refactor is now complete. Use that implementation as the foundation and now implement the following roadmap **in order**.

### PHASE 1 — Identity

* User model
* Authentication flow
* Profile Settings
* User onboarding
* Permissions and role-based access

### PHASE 2 — Staff Management

* Staff invitations
* OTP/invitation flow
* Staff account management
* Roles and permissions
* Staff attendance

### PHASE 3 — Printing

* Print settings/customization
* Receipt templates
* Report-card templates
* Print-only staff print requests

### PHASE 4 — SaaS Platform

* SaaS Admin dashboard
* Schools
* Users
* Subscriptions
* Activity/audit
* Platform settings

### Feature requirements

**1. Profile Settings**
Every user should have a Profile Settings page where they can view and manage their own account information, such as name, password, profile picture, and other permitted personal settings. Email should not be directly changeable by the user. Respect the existing role/permission system.

**2. Staff Invitations & Registration**
School Admin and Staff Admin should be able to invite/register new staff members by entering the required staff information, email, and assigned role. The invited user should receive an OTP by email, use the OTP to verify the invitation, and then be prompted to create their password before accessing the application. The invited user must not choose their own role; the role comes from the admin's invitation.

**3. Staff Account Management**
School Admin and Staff Admin should have a dedicated staff-management section showing all staff accounts belonging to their school. They should be able to view name, email, role, and account status, and perform appropriate actions such as changing roles and deactivating/reactivating accounts. Enforce permissions so users can only manage staff within their own school.

**4. Staff Attendance**
School Admin and Staff Admin should be able to record and manage staff attendance. They should be able to select a date, see the school's staff, record statuses such as present, absent, and late, and view attendance history. The experience should follow the existing student attendance functionality where appropriate.

**5. User Onboarding**
After school registration or accepting a staff invitation, the user should go through a simple onboarding flow that guides them through completing required account/profile information and uploading any required files or documents. Show what has been completed, what remains, and what the user should do next. Do not make onboarding unnecessarily complicated.

**6. Print-Only Staff Dashboard**
The Print-Only Staff dashboard should remain empty when there are no print requests. When a user generates a supported document and chooses **"Print by Staff"**, create a print request that appears on the Print-Only Staff dashboard. The print staff member should be able to open the request, see the document and relevant information, process it, and mark it as completed.

**7. Print Customization**
Provide 1–2 pre-built receipt layouts and 1–2 pre-built report-card layouts. Schools should select the layout using simple select/radio-button options such as Standard, Detailed, or Thermal. There should be **no drag-and-drop designer**. After selecting a layout, the school admin can configure simple options such as school logo, school information, colors, visible fields/columns, signatures, and header/footer text. The actual layout and structure must remain controlled by the application.

**8. SaaS Platform Management**
The SaaS Admin manages the HoneyBadger platform rather than individual school operations. Keep the SaaS Admin navigation very small:

* Dashboard
* Schools
* Users
* Subscriptions
* Activity
* Settings

The SaaS Admin should be able to view/manage schools, school details, school admins, platform users, subscription/plan information, platform analytics, system activity/audit logs, and appropriate school-access/support functionality.

The initial dashboard analytics should include:

* Total schools
* Active schools
* Total users
* Total students
* New schools this month
* Active users
* Schools by subscription plan

The SaaS Admin should **not** manage normal school operations such as student attendance, marks, exams, fees, or teacher assignments unless specifically required for platform support.

---

## Implementation rules

1. **Implement the phases in order. Do not jump ahead.**
2. **Do not connect Supabase or the real backend yet.** Continue using the local/mock repositories, but structure everything so the eventual Supabase implementation can replace them cleanly.
3. **Do not redesign unrelated UI or rewrite working features.**
4. Reuse the existing User, School, Teacher, Session, Repository, and Permissions architecture created in the previous task.
5. Do not reintroduce the old `settings.currentUser` identity model or store user display names as authorship fields.
6. Keep authorization based on **user ID, school ID, role, and permissions**, not UI visibility alone.
7. Before implementing anything that depends on the database model, check the existing local model against the existing Supabase schema/migrations already provided in the project. Do not invent duplicate entities unnecessarily.
8. Resolve the known schema/model mismatches identified in the previous report before they become part of new features, especially:

   * ETB vs `santim` money units
   * local sex values vs database values
   * student status values
   * grades/sections/classes
   * teacher assignments
   * academic years/terms
   * enrollments
   * guardians
   * `user_roles` potentially being many-to-many
9. Keep the implementation simple. Prefer existing patterns and reusable components over introducing new architecture or unnecessary libraries.
10. After each phase, run TypeScript/build checks and fix errors before moving to the next phase.
11. Do not consider a phase complete merely because the UI exists. The local/mock data layer, permissions, state management, routing, and workflows should actually work end-to-end.
12. At the end of each phase, report:

* files changed
* features implemented
* important architectural/data-model changes
* permissions added/changed
* remaining limitations
* build/type-check result

### Important

Before and during implementation, maintain a clear Supabase migration checklist. For every change made to the local data model, authentication, permissions, relationships, or new feature that will eventually require a database/backend change, explicitly identify what must be changed in the existing Supabase project (tables, columns, enums/check constraints, relationships, indexes, functions, triggers, RLS policies, storage buckets, Auth configuration, etc.). Do not make those Supabase changes yet. At the end of each phase, provide a section called Supabase Changes Required listing exactly what needs to be added, modified, removed, or verified in Supabase, including any migration/RLS considerations. Clearly distinguish between changes that are definitely required and changes that only need verification.

Before we connect the real backend, perform a final Supabase compatibility audit. Compare the completed local implementation against the existing Supabase schema and produce a complete Supabase Changes Required Before Integration checklist. Include database schema changes, Auth configuration, RLS policies, storage requirements, database functions/triggers, indexes, enums/constraints, and any data migrations required. Do not apply these changes automatically; report them for review first.

The final goal is:

**Prototype → production-style local implementation → connect real Supabase backend → final production hardening.**

Do not connect the real backend during these phases. Once all four phases are implemented and working correctly, stop and report what remains before we begin the Supabase integration.



# prompt 5

Phase 1 is complete. Now move on to Phase 2 — Staff Management (staff invitations, OTP/invitation flow, staff account management, roles & permissions, and staff attendance). Use best practices throughout the implementation, but keep the architecture and implementation as simple as possible and don't over-engineer anything. Also, for every change or new feature we implement, make sure you tell me what changes will eventually be required in Supabase (database, Auth, RLS, Storage, etc.). Do not modify or connect Supabase yet; just document what will need to change. Keep the existing functionality working and run the type-check/build when finished.

# prompt 6

Phase 2 is complete. Now move on to Phase 3 — Printing: print settings/customization, receipt templates, report-card templates, and the Print-Only Staff print-request workflow. Before implementing, resolve the ETB vs santim money mismatch identified in the previous report so money is represented consistently and correctly for printing. Keep everything simple and use best practices without over-engineering. Use 1–2 pre-built receipt layouts and 1–2 pre-built report-card layouts with simple select/radio-button choices; there should be no drag-and-drop designer. Keep the existing functionality working and do not connect or modify Supabase yet. For every change or feature, clearly tell me what will eventually need to be changed in Supabase (database, RLS, Storage, functions, etc.), and distinguish required changes from things that only need verification. Run the type-check and production build when finished. Do not start Phase 4.

