import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/store/session";
import { useDb } from "@/services/db";
import { Shell } from "@/components/Shell";
import type { Role } from "@/types";

import { ROLE_HOME } from "@/config/routes";
import { needsOnboarding } from "@/services/onboarding";

import Login from "@/pages/Login";
import Landing from "@/pages/marketing/Landing";
import GetStarted from "@/pages/marketing/GetStarted";
import Profile from "@/pages/profile/Profile";
import Onboarding from "@/pages/onboarding/Onboarding";
import AcceptInvite from "@/pages/invite/AcceptInvite";
import Accounts from "@/pages/staff/Accounts";
import StaffAttendance from "@/pages/staff/StaffAttendance";
// admin pages
import SchoolAdminDashboard from "@/pages/admin/Dashboard";
import SchoolAdminStudents from "@/pages/admin/Students";
import SchoolAdminStudentProfile from "@/pages/admin/StudentProfile";
import SchoolAdminFees from "@/pages/admin/Fees";
import SchoolAdminExams from "@/pages/admin/Exams";
import SchoolAdminStaff from "@/pages/admin/Staff";
import SchoolAdminStaffProfile from "@/pages/admin/StaffProfile";
import SchoolAdminSettings from "@/pages/admin/Settings";
import SchoolAdminPrintSettings from "@/pages/admin/PrintSettings";
// finance pages
import FinanceDashboard from "@/pages/finance/Dashboard";
import FinanceFees from "@/pages/finance/Fees";
// teacher pages
import StaffDashboard from "@/pages/staff_admin/Dashboard";
import Staff from "@/pages/staff_admin/Staff";
import StaffProfile from "@/pages/staff_admin/StaffProfile";
// teacher pages
import MyClasses from "@/pages/teacher/MyClasses";
import Attendance from "@/pages/teacher/Attendance";
import MarkEntry from "@/pages/teacher/MarkEntry";
import MyStudents from "@/pages/teacher/MyStudents";
// print-only staff pages
import PrintDashboard from "@/pages/print_staff/Dashboard";
// saas-admin pages
import SaasAdminDashboard from "@/pages/saas_admin/Dashboard";

function Guard({ need, children }: { need: Role; children: ReactNode }) {
  const role = useSession((s) => s.role);
  const userId = useSession((s) => s.userId);
  const logout = useSession((s) => s.logout);
  const db = useDb();

  // A session whose user no longer resolves (demo data reset, account removed)
  // must end rather than silently borrow another identity — anything written in
  // that state would be attributed to the wrong person. Checked on the USER
  // now, so it covers every role and not just teachers.
  const stale = userId !== null && !db.users.some((u) => u.id === userId);

  useEffect(() => {
    if (stale) logout();
  }, [stale, logout]);

  if (role !== need || stale) return <Navigate to="/" replace />;
  return <Shell>{children}</Shell>;
}

/**
 * A route any signed-in user may see, whatever their role.
 *
 * Profile and onboarding belong to the person, not to a job, so they are gated
 * on having a session rather than on holding a role.
 */
function SignedIn({ children }: { children: ReactNode }) {
  const role = useSession((s) => s.role);
  const userId = useSession((s) => s.userId);
  const logout = useSession((s) => s.logout);
  const db = useDb();

  const stale = userId !== null && !db.users.some((u) => u.id === userId);
  useEffect(() => {
    if (stale) logout();
  }, [stale, logout]);

  if (!role || !userId || stale) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
}

function Home() {
  const role = useSession((s) => s.role);
  const userId = useSession((s) => s.userId);
  const db = useDb();

  if (!role || !userId) return <Landing />;
  // A new account is sent to its checklist once, on arrival. It is not a trap:
  // onboarding has a "do this later" and every other route stays reachable.
  const user = db.users.find((u) => u.id === userId);
  if (needsOnboarding(user)) return <Navigate to="/onboarding" replace />;
  return <Navigate to={ROLE_HOME[role]} replace />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/get-started" element={<GetStarted />} />
        {/* public: the invitee has no session until they redeem the code */}
        <Route path="/accept-invite" element={<AcceptInvite />} />

        <Route path="/profile" element={<SignedIn><Profile /></SignedIn>} />
        <Route path="/onboarding" element={<SignedIn><Onboarding /></SignedIn>} />

        <Route path="/school-admin" element={<Guard need="school-admin"><SchoolAdminDashboard /></Guard>} />
        <Route path="/school-admin/students" element={<Guard need="school-admin"><SchoolAdminStudents /></Guard>} />
        <Route path="/school-admin/students/:id" element={<Guard need="school-admin"><SchoolAdminStudentProfile /></Guard>} />
        <Route path="/school-admin/fees" element={<Guard need="school-admin"><SchoolAdminFees /></Guard>} />
        <Route path="/school-admin/exams" element={<Guard need="school-admin"><SchoolAdminExams /></Guard>} />
        <Route path="/school-admin/staff" element={<Guard need="school-admin"><SchoolAdminStaff /></Guard>} />
        <Route path="/school-admin/staff/:id" element={<Guard need="school-admin"><SchoolAdminStaffProfile /></Guard>} />
        <Route path="/school-admin/accounts" element={<Guard need="school-admin"><Accounts /></Guard>} />
        <Route path="/school-admin/staff-attendance" element={<Guard need="school-admin"><StaffAttendance /></Guard>} />
        <Route path="/school-admin/print-settings" element={<Guard need="school-admin"><SchoolAdminPrintSettings /></Guard>} />
        <Route path="/school-admin/settings" element={<Guard need="school-admin"><SchoolAdminSettings /></Guard>} />

        <Route path="/finance" element={<Guard need="finance-officer"><FinanceDashboard /></Guard>} />
        <Route path="/finance/fees" element={<Guard need="finance-officer"><FinanceFees /></Guard>} />
        
        <Route path="/teacher" element={<Guard need="teacher"><MyClasses /></Guard>} />
        <Route path="/teacher/attendance" element={<Guard need="teacher"><Attendance /></Guard>} />
        <Route path="/teacher/marks" element={<Guard need="teacher"><MarkEntry /></Guard>} />
        <Route path="/teacher/students" element={<Guard need="teacher"><MyStudents /></Guard>} />

        <Route path="/staff-admin" element={<Guard need="staff-admin"><StaffDashboard /></Guard>} />
        <Route path="/staff-admin/staff" element={<Guard need="staff-admin"><Staff/></Guard>} />
        <Route path="/staff-admin/staff/:id" element={<Guard need="staff-admin"><StaffProfile /></Guard>} />
        <Route path="/staff-admin/accounts" element={<Guard need="staff-admin"><Accounts /></Guard>} />
        <Route path="/staff-admin/staff-attendance" element={<Guard need="staff-admin"><StaffAttendance /></Guard>} />

        <Route path="/saas-admin" element={<Guard need="saas-admin"><SaasAdminDashboard /></Guard>} />

        <Route path="/print" element={<Guard need="print-only-staff"><PrintDashboard /></Guard>} />
        {/* <Route path="/reports/exams" element={<Guard need="print-only-staff"><Exams /></Guard>} /> */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
