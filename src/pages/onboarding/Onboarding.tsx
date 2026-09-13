import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { PageTitle } from "@/components/bits";
import { toast } from "@/components/Toast";
import { useDb } from "@/services/db";
import { currentUser } from "@/services/users";
import { completeOnboarding, onboardingState } from "@/services/onboarding";
import { useT } from "@/store/session";

/**
 * The setup checklist a new account sees.
 *
 * A checklist, not a wizard: every step links to where it is actually done
 * (the profile screen owns those fields — duplicating them here would give the
 * app two places that write the same columns). Nothing is blocking; the user
 * can leave and the outstanding items follow them in the nav.
 */
export default function Onboarding() {
  const t = useT();
  const db = useDb();
  const navigate = useNavigate();
  const user = currentUser(db);
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const state = onboardingState(db, user);

  const finish = async () => {
    setBusy(true);
    await completeOnboarding(user.id);
    setBusy(false);
    toast(t("onboardingComplete"));
    navigate("/");
  };

  const pct = state.total === 0 ? 100 : Math.round((state.done / state.total) * 100);

  return (
    <>
      <PageTitle title={t("onboardingTitle")} />
      <p className="text-soft text-[13.5px] -mt-2 mb-5 max-w-[560px] leading-relaxed">
        {t("onboardingSub")}
      </p>

      <div className="max-w-[640px]">
        <div className="card-pad mb-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <b className="font-display text-[13px]">
              {t("onboardingProgress")
                .replace("{done}", String(state.done))
                .replace("{total}", String(state.total))}
            </b>
            <span className="text-dim text-[12px]">{pct}%</span>
          </div>
          <div className="h-[10px] rounded-full bg-surface3 overflow-hidden">
            <i
              className="block h-full rounded-full bg-gradient-to-r from-honey-dark to-honey transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="card">
          {state.steps.map((step) => (
            <Link key={step.id} to={step.to} className="lrow">
              <span
                className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
                  step.done ? "bg-good/15 text-good" : "bg-surface3 text-dim"
                }`}
              >
                <Icon name={step.done ? "check" : "edit"} size={17} />
              </span>
              <span className="flex-1 min-w-0">
                <b className="text-[13.5px] block">
                  {t(step.title)}
                  {!step.required && (
                    <span className="text-dim font-normal"> · {t("optional")}</span>
                  )}
                </b>
                <small className="text-dim text-[12px]">{t(step.description)}</small>
              </span>
              <Icon name="chevR" size={17} className="text-dim shrink-0" />
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-2.5 mt-5">
          <button
            className="btn-gold"
            onClick={finish}
            disabled={!state.ready || busy}
            style={{ opacity: state.ready ? 1 : 0.5 }}
          >
            {busy ? t("saving") : t("finishSetup")}
            <Icon name="check" size={17} />
          </button>
          <button className="btn-ghost" onClick={() => navigate("/")}>
            {t("doThisLater")}
          </button>
        </div>
      </div>
    </>
  );
}
