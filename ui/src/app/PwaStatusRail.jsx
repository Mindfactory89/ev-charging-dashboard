import { useI18n } from "../i18n/I18nProvider.jsx";

function ConnectionIcon({ type }) {
  if (type === "update") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 7v5h-5" />
        <path d="M18.5 16a8 8 0 1 1 .4-8.4L20 12" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.9 9.9a10.2 10.2 0 0 1 14.2 0M8 13a5.8 5.8 0 0 1 8 0M11.1 16.1a1.3 1.3 0 0 1 1.8 0" />
      <path d="M4 4 20 20" />
    </svg>
  );
}

export default function PwaStatusRail({ online = true, updateAvailable = false, onApplyUpdate }) {
  const { t } = useI18n();
  if (online && !updateAvailable) return null;

  return (
    <div className="pwaStatusStack" aria-live="polite">
      {!online ? (
        <div className="pwaStatusRail pwaStatusOffline" role="status">
          <ConnectionIcon type="offline" />
          <div>
            <strong>{t("pwa.offline.title")}</strong>
            <span>{t("pwa.offline.text")}</span>
          </div>
        </div>
      ) : null}

      {updateAvailable ? (
        <div className="pwaStatusRail pwaStatusUpdate" role="status">
          <ConnectionIcon type="update" />
          <div>
            <strong>{t("pwa.update.title")}</strong>
            <span>{t("pwa.update.text")}</span>
          </div>
          <button type="button" className="pill" onClick={onApplyUpdate}>
            {t("pwa.update.action")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
