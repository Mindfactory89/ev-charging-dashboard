import { datumDE, num } from "./formatters.js";
import { useI18n } from "../i18n/I18nProvider.jsx";

export default function DashboardHeader({
  availableYears = [],
  dashboardTitle,
  demo,
  latestSession,
  loading,
  refreshing,
  sessionsCount,
  year,
  onSelectYear,
}) {
  const { locale, setLocale, supportedLocales, t } = useI18n();

  return (
    <header className="topBar topBarPremium">
      <div className="topLeft premiumTopCopy">
        <div className="kicker">{t("header.kicker")}</div>
        <h1 className="title">{dashboardTitle}</h1>
        <div className="sub">{t("header.subtitle")}</div>

        {demo ? (
          <div className="demoBanner" role="status" aria-live="polite">
            <div className="demoBannerLeft">
              <span className="demoPill">{t("header.demoPill")}</span>
              <span className="demoText">{t("header.demoText")}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="premiumTopControls">
        <div className="filters premiumYearRail">
          <div className="chipLabel">{t("header.year")}</div>
          <div className="chipRow">
            {availableYears.map((itemYear) => (
              <button
                key={itemYear}
                type="button"
                className={year === itemYear ? "chip" : "chip ghost"}
                onClick={() => onSelectYear(itemYear)}
              >
                {itemYear}
              </button>
            ))}
          </div>
        </div>

        <div className="filters premiumYearRail">
          <div className="chipLabel">{t("language.label")}</div>
          <div className="chipRow">
            {supportedLocales.map((itemLocale) => (
              <button
                key={itemLocale}
                type="button"
                className={locale === itemLocale ? "chip" : "chip ghost"}
                onClick={() => setLocale(itemLocale)}
              >
                {t(`language.options.${itemLocale}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="premiumHeaderMeta">
          <div className="pill ghostPill">{t("header.sessionsCount", { count: num(sessionsCount, 0) })}</div>
          {loading || refreshing ? (
            <div className="pill ghostPill">{loading ? t("common.loading") : t("common.refreshing")}</div>
          ) : null}
          <div className="pill ghostPill">
            {latestSession?.date
              ? t("header.latest", { date: datumDE(latestSession.date) })
              : t("header.yearPill", { year })}
          </div>
        </div>
      </div>
    </header>
  );
}
