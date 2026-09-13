/**
 * The Print-Only Staff dashboard — the print queue, and nothing else.
 *
 * Empty is the normal state and it stays empty: this role does not chase
 * missing attendance or outstanding fees, it prints what colleagues ask for.
 * A request appears here when someone chooses "Print by staff" on a receipt or
 * a report card.
 *
 * The document is re-derived from live data at the moment it is opened, never
 * read from a snapshot taken when the request was made — see
 * services/printRequests.ts for why.
 */
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { PageTitle, EmptyState, personName } from "@/components/bits";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toast";
import { PrintArea, printNow } from "@/components/Print";
import { ReceiptPaper } from "@/components/print/Receipt";
import { ReportCardPaper } from "@/components/print/ReportCard";
import { useDb } from "@/services/db";
import { currentUser, userName } from "@/services/users";
import {
  cancelPrintRequest,
  completePrintRequest,
  pendingPrintCount,
  printRequestsIn,
} from "@/services/printRequests";
import { sectionLabel, sectionReport } from "@/lib/derive";
import { fmtDate, fmtDateTime, todayISO } from "@/lib/dates";
import { useT } from "@/store/session";
import type { PrintRequest, PrintRequestStatus } from "@/types";

const TABS: { status: PrintRequestStatus; label: "printQueuePending" | "printQueueDone" | "printQueueCancelled" }[] = [
  { status: "pending", label: "printQueuePending" },
  { status: "completed", label: "printQueueDone" },
  { status: "cancelled", label: "printQueueCancelled" },
];

export default function PrintDashboard() {
  const t = useT();
  const db = useDb();
  const [status, setStatus] = useState<PrintRequestStatus>("pending");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = printRequestsIn(db, status);
  const waiting = pendingPrintCount(db);
  const open = openId ? db.printRequests.find((r) => r.id === openId) : undefined;

  return (
    <>
      <PageTitle title={`${t("goodMorning")}, ${currentUser(db)?.firstName ?? ""}`}>
        <span className="pill-dim">
          <Icon name="calendar" size={13} />
          {fmtDate(todayISO())}
        </span>
        {waiting > 0 && (
          <span className="pill-gold">
            {t("waitingCount").replace("{n}", String(waiting))}
          </span>
        )}
      </PageTitle>

      <div className="seg max-w-[360px] mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            className={status === tab.status ? "on" : ""}
            onClick={() => setStatus(tab.status)}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <EmptyState
            icon="printer"
            title={t(status === "pending" ? "printQueueEmpty" : "printQueueTitle")}
            sub={t(
              status === "pending"
                ? "printQueueEmptySub"
                : status === "completed"
                  ? "printQueueEmptyDone"
                  : "printQueueEmptyCancelled",
            )}
          />
        ) : (
          rows.map((r) => (
            <button key={r.id} className="lrow" onClick={() => setOpenId(r.id)}>
              <span className="w-9 h-9 rounded-xl bg-surface2 text-soft grid place-items-center shrink-0">
                <Icon name={r.kind === "receipt" ? "receipt" : "exam"} size={17} />
              </span>
              <span className="flex-1 min-w-0 text-left">
                <b className="text-[13.5px] block truncate">{subjectLabel(r)}</b>
                <small className="text-dim text-[11.5px]">
                  {t(r.kind === "receipt" ? "docReceipt" : "docReportCard")} ·{" "}
                  {userName(db, r.requestedByUserId)} · {fmtDateTime(r.requestedAt)}
                </small>
              </span>
              {r.copies > 1 && (
                <span className="pill-dim shrink-0">
                  {t("copiesN").replace("{n}", String(r.copies))}
                </span>
              )}
              <Icon name="chevR" size={17} className="text-dim shrink-0" />
            </button>
          ))
        )}
      </div>

      {open && <RequestModal request={open} onClose={() => setOpenId(null)} />}
    </>
  );

  /** What the row is about, in the words the print staff will recognise. */
  function subjectLabel(r: PrintRequest): string {
    if (r.kind === "receipt") {
      const payment = db.payments.find((p) => p.id === r.subjectId);
      const student = payment && db.students.find((s) => s.id === payment.studentId);
      return payment
        ? `${payment.receiptNo}${student ? ` — ${personName(student)}` : ""}`
        : t("printRequestGone");
    }
    const student = db.students.find((s) => s.id === r.subjectId);
    return student ? personName(student) : t("printRequestGone");
  }
}

/* ---------------- one request: document + actions ---------------- */

function RequestModal({ request, onClose }: { request: PrintRequest; onClose: () => void }) {
  const t = useT();
  const db = useDb();
  const [printing, setPrinting] = useState(false);
  const [busy, setBusy] = useState(false);

  // Resolved fresh, every time this opens. A request whose record has since
  // been removed is shown as such rather than printed blank.
  const payment = request.kind === "receipt"
    ? db.payments.find((p) => p.id === request.subjectId)
    : undefined;
  const student = request.kind === "report_card"
    ? db.students.find((s) => s.id === request.subjectId)
    : undefined;
  const exam = request.examId ? db.examPeriods.find((e) => e.id === request.examId) : undefined;
  const rows = student && exam ? sectionReport(db, exam.id, student.sectionId) : [];
  const row = rows.find((r) => r.student.id === student?.id);

  const sheet =
    request.kind === "receipt"
      ? (payment ? <ReceiptPaper payment={payment} /> : null)
      : (exam && row ? <ReportCardPaper exam={exam} row={row} rows={rows} /> : null);

  const close = async (action: "complete" | "cancel") => {
    setBusy(true);
    try {
      if (action === "complete") await completePrintRequest(request.id);
      else await cancelPrintRequest(request.id);
      toast(t(action === "complete" ? "printRequestCompleted" : "printRequestCancelled"));
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("saveFailed"));
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        title={t(request.kind === "receipt" ? "docReceipt" : "docReportCard")}
        onClose={onClose}
      >
        <div className="flex flex-col gap-1.5 text-[13px] mb-4">
          <Row label={t("requestedBy")} value={userName(db, request.requestedByUserId)} />
          <Row label={t("printRequestCopies")} value={String(request.copies)} />
          {student && <Row label={t("student")} value={`${personName(student)} · ${sectionLabel(db, student.sectionId)}`} />}
          {exam && <Row label={t("examName")} value={exam.name} />}
          {request.processedByUserId && (
            <Row label={t("markCompleted")} value={userName(db, request.processedByUserId)} />
          )}
        </div>
        {request.note && (
          <p className="text-[13px] p-2.5 rounded-xl bg-surface2 text-soft mb-4">{request.note}</p>
        )}

        {sheet ? (
          <div className="border border-line rounded-xl bg-white p-3 mb-4 overflow-x-auto">
            <div className="min-w-[420px]">{sheet}</div>
          </div>
        ) : (
          <p className="text-warn text-[13px] font-medium mb-4">{t("printRequestGone")}</p>
        )}

        <div className="flex flex-wrap gap-2.5">
          <button className="btn-ghost flex-1" onClick={onClose}>{t("done")}</button>
          {request.status === "pending" && (
            <>
              {sheet && (
                <button
                  className="btn-gold flex-1"
                  onClick={() => { setPrinting(true); printNow(() => setPrinting(false)) }}
                >
                  <Icon name="printer" size={17} />{t("printDoc")}
                </button>
              )}
              <button className="btn-ghost flex-1" onClick={() => close("complete")} disabled={busy}>
                <Icon name="check" size={16} />{t("markCompleted")}
              </button>
              <button className="btn-danger flex-1" onClick={() => close("cancel")} disabled={busy}>
                {t("cancelRequest")}
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* One sheet per requested copy — `.print-page` turns each into its own
          page, which is what "3 copies" means at a printer. */}
      {printing && sheet && (
        <PrintArea>
          {Array.from({ length: request.copies }, (_, i) => (
            <div key={i} className="print-page">{sheet}</div>
          ))}
        </PrintArea>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-dim">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
