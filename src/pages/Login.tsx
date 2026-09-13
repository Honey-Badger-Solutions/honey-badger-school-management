import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { FullLogo } from "../components/Logo";
import { personName } from "../components/bits";
import { useDb } from "../services/db";
import { AuthError, signIn, startSession } from "../services/auth";
import { usersInSchool } from "../services/users";
import { useSession, useT } from "../store/session";
import { DEMO_PASSWORD } from "../lib/digest";
import { ROLES, type Role, type User } from "../types";
import type { TKey } from "../i18n";

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
 * Sign in.
 *
 * Real credentials against the local credential store, plus a demo picker —
 * the prototype has no mail server, so without the picker there would be no way
 * to see the other roles. Both paths end in the same `startSession` call, so
 * swapping the form for Supabase Auth later changes only this screen.
 */
export default function Login() {
  const t = useT();
  const db = useDb();
  const lang = useSession((s) => s.lang);
  const setLang = useSession((s) => s.setLang);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<TKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  // Always via "/": `Home` decides between the role's dashboard and the setup
  // checklist. Routing straight to a dashboard here would put a second copy of
  // that decision in the one place guaranteed to run for a brand-new account.
  const land = () => navigate("/");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      land();
    } catch (err) {
      setError(
        err instanceof AuthError ? FAILURE_KEY[err.failure] : "errInvalidCredentials",
      );
    } finally {
      setBusy(false);
    }
  };

  /** Demo shortcut: sign in as a seeded account without its password. */
  const useDemoAccount = (user: User) => {
    startSession(user, user.roles[0]);
    land();
  };

  // one representative account per role, so the list stays short
  const staff = usersInSchool(db, db.schoolId);
  const demoAccounts = ROLES.map((role) =>
    staff.find((u) => u.roles.includes(role) && u.accountStatus === "active"),
  ).filter((u): u is User => !!u);

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center justify-between mb-5">
          <Link to="/">
            <FullLogo height={72} />
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

        <h1 className="text-[24px] font-bold mb-1">{t("signIn")}</h1>
        <p className="text-soft text-[13.5px] mb-6">
          {t("signInSub")} — {db.school.name}
        </p>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">{t("emailAddress")}</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t("password")}</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="err">{t(error)}</p>}
          </div>
          <button className="btn-gold w-full" type="submit" disabled={busy}>
            {busy ? t("signingIn") : t("signIn")}
            <Icon name="chevR" size={17} />
          </button>
        </form>

        <div className="mt-6">
          <button
            className="btn-ghost btn-sm w-full"
            onClick={() => setShowDemo((v) => !v)}
            aria-expanded={showDemo}
          >
            {t("demoAccounts")}
          </button>

          {showDemo && (
            <div className="mt-3">
              <p className="text-dim text-[12px] leading-relaxed mb-3">
                {t("demoAccountsSub")}{" "}
                <b className="font-display text-soft">{DEMO_PASSWORD}</b>
              </p>
              <div className="flex flex-col gap-2">
                {demoAccounts.map((user) => (
                  <button
                    key={user.id}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-line bg-surface2/60 text-left hover:border-gold transition-colors min-h-[56px]"
                    onClick={() => useDemoAccount(user)}
                  >
                    <span className="w-9 h-9 rounded-xl bg-honey/15 text-gold grid place-items-center shrink-0">
                      <Icon name="badge" size={17} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <b className="font-display font-semibold text-[13.5px] block">
                        {personName(user)}
                      </b>
                      <small className="text-dim text-[11.5px]">
                        {t(ROLE_LABEL[user.roles[0]])} · {user.email}
                      </small>
                    </span>
                    <Icon name="chevR" size={16} className="text-dim shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
