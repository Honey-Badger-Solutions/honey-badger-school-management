import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { useSession } from './store/session'
import { useDb } from './services/db'
import { Shell } from './components/Shell'
import Login from './pages/Login'
import Dashboard from './pages/admin/Dashboard'
import Students from './pages/admin/Students'
import StudentProfile from './pages/admin/StudentProfile'
import Fees from './pages/admin/Fees'
import Exams from './pages/admin/Exams'
import Staff from './pages/admin/Staff'
import StaffProfile from './pages/admin/StaffProfile'
import Settings from './pages/admin/Settings'
import MyClasses from './pages/teacher/MyClasses'
import Attendance from './pages/teacher/Attendance'
import MarkEntry from './pages/teacher/MarkEntry'
import MyStudents from './pages/teacher/MyStudents'

function Guard({ need, children }: { need: 'admin' | 'teacher'; children: ReactNode }) {
  const role = useSession((s) => s.role)
  const teacherId = useSession((s) => s.teacherId)
  const logout = useSession((s) => s.logout)
  const db = useDb()

  // A teacher session whose id no longer resolves (record removed, demo data
  // reset) must end, not silently borrow another teacher's identity — a mark
  // saved in that state would be attributed to the wrong person.
  const staleTeacher = need === 'teacher' && role === 'teacher'
    && !db.teachers.some((x) => x.id === teacherId)

  useEffect(() => { if (staleTeacher) logout() }, [staleTeacher, logout])

  if (role !== need || staleTeacher) return <Navigate to="/" replace />
  return <Shell>{children}</Shell>
}

function Home() {
  const role = useSession((s) => s.role)
  if (role === 'admin') return <Navigate to="/admin" replace />
  if (role === 'teacher') return <Navigate to="/teacher" replace />
  return <Login />
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/admin" element={<Guard need="admin"><Dashboard /></Guard>} />
        <Route path="/admin/students" element={<Guard need="admin"><Students /></Guard>} />
        <Route path="/admin/students/:id" element={<Guard need="admin"><StudentProfile /></Guard>} />
        <Route path="/admin/fees" element={<Guard need="admin"><Fees /></Guard>} />
        <Route path="/admin/exams" element={<Guard need="admin"><Exams /></Guard>} />
        <Route path="/admin/staff" element={<Guard need="admin"><Staff /></Guard>} />
        <Route path="/admin/staff/:id" element={<Guard need="admin"><StaffProfile /></Guard>} />
        <Route path="/admin/settings" element={<Guard need="admin"><Settings /></Guard>} />

        <Route path="/teacher" element={<Guard need="teacher"><MyClasses /></Guard>} />
        <Route path="/teacher/attendance" element={<Guard need="teacher"><Attendance /></Guard>} />
        <Route path="/teacher/marks" element={<Guard need="teacher"><MarkEntry /></Guard>} />
        <Route path="/teacher/students" element={<Guard need="teacher"><MyStudents /></Guard>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
