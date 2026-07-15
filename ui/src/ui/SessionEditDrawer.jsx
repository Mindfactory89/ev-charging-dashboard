import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { datumDE, euro, num } from "../app/formatters.js";
import {
  SESSION_EDIT_FIELD_ORDER,
  buildSessionEditPreview,
  sessionEditHasChanges,
  validateSessionEditDraft,
} from "./sessionEditForm.js";

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function Spinner() {
  return <span className="sessionActionSpinner" aria-hidden="true" />;
}

export default function SessionEditDrawer({
  session,
  sessions = [],
  draft,
  connectorOptions = [],
  filterOptions = {},
  busy = false,
  onDraftChange,
  onRequestClose,
  onSave,
}) {
  const { t } = useI18n();
  const panelRef = React.useRef(null);
  const fieldRefs = React.useRef({});
  const closeRef = React.useRef(onRequestClose);
  const [touched, setTouched] = React.useState({});
  const [submitted, setSubmitted] = React.useState(false);
  const validation = React.useMemo(
    () => validateSessionEditDraft(draft, sessions, session),
    [draft, session, sessions]
  );
  const preview = validation.preview || buildSessionEditPreview(draft, sessions, session);
  const dirty = sessionEditHasChanges(session, draft);

  React.useEffect(() => {
    closeRef.current = onRequestClose;
  }, [onRequestClose]);

  React.useEffect(() => {
    if (!session || typeof document === "undefined") return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => panelRef.current?.focus?.(), 30);

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
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
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, [session?.id]);

  if (!session || !draft) return null;

  function errorMessage(field) {
    const error = validation.errors[field];
    if (!error || (!submitted && !touched[field])) return "";
    const params = error.params?.value != null ? { value: num(error.params.value, 0) } : error.params;
    return t(`sessionsCard.validation.${error.key}`, params);
  }

  function fieldProps(field) {
    const message = errorMessage(field);
    return {
      ref: (node) => { fieldRefs.current[field] = node; },
      value: draft[field] ?? "",
      onChange: (event) => onDraftChange?.(field, event.target.value),
      onBlur: () => setTouched((current) => ({ ...current, [field]: true })),
      "aria-invalid": message ? "true" : undefined,
      "aria-describedby": message ? `session-edit-${field}-error` : undefined,
    };
  }

  function renderError(field) {
    const message = errorMessage(field);
    return message ? <small id={`session-edit-${field}-error`} className="sessionFieldError" role="alert">{message}</small> : null;
  }

  function submit(event) {
    event.preventDefault();
    setSubmitted(true);
    if (!validation.valid) {
      const firstInvalid = SESSION_EDIT_FIELD_ORDER.find((field) => validation.errors[field]);
      fieldRefs.current[firstInvalid]?.focus?.();
      return;
    }
    if (dirty && !busy) onSave?.(validation.preview);
  }

  return (
    <div className="sessionDrawerOverlay sessionEditorOverlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onRequestClose?.();
    }}>
      <aside
        className="sessionDrawer sessionEditorDrawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-edit-title"
        aria-describedby="session-edit-description"
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="sessionDrawerHeader sessionEditorHeader">
          <div className="sessionDrawerIdentity">
            <span className="sessionDrawerGlyph" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M13 2 6.5 13H12l-1 9 6.5-11H12l1-9Z" /></svg>
            </span>
            <div>
              <div className="sectionKicker">{t("sessionDetail.edit.kicker")}</div>
              <h2 className="sessionDrawerTitle" id="session-edit-title">{t("sessionDetail.edit.title")}</h2>
              <p className="sessionDrawerDescription" id="session-edit-description">
                {t("sessionDetail.edit.description", { date: datumDE(session.date) })}
              </p>
            </div>
          </div>
          <button type="button" className="sessionDrawerClose" onClick={onRequestClose} aria-label={t("sessionDetail.close")}>
            <CloseIcon />
          </button>
        </header>

        <form className="sessionEditorForm" onSubmit={submit} noValidate>
          <section className="sessionEditorPreview" aria-label={t("sessionDetail.edit.previewLabel")}>
            <div className="sessionEditorPreviewStatus">
              <span className={`sessionEditState ${dirty ? "dirty" : "clean"}`}>
                {dirty ? t("sessionsCard.edit.statusDirty") : t("sessionsCard.edit.statusClean")}
              </span>
              <span className={`sessionEditReadiness ${validation.valid ? "ready" : "attention"}`}>
                {validation.valid ? t("sessionDetail.edit.readyShort") : t("sessionDetail.edit.reviewShort")}
              </span>
            </div>
            <div className="sessionEditorPreviewGrid">
              <div><span>{t("sessionsCard.edit.liveCost")}</span><strong>{preview.totalCost != null ? euro(preview.totalCost) : "–"}</strong></div>
              <div><span>{t("sessionsCard.edit.liveAvg")}</span><strong>{preview.avgPowerKw != null ? `${num(preview.avgPowerKw, 1)} kW` : "–"}</strong></div>
              <div><span>{t("sessionsCard.edit.socDelta")}</span><strong>{preview.socDelta != null ? `${num(preview.socDelta, 0)} %` : "–"}</strong></div>
              <div><span>{t("sessionsCard.edit.distance")}</span><strong>{preview.distanceKm != null ? `${num(preview.distanceKm, 0)} km` : "–"}</strong></div>
            </div>
          </section>

          {submitted && !validation.valid ? (
            <div className="sessionEditorSummary" role="alert">
              <strong>{t("sessionDetail.edit.reviewTitle")}</strong>
              <span>{t("sessionDetail.edit.reviewText")}</span>
            </div>
          ) : null}

          <fieldset className="sessionEditorSection">
            <legend>
              <span>{t("sessionDetail.edit.chargingTitle")}</span>
              <small>{t("sessionDetail.edit.required")}</small>
            </legend>
            <div className="sessionEditorGrid">
              <label className="sessionEditField">
                <span>{t("common.date")} <b aria-hidden="true">*</b></span>
                <input className="input" type="date" {...fieldProps("date")} />
                {renderError("date")}
              </label>
              <label className="sessionEditField">
                <span>{t("common.connector")}</span>
                <select className="input" {...fieldProps("connector")}>
                  {connectorOptions.map((connector) => <option key={connector} value={connector}>{connector}</option>)}
                </select>
              </label>
              <label className="sessionEditField">
                <span>{t("common.energy")} <b aria-hidden="true">*</b></span>
                <input className="input" inputMode="decimal" {...fieldProps("energy_kwh")} />
                {renderError("energy_kwh")}
              </label>
              <label className="sessionEditField">
                <span>{t("common.pricePerKwh")} <b aria-hidden="true">*</b></span>
                <input className="input" inputMode="decimal" {...fieldProps("price_per_kwh")} />
                {renderError("price_per_kwh")}
              </label>
              <label className="sessionEditField">
                <span>{t("common.duration")} <b aria-hidden="true">*</b></span>
                <input className="input" inputMode="numeric" placeholder="01:30" {...fieldProps("duration_hhmm")} />
                {renderError("duration_hhmm")}
              </label>
              <label className="sessionEditField">
                <span>{t("addSession.fields.odometer")}</span>
                <input className="input" type="number" min="0" inputMode="numeric" {...fieldProps("odometer_km")} />
                {renderError("odometer_km")}
              </label>
              <label className="sessionEditField">
                <span>{t("addSession.fields.socStart")} <b aria-hidden="true">*</b></span>
                <input className="input" type="number" min="0" max="100" inputMode="numeric" {...fieldProps("soc_start")} />
                {renderError("soc_start")}
              </label>
              <label className="sessionEditField">
                <span>{t("addSession.fields.socEnd")} <b aria-hidden="true">*</b></span>
                <input className="input" type="number" min="0" max="100" inputMode="numeric" {...fieldProps("soc_end")} />
                {renderError("soc_end")}
              </label>
            </div>
          </fieldset>

          <fieldset className="sessionEditorSection">
            <legend>
              <span>{t("sessionDetail.edit.contextTitle")}</span>
              <small>{t("sessionDetail.edit.optional")}</small>
            </legend>
            <div className="sessionEditorGrid">
              <label className="sessionEditField">
                <span>{t("common.provider")}</span>
                <input className="input" list={filterOptions.providers?.length ? "history-session-provider-options" : undefined} {...fieldProps("provider")} />
              </label>
              <label className="sessionEditField">
                <span>{t("common.location")}</span>
                <input className="input" list={filterOptions.locations?.length ? "history-session-location-options" : undefined} {...fieldProps("location")} />
              </label>
              <label className="sessionEditField">
                <span>{t("common.vehicle")}</span>
                <input className="input" list={filterOptions.vehicles?.length ? "history-session-vehicle-options" : undefined} {...fieldProps("vehicle")} />
              </label>
              <label className="sessionEditField">
                <span>{t("common.tags")}</span>
                <input className="input" list={filterOptions.tags?.length ? "history-session-tag-options" : undefined} {...fieldProps("tags")} />
              </label>
              <label className="sessionEditField sessionEditFieldWide">
                <span>{t("common.note")}</span>
                <textarea className="input" rows="3" {...fieldProps("note")} />
              </label>
            </div>
          </fieldset>

          <footer className="sessionEditorActions">
            <div className="sessionEditorActionCopy">
              <strong>{dirty ? t("sessionDetail.edit.unsavedTitle") : t("sessionDetail.edit.safeTitle")}</strong>
              <span>{dirty ? t("sessionDetail.edit.unsavedText") : t("sessionDetail.edit.safeText")}</span>
            </div>
            <div className="sessionEditorButtons">
              <button type="button" className="pill ghostPill" onClick={onRequestClose} disabled={busy}>{t("common.cancel")}</button>
              <button type="submit" className="pill pillWarm" disabled={busy || !dirty} aria-busy={busy || undefined}>
                {busy ? <><Spinner />{t("sessionsCard.buttons.saving")}</> : t("common.save")}
              </button>
            </div>
          </footer>
        </form>
      </aside>
    </div>
  );
}
