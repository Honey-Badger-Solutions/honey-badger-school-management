import { Icon } from "@/components/Icon";
import { PageTitle, EmptyState } from "@/components/bits";
import { useDb } from "@/services/db";
import { currentUser } from "@/services/users";
import { fmtDate, todayISO } from "@/lib/dates";
import { useT } from "@/store/session";

/**
 * What is missing right now — sections that have not marked attendance today
 * and subjects with no marks for the current exam. Each row leads to the
 * person responsible, which is what an administrator actually acts on.
 */

export default function StaffDashboard() {
  const t = useT();
  const db = useDb();
  const today = todayISO();

  return (
    <>
      <PageTitle
        title={`${t("goodMorning")}, ${currentUser(db)?.firstName ?? ""}`}
      >
        <span className="pill-dim">
          <Icon name="calendar" size={13} />
          {fmtDate(today)}
        </span>
      </PageTitle>

      {/* <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-2 gap-3">
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
      </div> */}

      <div className="card">
        <EmptyState
          icon="exam"
          title={t("emptyStateTitle")}
          sub={t("emptyStateMaintainance")}
        />
      </div>
    </>
  );
}
