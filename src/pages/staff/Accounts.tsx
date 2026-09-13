import { useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { Avatar, EmptyState, PageTitle, personName } from "@/components/bits";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toast";
import { useDb } from "@/services/db";
import { usersInSchool, userName } from "@/services/users";
import {
  assignableRoles,
  EmailTaken,
  inviteStaff,
  resendInvitation,
  revokeInvitation,
  setAccountActive,
  setUserRoles,
} from "@/services/invitations";
import type { IssuedOtp } from "@/services/auth";
import { useCan, useSession, useT } from "@/store/session";
import { fmtDate } from "@/lib/dates";
import type { TKey } from "@/i18n";
import type { Role, Sex, User } from "@/types";

const ROLE_LABEL: Record<Role, TKey> = {
  "saas-admin": "roleSaasAdmin",
  "school-admin": "roleSchoolAdmin",
  "staff-admin": "roleStaffAdmin",
  teacher: "roleTeacher",
  "finance-officer": "roleFinance",
  "print-only-staff": "rolePrintStaff",
};

/**
 * Staff accounts for one school.
 *
 * One screen serving both the school admin and the staff admin, rather than the
 * two near-identical copies this codebase already has for StaffProfile — the
 * permissions differ, not the screen, and `useCan()` expresses that.
 *
 * Scoped with `usersInSchool` rather than reading `db.users`: the tenant filter
 * is the same predicate RLS will enforce, and it should not be re-derived per
 * screen.
 */
export default function Accounts() {
  const t = useT();
  const db = useDb();
  const can = useCan();
  const meId = useSession((s) => s.userId);
  const [query, setQuery] = useState("");
  const [inviting, setInviting] = useState(false);
  const [issued, setIssued] = useState<IssuedOtp | null>(null);
  const [editing, setEditing] = useState<User | null>(null);

  const needle = query.trim().toLowerCase();
  const accounts = usersInSchool(db, db.schoolId)
    .filter(
      (u) =>
        !needle ||
        personName(u).toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle),
    )
    .sort((a, b) => personName(a).localeCompare(personName(b)));

  const statusPill = (u: User) => {
    if (u.status === "departed")
      return <span className="pill-dim">{t("statusDeactivated")}</span>;
    if (u.accountStatus === "invited")
      return <span className="pill-gold">{t("statusInvited")}</span>;
    return <span className="pill-good">{t("statusActive")}</span>;
  };

  return (
    <>
      <PageTitle title={t("accountsTitle")}>
        {can("users.create") && (
          <button className="btn-gold btn-sm" onClick={() => setInviting(true)}>
            <Icon name="plus" size={16} />
            {t("inviteStaff")}
          </button>
        )}
      </PageTitle>
      <p className="text-soft text-[13.5px] -mt-2 mb-4 max-w-[620px]">
        {t("accountsSub")}
      </p>

      <div className="field">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchStaff")}
          aria-label={t("searchStaff")}
        />
      </div>

      {accounts.length === 0 ? (
        <div className="card">
          <EmptyState icon="users" title={t("noAccounts")} sub={t("noAccountsSub")} />
        </div>
      ) : (
        <div className="card">
          {accounts.map((u) => (
            <div key={u.id} className="lrow flex-wrap !gap-2.5">
              {u.avatarUrl ? (
                <img
                  src={u.avatarUrl}
                  alt=""
                  className="w-[38px] h-[38px] rounded-full object-cover shrink-0"
                />
              ) : (
                <Avatar name={personName(u)} size={38} />
              )}
              <span className="flex-1 min-w-[160px]">
                <b className="text-[13.5px] block">
                  {personName(u)}
                  {u.id === meId && <span className="text-dim font-normal"> · {t("you")}</span>}
                </b>
                <small className="text-dim text-[12px] block truncate">{u.email}</small>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {u.roles.map((r) => (
                  <span key={r} className="pill-neutral">
                    {t(ROLE_LABEL[r])}
                  </span>
                ))}
                {statusPill(u)}
              </span>
              <button
                className="btn-ghost btn-sm shrink-0"
                onClick={() => setEditing(u)}
              >
                {t("edit")}
              </button>
            </div>
          ))}
        </div>
      )}

      {inviting && (
        <InviteModal
          onClose={() => setInviting(false)}
          onSent={(otp) => {
            setInviting(false);
            setIssued(otp);
          }}
        />
      )}

      {issued && <CodeModal otp={issued} onClose={() => setIssued(null)} />}

      {editing && (
        <AccountModal
          user={editing}
          onClose={() => setEditing(null)}
          onCode={(otp) => {
            setEditing(null);
            setIssued(otp);
          }}
        />
      )}
    </>
  );
}

function InviteModal({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: (otp: IssuedOtp) => void;
}) {
  const t = useT();
  const [form, setForm] = useState({
    firstName: "",
    fatherName: "",
    email: "",
    phone: "",
    sex: null as Sex | null,
    role: "teacher" as Role,
  });
  const [error, setError] = useState<TKey | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string | Sex | null) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { otp } = await inviteStaff(form);
      toast(t("invitationSent"));
      onSent(otp);
    } catch (err) {
      setError(err instanceof EmailTaken ? "emailTaken" : "saveFailed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("inviteStaffTitle")} lead={t("inviteStaffLead")} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-3">
          <div className="field">
            <label htmlFor="in-first">{t("firstName")}</label>
            <input
              id="in-first"
              required
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="in-father">{t("fatherName")}</label>
            <input
              id="in-father"
              required
              value={form.fatherName}
              onChange={(e) => set("fatherName", e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="in-email">{t("emailAddress")}</label>
          <input
            id="in-email"
            type="email"
            required
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
          {error && <p className="err">{t(error)}</p>}
        </div>
        <div className="field">
          <label htmlFor="in-phone">{t("phone")}</label>
          <input
            id="in-phone"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="in-role">{t("roleAssigned")}</label>
          <select
            id="in-role"
            value={form.role}
            onChange={(e) => set("role", e.target.value as Role)}
          >
            {assignableRoles().map((r) => (
              <option key={r} value={r}>
                {t(ROLE_LABEL[r])}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2.5">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className="btn-gold flex-1" disabled={busy}>
            {busy ? t("saving") : t("sendInvitation")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Shows the invitation code.
 *
 * Only exists because there is no mail server: a real invitation is emailed and
 * the code is never rendered anywhere. The copy on this dialog says so, so the
 * shortcut is not mistaken for the design.
 */
function CodeModal({ otp, onClose }: { otp: IssuedOtp; onClose: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  return (
    <Modal title={t("invitationCode")} lead={t("invitationCodeLead")} onClose={onClose}>
      <div className="card-pad text-center py-6 mb-4">
        <div className="font-display font-bold text-[32px] tracking-[6px] text-gold">
          {otp.code}
        </div>
        <small className="text-dim text-[12px] block mt-2">{otp.email}</small>
      </div>
      <div className="flex gap-2.5">
        <button
          className="btn-ghost flex-1"
          onClick={() => {
            void navigator.clipboard?.writeText(otp.code);
            setCopied(true);
          }}
        >
          {copied ? t("copied") : t("copyCode")}
        </button>
        <button className="btn-gold flex-1" onClick={onClose}>
          {t("done")}
        </button>
      </div>
    </Modal>
  );
}

function AccountModal({
  user,
  onClose,
  onCode,
}: {
  user: User;
  onClose: () => void;
  onCode: (otp: IssuedOtp) => void;
}) {
  const t = useT();
  const db = useDb();
  const can = useCan();
  const meId = useSession((s) => s.userId);
  const [role, setRole] = useState<Role>(user.roles[0]);
  const [busy, setBusy] = useState(false);
  const isSelf = user.id === meId;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      toast(t("accountUpdated"));
      onClose();
    } catch {
      toast(t("saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={personName(user)} lead={user.email} onClose={onClose}>
      <div className="card-pad !py-3 mb-4 text-[12.5px] text-soft flex flex-col gap-1">
        <span>
          {t("lastSignIn")}:{" "}
          {user.lastSignInAt ? fmtDate(user.lastSignInAt) : t("neverSignedIn")}
        </span>
        {user.invitedByUserId && (
          <span>
            {t("invitedBy")}: {userName(db, user.invitedByUserId)}
            {user.invitedAt ? ` · ${fmtDate(user.invitedAt)}` : ""}
          </span>
        )}
      </div>

      {isSelf && (
        <p className="text-dim text-[12px] mb-3">{t("cannotEditSelf")}</p>
      )}

      {can("users.assign_roles") && (
        <div className="field">
          <label htmlFor="ac-role">{t("changeRole")}</label>
          <select
            id="ac-role"
            value={role}
            disabled={isSelf}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {assignableRoles().map((r) => (
              <option key={r} value={r}>
                {t(ROLE_LABEL[r])}
              </option>
            ))}
          </select>
          <p className="hint">{t("changeRoleLead")}</p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {can("users.assign_roles") && !isSelf && role !== user.roles[0] && (
          <button
            className="btn-gold"
            disabled={busy}
            onClick={() => run(() => setUserRoles(user.id, [role]))}
          >
            {t("save")}
          </button>
        )}

        {/* An unredeemed invitation can be re-sent or withdrawn; a used account
            can only be turned off, because records already point at it. */}
        {user.accountStatus === "invited" && can("users.create") && (
          <button
            className="btn-ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const otp = await resendInvitation(user.id);
              setBusy(false);
              onCode(otp);
            }}
          >
            <Icon name="swap" size={16} />
            {t("resendInvite")}
          </button>
        )}

        {user.accountStatus === "invited" && can("users.disable") && (
          <button
            className="btn-danger"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(t("revokeInviteConfirm"))) return;
              void run(() => revokeInvitation(user.id));
            }}
          >
            {t("revokeInvite")}
          </button>
        )}

        {user.accountStatus === "active" && can("users.disable") && !isSelf && (
          <button
            className={user.status === "departed" ? "btn-ghost" : "btn-danger"}
            disabled={busy}
            onClick={() => {
              if (user.status !== "departed" && !window.confirm(t("deactivateConfirm"))) return;
              void run(() => setAccountActive(user.id, user.status === "departed"));
            }}
          >
            {user.status === "departed" ? t("reactivate") : t("deactivate")}
          </button>
        )}
      </div>
    </Modal>
  );
}
