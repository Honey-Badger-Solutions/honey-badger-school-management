import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Icon, type IconName } from "@/components/Icon";
import { Brand, Mark } from "@/components/Logo";
import { Avatar, OnlineDot, personName } from "@/components/bits";
import { Modal } from "@/components/Modal";
import { useSession, useT } from "@/store/session";
import { useDb } from "@/services/db";
import { ToastHost } from "@/components/Toast";
import type { TKey } from "@/i18n";
import type { Role } from "@/types";

interface NavItem {
  to: string;
  icon: IconName;
  label: TKey;
  end?: boolean;
}

const ADMIN_NAV: NavItem[] = [
  { to: "/school-admin", icon: "home", label: "navDashboard", end: true },
  { to: "/school-admin/students", icon: "users", label: "navStudents" },
  { to: "/school-admin/fees", icon: "cash", label: "navFees" },
  { to: "/school-admin/exams", icon: "exam", label: "navExams" },
  { to: "/school-admin/staff", icon: "staff", label: "navStaff" },
  { to: "/school-admin/settings", icon: "settings", label: "navSettings" },
];

const TEACHER_NAV: NavItem[] = [
  { to: "/teacher", icon: "home", label: "navMyClasses", end: true },
  { to: "/teacher/attendance", icon: "clipboard", label: "navAttendance" },
  { to: "/teacher/marks", icon: "edit", label: "navMarks" },
  { to: "/teacher/students", icon: "users", label: "navMyStudents" },
];

const FINANCE_NAV: NavItem[] = [
  { to: "/finance", icon: "home", label: "navDashboard", end: true },
  { to: "/finance/fees", icon: "cash", label: "navFees" },
];

const STAFF_ADMIN_NAV: NavItem[] = [
  { to: "/staff-admin", icon: "home", label: "navDashboard", end: true },
  { to: "/staff-admin/staff", icon: "staff", label: "navStaff" },
];

const PRINT_STAFF_NAV: NavItem[] = [
  { to: "/print", icon: "home", label: "navMarks", end: true },
  { to: "/print/attendance", icon: "clipboard", label: "navAttendance" },
  { to: "/print/marks", icon: "edit", label: "navMarks" },
  { to: "/print/students", icon: "users", label: "navMyStudents" },
];

export function Shell({ children }: { children: ReactNode }) {
  const t = useT();
  const role = useSession((s) => s.role);
  const teacherId = useSession((s) => s.teacherId);
  const logout = useSession((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const db = useDb();
  const [more, setMore] = useState(false);

  const NAV_BY_ROLE = {
    "saas-admin": ADMIN_NAV,
    "school-admin": ADMIN_NAV,
    "staff-admin": STAFF_ADMIN_NAV,
    teacher: TEACHER_NAV,
    "finance-officer": FINANCE_NAV,
    "print-only-staff": PRINT_STAFF_NAV,
  } satisfies Record<Role, typeof ADMIN_NAV>;

  const nav = role ? NAV_BY_ROLE[role] : null;

  // Mobile bottom navigation:
  // - Show up to 4 primary navigation items
  // - Put the remaining items behind "More"
  const mobileNav = nav?.slice(0, 4) ?? [];
  const overflow = nav?.slice(4) ?? [];
  const onOverflowRoute = overflow.some((item) =>
    location.pathname.startsWith(item.to),
  );

  const teacher = db.teachers.find((x) => x.id === teacherId);
  const userName =
    role === "teacher"
      ? teacher
        ? personName(teacher)
        : ""
      : db.settings.currentUser;

  const ROLE_LABEL_KEY: Record<Role, Parameters<typeof t>[0]> = {
    "saas-admin": "roleSaasAdmin",
    "school-admin": "roleSchoolAdmin",
    "staff-admin": "roleStaffAdmin",
    teacher: "roleTeacher",
    "finance-officer": "roleFinance",
    "print-only-staff": "rolePrintStaff",
  };

  const roleLabel = role ? t(ROLE_LABEL_KEY[role]) : null;

  const doLogout = () => {
    logout();
    navigate("/");
  };

  const linkCls = (on: boolean) =>
    `flex items-center gap-3 px-3.5 py-3 rounded-xl font-display font-medium text-[13.5px] transition-colors ${
      on
        ? "bg-honey/15 text-gold"
        : "text-soft hover:bg-surface2 hover:text-ink"
    }`;

  return (
    <div className="min-h-screen md:flex">
      {/* ---- desktop sidebar ---- */}
      <aside className="no-print hidden md:flex flex-col w-[236px] shrink-0 border-r border-line-soft bg-surface/70 backdrop-blur sticky top-0 h-screen p-4">
        <div className="px-1.5 pb-5 pt-1">
          <Brand />
        </div>

        <nav className="flex flex-col gap-1" aria-label="Main">
          {nav?.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => linkCls(isActive)}
            >
              <Icon name={item.icon} size={19} />
              {t(item.label)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <OnlineDot />
          <div className="flex items-center gap-2.5 px-1">
            <Avatar name={userName} size={34} />
            <div className="flex-1 leading-tight min-w-0">
              <b className="text-[13px] block truncate">{userName}</b>
              <small className="text-dim text-[11px]">{roleLabel}</small>
            </div>
            <button
              onClick={doLogout}
              className="w-9 h-9 grid place-items-center rounded-[10px] text-soft hover:text-warn hover:bg-surface2"
              title={t("logout")}
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* ---- mobile top bar ---- */}
        <header className="no-print md:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-4 py-3 bg-paper/90 backdrop-blur border-b border-line-soft">
          <span className="flex items-center gap-2">
            {/* head crop here, not the full badger: at 28px the body collapses.
                Same short wordmark as the sidebar, which also stops the old
                long name wrapping onto two lines in this bar. */}
            <Mark size={28} />
            <b className="font-display text-[14px]">{t("brandName")}</b>
          </span>
          <span className="flex items-center gap-2">
            <OnlineDot />
            <button
              onClick={doLogout}
              className="w-9 h-9 grid place-items-center rounded-[10px] text-soft"
              aria-label={t("logout")}
            >
              <Icon name="logout" size={18} />
            </button>
          </span>
        </header>

        <main className="flex-1 w-full max-w-app mx-auto px-4 pt-4 pb-28 md:px-7 md:pt-7 md:pb-10">
          {children}
        </main>
      </div>

      {/* ---- mobile bottom nav ---- */}
      <nav
        className="no-print md:hidden fixed bottom-0 inset-x-0 z-40 h-[64px] bg-surface/95 backdrop-blur border-t border-line-soft flex items-stretch justify-around px-1"
        aria-label="Main"
      >
        {mobileNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 text-[10px] font-display font-medium transition-colors ${isActive ? "text-gold" : "text-dim"}`
            }
          >
            <Icon name={item.icon} size={21} />
            {t(item.label)}
          </NavLink>
        ))}
        {overflow.length > 0 && (
          <button
            onClick={() => setMore(true)}
            aria-current={onOverflowRoute ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 text-[10px] font-display font-medium transition-colors ${
              // Staff/Settings live behind "More" — without this nothing is lit
              // and you lose track of where you are.
              onOverflowRoute ? "text-gold" : "text-dim"
            }`}
          >
            <Icon name="more" size={21} />
            {t("navMore")}
          </button>
        )}
      </nav>

      {more && (
        <Modal title={t("navMore")} onClose={() => setMore(false)}>
          <div className="flex flex-col gap-1.5">
            {overflow.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMore(false)}
                className={linkCls(false) + " border border-line"}
              >
                <Icon name={item.icon} size={19} />
                {t(item.label)}
              </NavLink>
            ))}
            <button
              onClick={doLogout}
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-line font-display font-medium text-[13.5px] text-warn"
            >
              <Icon name="logout" size={19} />
              {t("logout")}
            </button>
          </div>
        </Modal>
      )}

      <ToastHost />
    </div>
  );
}
