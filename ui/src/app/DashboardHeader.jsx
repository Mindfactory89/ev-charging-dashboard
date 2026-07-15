import { datumDE, num } from "./formatters.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import ReleaseUpdateControl from "./ReleaseUpdateControl.jsx";
import ThemeControl from "../design-system/ThemeControl.jsx";

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
  onOpenOnboarding,
}) {
  const { locale, setLocale, supportedLocales, t } = useI18n();

  return (
    <header className="shellHeader">
      <div className="shellHeaderCopy">
        <div className="shellBrandLockup">
          <span className="shellBrandMark" aria-hidden="true">e</span>
          <div>
            <div className="kicker">{t("header.kicker")}</div>
            <h1 className="title">{dashboardTitle}</h1>
          </div>
        </div>
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

      <div className="shellHeaderControls">
        <div className="shellYearControl" role="group" aria-label={t("header.year")}>
          <div className="chipLabel">{t("header.year")}</div>
          <div className="chipRow">
            {availableYears.map((itemYear) => (
              <button
                key={itemYear}
                type="button"
                className={year === itemYear ? "chip" : "chip ghost"}
                onClick={() => onSelectYear(itemYear)}
                aria-label={`${t("header.year")} ${itemYear}`}
                aria-pressed={year === itemYear}
              >
                {itemYear}
              </button>
            ))}
          </div>
        </div>

        <details className="shellSettings">
          <summary>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h10M18 7h2M10 17h10M4 17h2M14 4v6M10 14v6" />
            </svg>
            <span>{t("app.shell.settings")}</span>
            <span className="shellSettingsStatus">{t(`language.options.${locale}`)}</span>
          </summary>

          <div className="shellSettingsPanel">
            <div className="shellSettingsSection" role="group" aria-label={t("language.label")}>
              <div className="chipLabel">{t("language.label")}</div>
              <div className="chipRow">
                {supportedLocales.map((itemLocale) => (
                  <button
                    key={itemLocale}
                    type="button"
                    className={locale === itemLocale ? "chip" : "chip ghost"}
                    onClick={() => setLocale(itemLocale)}
                    aria-label={`${t("language.label")} ${t(`language.options.${itemLocale}`)}`}
                    aria-pressed={locale === itemLocale}
                  >
                    {t(`language.options.${itemLocale}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="shellSettingsSection" role="group" aria-label={t("theme.label")}>
              <div className="chipLabel">{t("theme.label")}</div>
              <ThemeControl />
            </div>

            <div className="shellSettingsSection releaseUpdateRail" role="group" aria-label={t("releaseUpdate.label")}>
              <div className="chipLabel">{t("releaseUpdate.label")}</div>
              <ReleaseUpdateControl demo={demo} />
            </div>

            <div className="shellSettingsSection" role="group" aria-label={t("onboarding.replayLabel")}>
              <div>
                <div className="chipLabel">{t("onboarding.replayLabel")}</div>
                <div className="shellSettingsHint">{t("onboarding.replayHint")}</div>
              </div>
              <button type="button" className="chip ghost" onClick={onOpenOnboarding}>
                {t("onboarding.replay")}
              </button>
            </div>

            <div className="shellHeaderMeta">
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
        </details>
      </div>
    </header>
  );
}
