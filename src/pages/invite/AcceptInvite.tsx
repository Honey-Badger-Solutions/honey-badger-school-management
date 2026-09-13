import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { FullLogo } from "@/components/Logo";
import { useDb } from "@/services/db";
import {
  AuthError,
  MIN_PASSWORD_LENGTH,
  setPassword,
  startSession,
  verifyOtp,
} from "@/services/auth";
import { fullName } from "@/services/users";
import { useT } from "@/store/session";
import type { TKey } from "@/i18n";
import type { Role, User } from "@/types";

const ROLE_LABEL: Record<Role, TKey> = {
  "saas-admin": "roleSaasAdmin",
  "school-admin": "roleSchoolAdmin",
  "staff-admin": "roleStaffAdmin",
  teacher: "roleTeacher",
  "finance-officer": "roleFinance",
  "print-only-staff": "rolePrintStaff",
};

const FAILURE_KEY = {
  invalidCredentials: "errInvalidCredentials",
  accountInactive: "errAccountInactive",
  accountInvited: "errAccountInvited",
  otpInvalid: "errOtpInvalid",
  otpExpired: "errOtpExpired",
  passwordTooShort: "errPasswordTooShort",
} as const;

/**
 * Redeeming a staff invitation: verify the emailed code, then set a password.
 *
 * Public, because the person doing it has no session yet. Two steps rather than
 * one form: the code has to be checked before there is anything to attach a
 * password to, and splitting them means a wrong code costs the user only the
 * code field.
 *
 * The role is NOT chosen here — it was fixed by the admin who sent the
 * invitation. It is only displayed, so the new user can see what they are
 * accepting.
 */
export default function AcceptInvite() {
  const t = useT();
  const db = useDb();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState<User | null>(null);
  const [password, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<TKey | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setVerified(await verifyOtp(email, code));
    } catch (err) {
      setError(err instanceof AuthError ? FAILURE_KEY[err.failure] : "errOtpInvalid");
    } finally {
      setBusy(false);
    }
  };

  const finish = async (e: FormEvent) => {
    e.preventDefault();
    if (!verified) return;
    if (password !== confirm) {
      setError("errPasswordMismatch");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setPassword(verified.id, password);
      // Straight into the app: they have just proved the email is theirs and
      // chosen a password, so making them sign in again adds nothing.
      const fresh = { ...verified, accountStatus: "active" as const };
      startSession(fresh, fresh.roles[0]);
      navigate("/");
    } catch (err) {
      setError(
        err instanceof AuthError ? FAILURE_KEY[err.failure] : "errPasswordTooShort",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-6">
          <Link to="/">
            <FullLogo height={64} />
          </Link>
        </div>

        {!verified ? (
          <>
            <h1 className="text-[22px] font-bold mb-1.5">{t("acceptInviteTitle")}</h1>
            <p className="text-soft text-[13.5px] mb-6 leading-relaxed">
              {t("acceptInviteLead")}
            </p>
            <form onSubmit={check}>
              <div className="field">
                <label htmlFor="iv-email">{t("emailAddress")}</label>
                <input
                  id="iv-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="iv-code">{t("invitationCodeLabel")}</label>
                <input
                  id="iv-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                {error && <p className="err">{t(error)}</p>}
              </div>
              <button className="btn-gold w-full" type="submit" disabled={busy}>
                {busy ? t("verifying") : t("verifyCode")}
                <Icon name="chevR" size={17} />
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="card-pad mb-4 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-good/15 text-good grid place-items-center shrink-0">
                <Icon name="check" size={20} />
              </span>
              <span className="min-w-0">
                <b className="text-[14px] block">
                  {t("welcomeName").replace("{name}", fullName(verified))}
                </b>
                <small className="text-dim text-[12px]">
                  {t("yourRoleIs")}: {t(ROLE_LABEL[verified.roles[0]])} ·{" "}
                  {db.school.name}
                </small>
              </span>
            </div>

            <h1 className="text-[20px] font-bold mb-1.5">
              {t("choosePasswordTitle")}
            </h1>
            <p className="text-soft text-[13.5px] mb-5 leading-relaxed">
              {t("choosePasswordLead")}
            </p>

            <form onSubmit={finish}>
              <div className="field">
                <label htmlFor="iv-pw">{t("newPassword")}</label>
                <input
                  id="iv-pw"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(e) => setPw(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="iv-confirm">{t("confirmPassword")}</label>
                <input
                  id="iv-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {error && <p className="err">{t(error)}</p>}
              </div>
              <button className="btn-gold w-full" type="submit" disabled={busy}>
                {busy ? t("saving") : t("createAccount")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
