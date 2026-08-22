import { useState } from "react";
import { Icon } from "@/components/Icon";
import { PageTitle } from "@/components/bits";
import { useDb } from "@/services/db";
import { fmtDate, todayISO } from "@/lib/dates";
import { useT } from "@/store/session";
import {
  ReplaceTeacherModal,
  AddTeacherModal,
} from "@/pages/staff_admin/StaffActions";

/**
 * What is missing right now — sections that have not marked attendance today
 * and subjects with no marks for the current exam. Each row leads to the
 * person responsible, which is what an administrator actually acts on.
 */

export default function StaffDashboard() {
  const t = useT();
  const db = useDb();
  const today = todayISO();
  const [adding, setAdding] = useState(false);
  const [replacing, setReplacing] = useState(false);

  return (
    <>
      <PageTitle
        title={`${t("goodMorning")}, ${db.settings.currentUser.split(" ")[0]}`}
      >
        <span className="pill-dim">
          <Icon name="calendar" size={13} />
          {fmtDate(today)}
        </span>
      </PageTitle>

      {/* quick actions first — the two things the office does all day */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <button
          className="btn-gold btn-sm !justify-start !min-h-[58px]"
          onClick={() => setAdding(true)}
        >
          <Icon name="plus" size={16} />
          {t("addTeacher")}
        </button>
        <button
          className="btn-ghost btn-sm !justify-start !min-h-[58px]"
          onClick={() => setReplacing(true)}
        >
          <Icon name="swap" size={16} />
          {t("replaceTeacher")}
        </button>
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="kpi">
          <div className="v !text-[12px] font-semibold align-middle mr-1">
            <span className="text-dim">{t("fullTeachers")}{" · "}</span>
            {
              db.teachers.filter(
                (x) =>
                  x.status === "active" && x.employmentType === "full_time",
              ).length
            }
          </div>
        </div>
        <div className="kpi">
          <div className="v !text-[12px] font-semibold align-middle mr-1">
            <span className="text-dim">{t("partTeachers")}{" · "}</span>
            {
              db.teachers.filter(
                (x) =>
                  x.status === "active" && x.employmentType === "part_time",
              ).length
            }
          </div>
        </div>
        <div className="kpi">
          <div className="v !text-[12px] font-semibold align-middle mr-1">
            <span className="text-dim">{t("teachersOnLeave")}{" · "}</span>
            {db.teachers.filter((x) => x.status === "on_leave").length}
          </div>
        </div>
      </div>

      

      {adding && <AddTeacherModal onClose={() => setAdding(false)} />}
      {replacing && <ReplaceTeacherModal onClose={() => setReplacing(false)} />}
    </>
  );
}
