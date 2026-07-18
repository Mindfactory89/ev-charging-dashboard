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
  chargingGoalCount = 0,
  chargingProfile,
  onOpenChargingGoals,
  onOpenChargingProfiles,
  onOpenDataControl,
  onOpenNotifications,
  onOpenQuickAccess,
  onSelectYear,
  onOpenOnboarding,
  onOpenVehicleProfiles,
  vehicleProfile,
  vehicleProfiles = [],
  vehicleScopeId = "all",
  onSelectVehicleScope,
  notificationUnreadCount = 0,
  pwaState = {},
  onInstallPwa,
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
        <div className="shellUtilityButtons">
          <button
            type="button"
            className="shellQuickAccessButton"
            onClick={onOpenQuickAccess}
            aria-label={t("quickAccess.open")}
            title={t("quickAccess.openHintFull")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <kbd aria-hidden="true">⌘K</kbd>
          </button>
          <button
            type="button"
            className="shellNotificationButton"
            onClick={onOpenNotifications}
            aria-label={notificationUnreadCount
              ? t("notifications.openUnread", { count: notificationUnreadCount })
              : t("notifications.open")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 17h12l-1.4-2.1V10a4.6 4.6 0 0 0-9.2 0v4.9L6 17Z" />
              <path d="M10 20h4" />
            </svg>
            {notificationUnreadCount ? <span>{notificationUnreadCount > 9 ? "9+" : notificationUnreadCount}</span> : null}
          </button>
        </div>
        <label className="shellVehicleControl">
          <span>{t("vehicleScope.label")}</span>
          <select
            value={vehicleScopeId}
            onChange={(event) => onSelectVehicleScope?.(event.target.value)}
            aria-label={t("vehicleScope.label")}
          >
            <option value="all">{t("vehicleScope.all")}</option>
            {vehicleProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name}</option>
            ))}
          </select>
        </label>
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

            <div className="shellSettingsSection" role="group" aria-label={t("vehicleProfiles.settings.label")}>
              <div className="vehicleSettingsCopy">
                <div className="chipLabel">{t("vehicleProfiles.settings.label")}</div>
                <div className="shellSettingsHint">{t("vehicleProfiles.settings.active", { name: vehicleProfile?.name || t("hero.vehicle") })}</div>
              </div>
              <button type="button" className="chip ghost" onClick={onOpenVehicleProfiles}>
                {t("vehicleProfiles.settings.action")}
              </button>
            </div>

            <div className="shellSettingsSection" role="group" aria-label={t("chargingGoals.settings.label")}>
              <div className="vehicleSettingsCopy">
                <div className="chipLabel">{t("chargingGoals.settings.label")}</div>
                <div className="shellSettingsHint">{chargingGoalCount
                  ? t("chargingGoals.settings.active", { count: chargingGoalCount })
                  : t("chargingGoals.settings.empty")}</div>
              </div>
              <button type="button" className="chip ghost" onClick={onOpenChargingGoals}>
                {t("chargingGoals.settings.action")}
              </button>
            </div>

            <div className="shellSettingsSection" role="group" aria-label={t("chargingProfiles.settings.label")}>
              <div className="vehicleSettingsCopy">
                <div className="chipLabel">{t("chargingProfiles.settings.label")}</div>
                <div className="shellSettingsHint">{chargingProfile
                  ? t("chargingProfiles.settings.active", { name: chargingProfile.name })
                  : t("chargingProfiles.settings.empty")}</div>
              </div>
              <button type="button" className="chip ghost" onClick={onOpenChargingProfiles}>
                {t("chargingProfiles.settings.action")}
              </button>
            </div>

            <div className="shellSettingsSection" role="group" aria-label={t("dataControl.settings.label")}>
              <div className="vehicleSettingsCopy">
                <div className="chipLabel">{t("dataControl.settings.label")}</div>
                <div className="shellSettingsHint">{t("dataControl.settings.hint")}</div>
              </div>
              <button type="button" className="chip ghost" onClick={onOpenDataControl}>
                {t("dataControl.settings.action")}
              </button>
            </div>

            <div className="shellSettingsSection" role="group" aria-label={t("pwa.settings.label")}>
              <div className="vehicleSettingsCopy">
                <div className="chipLabel">{t("pwa.settings.label")}</div>
                <div className={`pwaSettingsStatus ${pwaState.installed ? "installed" : pwaState.online ? "online" : "offline"}`}>
                  {pwaState.installed
                    ? t("pwa.settings.installed")
                    : pwaState.online
                      ? t("pwa.settings.ready")
                      : t("pwa.settings.offline")}
                </div>
                <div className="shellSettingsHint">{pwaState.installed
                  ? t("pwa.settings.installedHint")
                  : pwaState.installAvailable
                    ? t("pwa.settings.installHint")
                    : t("pwa.settings.browserHint")}</div>
              </div>
              {pwaState.installAvailable && !pwaState.installed ? (
                <button type="button" className="chip ghost" onClick={onInstallPwa}>
                  {t("pwa.settings.install")}
                </button>
              ) : null}
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
