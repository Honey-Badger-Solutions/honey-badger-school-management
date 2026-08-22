import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { Avatar, EmptyState, PageTitle, personName } from "@/components/bits";
import { useDb } from "@/services/db";
import { sectionLabel } from "@/lib/derive";
import { useT } from "@/store/session";
import { POSITION_KEYS } from "@/pages/staff_admin/StaffProfile";
import type { Teacher } from "@/types";
import {
  ReplaceTeacherModal,
  AddTeacherModal,
} from "@/pages/staff_admin/StaffActions";

const FILTERS = [
  { id: "active", key: "statusActive" },
  { id: "on_leave", key: "statusOnLeave" },
  { id: "departed", key: "statusDeparted" },
] as const;

export default function Staff() {
  const t = useT();
  const db = useDb();
  const [adding, setAdding] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [params, setParams] = useSearchParams();
  const filter = (params.get("f") ?? "active") as Teacher["status"];

  const list = db.teachers.filter((x) => x.status === filter);

  return (
    <>
      <PageTitle title={t("staffTitle")}>
        <button className="btn-ghost btn-sm" onClick={() => setReplacing(true)}>
          <Icon name="swap" size={16} />
          {t("replaceTeacher")}
        </button>
        <button className="btn-gold btn-sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} />
          {t("addTeacher")}
        </button>
      </PageTitle>

      <div className="seg mb-4 max-w-full overflow-x-auto" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            className={filter === f.id ? "on" : ""}
            onClick={() =>
              setParams(f.id === "active" ? {} : { f: f.id }, { replace: true })
            }
          >
            {t(f.key)} · {db.teachers.filter((x) => x.status === f.id).length}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <EmptyState icon="staff" title={t("noStaffHere")} />
      )}

      <div className="card">
        {list.map((x) => {
          const subjects = [...new Set(x.assignments.map((a) => a.subjectId))]
            .map((sid) => db.subjects.find((s) => s.id === sid)?.name)
            .filter(Boolean);
          const homeroom = db.sections.find(
            (s) => s.homeroomTeacherId === x.id,
          );
          return (
            <Link key={x.id} to={`/staff-admin/staff/${x.id}`} className="lrow">
              <Avatar name={x.firstName} />
              <span className="flex-1 min-w-0 text-left">
                <b className="text-[14px] block truncate">{personName(x)}</b>
                <small className="text-dim text-[12px] truncate block">
                  {t(POSITION_KEYS[x.position])} · {subjects.join(", ") || "—"}
                  {homeroom &&
                    ` · ${t("homeroomOf")} ${sectionLabel(db, homeroom.id)}`}
                </small>
              </span>
              <Icon name="chevR" size={17} className="text-dim shrink-0" />
            </Link>
          );
        })}
      </div>

      {adding && <AddTeacherModal onClose={() => setAdding(false)} />}
      {replacing && <ReplaceTeacherModal onClose={() => setReplacing(false)} />}
    </>
  );
}
