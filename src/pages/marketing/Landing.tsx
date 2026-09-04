import { Link } from "react-router-dom";
import { Icon, type IconName } from "@/components/Icon";
import { FullLogo } from "@/components/Logo";
import { useSession, useT } from "@/store/session";
import type { TKey } from "@/i18n";
import type { Role } from "@/types";

const FEATURES: { icon: IconName; title: TKey; sub: TKey }[] = [
  {
    icon: "users",
    title: "mktFeatureStudentsTitle",
    sub: "mktFeatureStudentsSub",
  },
  { icon: "cash", title: "mktFeatureFeesTitle", sub: "mktFeatureFeesSub" },
  { icon: "exam", title: "mktFeatureExamsTitle", sub: "mktFeatureExamsSub" },
  { icon: "staff", title: "mktFeatureStaffTitle", sub: "mktFeatureStaffSub" },
  {
    icon: "clipboard",
    title: "mktFeatureAttendanceTitle",
    sub: "mktFeatureAttendanceSub",
  },
  { icon: "receipt", title: "mktFeaturePrintTitle", sub: "mktFeaturePrintSub" },
];

const ROLES: { role: Role; icon: IconName; label: TKey; sub: TKey }[] = [
  {
    role: "school-admin",
    icon: "badge",
    label: "roleSchoolAdmin",
    sub: "roleSchoolAdminSub",
  },
  {
    role: "teacher",
    icon: "book",
    label: "roleTeacher",
    sub: "roleTeacherSub",
  },
  {
    role: "finance-officer",
    icon: "cash",
    label: "roleFinance",
    sub: "roleFinanceSub",
  },
  {
    role: "staff-admin",
    icon: "users",
    label: "roleStaffAdmin",
    sub: "roleStaffAdminSub",
  },
  {
    role: "print-only-staff",
    icon: "printer",
    label: "rolePrintStaff",
    sub: "rolePrintStaffSub",
  },
  {
    role: "saas-admin",
    icon: "badge",
    label: "roleSaasAdmin",
    sub: "roleSaasAdminSub",
  },
];

export default function Landing() {
  const t = useT();
  const lang = useSession((s) => s.lang);
  const setLang = useSession((s) => s.setLang);

  return (
    <div className="min-h-screen">
      {/* ---- header ---- */}
      <header className="no-print sticky top-0 z-30 bg-paper/90 backdrop-blur border-b border-line-soft">
        <div className="max-w-app mx-auto px-4 md:px-7 h-[64px] flex items-center gap-4">
          <FullLogo height={40} />
          <span className="font-display font-bold text-[15px] mr-auto">
            {t("brandName")}
          </span>

          <nav
            className="hidden md:flex items-center gap-5 mr-2"
            aria-label="Main"
          >
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("features")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
              className="text-[13.5px] font-medium text-soft hover:text-ink"
            >
              {t("mktNavFeatures")}
            </a>
            <a
              href="#roles"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("roles")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
              className="text-[13.5px] font-medium text-soft hover:text-ink"
            >
              {t("mktNavRoles")}
            </a>
          </nav>

          <div
            className="seg hidden xs:inline-flex"
            role="group"
            aria-label={t("language")}
          >
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

          <Link to="/login" className="btn-ghost btn-sm">
            {t("mktCtaLogin")}
          </Link>
          <Link to="/get-started" className="btn-gold btn-sm">
            {t("mktCtaStart")}
          </Link>
        </div>
      </header>

      <main className="max-w-app mx-auto px-4 md:px-7">
        {/* ---- hero ---- */}
        <section className="grid lg:grid-cols-2 gap-10 items-center pt-12 pb-16 md:pt-16 md:pb-20">
          <div>
            <h1 className="text-[30px] md:text-[40px] font-display font-bold leading-[1.15] mb-4">
              {t("mktHeroTitle")}
            </h1>
            <p className="text-soft text-[15px] md:text-[16px] leading-relaxed mb-7 max-w-[480px]">
              {t("mktHeroSub")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/get-started" className="btn-gold">
                <Icon name="plus" size={18} />
                {t("mktCtaStart")}
              </Link>
              <Link to="/login" className="btn-ghost">
                {t("mktCtaLogin")}
                <Icon name="chevR" size={17} />
              </Link>
            </div>
            <p className="text-dim text-[12px] mt-4">{t("mktHeroNote")}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 xs:gap-4">
            <div className="kpi col-span-2">
              <div className="k">{t("mktHeroStatStudents")}</div>
              <div className="v">1,240</div>
            </div>
            <div className="kpi">
              <div className="k">{t("mktHeroStatAttendance")}</div>
              <div className="v text-good">96%</div>
            </div>
            <div className="kpi">
              <div className="k">{t("mktHeroStatFees")}</div>
              <div className="v">ETB 2.1M</div>
            </div>
          </div>
        </section>

        {/* ---- features ---- */}
        <section id="features" className="py-14 md:py-16 scroll-mt-20">
          <div className="max-w-[560px] mb-10">
            <h2 className="text-[24px] md:text-[28px] font-display font-bold mb-3">
              {t("mktFeaturesTitle")}
            </h2>
            <p className="text-soft text-[14.5px] leading-relaxed">
              {t("mktFeaturesSub")}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-pad">
                <span className="w-11 h-11 rounded-xl bg-honey/15 text-gold grid place-items-center shrink-0 mb-3.5">
                  <Icon name={f.icon} size={22} />
                </span>
                <h3 className="font-display font-semibold text-[15px] mb-1.5">
                  {t(f.title)}
                </h3>
                <p className="text-soft text-[13px] leading-relaxed">
                  {t(f.sub)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- roles ---- */}
        <section id="roles" className="py-14 md:py-16 scroll-mt-20">
          <div className="max-w-[560px] mb-10">
            <h2 className="text-[24px] md:text-[28px] font-display font-bold mb-3">
              {t("mktRolesTitle")}
            </h2>
            <p className="text-soft text-[14.5px] leading-relaxed">
              {t("mktRolesSub")}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ROLES.map((r) => (
              <div
                key={r.role}
                className="flex items-center gap-3.5 p-4 rounded-xl border border-line bg-surface2/60"
              >
                <span className="w-11 h-11 rounded-xl bg-honey/15 text-gold grid place-items-center shrink-0">
                  <Icon name={r.icon} />
                </span>
                <span>
                  <b className="font-display font-semibold text-[14px] block">
                    {t(r.label)}
                  </b>
                  <small className="text-dim text-[12px]">{t(r.sub)}</small>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ---- cta banner ---- */}
        <section className="py-14 md:py-16">
          <div className="card-pad text-center py-10 md:py-14 px-6 bg-gradient-to-br from-honey/15 to-transparent">
            <h2 className="text-[22px] md:text-[26px] font-display font-bold mb-2.5">
              {t("mktCtaBannerTitle")}
            </h2>
            <p className="text-soft text-[14.5px] mb-7 max-w-[440px] mx-auto leading-relaxed">
              {t("mktCtaBannerSub")}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/get-started" className="btn-gold">
                {t("mktCtaBannerStart")}
              </Link>
              <Link to="/login" className="btn-ghost">
                {t("mktCtaBannerLogin")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ---- footer ---- */}
      <footer className="no-print border-t border-line-soft">
        <div className="max-w-app mx-auto px-4 md:px-7 py-8 flex flex-wrap items-center justify-between gap-4">
          <span className="flex items-center gap-2.5">
            <FullLogo height={30} />
            <span className="leading-tight">
              <b className="font-display font-bold text-[13.5px] block">
                {t("brandName")}
              </b>
              <small className="text-dim text-[11px]">
                {t("mktFooterTag")}
              </small>
            </span>
          </span>
          <small className="text-dim text-[12px]">
            © {new Date().getFullYear()} {t("brandName")} —{" "}
            {t("mktFooterRights")}
          </small>
        </div>
      </footer>
    </div>
  );
}
