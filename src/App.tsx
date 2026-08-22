import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/store/session";
import { useDb } from "@/services/db";
import { Shell } from "@/components/Shell";
import type { Role } from "@/types";

import Login from "@/pages/Login";
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

function Guard({ need, children }: { need: Role; children: ReactNode }) {
  const role = useSession((s) => s.role);
  const teacherId = useSession((s) => s.teacherId);
  const logout = useSession((s) => s.logout);
  const db = useDb();

  // A teacher session whose id no longer resolves (record removed, demo data
  // reset) must end, not silently borrow another teacher's identity — a mark
  // saved in that state would be attributed to the wrong person.
  const staleTeacher =
    need === "teacher" &&
    role === "teacher" &&
    !db.teachers.some((x) => x.id === teacherId);

  useEffect(() => {
    if (staleTeacher) logout();
  }, [staleTeacher, logout]);

  if (role !== need || staleTeacher) return <Navigate to="/" replace />;
  return <Shell>{children}</Shell>;
}

function Home() {
  const role = useSession((s) => s.role);
  if (role === "school-admin") return <Navigate to="/school-admin" replace />;
  if (role === "teacher") return <Navigate to="/teacher" replace />;
  return <Login />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />

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

        {/* <Route path="/saas-admin" element={<Guard need="saas-admin"><AdminDashboard /></Guard>} /> */}

        {/* <Route path="/reports/exams" element={<Guard need="print-only-staff"><Exams /></Guard>} /> */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
