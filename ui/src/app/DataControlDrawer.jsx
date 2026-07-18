import React from "react";
import {
  DATA_PREFERENCES_MAX_BYTES,
  analyzeLocalPreferencesBackup,
  getLocalPreferenceInventory,
  restoreLocalPreferencesBackup,
  serializeLocalPreferencesBackup,
} from "../config/dataPreferences.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { downloadTextFile } from "../platform/download.js";
import { confirmAction } from "../platform/runtime.js";

function DataIcon({ type = "data" }) {
  if (type === "download") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" /></svg>;
  }
  if (type === "backup") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h8l3 3v13H7z" /><path d="M10 4v5h5V4M10 16h5" /></svg>;
  }
  if (type === "restore") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V9m0 0 4 4m-4-4-4 4M5 4h14" /></svg>;
  }
  if (type === "shield") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.8 7.8 7 10 4.2-2.2 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

export default function DataControlDrawer({
  demo = false,
  onClose,
  onDownloadAllSessions,
  onDownloadMonthly,
  onDownloadSeasons,
  onDownloadYearSessions,
  onPreferencesRestored,
  open,
  sessionsCount = 0,
  year,
}) {
  const { t } = useI18n();
  const panelRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const [busyAction, setBusyAction] = React.useState("");
  const [message, setMessage] = React.useState(null);
  const [restoreText, setRestoreText] = React.useState("");
  const [restoreAnalysis, setRestoreAnalysis] = React.useState(null);
  const [inventory, setInventory] = React.useState([]);

  React.useEffect(() => {
    if (!open) return;
    setMessage(null);
    setRestoreText("");
    setRestoreAnalysis(null);
    setInventory(getLocalPreferenceInventory());
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => panelRef.current?.focus?.(), 40);

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, [onClose, open]);

  if (!open) return null;

  async function runDownload(actionId, action) {
    if (busyAction) return;
    setBusyAction(actionId);
    setMessage(null);
    try {
      const completed = await action?.();
      if (completed !== false) setMessage({ tone: "success", text: t("dataControl.feedback.downloaded") });
    } catch (error) {
      setMessage({ tone: "error", text: t("dataControl.feedback.downloadError", { error: String(error?.message || error) }) });
    } finally {
      setBusyAction("");
    }
  }

  function exportPreferences() {
    const stamp = new Date().toISOString().slice(0, 10);
    return runDownload("preferences", () => downloadTextFile(serializeLocalPreferencesBackup(), {
      fileName: `mobility-preferences-${stamp}.json`,
      title: t("dataControl.preferences.backupTitle"),
      type: "application/json;charset=utf-8",
    }));
  }

  async function selectBackupFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setRestoreText("");
    setRestoreAnalysis(null);
    if (!file) return;
    if (file.size > DATA_PREFERENCES_MAX_BYTES) {
      setMessage({ tone: "error", text: t("dataControl.restore.errors.size") });
      return;
    }
    try {
      const text = await file.text();
      const analysis = analyzeLocalPreferencesBackup(text);
      if (!analysis.valid) {
        setMessage({ tone: "error", text: t(`dataControl.restore.errors.${analysis.error}`) });
        return;
      }
      setRestoreText(text);
      setRestoreAnalysis(analysis);
      setMessage({ tone: "info", text: t("dataControl.restore.ready", { count: analysis.items.length }) });
    } catch {
      setMessage({ tone: "error", text: t("dataControl.restore.errors.read") });
    }
  }

  async function restorePreferences() {
    if (!restoreText || !restoreAnalysis?.valid) return;
    const confirmed = await confirmAction(t("dataControl.restore.confirmText"), {
      title: t("dataControl.restore.confirmTitle"),
      confirmLabel: t("dataControl.restore.confirmAction"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;
    const result = restoreLocalPreferencesBackup(restoreText);
    if (!result.valid) {
      setMessage({ tone: "error", text: t(`dataControl.restore.errors.${result.error}`) });
      return;
    }
    setMessage({ tone: "success", text: t("dataControl.restore.done") });
    window.setTimeout(() => onPreferencesRestored?.(), 500);
  }

  const exportActions = [
    {
      id: "year",
      title: t("dataControl.exports.yearTitle", { year }),
      text: t("dataControl.exports.yearText", { count: sessionsCount }),
      action: onDownloadYearSessions,
    },
    {
      id: "all",
      title: t("dataControl.exports.allTitle"),
      text: t("dataControl.exports.allText"),
      action: onDownloadAllSessions,
    },
    {
      id: "monthly",
      title: t("dataControl.exports.monthlyTitle", { year }),
      text: t("dataControl.exports.monthlyText"),
      action: onDownloadMonthly,
    },
    {
      id: "seasons",
      title: t("dataControl.exports.seasonsTitle", { year }),
      text: t("dataControl.exports.seasonsText"),
      action: onDownloadSeasons,
    },
  ];

  return (
    <div className="dataControlOverlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <aside
        className="dataControlDrawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-control-title"
        aria-describedby="data-control-description"
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="dataControlHeader">
          <div className="dataControlIdentity">
            <span className="dataControlGlyph"><DataIcon /></span>
            <div>
              <div className="sectionKicker">{t("dataControl.drawer.kicker")}</div>
              <h2 id="data-control-title">{t("dataControl.drawer.title")}</h2>
              <p id="data-control-description">{t("dataControl.drawer.text")}</p>
            </div>
          </div>
          <button type="button" className="dataControlClose" onClick={onClose} aria-label={t("dataControl.drawer.close")}>
            <CloseIcon />
          </button>
        </header>

        <div className="dataControlContent">
          <section className="dataControlTrust" aria-labelledby="data-control-trust-title">
            <span className="dataControlTrustIcon"><DataIcon type="shield" /></span>
            <div>
              <div className="sectionKicker">{t("dataControl.trust.kicker")}</div>
              <h3 id="data-control-trust-title">{t("dataControl.trust.title")}</h3>
              <p>{t("dataControl.trust.text")}</p>
            </div>
          </section>

          <div className="dataControlSourceGrid">
            <article>
              <span>{t("dataControl.sources.serverLabel")}</span>
              <strong>{t("dataControl.sources.serverTitle")}</strong>
              <p>{t("dataControl.sources.serverText")}</p>
            </article>
            <article>
              <span>{t("dataControl.sources.browserLabel")}</span>
              <strong>{t("dataControl.sources.browserTitle")}</strong>
              <p>{t("dataControl.sources.browserText")}</p>
            </article>
          </div>

          <section className="dataControlSection" aria-labelledby="data-control-exports-title">
            <div className="dataControlSectionHeader">
              <div>
                <div className="sectionKicker">{t("dataControl.exports.kicker")}</div>
                <h3 id="data-control-exports-title">{t("dataControl.exports.title")}</h3>
                <p>{t("dataControl.exports.text")}</p>
              </div>
              <span className="dataControlScope">{year}</span>
            </div>

            {demo ? <div className="dataControlNotice">{t("dataControl.exports.demo")}</div> : null}

            <div className="dataControlActionGrid">
              {exportActions.map((item) => (
                <article className="dataControlAction" key={item.id}>
                  <span className="dataControlActionIcon"><DataIcon type="download" /></span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                  <button
                    type="button"
                    className="pill ghostPill"
                    disabled={demo || Boolean(busyAction)}
                    onClick={() => runDownload(item.id, item.action)}
                  >
                    {busyAction === item.id ? t("dataControl.exports.busy") : t("dataControl.exports.action")}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="dataControlSection" aria-labelledby="data-control-preferences-title">
            <div className="dataControlSectionHeader">
              <div>
                <div className="sectionKicker">{t("dataControl.preferences.kicker")}</div>
                <h3 id="data-control-preferences-title">{t("dataControl.preferences.title")}</h3>
                <p>{t("dataControl.preferences.text")}</p>
              </div>
            </div>

            <div className="dataControlInventory" aria-label={t("dataControl.preferences.inventoryLabel")}>
              {inventory.map((item) => (
                <div className={item.present ? "isPresent" : ""} key={item.id}>
                  <span aria-hidden="true">{item.present ? "✓" : "–"}</span>
                  <strong>{t(`dataControl.preferences.items.${item.id}`)}</strong>
                  <small>{item.present
                    ? t("dataControl.preferences.itemCount", { count: item.itemCount })
                    : t("dataControl.preferences.notConfigured")}</small>
                </div>
              ))}
            </div>

            <div className="dataControlPreferenceActions">
              <article>
                <span className="dataControlActionIcon"><DataIcon type="backup" /></span>
                <div>
                  <strong>{t("dataControl.preferences.backupTitle")}</strong>
                  <p>{t("dataControl.preferences.backupText")}</p>
                </div>
                <button type="button" className="btnPrimary" onClick={exportPreferences} disabled={Boolean(busyAction)}>
                  {busyAction === "preferences" ? t("dataControl.exports.busy") : t("dataControl.preferences.backupAction")}
                </button>
              </article>

              <article>
                <span className="dataControlActionIcon"><DataIcon type="restore" /></span>
                <div>
                  <strong>{t("dataControl.restore.title")}</strong>
                  <p>{t("dataControl.restore.text")}</p>
                </div>
                <input
                  ref={fileInputRef}
                  className="srOnly"
                  type="file"
                  accept="application/json,.json"
                  onChange={selectBackupFile}
                  aria-hidden="true"
                  tabIndex={-1}
                />
                <button type="button" className="pill ghostPill" onClick={() => fileInputRef.current?.click?.()}>
                  {t("dataControl.restore.select")}
                </button>
              </article>
            </div>

            {restoreAnalysis?.valid ? (
              <div className="dataControlRestorePreview">
                <div>
                  <strong>{t("dataControl.restore.previewTitle")}</strong>
                  <span>{t("dataControl.restore.previewText", { count: restoreAnalysis.items.length })}</span>
                </div>
                <div className="dataControlRestoreTags">
                  {restoreAnalysis.items.map((item) => (
                    <span key={item}>{t(`dataControl.restore.items.${item}`)}</span>
                  ))}
                </div>
                <button type="button" className="btnPrimary" onClick={restorePreferences}>
                  {t("dataControl.restore.apply")}
                </button>
              </div>
            ) : null}
          </section>

          {message ? <div className={`dataControlMessage ${message.tone}`} role="status" aria-live="polite">{message.text}</div> : null}

          <footer className="dataControlFooter">
            <span>{t("dataControl.footer")}</span>
            <button type="button" className="pill ghostPill" onClick={onClose}>{t("common.close")}</button>
          </footer>
        </div>
      </aside>
    </div>
  );
}
