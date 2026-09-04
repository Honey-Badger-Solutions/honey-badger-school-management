import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { FullLogo } from "../components/Logo";
import { personName } from "../components/bits";
import { useDb } from "../services/db";
import { assignableTeachers } from "../services/staff";
import { useSession, useT } from "../store/session";
import type { Role } from "../types";

export default function Login() {
  const t = useT();
  const db = useDb();
  const login = useSession((s) => s.login);
  const lang = useSession((s) => s.lang);
  const setLang = useSession((s) => s.setLang);
  const navigate = useNavigate();
  const [role, setRole] = useState<Role | null>(null);
  // departed staff can no longer sign in
  const signInList = assignableTeachers(db);
  const [teacherId, setTeacherId] = useState(signInList[0]?.id ?? "");

  const roleOptions: {
    role: Role;
    label: string;
    description: string;
    icon: "badge" | "book" | "users" | "cash" | "printer";
  }[] = [
    {
      role: "saas-admin",
      label: t("roleSaasAdmin"),
      description: t("roleSaasAdminSub"),
      icon: "badge",
    },
    {
      role: "school-admin",
      label: t("roleSchoolAdmin"),
      description: t("roleSchoolAdminSub"),
      icon: "badge",
    },
    {
      role: "staff-admin",
      label: t("roleStaffAdmin"),
      description: t("roleStaffAdminSub"),
      icon: "users",
    },
    {
      role: "teacher",
      label: t("roleTeacher"),
      description: t("roleTeacherSub"),
      icon: "book",
    },
    {
      role: "finance-officer",
      label: t("roleFinance"),
      description: t("roleFinanceSub"),
      icon: "cash",
    },
    {
      role: "print-only-staff",
      label: t("rolePrintStaff"),
      description: t("rolePrintStaffSub"),
      icon: "printer",
    },
  ];

  const ROLE_HOME: Record<Role, string> = {
    "saas-admin": "/saas-admin",
    "school-admin": "/school-admin",
    "staff-admin": "/staff-admin",
    "teacher": "/teacher",
    "finance-officer": "/finance",
    "print-only-staff": "/print",
  };

  const go = () => {
    if (!role) return;

    login(role, role === "teacher" ? teacherId : undefined);

    navigate(ROLE_HOME[role]);
  };

  const optCls = (sel: boolean) =>
    `w-full flex items-center gap-3.5 p-4 rounded-xl border text-left transition-colors min-h-[72px] ${
      sel
        ? "border-gold bg-honey/10"
        : "border-line bg-surface2/60 hover:border-gold"
    }`;

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center justify-between mb-5">
          <Link to="/">
            <FullLogo height={84} />
          </Link>
          <div className="seg" role="group" aria-label={t("language")}>
            <button
              className={lang === "en" ? "on" : ""}
              onClick={() => setLang("en")}
            >
              {t("langEn")}
            </button>
            <button
              className={lang === "am" ? "on" : ""}
              onClick={() => setLang("am")}
            >
              {t("langAm")}
            </button>
          </div>
        </div>
        <h1 className="text-[24px] font-bold mb-1">{t("appName")}</h1>
        <p className="text-soft text-[13.5px] mb-6">
          {t("tagline")} — {db.settings.schoolName}
        </p>

        <p className="sec-h !mt-0">{t("chooseRole")}</p>
        <div className="flex flex-col gap-2.5 mb-4">
          {roleOptions.map((option) => {
            const selected = role === option.role;

            return (
              <button
                key={option.role}
                className={optCls(selected)}
                onClick={() => setRole(option.role)}
                aria-pressed={selected}
              >
                <span className="w-11 h-11 rounded-xl bg-honey/15 text-gold grid place-items-center shrink-0">
                  <Icon name={option.icon} />
                </span>

                <span className="flex-1">
                  <b className="font-display font-semibold text-[15px] block">
                    {option.label}
                  </b>

                  <small className="text-dim text-[12px]">
                    {option.description}
                  </small>
                </span>

                {selected && (
                  <Icon name="check" size={20} className="text-gold" />
                )}
              </button>
            );
          })}
        </div>

        {role === "teacher" && (
          <div className="field">
            <label htmlFor="pickTeacher">{t("pickTeacher")}</label>
            <select
              id="pickTeacher"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
            >
              {signInList.map((x) => (
                <option key={x.id} value={x.id}>
                  {personName(x)}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          className="btn-gold w-full"
          disabled={!role}
          onClick={go}
          style={{ opacity: role ? 1 : 0.5 }}
        >
          {t("continueAs")}
          <Icon name="chevR" size={17} />
        </button>

        <p className="text-dim text-[12px] text-center mt-5 leading-relaxed">
          {t("demoNote")}
        </p>
      </div>
    </div>
  );
}
