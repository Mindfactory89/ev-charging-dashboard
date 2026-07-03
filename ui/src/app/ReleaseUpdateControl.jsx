import { useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { checkReleaseUpdate, installReleaseUpdate } from "../ui/api.js";

function formatReleaseDate(value, locale) {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}

export default function ReleaseUpdateControl({ demo = false }) {
  const { locale, t } = useI18n();
  const [status, setStatus] = useState("idle");
  const [releaseStatus, setReleaseStatus] = useState(null);
  const [message, setMessage] = useState("");

  const latest = releaseStatus?.latest || null;
  const updateAvailable = releaseStatus?.updateAvailable === true;
  const updateUnknown = releaseStatus?.updateAvailable == null && Boolean(latest);
  const installEnabled = Boolean(releaseStatus?.installEnabled);
  const installToken = releaseStatus?.installAuthorization?.token || "";
  const installReady = installEnabled && Boolean(installToken);
  const publishedDate = useMemo(() => formatReleaseDate(latest?.publishedAt, locale), [latest?.publishedAt, locale]);

  async function handleCheck() {
    if (demo) return;

    setStatus("checking");
    setMessage("");

    try {
      const data = await checkReleaseUpdate();
      setReleaseStatus(data);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(error?.message || t("releaseUpdate.error"));
    }
  }

  async function handleInstall() {
    if (!latest?.tagName || !installReady) return;

    setStatus("installing");
    setMessage("");

    try {
      const data = await installReleaseUpdate(latest.tagName, installToken);
      setStatus("installStarted");
      setMessage(t("releaseUpdate.installStarted", { version: data?.latest?.tagName || latest.tagName }));
    } catch (error) {
      setStatus("ready");
      setMessage(error?.message || t("releaseUpdate.installError"));
    }
  }

  const buttonLabel = status === "checking" ? t("releaseUpdate.checking") : t("releaseUpdate.button");
  const panelTitle = updateAvailable
    ? t("releaseUpdate.availableTitle", { version: latest?.tagName || "" })
    : updateUnknown
      ? t("releaseUpdate.unknownTitle")
    : t("releaseUpdate.currentTitle");

  return (
    <div className="releaseUpdateControl">
      <button
        type="button"
        className={updateAvailable ? "chip releaseUpdateButton attention" : "chip ghost releaseUpdateButton"}
        onClick={handleCheck}
        disabled={demo || status === "checking" || status === "installing"}
        aria-busy={status === "checking" || status === "installing" ? "true" : "false"}
      >
        {buttonLabel}
      </button>

      {status !== "idle" ? (
        <div className="releaseUpdatePanel" role="status" aria-live="polite">
          <div className="releaseUpdatePanelHead">
            <div>
              <div className="releaseUpdateEyebrow">{t("releaseUpdate.eyebrow")}</div>
              <div className="releaseUpdateTitle">
                {status === "checking" ? t("releaseUpdate.checkingTitle") : panelTitle}
              </div>
            </div>
            <button
              type="button"
              className="releaseUpdateClose"
              onClick={() => setStatus("idle")}
              aria-label={t("common.close")}
            >
              x
            </button>
          </div>

          {status === "error" ? <p className="releaseUpdateText">{message || t("releaseUpdate.error")}</p> : null}

          {status !== "error" && latest ? (
            <>
              <p className="releaseUpdateText">
                {updateAvailable
                  ? t("releaseUpdate.availableText", {
                      current: releaseStatus?.current?.version || t("releaseUpdate.unknownVersion"),
                      latest: latest.tagName,
                    })
                  : updateUnknown
                    ? t("releaseUpdate.unknownText", { latest: latest.tagName })
                  : t("releaseUpdate.currentText", {
                      current: releaseStatus?.current?.version || latest.tagName,
                    })}
              </p>

              <div className="releaseUpdateMeta">
                {publishedDate ? <span>{t("releaseUpdate.published", { date: publishedDate })}</span> : null}
                {releaseStatus?.current?.commit ? <span>{releaseStatus.current.commit}</span> : null}
              </div>

              {message ? <p className="releaseUpdateText strong">{message}</p> : null}

              <div className="releaseUpdateActions">
                {latest.htmlUrl ? (
                  <a className="chip ghost releaseUpdateLink" href={latest.htmlUrl} target="_blank" rel="noreferrer">
                    {t("releaseUpdate.openRelease")}
                  </a>
                ) : null}
                {updateAvailable ? (
                  <>
                    <button
                      type="button"
                      className="chip releaseUpdateInstall"
                      onClick={handleInstall}
                      disabled={!installReady || status === "installing"}
                      title={!installReady ? t("releaseUpdate.installDisabled") : undefined}
                    >
                      {status === "installing" ? t("releaseUpdate.installing") : t("releaseUpdate.install")}
                    </button>
                    <button type="button" className="chip ghost" onClick={() => setStatus("idle")}>
                      {t("releaseUpdate.later")}
                    </button>
                  </>
                ) : null}
              </div>

              {updateAvailable && !installReady ? (
                <p className="releaseUpdateHint">{t("releaseUpdate.installDisabled")}</p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
