import { useRef, useState, type ChangeEvent } from "react";
import { Icon } from "@/components/Icon";
import { Avatar, PageTitle, personName } from "@/components/bits";
import { toast } from "@/components/Toast";
import { useDb } from "@/services/db";
import { currentUser } from "@/services/users";
import { MAX_AVATAR_BYTES, saveAvatar, saveProfile } from "@/services/profile";
import {
  AuthError,
  changePassword,
  hasPassword,
  MIN_PASSWORD_LENGTH,
  switchRole,
} from "@/services/auth";
import { onboardingState } from "@/services/onboarding";
import { useSession, useT } from "@/store/session";
import type { TKey } from "@/i18n";
import type { Role, Sex } from "@/types";

const ROLE_LABEL: Record<Role, TKey> = {
  "saas-admin": "roleSaasAdmin",
  "school-admin": "roleSchoolAdmin",
  "staff-admin": "roleStaffAdmin",
  teacher: "roleTeacher",
  "finance-officer": "roleFinance",
  "print-only-staff": "rolePrintStaff",
};

/**
 * Your own account.
 *
 * Gated by ownership, not by permission: every signed-in user has exactly one
 * of these and it is always their own. Writes go through `services/profile`,
 * which re-checks that rather than trusting the screen.
 */
export default function Profile() {
  const t = useT();
  const db = useDb();
  const user = currentUser(db);
  const activeRole = useSession((s) => s.role);

  if (!user) return null;

  const onboarding = onboardingState(db, user);

  return (
    <>
      <PageTitle title={t("profileTitle")}>
        {!onboarding.complete && (
          <span className="pill-gold">
            <Icon name="alert" size={13} />
            {onboarding.done}/{onboarding.total}
          </span>
        )}
      </PageTitle>
      <p className="text-soft text-[13.5px] -mt-2 mb-5 max-w-[560px]">
        {t("profileSub")}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start max-w-[900px]">
        <div className="flex flex-col gap-5">
          <PictureCard />
          <DetailsCard />
        </div>
        <div className="flex flex-col gap-5">
          <AccountCard />
          <PasswordCard />
        </div>
      </div>

      {/* role switcher — only meaningful for a user holding more than one */}
      {user.roles.length > 1 && (
        <div className="card-pad mt-5 max-w-[900px]">
          <h2 className="font-display font-bold text-[15px] mb-1">
            {t("switchRole")}
          </h2>
          <p className="text-dim text-[12px] mb-3">{t("yourRoles")}</p>
          <div className="seg">
            {user.roles.map((r) => (
              <button
                key={r}
                className={activeRole === r ? "on" : ""}
                onClick={() => switchRole(r)}
              >
                {t(ROLE_LABEL[r])}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function PictureCard() {
  const t = useT();
  const db = useDb();
  const user = currentUser(db)!;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be chosen again after a failure
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast(t("imageTooLarge"));
      return;
    }
    setBusy(true);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }).catch(() => null);
    if (dataUrl) {
      await saveAvatar(user.id, dataUrl);
      toast(t("profileSaved"));
    }
    setBusy(false);
  };

  return (
    <div className="card-pad">
      <h2 className="font-display font-bold text-[15px] mb-1">
        {t("profilePicture")}
      </h2>
      <p className="text-dim text-[12px] mb-4">{t("profilePictureSub")}</p>
      <div className="flex items-center gap-4">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="w-[72px] h-[72px] rounded-full object-cover border border-line shrink-0"
          />
        ) : (
          <Avatar name={personName(user)} size={72} />
        )}
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-ghost btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Icon name="up" size={16} />
            {t("uploadPicture")}
          </button>
          {user.avatarUrl && (
            <button
              className="btn-ghost btn-sm"
              onClick={async () => {
                await saveAvatar(user.id, null);
                toast(t("profileSaved"));
              }}
            >
              {t("removePicture")}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={pick}
        />
      </div>
    </div>
  );
}

function DetailsCard() {
  const t = useT();
  const db = useDb();
  const user = currentUser(db)!;
  const [form, setForm] = useState({
    firstName: user.firstName,
    fatherName: user.fatherName,
    sex: user.sex,
    phone: user.phone,
  });
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string | Sex | null) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    await saveProfile(user.id, form);
    setBusy(false);
    toast(t("profileSaved"));
  };

  return (
    <div className="card-pad">
      <h2 className="font-display font-bold text-[15px] mb-4">
        {t("personalDetails")}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-3">
        <div className="field">
          <label htmlFor="pf-first">{t("firstName")}</label>
          <input
            id="pf-first"
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="pf-father">{t("fatherName")}</label>
          <input
            id="pf-father"
            value={form.fatherName}
            onChange={(e) => set("fatherName", e.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <label>{t("sex")}</label>
        <div className="seg">
          <button
            type="button"
            className={form.sex === "male" ? "on" : ""}
            onClick={() => set("sex", "male")}
          >
            {t("male")}
          </button>
          <button
            type="button"
            className={form.sex === "female" ? "on" : ""}
            onClick={() => set("sex", "female")}
          >
            {t("female")}
          </button>
        </div>
      </div>
      <div className="field">
        <label htmlFor="pf-phone">{t("phone")}</label>
        <input
          id="pf-phone"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
      </div>
      <button className="btn-gold w-full" onClick={save} disabled={busy}>
        {busy ? t("saving") : t("save")}
      </button>
    </div>
  );
}

function AccountCard() {
  const t = useT();
  const db = useDb();
  const user = currentUser(db)!;

  return (
    <div className="card-pad">
      <h2 className="font-display font-bold text-[15px] mb-4">
        {t("accountStatusLabel")}
      </h2>
      <div className="field">
        <label htmlFor="pf-email">{t("email")}</label>
        {/* Read-only: this identifies the Auth account, so changing it is an
            Auth operation with its own verification, not a profile edit. */}
        <input id="pf-email" value={user.email} readOnly disabled />
        <p className="hint">{t("emailReadOnly")}</p>
      </div>
      <div className="field !mb-0">
        <label>{t("yourRoles")}</label>
        <div className="flex flex-wrap gap-1.5">
          {user.roles.map((r) => (
            <span key={r} className="pill-gold">
              {t(ROLE_LABEL[r])}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PasswordCard() {
  const t = useT();
  const db = useDb();
  const user = currentUser(db)!;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<TKey | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (next !== confirm) {
      setError("errPasswordMismatch");
      return;
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError("errPasswordTooShort");
      return;
    }
    setBusy(true);
    try {
      await changePassword(user.id, current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast(t("passwordChanged"));
    } catch (err) {
      setError(
        err instanceof AuthError && err.failure === "passwordTooShort"
          ? "errPasswordTooShort"
          : "errInvalidCredentials",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-pad">
      <h2 className="font-display font-bold text-[15px] mb-4">{t("security")}</h2>
      {hasPassword(db, user.id) && (
        <div className="field">
          <label htmlFor="pf-cur">{t("currentPassword")}</label>
          <input
            id="pf-cur"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
      )}
      <div className="field">
        <label htmlFor="pf-new">{t("newPassword")}</label>
        <input
          id="pf-new"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="pf-confirm">{t("confirmPassword")}</label>
        <input
          id="pf-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <p className="err">{t(error)}</p>}
      </div>
      <button
        className="btn-gold w-full"
        onClick={submit}
        disabled={busy || !next}
      >
        {busy ? t("saving") : t("changePassword")}
      </button>
    </div>
  );
}
