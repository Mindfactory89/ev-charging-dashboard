import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { num } from "../app/formatters.js";
import { createSession } from "./api.js";
import { getImportProfiles } from "./importProfiles.js";
import { buildImportPreview } from "./sessionImport.js";

function missingFieldLabel(field, t) {
  const key = String(field || "").trim();

  const labels = {
    date: t("common.date"),
    provider: t("common.provider"),
    location: t("common.location"),
    vehicle: t("common.vehicle"),
    tags: t("common.tags"),
    connector: t("common.connector"),
    soc_start: t("addSession.fields.socStart"),
    soc_end: t("addSession.fields.socEnd"),
    energy_kwh: t("addSession.fields.energy"),
    price_per_kwh: t("addSession.fields.pricePerKwh"),
    total_cost: t("common.cost"),
    duration: t("common.duration"),
    duration_seconds: t("common.duration"),
    duration_hhmm: t("common.duration"),
    odometer_km: t("addSession.fields.odometer"),
    note: t("common.note"),
  };

  return labels[key] || key;
}

export default function ImportSessionsCard({ onImported, sessions = [] }) {
  const { locale, t } = useI18n();
  const availableProfiles = React.useMemo(() => getImportProfiles(), [locale]);
  const [fileName, setFileName] = React.useState("");
  const [sourceText, setSourceText] = React.useState("");
  const [profileId, setProfileId] = React.useState("generic");
  const [preview, setPreview] = React.useState(null);
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!sourceText) return;
    setPreview(buildImportPreview(sourceText, sessions, { profileId }));
  }, [locale, profileId, sessions, sourceText]);

  async function onFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setFileName(file.name);
    setSourceText(text);
    const nextPreview = buildImportPreview(text, sessions);
    setProfileId(nextPreview?.profile?.activeId || "generic");
    setPreview(nextPreview);
    setMessage("");
  }

  function onProfileChange(nextProfileId) {
    setProfileId(nextProfileId);
    if (!sourceText) return;
    setPreview(buildImportPreview(sourceText, sessions, { profileId: nextProfileId }));
  }

  async function runImport() {
    const rows = (preview?.rows || []).filter((row) => row.ready);
    if (!rows.length) {
      setMessage(t("importSessions.messages.noRows"));
      return;
    }

    setBusy(true);
    setMessage("");
    let imported = 0;

    try {
      for (const row of rows) {
        await createSession(row.payload);
        imported += 1;
      }
      setMessage(t("importSessions.messages.imported", { count: imported }));
      await onImported?.();
    } catch (error) {
      setMessage(
        t("importSessions.messages.aborted", {
          count: imported,
          error: String(error?.message || error),
        })
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card glassStrong formCard">
      <div className="sectionHeader">
        <div>
          <div className="sectionKicker">{t("importSessions.kicker")}</div>
          <div className="sectionTitle">{t("importSessions.title")}</div>
        </div>
        <div className="pill ghostPill">{fileName || t("importSessions.noFile")}</div>
      </div>

      <div className="formGrid">
        <label className="field fieldWide">
          <span>{t("importSessions.fileLabel")}</span>
          <input className="input" type="file" accept=".csv,text/csv" onChange={onFileSelected} />
        </label>

        <label className="field">
          <span>{t("importSessions.profileLabel")}</span>
          <select className="input" value={profileId} onChange={(event) => onProfileChange(event.target.value)}>
            {(preview?.availableProfiles || availableProfiles).map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {preview ? (
        <>
          <div className="sessionImportProfileBar">
            <div className="sessionImportProfileCopy">
              <div className="summaryLabel">{t("importSessions.activeProfile")}</div>
              <div className="summaryValue">{preview.profile.activeLabel}</div>
              <div className="summarySub">{preview.profile.activeDescription}</div>
            </div>
            <div className="pill ghostPill">{t("importSessions.detected", { label: preview.profile.detectedLabel })}</div>
          </div>

          <div className="summaryGrid">
            <div className="summaryCard warm">
              <div className="summaryLabel">{t("importSessions.summary.total")}</div>
              <div className="summaryValue">{num(preview.summary.total, 0)}</div>
              <div className="summarySub">{t("importSessions.summary.totalSub")}</div>
            </div>
            <div className="summaryCard mint">
              <div className="summaryLabel">{t("importSessions.summary.ready")}</div>
              <div className="summaryValue">{num(preview.summary.ready, 0)}</div>
              <div className="summarySub">{t("importSessions.summary.readySub")}</div>
            </div>
            <div className="summaryCard frost">
              <div className="summaryLabel">{t("importSessions.summary.duplicates")}</div>
              <div className="summaryValue">{num(preview.summary.duplicates, 0)}</div>
              <div className="summarySub">{t("importSessions.summary.duplicatesSub")}</div>
            </div>
            <div className="summaryCard">
              <div className="summaryLabel">{t("importSessions.summary.invalid")}</div>
              <div className="summaryValue">{num(preview.summary.invalid, 0)}</div>
              <div className="summarySub">{t("importSessions.summary.invalidSub")}</div>
            </div>
          </div>

          <div className="tableWrap" style={{ marginTop: 16 }}>
            <div className="tableHead">
              <div>{t("importSessions.table.line")}</div>
              <div>{t("importSessions.table.date")}</div>
              <div>{t("importSessions.table.provider")}</div>
              <div>{t("importSessions.table.locationVehicle")}</div>
              <div>{t("importSessions.table.energy")}</div>
              <div>{t("importSessions.table.status")}</div>
            </div>

            <div className="tableBody tableBodyScroll">
              {preview.rows.slice(0, 12).map((row) => (
                <div key={`preview-${row.index}`} className="tableRow">
                  <div className="tablePrimary">#{row.index}</div>
                  <div>{row.payload.date || "–"}</div>
                  <div>{row.payload.provider || "–"}</div>
                  <div>
                    <div className="tablePrimary">{row.payload.location || "–"}</div>
                    <div className="tableSecondary">{row.payload.vehicle || "–"}</div>
                  </div>
                  <div>{row.payload.energy_kwh != null ? `${num(row.payload.energy_kwh, 1)} kWh` : "–"}</div>
                  <div>
                    {row.ready
                      ? t("importSessions.status.ready")
                      : row.missing.length
                        ? t("importSessions.status.missing", {
                            fields: row.missing.map((field) => missingFieldLabel(field, t)).join(", "),
                          })
                      : row.duplicateExisting
                        ? t("importSessions.status.duplicateHistory")
                      : row.duplicateImport
                          ? t("importSessions.status.duplicateCsv")
                          : t("importSessions.status.review")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="tableEditActions" style={{ marginTop: 16 }}>
            <div className="formHint">{t("importSessions.hint")}</div>
            <button type="button" className="pill pillWarm" onClick={runImport} disabled={busy || preview.summary.ready === 0}>
              {busy ? t("importSessions.runBusy") : t("importSessions.runAction", { count: num(preview.summary.ready, 0) })}
            </button>
          </div>
        </>
      ) : null}

      {message ? <div className="formMsg">{message}</div> : null}
    </div>
  );
}
