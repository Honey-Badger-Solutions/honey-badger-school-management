import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/store/session";
import { useDb } from "@/services/db";
import { Shell } from "@/components/Shell";
import type { Role } from "@/types";

import Login from "@/pages/Login";
import Landing from "@/pages/marketing/Landing";
import GetStarted from "@/pages/marketing/GetStarted";
// admin pages
import SchoolAdminDashboard from "@/pages/admin/Dashboard";
import SchoolAdminStudents from "@/pages/admin/Students";
import SchoolAdminStudentProfile from "@/pages/admin/StudentProfile";
import SchoolAdminFees from "@/pages/admin/Fees";
import SchoolAdminExams from "@/pages/admin/Exams";
import SchoolAdminStaff from "@/pages/admin/Staff";
import SchoolAdminStaffProfile from "@/pages/admin/StaffProfile";
import SchoolAdminSettings from "@/pages/admin/Settings";
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

function Home() {
  const role = useSession((s) => s.role);
  if (role === "school-admin") return <Navigate to="/school-admin" replace />;
  if (role === "teacher") return <Navigate to="/teacher" replace />;
  return <Landing />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/get-started" element={<GetStarted />} />

        <Route path="/school-admin" element={<Guard need="school-admin"><SchoolAdminDashboard /></Guard>} />
        <Route path="/school-admin/students" element={<Guard need="school-admin"><SchoolAdminStudents /></Guard>} />
        <Route path="/school-admin/students/:id" element={<Guard need="school-admin"><SchoolAdminStudentProfile /></Guard>} />
        <Route path="/school-admin/fees" element={<Guard need="school-admin"><SchoolAdminFees /></Guard>} />
        <Route path="/school-admin/exams" element={<Guard need="school-admin"><SchoolAdminExams /></Guard>} />
        <Route path="/school-admin/staff" element={<Guard need="school-admin"><SchoolAdminStaff /></Guard>} />
        <Route path="/school-admin/staff/:id" element={<Guard need="school-admin"><SchoolAdminStaffProfile /></Guard>} />
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

        <Route path="/saas-admin" element={<Guard need="saas-admin"><SaasAdminDashboard /></Guard>} />

        <Route path="/print" element={<Guard need="print-only-staff"><PrintDashboard /></Guard>} />
        {/* <Route path="/reports/exams" element={<Guard need="print-only-staff"><Exams /></Guard>} /> */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
