import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { num } from "../app/formatters.js";
import { createSession } from "./api.js";
import { getImportProfiles } from "./importProfiles.js";
import { buildImportPreview } from "./sessionImport.js";

const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15.5v3A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </svg>
  );
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>;
}

function missingFieldLabel(field, t) {
  const labels = {
    date: t("common.date"),
    soc_start: t("addSession.fields.socStart"),
    soc_end: t("addSession.fields.socEnd"),
    energy_kwh: t("addSession.fields.energy"),
    price_per_kwh: t("addSession.fields.pricePerKwh"),
  };
  return labels[String(field || "").trim()] || field;
}

function rowStatus(row, t) {
  if (row.ready) return { tone: "ready", label: t("importSessions.status.ready") };
  if (row.missing.length) {
    return {
      tone: "invalid",
      label: t("importSessions.status.missing", {
        fields: row.missing.map((field) => missingFieldLabel(field, t)).join(", "),
      }),
    };
  }
  if (row.duplicateExisting) return { tone: "duplicate", label: t("importSessions.status.duplicateHistory") };
  if (row.duplicateImport) return { tone: "duplicate", label: t("importSessions.status.duplicateCsv") };
  return { tone: "invalid", label: t("importSessions.status.review") };
}

export default function ImportSessionsCard({ onImported, sessions = [] }) {
  const { locale, t } = useI18n();
  const inputRef = React.useRef(null);
  const availableProfiles = React.useMemo(() => getImportProfiles(), [locale]);
  const [fileName, setFileName] = React.useState("");
  const [sourceText, setSourceText] = React.useState("");
  const [profileId, setProfileId] = React.useState("generic");
  const [fallbacks, setFallbacks] = React.useState({ soc_start: 10, soc_end: 80, vehicle: "CUPRA Born 79 kWh" });
  const [preview, setPreview] = React.useState(null);
  const [filter, setFilter] = React.useState("all");
  const [fileError, setFileError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ current: 0, total: 0 });
  const [result, setResult] = React.useState(null);

  React.useEffect(() => {
    if (!sourceText) return;
    setPreview(buildImportPreview(sourceText, sessions, { profileId, fallbacks }));
  }, [fallbacks, locale, profileId, sessions, sourceText]);

  const visibleRows = React.useMemo(() => {
    const rows = preview?.rows || [];
    if (filter === "ready") return rows.filter((row) => row.ready);
    if (filter === "duplicates") return rows.filter((row) => row.duplicateExisting || row.duplicateImport);
    if (filter === "invalid") return rows.filter((row) => row.missing.length > 0);
    return rows;
  }, [filter, preview?.rows]);

  async function acceptFile(file) {
    setFileError("");
    setResult(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && !String(file.type || "").includes("csv")) {
      setFileError(t("importSessions.validation.type"));
      return;
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setFileError(t("importSessions.validation.size"));
      return;
    }

    const text = await file.text();
    if (!text.trim()) {
      setFileError(t("importSessions.validation.empty"));
      return;
    }
    const nextPreview = buildImportPreview(text, sessions, { fallbacks });
    if (!nextPreview.headers.length || !nextPreview.rows.length) {
      setFileError(t("importSessions.validation.structure"));
      return;
    }
    setFileName(file.name);
    setSourceText(text);
    setProfileId(nextPreview.profile.activeId || "generic");
    setPreview(nextPreview);
    setFilter("all");
  }

  function resetImport() {
    setFileName("");
    setSourceText("");
    setPreview(null);
    setFileError("");
    setResult(null);
    setProgress({ current: 0, total: 0 });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function runImport() {
    const rows = (preview?.rows || []).filter((row) => row.ready);
    if (!rows.length) {
      setFileError(t("importSessions.messages.noRows"));
      return;
    }

    setBusy(true);
    setResult(null);
    setProgress({ current: 0, total: rows.length });
    const failures = [];
    let imported = 0;

    for (const row of rows) {
      try {
        await createSession(row.payload);
        imported += 1;
      } catch (error) {
        failures.push({ index: row.index, error: String(error?.message || error) });
      }
      setProgress({ current: imported + failures.length, total: rows.length });
    }

    setBusy(false);
    setResult({ imported, failures, total: rows.length });
    if (imported) await onImported?.();
  }

  const activeStep = result ? 3 : preview ? 2 : 1;
  const progressPercent = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="card glassStrong importWorkflowCard">
      <header className="importWorkflowHeader">
        <div>
          <div className="sectionKicker">{t("importSessions.kicker")}</div>
          <h3 className="sectionTitle">{t("importSessions.title")}</h3>
          <p>{t("importSessions.intro")}</p>
        </div>
        {fileName ? <button type="button" className="pill ghostPill" onClick={resetImport}>{t("importSessions.reset")}</button> : null}
      </header>

      <ol className="importSteps" aria-label={t("importSessions.steps.label")}>
        {["file", "review", "finish"].map((step, index) => {
          const number = index + 1;
          const complete = activeStep > number;
          const active = activeStep === number;
          return (
            <li key={step} className={`${complete ? "complete" : ""} ${active ? "active" : ""}`} aria-current={active ? "step" : undefined}>
              <span>{complete ? <CheckIcon /> : number}</span>
              <div><strong>{t(`importSessions.steps.${step}.title`)}</strong><small>{t(`importSessions.steps.${step}.text`)}</small></div>
            </li>
          );
        })}
      </ol>

      <section className="importFileStage" aria-labelledby="import-file-title">
        <div className="importStageHeading">
          <div><span>{t("importSessions.steps.file.badge")}</span><h4 id="import-file-title">{t("importSessions.fileTitle")}</h4></div>
          <small>{t("importSessions.fileMeta")}</small>
        </div>
        <label
          className={`importDropzone ${fileError ? "hasError" : ""}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); acceptFile(event.dataTransfer.files?.[0]); }}
        >
          <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={(event) => acceptFile(event.target.files?.[0])} />
          <span className="importDropzoneIcon"><UploadIcon /></span>
          <strong>{fileName || t("importSessions.dropzone.title")}</strong>
          <small>{fileName ? t("importSessions.dropzone.replace") : t("importSessions.dropzone.text")}</small>
          <span className="pill ghostPill">{t("importSessions.dropzone.action")}</span>
        </label>
        {fileError ? <div className="importInlineError" role="alert"><strong>{t("importSessions.validation.title")}</strong><span>{fileError}</span></div> : null}
      </section>

      {preview ? (
        <section className="importReviewStage" aria-labelledby="import-review-title">
          <div className="importStageHeading">
            <div><span>{t("importSessions.steps.review.badge")}</span><h4 id="import-review-title">{t("importSessions.reviewTitle")}</h4></div>
            <small>{t("importSessions.detected", { label: preview.profile.detectedLabel })}</small>
          </div>

          <div className="importConfiguration">
            <label><span>{t("importSessions.profileLabel")}</span><select className="input" value={profileId} onChange={(event) => setProfileId(event.target.value)}>{(preview.availableProfiles || availableProfiles).map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select><small>{preview.profile.activeDescription}</small></label>
            <label><span>{t("importSessions.fallbacks.socStart")}</span><input className="input" type="number" min="0" max="100" value={fallbacks.soc_start} onChange={(event) => setFallbacks((current) => ({ ...current, soc_start: Number(event.target.value) }))} /></label>
            <label><span>{t("importSessions.fallbacks.socEnd")}</span><input className="input" type="number" min="0" max="100" value={fallbacks.soc_end} onChange={(event) => setFallbacks((current) => ({ ...current, soc_end: Number(event.target.value) }))} /></label>
            <label><span>{t("importSessions.fallbacks.vehicle")}</span><input className="input" value={fallbacks.vehicle} onChange={(event) => setFallbacks((current) => ({ ...current, vehicle: event.target.value }))} /></label>
          </div>

          <div className="importSummaryGrid">
            {["total", "ready", "duplicates", "invalid"].map((key) => (
              <button key={key} type="button" className={`importSummaryCard ${key} ${filter === key || (key === "total" && filter === "all") ? "active" : ""}`} onClick={() => setFilter(key === "total" ? "all" : key)} aria-pressed={filter === key || (key === "total" && filter === "all")}>
                <span>{t(`importSessions.summary.${key}`)}</span><strong>{num(preview.summary[key], 0)}</strong><small>{t(`importSessions.summary.${key}Sub`)}</small>
              </button>
            ))}
          </div>

          <div className="importPreviewList" aria-live="polite">
            <div className="importPreviewHeader"><strong>{t("importSessions.previewTitle")}</strong><span>{t("importSessions.previewCount", { visible: Math.min(visibleRows.length, 20), total: visibleRows.length })}</span></div>
            {visibleRows.slice(0, 20).map((row) => {
              const status = rowStatus(row, t);
              return (
                <article key={`preview-${row.index}`} className={`importPreviewRow ${status.tone}`}>
                  <div className="importRowNumber">#{row.index}</div>
                  <div className="importRowMain"><strong>{row.payload.date || t("common.noValues")}</strong><span>{[row.payload.provider, row.payload.location].filter(Boolean).join(" · ") || t("importSessions.noContext")}</span></div>
                  <div className="importRowMetric"><strong>{row.payload.energy_kwh != null ? `${num(row.payload.energy_kwh, 1)} kWh` : "–"}</strong><span>{row.payload.vehicle || fallbacks.vehicle}</span></div>
                  <div className={`importRowStatus ${status.tone}`}><span aria-hidden="true" />{status.label}</div>
                </article>
              );
            })}
            {!visibleRows.length ? <div className="importEmptyFilter">{t("importSessions.emptyFilter")}</div> : null}
          </div>

          <div className="importReviewActions">
            <div><strong>{t("importSessions.actionTitle", { count: num(preview.summary.ready, 0) })}</strong><span>{t("importSessions.hint")}</span></div>
            <button type="button" className="pill pillWarm" onClick={runImport} disabled={busy || preview.summary.ready === 0}>{busy ? t("importSessions.runBusy") : t("importSessions.runAction", { count: num(preview.summary.ready, 0) })}</button>
          </div>
        </section>
      ) : null}

      {busy ? (
        <section className="importProgress" role="status" aria-live="polite">
          <div><strong>{t("importSessions.progress.title")}</strong><span>{t("importSessions.progress.text", { current: progress.current, total: progress.total })}</span></div>
          <div className="importProgressTrack" aria-hidden="true"><span style={{ transform: `scaleX(${progressPercent / 100})` }} /></div>
          <b>{progressPercent}%</b>
        </section>
      ) : null}

      {result ? (
        <section className={`importResult ${result.failures.length ? "partial" : "success"}`} role="status" aria-live="polite">
          <span className="importResultIcon"><CheckIcon /></span>
          <div><strong>{result.failures.length ? t("importSessions.result.partialTitle") : t("importSessions.result.successTitle")}</strong><p>{t("importSessions.result.summary", { imported: result.imported, total: result.total, failed: result.failures.length })}</p>{result.failures.length ? <small>{t("importSessions.result.failedRows", { rows: result.failures.map((item) => `#${item.index}`).join(", ") })}</small> : null}</div>
          <button type="button" className="pill ghostPill" onClick={resetImport}>{t("importSessions.result.another")}</button>
        </section>
      ) : null}
    </div>
  );
}
