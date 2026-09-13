import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Avatar, EmptyState, PageTitle, personName, SaveChip, type SaveState } from "@/components/bits";
import { toast } from "@/components/Toast";
import { useDb } from "@/services/db";
import {
  countDay,
  isEditable,
  marksOn,
  saveStaffMarks,
  staffRoster,
} from "@/services/staffAttendance";
import { useCan, useT } from "@/store/session";
import { fmtDateShort, schoolDays, todayISO } from "@/lib/dates";
import type { AttendanceMark } from "@/types";

/**
 * Staff presence for one day.
 *
 * Follows the class register deliberately: same P/A/L buttons, same recent-day
 * strip, same "only today is editable" rule, so an administrator who already
 * knows one screen knows this one. The differences are that the roster is
 * everyone with an account rather than one class, and that marks are saved
 * explicitly rather than per tap — an office marking twenty colleagues wants to
 * review the day before committing it, unlike a teacher tapping through a class.
 */
export default function StaffAttendance() {
  const t = useT();
  const db = useDb();
  const can = useCan();
  const [date, setDate] = useState(todayISO());
  const [pending, setPending] = useState<Record<string, AttendanceMark>>({});
  const [save, setSave] = useState<SaveState>("idle");

  const roster = staffRoster(db);
  const stored = marksOn(db, date);
  // what the screen shows: stored marks with any unsaved edits laid over them
  const marks = { ...stored, ...pending };
  const editable = isEditable(date) && can("staff_attendance.record");
  const counts = countDay(db, date);
  const recentDays = schoolDays(6, todayISO());

  const setMark = (userId: string, mark: AttendanceMark) => {
    if (!editable) return;
    setPending((p) => ({ ...p, [userId]: mark }));
    setSave("idle");
  };

  const markAllPresent = () => {
    if (!editable) return;
    const all: Record<string, AttendanceMark> = {};
    for (const u of roster) if (!marks[u.id]) all[u.id] = "P";
    setPending((p) => ({ ...p, ...all }));
  };

  const commit = async () => {
    if (Object.keys(pending).length === 0) return;
    setSave("saving");
    await saveStaffMarks(date, pending);
    setPending({});
    setSave("synced");
    toast(t("attendanceSaved"));
  };

  const btnCls = (on: boolean, kind: AttendanceMark) => {
    if (!on) return "att-btn bg-surface2 border-line text-dim";
    if (kind === "P") return "att-btn bg-good text-white border-good";
    if (kind === "A") return "att-btn bg-warn text-white border-warn";
    return "att-btn bg-honey text-[#221900] border-honey";
  };

  if (roster.length === 0) {
    return (
      <>
        <PageTitle title={t("staffAttendanceTitle")} />
        <div className="card">
          <EmptyState icon="users" title={t("noStaffToMark")} sub={t("noStaffToMarkSub")} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title={t("staffAttendanceTitle")}>
        <SaveChip state={save} />
      </PageTitle>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex gap-2 overflow-x-auto py-0.5" role="group" aria-label={t("recentDays")}>
          {recentDays.map((d) => {
            const on = d === date;
            const marked = countDay(db, d).marked > 0;
            return (
              <button
                key={d}
                onClick={() => {
                  setDate(d);
                  setPending({});
                  setSave("idle");
                }}
                className={`shrink-0 px-3 min-h-[38px] rounded-full border text-[12px] font-display font-semibold transition-colors flex items-center gap-1.5 ${
                  on ? "bg-ink text-white border-ink" : "bg-surface text-soft border-line"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${marked ? "bg-good" : "bg-line"}`} />
                {d === todayISO() ? t("today") : fmtDateShort(d)}
              </button>
            );
          })}
        </div>
        <label className="w-full sm:w-auto sm:ml-auto flex items-center gap-2 text-[12.5px] text-soft">
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => {
              setDate(e.target.value);
              setPending({});
            }}
            className="w-full sm:w-auto bg-surface border border-line rounded-xl px-3 min-h-[44px] text-[13px]"
            aria-label={t("today")}
          />
        </label>
      </div>

      {!isEditable(date) && (
        <div className="card-pad !py-2.5 mb-3 flex items-center gap-2.5 text-[12.5px] text-soft">
          <Icon name="alert" size={16} className="text-dim shrink-0" />
          <span>{t("staffPastDayReadOnly")}</span>
        </div>
      )}

      <div className="card-pad flex flex-wrap items-center gap-2.5 mb-4">
        <span className="pill-good">{counts.present} {t("present")}</span>
        <span className="pill-warn">{counts.absent} {t("absent")}</span>
        <span className="pill-gold">{counts.late} {t("late")}</span>
        <span className="pill-dim">
          {t("staffMarked")
            .replace("{n}", String(counts.marked))
            .replace("{total}", String(counts.total))}
        </span>
        {editable && (
          <button className="btn-ghost btn-sm w-full sm:w-auto sm:ml-auto" onClick={markAllPresent}>
            <Icon name="check" size={16} className="text-good" />
            {t("markAllPresent")}
          </button>
        )}
      </div>

      <div className="card">
        {roster.map((u) => {
          const m = marks[u.id];
          return (
            <div key={u.id} className="lrow !py-2">
              {u.avatarUrl ? (
                <img src={u.avatarUrl} alt="" className="w-[34px] h-[34px] rounded-full object-cover shrink-0" />
              ) : (
                <Avatar name={u.firstName} size={34} />
              )}
              <span className="flex-1 min-w-0">
                <b className="text-[13.5px] font-medium block truncate">{personName(u)}</b>
              </span>
              <div className="flex gap-1.5 shrink-0" role="group" aria-label={personName(u)}>
                <button className={btnCls(m === "P", "P")} onClick={() => setMark(u.id, "P")} aria-pressed={m === "P"} title={t("present")} disabled={!editable}>P</button>
                <button className={btnCls(m === "A", "A")} onClick={() => setMark(u.id, "A")} aria-pressed={m === "A"} title={t("absent")} disabled={!editable}>A</button>
                <button className={btnCls(m === "L", "L")} onClick={() => setMark(u.id, "L")} aria-pressed={m === "L"} title={t("late")} disabled={!editable}>L</button>
              </div>
            </div>
          );
        })}
      </div>

      {editable && (
        <div className="mt-4 mb-2">
          <button
            className="btn-gold w-full"
            onClick={commit}
            disabled={Object.keys(pending).length === 0 || save === "saving"}
          >
            {save === "saving" ? t("saving") : t("save")}
          </button>
        </div>
      )}
    </>
  );
}
