import React from "react";
import { CONNECTOR_OPTIONS, DEFAULT_VEHICLE } from "../app/constants.js";
import { euro, num } from "../app/formatters.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { createSession } from "./api.js";
import {
  ADD_SESSION_FIELD_ORDER,
  createInitialAddSessionValues,
  durationToSeconds,
  parseLocalizedNumber,
  validateAddSessionValues,
} from "./addSessionForm.js";
import { deriveMobilityForSession } from "./sessionIntelligence.js";
import { formatTags } from "./sessionMetadata.js";
import { buildSessionMetadataOptions } from "./sessionMetadataOptions.js";
import { clearAddSessionDraft, readAddSessionDraft, writeAddSessionDraft } from "./addSessionDraft.js";
import { addSessionDefaultsForChargingProfile } from "../config/chargingProfiles.js";

const PROVIDER_LIST_ID = "add-session-provider-options";
const LOCATION_LIST_ID = "add-session-location-options";
const VEHICLE_LIST_ID = "add-session-vehicle-options";
const TAG_LIST_ID = "add-session-tag-options";

function SessionFormIcon({ type }) {
  if (type === "context") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3" />
        <path d="M6 19c.7-3 2.7-5 6-5s5.3 2 6 5" />
      </svg>
    );
  }

  if (type === "optional") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17h16" />
        <path d="M7 17 9 7h6l2 10" />
        <path d="M9 11h6" />
      </svg>
    );
  }

  if (type === "success") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </svg>
    );
  }

  if (type === "danger") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4 3.5 19h17L12 4Z" />
        <path d="M12 9v4" />
        <path d="M12 16h.01" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4h8l3 3v13H7V4Z" />
      <path d="M15 4v4h4" />
      <path d="M10 12h5" />
      <path d="M10 16h5" />
    </svg>
  );
}

function FieldLabel({ children, required = false, requiredLabel }) {
  return (
    <span className="sessionFieldLabel">
      {children}
      {required ? (
        <>
          <span className="sessionRequiredMarker" aria-hidden="true">*</span>
          <span className="srOnly">{requiredLabel}</span>
        </>
      ) : null}
    </span>
  );
}

export default function AddSessionCard({ chargingProfile = null, onCreated, demo = false, intelligence = null, sessions = [], vehicleProfile = null }) {
  const { t } = useI18n();
  const profileVehicleName = vehicleProfile?.sessionVehicleName || vehicleProfile?.name || DEFAULT_VEHICLE;
  const restoredDraftRef = React.useRef(null);
  if (restoredDraftRef.current === null) restoredDraftRef.current = readAddSessionDraft() || false;
  function blankValues() {
    return {
      ...createInitialAddSessionValues(),
      connector: CONNECTOR_OPTIONS[0] || "CCS - DC",
      vehicle: profileVehicleName,
      ...addSessionDefaultsForChargingProfile(chargingProfile),
    };
  }
  const [values, setValues] = React.useState(() => restoredDraftRef.current
    ? { ...blankValues(), ...restoredDraftRef.current.values }
    : blankValues());
  const [draftRestored, setDraftRestored] = React.useState(Boolean(restoredDraftRef.current));
  const [touched, setTouched] = React.useState({});
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState(null);
  const inputRefs = React.useRef({});
  const optionalDetailsRef = React.useRef(null);
  const previousProfileVehicleRef = React.useRef(profileVehicleName);

  React.useEffect(() => {
    writeAddSessionDraft(values);
  }, [values]);

  React.useEffect(() => {
    const previousName = previousProfileVehicleRef.current;
    setValues((current) => {
      if (current.vehicle && current.vehicle !== DEFAULT_VEHICLE && current.vehicle !== previousName) return current;
      return { ...current, vehicle: profileVehicleName };
    });
    previousProfileVehicleRef.current = profileVehicleName;
  }, [profileVehicleName]);

  const metadataOptions = React.useMemo(
    () => buildSessionMetadataOptions({ sessions, intelligence }),
    [intelligence, sessions]
  );
  const socOptions = React.useMemo(() => Array.from({ length: 101 }, (_, index) => index), []);
  const parsedEnergy = parseLocalizedNumber(values.energyKwh);
  const parsedPrice = parseLocalizedNumber(values.pricePerKwh);
  const parsedDuration = durationToSeconds(values.durationHHMM);
  const parsedOdometer = values.odometerKm === "" ? null : Number(values.odometerKm);
  const previewCost = Number.isFinite(parsedEnergy) && Number.isFinite(parsedPrice) ? parsedEnergy * parsedPrice : null;
  const previewPower =
    Number.isFinite(parsedEnergy) && Number.isFinite(parsedDuration) && parsedDuration > 0
      ? parsedEnergy / (parsedDuration / 3600)
      : null;
  const previewSocDelta = Math.max(0, Number(values.socEnd) - Number(values.socStart));
  const profileBatteryWindowKwh = vehicleProfile?.batteryKwh != null && Number.isFinite(Number(vehicleProfile.batteryKwh))
    ? (Number(vehicleProfile.batteryKwh) * previewSocDelta) / 100
    : null;
  const mobilityPreview = React.useMemo(() => {
    if (!Number.isFinite(parsedOdometer)) return null;
    return deriveMobilityForSession(sessions, {
      id: "__add-preview__",
      date: values.date,
      energy_kwh: parsedEnergy,
      total_cost: previewCost,
      duration_seconds: parsedDuration,
      price_per_kwh: parsedPrice,
      soc_start: Number(values.socStart),
      soc_end: Number(values.socEnd),
      odo_end_km: parsedOdometer,
    });
  }, [parsedDuration, parsedEnergy, parsedOdometer, parsedPrice, previewCost, sessions, values.date, values.socEnd, values.socStart]);
  const latestKnownOdometer = mobilityPreview?.previousOdometerKm ?? null;
  const previewDistanceKm = mobilityPreview?.distanceKm ?? null;
  const previewCostPer100Km =
    Number.isFinite(previewCost) && Number.isFinite(previewDistanceKm) && previewDistanceKm > 0
      ? (previewCost / previewDistanceKm) * 100
      : null;
  const errors = React.useMemo(
    () => validateAddSessionValues(values, {
      previousOdometerKm: mobilityPreview?.previousOdometerKm,
      nextOdometerKm: mobilityPreview?.nextOdometerKm,
    }),
    [mobilityPreview?.nextOdometerKm, mobilityPreview?.previousOdometerKm, values]
  );
  const issueCount = Object.keys(errors).length;

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setStatus(null);
  }

  function resetDraft() {
    clearAddSessionDraft();
    setValues(blankValues());
    setTouched({});
    setSubmitAttempted(false);
    setStatus(null);
    setDraftRestored(false);
  }

  function markTouched(field) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function visibleIssue(field) {
    return touched[field] || submitAttempted ? errors[field] : null;
  }

  function issueMessage(issue) {
    if (!issue) return "";
    const replacements = { ...(issue.values || {}) };
    if (replacements.value != null) replacements.value = num(replacements.value, 0);
    return t(`addSession.validation.${issue.key}`, replacements);
  }

  function fieldProps(field, helperId = null) {
    const issue = visibleIssue(field);
    const errorId = issue ? `add-session-${field}-error` : null;
    return {
      className: issue ? "field sessionField hasError" : "field sessionField",
      input: {
        "aria-invalid": issue ? "true" : "false",
        "aria-describedby": [helperId, errorId].filter(Boolean).join(" ") || undefined,
        onBlur: () => markTouched(field),
        ref: (node) => {
          inputRefs.current[field] = node;
        },
      },
      issue,
      errorId,
    };
  }

  function FieldError({ field, issue, id }) {
    if (!issue) return null;
    return <span id={id || `add-session-${field}-error`} className="sessionFieldError" role="alert">{issueMessage(issue)}</span>;
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitAttempted(true);
    setStatus(null);

    const firstInvalidField = ADD_SESSION_FIELD_ORDER.find((field) => errors[field]);
    if (firstInvalidField) {
      if (firstInvalidField === "odometerKm" && optionalDetailsRef.current) {
        optionalDetailsRef.current.open = true;
      }
      setStatus({
        tone: "danger",
        title: t("addSession.feedback.reviewTitle"),
        message: t("addSession.feedback.reviewText", { count: issueCount }),
      });
      requestAnimationFrame(() => inputRefs.current[firstInvalidField]?.focus?.());
      return;
    }

    setBusy(true);
    try {
      await createSession({
        date: values.date,
        provider: values.provider,
        location: values.location,
        vehicle: values.vehicle,
        vehicle_profile_id: vehicleProfile?.id || null,
        tags: formatTags(values.tags),
        connector: values.connector,
        soc_start: Number(values.socStart),
        soc_end: Number(values.socEnd),
        energy_kwh: parsedEnergy,
        price_per_kwh: parsedPrice,
        duration_seconds: parsedDuration,
        odometer_km: parsedOdometer != null ? Math.round(parsedOdometer) : null,
        note: values.note || null,
      });
      setStatus({
        tone: "success",
        title: t("addSession.feedback.savedTitle"),
        message: t("addSession.messages.saved"),
      });
      clearAddSessionDraft();
      setValues(blankValues());
      setDraftRestored(false);
      setTouched({});
      setSubmitAttempted(false);
      await onCreated?.();
    } catch (error) {
      setStatus({
        tone: "danger",
        title: t("addSession.feedback.errorTitle"),
        message: t("addSession.messages.error", { error: String(error?.message || error) }),
      });
    } finally {
      setBusy(false);
    }
  }

  const dateField = fieldProps("date");
  const connectorField = fieldProps("connector");
  const socStartField = fieldProps("socStart");
  const socEndField = fieldProps("socEnd");
  const energyField = fieldProps("energyKwh", "add-session-energy-help");
  const priceField = fieldProps("pricePerKwh", "add-session-price-help");
  const durationField = fieldProps("durationHHMM", "add-session-duration-help");
  const odometerField = fieldProps("odometerKm", "add-session-odometer-help");

  return (
    <div className="card glassStrong formCard sessionEntryCard">
      <div className="sectionHeader sessionEntryHeader">
        <div>
          <div className="sectionKicker">{t("addSession.kicker")}</div>
          <div className="sectionTitle">{t("addSession.title")}</div>
          <p className="sessionEntryIntro">{t("addSession.intro")}</p>
        </div>
        <div className="sessionEntryMeta">
          {draftRestored ? (
            <span className="sessionDraftRestored">
              {t("addSession.draft.restored")}
              <button type="button" onClick={resetDraft}>{t("addSession.draft.discard")}</button>
            </span>
          ) : null}
          <span className="pill ghostPill">{demo ? t("addSession.metaDemo") : t("addSession.metaLive")}</span>
          <span className="pill ghostPill">{t("addSession.metaVehicleProfile", { name: vehicleProfile?.name || profileVehicleName })}</span>
          <span className={issueCount ? "sessionReadiness review" : "sessionReadiness ready"}>
            {issueCount
              ? t("addSession.readiness.review", { count: issueCount })
              : t("addSession.readiness.ready")}
          </span>
        </div>
      </div>

      <div className="formPreviewGrid" aria-label={t("addSession.preview.ariaLabel")}>
        <div className="formPreviewCard warm">
          <div className="formPreviewLabel">{t("addSession.preview.totalCost")}</div>
          <div className="formPreviewValue">{Number.isFinite(previewCost) ? euro(previewCost) : "–"}</div>
          <div className="formPreviewSub">{t("addSession.preview.totalCostSub")}</div>
        </div>

        <div className="formPreviewCard">
          <div className="formPreviewLabel">{t("addSession.preview.socDelta")}</div>
          <div className="formPreviewValue">{Number.isFinite(previewSocDelta) ? `${previewSocDelta} %` : "–"}</div>
          <div className="formPreviewSub">{values.socStart} → {values.socEnd}</div>
        </div>

        <div className="formPreviewCard">
          <div className="formPreviewLabel">{t("addSession.preview.avgPower")}</div>
          <div className="formPreviewValue">{Number.isFinite(previewPower) ? `${num(previewPower, 1)} kW` : "–"}</div>
          <div className="formPreviewSub">{t("addSession.preview.avgPowerSub")}</div>
        </div>

        <div className="formPreviewCard cool">
          <div className="formPreviewLabel">{t("addSession.preview.mobility")}</div>
          <div className="formPreviewValue">
            {previewCostPer100Km != null ? `${num(previewCostPer100Km, 2)} €/100 km` : values.connector || "–"}
          </div>
          <div className="formPreviewSub">
            {previewDistanceKm != null
              ? t("addSession.preview.distanceSub", { distance: num(previewDistanceKm, 0) })
              : latestKnownOdometer != null
                ? t("addSession.preview.previousOdometerSub", { value: num(latestKnownOdometer, 0) })
                : values.date || t("addSession.preview.noDateSub")}
          </div>
        </div>
      </div>

      <form className="sessionEntryForm" onSubmit={submit} noValidate>
        <section className="sessionFormSection primary" aria-labelledby="session-form-charging-title">
          <div className="sessionFormSectionHeader">
            <span className="sessionFormSectionIcon"><SessionFormIcon type="charging" /></span>
            <div>
              <div className="sessionFormSectionMeta">{t("addSession.sections.charging.badge")}</div>
              <h4 id="session-form-charging-title">{t("addSession.sections.charging.title")}</h4>
              <p>{t("addSession.sections.charging.text")}</p>
            </div>
          </div>

          <div className="sessionFormGrid">
            <label className={dateField.className}>
              <FieldLabel required requiredLabel={t("addSession.required")}>{t("addSession.fields.date")}</FieldLabel>
              <input
                {...dateField.input}
                className="input"
                type="date"
                required
                value={values.date}
                onChange={(event) => updateField("date", event.target.value)}
              />
              <FieldError field="date" issue={dateField.issue} id={dateField.errorId} />
            </label>

            <label className={connectorField.className}>
              <FieldLabel required requiredLabel={t("addSession.required")}>{t("addSession.fields.connector")}</FieldLabel>
              <select
                {...connectorField.input}
                className="input"
                required
                value={values.connector}
                onChange={(event) => updateField("connector", event.target.value)}
              >
                {CONNECTOR_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <FieldError field="connector" issue={connectorField.issue} id={connectorField.errorId} />
            </label>

            <label className={energyField.className}>
              <FieldLabel required requiredLabel={t("addSession.required")}>{t("addSession.fields.energy")}</FieldLabel>
              <input
                {...energyField.input}
                className="input"
                value={values.energyKwh}
                onChange={(event) => updateField("energyKwh", event.target.value)}
                placeholder={t("addSession.placeholders.energy")}
                inputMode="decimal"
                autoComplete="off"
                required
              />
              <span id="add-session-energy-help" className="sessionFieldHelp">
                {profileBatteryWindowKwh != null
                  ? t("addSession.helpers.energyProfile", { name: vehicleProfile?.name || profileVehicleName, value: num(profileBatteryWindowKwh, 1) })
                  : t("addSession.helpers.energy")}
              </span>
              <FieldError field="energyKwh" issue={energyField.issue} id={energyField.errorId} />
            </label>

            <label className={priceField.className}>
              <FieldLabel required requiredLabel={t("addSession.required")}>{t("addSession.fields.pricePerKwh")}</FieldLabel>
              <input
                {...priceField.input}
                className="input"
                value={values.pricePerKwh}
                onChange={(event) => updateField("pricePerKwh", event.target.value)}
                placeholder={t("addSession.placeholders.pricePerKwh")}
                inputMode="decimal"
                autoComplete="off"
                required
              />
              <span id="add-session-price-help" className="sessionFieldHelp">{t("addSession.helpers.price")}</span>
              <FieldError field="pricePerKwh" issue={priceField.issue} id={priceField.errorId} />
            </label>

            <label className={socStartField.className}>
              <FieldLabel required requiredLabel={t("addSession.required")}>{t("addSession.fields.socStart")}</FieldLabel>
              <select
                {...socStartField.input}
                className="input"
                required
                value={values.socStart}
                onChange={(event) => updateField("socStart", event.target.value)}
              >
                {socOptions.map((value) => <option key={value} value={value}>{value} %</option>)}
              </select>
              <FieldError field="socStart" issue={socStartField.issue} id={socStartField.errorId} />
            </label>

            <label className={socEndField.className}>
              <FieldLabel required requiredLabel={t("addSession.required")}>{t("addSession.fields.socEnd")}</FieldLabel>
              <select
                {...socEndField.input}
                className="input"
                required
                value={values.socEnd}
                onChange={(event) => updateField("socEnd", event.target.value)}
              >
                {socOptions.map((value) => <option key={value} value={value}>{value} %</option>)}
              </select>
              <FieldError field="socEnd" issue={socEndField.issue} id={socEndField.errorId} />
            </label>

            <label className={durationField.className}>
              <FieldLabel required requiredLabel={t("addSession.required")}>{t("addSession.fields.duration")}</FieldLabel>
              <input
                {...durationField.input}
                className="input"
                value={values.durationHHMM}
                onChange={(event) => updateField("durationHHMM", event.target.value)}
                placeholder={t("addSession.placeholders.duration")}
                inputMode="numeric"
                autoComplete="off"
                required
              />
              <span id="add-session-duration-help" className="sessionFieldHelp">{t("addSession.helpers.duration")}</span>
              <FieldError field="durationHHMM" issue={durationField.issue} id={durationField.errorId} />
            </label>
          </div>
        </section>

        <section className="sessionFormSection" aria-labelledby="session-form-context-title">
          <div className="sessionFormSectionHeader">
            <span className="sessionFormSectionIcon"><SessionFormIcon type="context" /></span>
            <div>
              <div className="sessionFormSectionMeta">{t("addSession.sections.context.badge")}</div>
              <h4 id="session-form-context-title">{t("addSession.sections.context.title")}</h4>
              <p>{t("addSession.sections.context.text")}</p>
            </div>
          </div>

          <div className="sessionFormGrid">
            <label className="field sessionField">
              <FieldLabel>{t("addSession.fields.provider")}</FieldLabel>
              <input
                className="input"
                list={metadataOptions.providers.length ? PROVIDER_LIST_ID : undefined}
                value={values.provider}
                onChange={(event) => updateField("provider", event.target.value)}
                placeholder={t("addSession.placeholders.provider")}
                autoComplete="organization"
              />
            </label>

            <label className="field sessionField">
              <FieldLabel>{t("addSession.fields.location")}</FieldLabel>
              <input
                className="input"
                list={metadataOptions.locations.length ? LOCATION_LIST_ID : undefined}
                value={values.location}
                onChange={(event) => updateField("location", event.target.value)}
                placeholder={t("addSession.placeholders.location")}
                autoComplete="off"
              />
            </label>

            <label className="field sessionField">
              <FieldLabel>{t("addSession.fields.vehicle")}</FieldLabel>
              <input
                className="input"
                list={metadataOptions.vehicles.length ? VEHICLE_LIST_ID : undefined}
                value={values.vehicle}
                onChange={(event) => updateField("vehicle", event.target.value)}
                placeholder={t("addSession.placeholders.vehicle")}
                autoComplete="off"
              />
            </label>

            <label className="field sessionField">
              <FieldLabel>{t("addSession.fields.tags")}</FieldLabel>
              <input
                className="input"
                list={metadataOptions.tags.length ? TAG_LIST_ID : undefined}
                value={values.tags}
                onChange={(event) => updateField("tags", event.target.value)}
                placeholder={t("addSession.placeholders.tags")}
                autoComplete="off"
              />
            </label>
          </div>
        </section>

        <details className="sessionOptionalSection" ref={optionalDetailsRef}>
          <summary>
            <span className="sessionFormSectionIcon"><SessionFormIcon type="optional" /></span>
            <span>
              <span className="sessionFormSectionMeta">{t("addSession.sections.optional.badge")}</span>
              <strong>{t("addSession.sections.optional.title")}</strong>
              <small>{t("addSession.sections.optional.text")}</small>
            </span>
            <span className="sessionOptionalState" aria-hidden="true">+</span>
          </summary>
          <div className="sessionOptionalContent">
            <div className="sessionFormGrid optional">
              <label className={odometerField.className}>
                <FieldLabel>{t("addSession.fields.odometer")}</FieldLabel>
                <input
                  {...odometerField.input}
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={values.odometerKm}
                  onChange={(event) => updateField("odometerKm", event.target.value)}
                  placeholder={t("addSession.placeholders.odometer")}
                />
                <span id="add-session-odometer-help" className="sessionFieldHelp">
                  {latestKnownOdometer != null
                    ? t("addSession.helpers.odometerKnown", { value: num(latestKnownOdometer, 0) })
                    : t("addSession.helpers.odometer")}
                </span>
                <FieldError field="odometerKm" issue={odometerField.issue} id={odometerField.errorId} />
              </label>

              <label className="field sessionField sessionNoteField">
                <FieldLabel>{t("addSession.fields.note")}</FieldLabel>
                <textarea
                  className="input inputArea"
                  value={values.note}
                  onChange={(event) => updateField("note", event.target.value)}
                  placeholder={t("addSession.placeholders.note")}
                />
              </label>
            </div>
          </div>
        </details>

        {status ? (
          <div
            className={`sessionFormFeedback ${status.tone}`}
            role={status.tone === "danger" ? "alert" : "status"}
            aria-live={status.tone === "danger" ? "assertive" : "polite"}
          >
            <span className="sessionFormFeedbackIcon"><SessionFormIcon type={status.tone} /></span>
            <div>
              <strong>{status.title}</strong>
              <p>{status.message}</p>
            </div>
          </div>
        ) : null}

        <div className="sessionFormActionBar">
          <div className="sessionFormActionCopy">
            <strong>{t("addSession.action.title")}</strong>
            <span>
              {demo ? t("addSession.hint.demo") : t("addSession.hint.live")}
              {" "}
              {latestKnownOdometer != null
                ? t("addSession.hint.latestOdometer", { value: num(latestKnownOdometer, 0) })
                : t("addSession.hint.firstOdometer")}
            </span>
          </div>
          <button className="btnPrimary sessionSaveButton" type="submit" disabled={busy} aria-busy={busy ? "true" : "false"}>
            {busy ? <span className="sessionSaveSpinner" aria-hidden="true" /> : null}
            <span>{busy ? t("addSession.saveBusy") : t("common.save")}</span>
          </button>
        </div>
      </form>

      {metadataOptions.providers.length ? (
        <datalist id={PROVIDER_LIST_ID}>
          {metadataOptions.providers.map((value) => <option key={value} value={value} />)}
        </datalist>
      ) : null}
      {metadataOptions.locations.length ? (
        <datalist id={LOCATION_LIST_ID}>
          {metadataOptions.locations.map((value) => <option key={value} value={value} />)}
        </datalist>
      ) : null}
      {metadataOptions.vehicles.length ? (
        <datalist id={VEHICLE_LIST_ID}>
          {metadataOptions.vehicles.map((value) => <option key={value} value={value} />)}
        </datalist>
      ) : null}
      {metadataOptions.tags.length ? (
        <datalist id={TAG_LIST_ID}>
          {metadataOptions.tags.map((value) => <option key={value} value={value} />)}
        </datalist>
      ) : null}
    </div>
  );
}
