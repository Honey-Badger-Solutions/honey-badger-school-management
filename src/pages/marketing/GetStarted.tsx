import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { FullLogo } from "@/components/Logo";
import { useT } from "@/store/session";

/**
 * Lead-capture only — this prototype has no backend to provision a real
 * tenant against, so "starting the process" means recording interest, not
 * creating an account. See services/db.ts for why: everything here is a
 * local mock, and a fabricated signup would be a promise the app can't keep.
 */
export default function GetStarted() {
  const t = useT();
  const [submitted, setSubmitted] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [studentCount, setStudentCount] = useState("");
  const [message, setMessage] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-[480px]">
        <div className="flex items-center justify-between mb-6">
          <Link to="/">
            <FullLogo height={64} />
          </Link>
          <Link to="/login" className="text-[13px] font-medium text-soft hover:text-ink">
            {t("mktGoLogin")}
          </Link>
        </div>

        {submitted ? (
          <div className="card-pad text-center py-10">
            <span className="w-14 h-14 rounded-2xl bg-good/15 text-good grid place-items-center mx-auto mb-4">
              <Icon name="check" size={26} />
            </span>
            <h1 className="text-[19px] font-bold mb-2">{t("mktSuccessTitle")}</h1>
            <p className="text-soft text-[13.5px] leading-relaxed mb-6">
              {t("mktSuccessSub")
                .replace("{name}", ownerName || "—")
                .replace("{school}", schoolName || "—")}
            </p>
            <Link to="/" className="btn-ghost">
              {t("mktBackHome")}
            </Link>
          </div>
        ) : (
          <>
            <span className="pill-gold mb-3">{t("mktGetStartedEyebrow")}</span>
            <h1 className="text-[22px] font-bold mb-1.5">{t("mktGetStartedTitle")}</h1>
            <p className="text-soft text-[13.5px] mb-6 leading-relaxed">
              {t("mktGetStartedLead")}
            </p>

            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="schoolName">{t("schoolName")}</label>
                <input
                  id="schoolName"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="ownerName">{t("mktOwnerName")}</label>
                <input
                  id="ownerName"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </div>

              <div className="grid xs:grid-cols-2 gap-x-4">
                <div className="field">
                  <label htmlFor="email">{t("email")}</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="phone">{t("phone")}</label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid xs:grid-cols-2 gap-x-4">
                <div className="field">
                  <label htmlFor="city">{t("city")}</label>
                  <input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="studentCount">{t("mktStudentCount")}</label>
                  <input
                    id="studentCount"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={studentCount}
                    onChange={(e) => setStudentCount(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="message">
                  {t("mktMessage")} <span className="text-dim font-normal">({t("optional")})</span>
                </label>
                <textarea
                  id="message"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <button className="btn-gold w-full" type="submit">
                {t("mktSubmitRequest")}
                <Icon name="chevR" size={17} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
