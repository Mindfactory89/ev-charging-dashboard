import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { num } from "../app/formatters.js";
import { createSession } from "./api.js";
import { getImportProfiles } from "./importProfiles.js";
import { buildImportPreview, IMPORT_MAPPING_FIELDS, REQUIRED_IMPORT_MAPPING_FIELDS } from "./sessionImport.js";
import {
  deleteImportMappingProfile,
  readImportMappingProfiles,
  saveImportMappingProfile,
} from "./importMappingProfiles.js";
import { confirmAction } from "../platform/runtime.js";
import { DEFAULT_VEHICLE } from "../app/constants.js";

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

function mappingFieldLabel(field, t) {
  return t(`importSessions.mapping.fields.${field}`);
}

export default function ImportSessionsCard({ onImported, sessions = [], vehicleProfile = null }) {
  const { locale, t } = useI18n();
  const profileVehicleName = vehicleProfile?.sessionVehicleName || vehicleProfile?.name || DEFAULT_VEHICLE;
  const inputRef = React.useRef(null);
  const availableProfiles = React.useMemo(() => getImportProfiles(), [locale]);
  const [fileName, setFileName] = React.useState("");
  const [sourceText, setSourceText] = React.useState("");
  const [profileId, setProfileId] = React.useState("generic");
  const [fallbacks, setFallbacks] = React.useState({ soc_start: 10, soc_end: 80, vehicle: profileVehicleName });
  const [preview, setPreview] = React.useState(null);
  const [filter, setFilter] = React.useState("all");
  const [fileError, setFileError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ current: 0, total: 0 });
  const [result, setResult] = React.useState(null);
  const [mappingOverrides, setMappingOverrides] = React.useState({});
  const [mappingOpen, setMappingOpen] = React.useState(false);
  const [savedProfiles, setSavedProfiles] = React.useState(() => readImportMappingProfiles());
  const [selectedSavedProfileId, setSelectedSavedProfileId] = React.useState("");
  const [profileName, setProfileName] = React.useState("");
  const [profileMessage, setProfileMessage] = React.useState(null);
  const previousProfileVehicleRef = React.useRef(profileVehicleName);

  React.useEffect(() => {
    const previousName = previousProfileVehicleRef.current;
    setFallbacks((current) => {
      if (current.vehicle && current.vehicle !== DEFAULT_VEHICLE && current.vehicle !== previousName) return current;
      return { ...current, vehicle: profileVehicleName };
    });
    previousProfileVehicleRef.current = profileVehicleName;
  }, [profileVehicleName]);

  React.useEffect(() => {
    if (!sourceText) return;
    setPreview(buildImportPreview(sourceText, sessions, { profileId, fallbacks, mapping: mappingOverrides }));
  }, [fallbacks, locale, mappingOverrides, profileId, sessions, sourceText]);

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
    setMappingOverrides({});
    setSelectedSavedProfileId("");
    setProfileName("");
    setProfileMessage(null);
    setMappingOpen(nextPreview.summary.invalid > 0);
    setPreview(nextPreview);
    setFilter("all");
  }

  function resetImport() {
    setFileName("");
    setSourceText("");
    setPreview(null);
    setFileError("");
    setResult(null);
    setMappingOverrides({});
    setMappingOpen(false);
    setSelectedSavedProfileId("");
    setProfileName("");
    setProfileMessage(null);
    setProgress({ current: 0, total: 0 });
    if (inputRef.current) inputRef.current.value = "";
  }

  function selectBaseProfile(nextProfileId) {
    setProfileId(nextProfileId);
    setMappingOverrides({});
    setSelectedSavedProfileId("");
    setProfileName("");
    setProfileMessage(null);
  }

  function updateMapping(field, header) {
    setMappingOverrides((current) => ({ ...current, [field]: header }));
    setProfileMessage(null);
  }

  function resetAutomaticMapping() {
    setMappingOverrides({});
    setSelectedSavedProfileId("");
    setProfileName("");
    setProfileMessage({ tone: "success", text: t("importSessions.mapping.autoRestored") });
  }

  function applySavedProfile(profileIdValue) {
    setSelectedSavedProfileId(profileIdValue);
    const savedProfile = savedProfiles.find((profile) => profile.id === profileIdValue);
    if (!savedProfile) {
      setProfileName("");
      return;
    }
    setProfileId(savedProfile.baseProfileId || "generic");
    setFallbacks(savedProfile.fallbacks || fallbacks);
    setMappingOverrides(savedProfile.mapping || {});
    setProfileName(savedProfile.name);
    setMappingOpen(true);
    setProfileMessage({ tone: "success", text: t("importSessions.savedProfiles.applied", { name: savedProfile.name }) });
  }

  function saveCurrentProfile() {
    const name = profileName.trim();
    if (!name) {
      setProfileMessage({ tone: "error", text: t("importSessions.savedProfiles.nameRequired") });
      return;
    }
    const mapping = Object.fromEntries(
      IMPORT_MAPPING_FIELDS.map((field) => [field, preview?.mapping?.[field] || ""])
    );
    const resultState = saveImportMappingProfile({
      id: selectedSavedProfileId || undefined,
      name,
      baseProfileId: profileId,
      mapping,
      fallbacks,
    }, savedProfiles);
    if (!resultState.profile) return;
    setSavedProfiles(resultState.profiles);
    setSelectedSavedProfileId(resultState.profile.id);
    setProfileMessage({ tone: "success", text: t("importSessions.savedProfiles.saved", { name }) });
  }

  async function deleteCurrentProfile() {
    const savedProfile = savedProfiles.find((profile) => profile.id === selectedSavedProfileId);
    if (!savedProfile) return;
    const confirmed = await confirmAction(t("importSessions.savedProfiles.deleteMessage", { name: savedProfile.name }), {
      title: t("importSessions.savedProfiles.deleteTitle"),
      confirmLabel: t("importSessions.savedProfiles.deleteConfirm"),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!confirmed) return;
    setSavedProfiles(deleteImportMappingProfile(savedProfile.id, savedProfiles));
    setSelectedSavedProfileId("");
    setProfileName("");
    setProfileMessage({ tone: "success", text: t("importSessions.savedProfiles.deleted") });
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
        const belongsToSelectedProfile = row.payload?.vehicle === profileVehicleName;
        await createSession({
          ...row.payload,
          vehicle_profile_id: belongsToSelectedProfile ? vehicleProfile?.id || null : null,
        });
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
  const mappedFieldCount = IMPORT_MAPPING_FIELDS.filter((field) => preview?.mapping?.[field]).length;
  const missingRequiredMappings = preview
    ? [
        ...REQUIRED_IMPORT_MAPPING_FIELDS.filter((field) => !preview.mapping?.[field]),
        ...(!preview.mapping?.price_per_kwh && !preview.mapping?.total_cost ? ["price"] : []),
      ]
    : [];

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
            <label><span>{t("importSessions.profileLabel")}</span><select className="input" value={profileId} onChange={(event) => selectBaseProfile(event.target.value)}>{(preview.availableProfiles || availableProfiles).map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select><small>{preview.profile.activeDescription}</small></label>
            <label><span>{t("importSessions.fallbacks.socStart")}</span><input className="input" type="number" min="0" max="100" value={fallbacks.soc_start} onChange={(event) => setFallbacks((current) => ({ ...current, soc_start: Number(event.target.value) }))} /></label>
            <label><span>{t("importSessions.fallbacks.socEnd")}</span><input className="input" type="number" min="0" max="100" value={fallbacks.soc_end} onChange={(event) => setFallbacks((current) => ({ ...current, soc_end: Number(event.target.value) }))} /></label>
            <label><span>{t("importSessions.fallbacks.vehicle")}</span><input className="input" value={fallbacks.vehicle} onChange={(event) => setFallbacks((current) => ({ ...current, vehicle: event.target.value }))} /></label>
          </div>

          <details
            className={`importMappingPanel ${missingRequiredMappings.length ? "needsAttention" : ""}`}
            open={mappingOpen}
            onToggle={(event) => setMappingOpen(event.currentTarget.open)}
          >
            <summary>
              <span className="importMappingSummaryIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 7h10m4 0h2M10 17h10M4 17h2M14 4v6M10 14v6" /></svg>
              </span>
              <span><strong>{t("importSessions.mapping.title")}</strong><small>{t("importSessions.mapping.text")}</small></span>
              <span className={`importMappingCoverage ${missingRequiredMappings.length ? "warning" : "ready"}`}>
                {missingRequiredMappings.length
                  ? t("importSessions.mapping.missing", { count: missingRequiredMappings.length })
                  : t("importSessions.mapping.coverage", { mapped: mappedFieldCount, total: IMPORT_MAPPING_FIELDS.length })}
              </span>
            </summary>

            <div className="importMappingBody">
              <section className="importSavedProfiles" aria-labelledby="saved-import-profile-title">
                <div className="importMappingSectionHeading">
                  <div><strong id="saved-import-profile-title">{t("importSessions.savedProfiles.title")}</strong><span>{t("importSessions.savedProfiles.text")}</span></div>
                </div>
                <div className="importSavedProfileControls">
                  <label>
                    <span>{t("importSessions.savedProfiles.select")}</span>
                    <select className="input" value={selectedSavedProfileId} onChange={(event) => applySavedProfile(event.target.value)}>
                      <option value="">{t("importSessions.savedProfiles.newProfile")}</option>
                      {savedProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>{t("importSessions.savedProfiles.name")}</span>
                    <input className="input" maxLength="60" value={profileName} onChange={(event) => { setProfileName(event.target.value); setProfileMessage(null); }} placeholder={t("importSessions.savedProfiles.namePlaceholder")} />
                  </label>
                  <div className="importSavedProfileActions">
                    <button type="button" className="pill pillWarm" onClick={saveCurrentProfile}>{selectedSavedProfileId ? t("importSessions.savedProfiles.update") : t("importSessions.savedProfiles.save")}</button>
                    {selectedSavedProfileId ? <button type="button" className="pill ghostPill dangerPill" onClick={deleteCurrentProfile}>{t("importSessions.savedProfiles.delete")}</button> : null}
                  </div>
                </div>
                {profileMessage ? <div className={`importProfileMessage ${profileMessage.tone}`} role="status">{profileMessage.text}</div> : null}
              </section>

              <section className="importColumnMapping" aria-labelledby="column-mapping-title">
                <div className="importMappingSectionHeading">
                  <div><strong id="column-mapping-title">{t("importSessions.mapping.columnsTitle")}</strong><span>{t("importSessions.mapping.columnsText")}</span></div>
                  <button type="button" className="pill ghostPill" onClick={resetAutomaticMapping}>{t("importSessions.mapping.resetAuto")}</button>
                </div>
                {missingRequiredMappings.length ? (
                  <div className="importMappingAlert" role="alert">
                    <strong>{t("importSessions.mapping.attentionTitle")}</strong>
                    <span>{t("importSessions.mapping.attentionText")}</span>
                  </div>
                ) : null}
                <div className="importMappingGrid">
                  {IMPORT_MAPPING_FIELDS.map((field) => {
                    const selectedHeader = preview.mapping?.[field] || "";
                    const sampleValue = selectedHeader ? preview.rows[0]?.record?.[selectedHeader] : "";
                    const required = REQUIRED_IMPORT_MAPPING_FIELDS.includes(field);
                    const priceAlternative = field === "price_per_kwh" || field === "total_cost";
                    return (
                      <label key={field} className={!selectedHeader && (required || (priceAlternative && missingRequiredMappings.includes("price"))) ? "hasError" : ""}>
                        <span>{mappingFieldLabel(field, t)}{required ? <b>{t("importSessions.mapping.required")}</b> : priceAlternative ? <b>{t("importSessions.mapping.alternative")}</b> : null}</span>
                        <select className="input" value={selectedHeader} onChange={(event) => updateMapping(field, event.target.value)}>
                          <option value="">{t("importSessions.mapping.ignore")}</option>
                          {preview.headers.map((header) => <option key={`${field}-${header}`} value={header}>{header}</option>)}
                        </select>
                        <small>{sampleValue ? t("importSessions.mapping.sample", { value: String(sampleValue).slice(0, 80) }) : t("importSessions.mapping.noSample")}</small>
                      </label>
                    );
                  })}
                </div>
              </section>
            </div>
          </details>

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
