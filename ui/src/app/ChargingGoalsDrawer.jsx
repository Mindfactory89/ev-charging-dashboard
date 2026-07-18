import React from "react";
import { validateChargingGoalsDraft } from "../config/chargingGoals.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { confirmAction } from "../platform/runtime.js";

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="m14.8 9.2-1.7 3.9-3.9 1.7 1.7-3.9 3.9-1.7Z" />
    </svg>
  );
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

function blankDraft() {
  return { annualBudgetEur: "", maxAveragePricePerKwh: "", minEfficiencyScore: "" };
}

function draftFromGoals(goals) {
  return {
    annualBudgetEur: goals?.annualBudgetEur != null ? String(goals.annualBudgetEur) : "",
    maxAveragePricePerKwh: goals?.maxAveragePricePerKwh != null ? String(goals.maxAveragePricePerKwh) : "",
    minEfficiencyScore: goals?.minEfficiencyScore != null ? String(goals.minEfficiencyScore) : "",
  };
}

export default function ChargingGoalsDrawer({ goals, onClose, onReset, onSave, open }) {
  const { t } = useI18n();
  const panelRef = React.useRef(null);
  const [draft, setDraft] = React.useState(blankDraft);
  const [initialDraft, setInitialDraft] = React.useState(blankDraft);
  const [errors, setErrors] = React.useState({});
  const [message, setMessage] = React.useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);
  const dirtyRef = React.useRef(dirty);
  dirtyRef.current = dirty;

  React.useEffect(() => {
    if (!open) return;
    const next = draftFromGoals(goals);
    setDraft(next);
    setInitialDraft(next);
    setErrors({});
    setMessage("");
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
        requestClose();
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
  }, [open]);

  if (!open) return null;

  async function canDiscardDraft() {
    if (!dirtyRef.current) return true;
    return confirmAction(t("chargingGoals.discard.message"), {
      title: t("chargingGoals.discard.title"),
      confirmLabel: t("chargingGoals.discard.confirm"),
      cancelLabel: t("common.cancel"),
    });
  }

  async function requestClose() {
    if (!await canDiscardDraft()) return;
    onClose?.();
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
    setMessage("");
  }

  function submitGoals(event) {
    event.preventDefault();
    const validation = validateChargingGoalsDraft(draft);
    if (!validation.valid) {
      setErrors(validation.errors);
      setMessage(t(validation.errors.form ? "chargingGoals.validation.empty" : "chargingGoals.validation.review"));
      const firstField = Object.keys(validation.errors).find((key) => key !== "form");
      if (firstField) panelRef.current?.querySelector?.(`[name="${firstField}"]`)?.focus?.();
      return;
    }

    const saved = onSave?.(draft);
    if (!saved) return;
    const next = draftFromGoals(saved);
    setDraft(next);
    setInitialDraft(next);
    setErrors({});
    setMessage(t("chargingGoals.form.saved"));
  }

  async function resetGoals() {
    const confirmed = await confirmAction(t("chargingGoals.reset.message"), {
      title: t("chargingGoals.reset.title"),
      confirmLabel: t("chargingGoals.reset.confirm"),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!confirmed) return;
    onReset?.();
    const next = blankDraft();
    setDraft(next);
    setInitialDraft(next);
    setErrors({});
    setMessage(t("chargingGoals.reset.done"));
  }

  return (
    <div className="chargingGoalsOverlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) requestClose();
    }}>
      <aside
        className="chargingGoalsDrawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="charging-goals-drawer-title"
        aria-describedby="charging-goals-drawer-description"
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="chargingGoalsDrawerHeader">
          <div className="chargingGoalsDrawerIdentity">
            <span className="chargingGoalsDrawerGlyph"><CompassIcon /></span>
            <div>
              <div className="sectionKicker">{t("chargingGoals.drawer.kicker")}</div>
              <h2 id="charging-goals-drawer-title">{t("chargingGoals.drawer.title")}</h2>
              <p id="charging-goals-drawer-description">{t("chargingGoals.drawer.text")}</p>
            </div>
          </div>
          <button type="button" className="chargingGoalsClose" onClick={requestClose} aria-label={t("chargingGoals.drawer.close")}>
            <CloseIcon />
          </button>
        </header>

        <form className="chargingGoalsForm" onSubmit={submitGoals} noValidate>
          <section className="chargingGoalsIntro" aria-labelledby="charging-goals-principle-title">
            <div className="sectionKicker">{t("chargingGoals.form.kicker")}</div>
            <h3 id="charging-goals-principle-title">{t("chargingGoals.form.title")}</h3>
            <p>{t("chargingGoals.form.text")}</p>
          </section>

          <div className="chargingGoalsFieldList">
            <label className={`chargingGoalField ${errors.annualBudgetEur ? "hasError" : ""}`}>
              <span className="chargingGoalFieldIndex">01</span>
              <span className="chargingGoalFieldCopy">
                <strong>{t("chargingGoals.form.budget")}</strong>
                <small>{t("chargingGoals.form.budgetHelp")}</small>
              </span>
              <span className="chargingGoalInputWrap">
                <input name="annualBudgetEur" type="number" inputMode="decimal" min="50" max="100000" step="10" placeholder="1200" value={draft.annualBudgetEur} onChange={(event) => updateDraft("annualBudgetEur", event.target.value)} aria-invalid={errors.annualBudgetEur ? "true" : "false"} />
                <span>€</span>
              </span>
              {errors.annualBudgetEur ? <small className="chargingGoalError" role="alert">{t("chargingGoals.validation.budget")}</small> : null}
            </label>

            <label className={`chargingGoalField ${errors.maxAveragePricePerKwh ? "hasError" : ""}`}>
              <span className="chargingGoalFieldIndex">02</span>
              <span className="chargingGoalFieldCopy">
                <strong>{t("chargingGoals.form.price")}</strong>
                <small>{t("chargingGoals.form.priceHelp")}</small>
              </span>
              <span className="chargingGoalInputWrap">
                <input name="maxAveragePricePerKwh" type="number" inputMode="decimal" min="0.05" max="5" step="0.001" placeholder="0.500" value={draft.maxAveragePricePerKwh} onChange={(event) => updateDraft("maxAveragePricePerKwh", event.target.value)} aria-invalid={errors.maxAveragePricePerKwh ? "true" : "false"} />
                <span>€/kWh</span>
              </span>
              {errors.maxAveragePricePerKwh ? <small className="chargingGoalError" role="alert">{t("chargingGoals.validation.price")}</small> : null}
            </label>

            <label className={`chargingGoalField ${errors.minEfficiencyScore ? "hasError" : ""}`}>
              <span className="chargingGoalFieldIndex">03</span>
              <span className="chargingGoalFieldCopy">
                <strong>{t("chargingGoals.form.efficiency")}</strong>
                <small>{t("chargingGoals.form.efficiencyHelp")}</small>
              </span>
              <span className="chargingGoalInputWrap">
                <input name="minEfficiencyScore" type="number" inputMode="decimal" min="1" max="100" step="1" placeholder="65" value={draft.minEfficiencyScore} onChange={(event) => updateDraft("minEfficiencyScore", event.target.value)} aria-invalid={errors.minEfficiencyScore ? "true" : "false"} />
                <span>/100</span>
              </span>
              {errors.minEfficiencyScore ? <small className="chargingGoalError" role="alert">{t("chargingGoals.validation.efficiency")}</small> : null}
            </label>
          </div>

          {message ? <div className={`chargingGoalsMessage ${Object.values(errors).some(Boolean) ? "error" : ""}`} role="status">{message}</div> : null}

          <div className="chargingGoalsPrivacy">
            <strong>{t("chargingGoals.form.localTitle")}</strong>
            <span>{t("chargingGoals.form.localText")}</span>
          </div>

          <footer className="chargingGoalsFormActions">
            {goals ? <button type="button" className="chargingGoalsReset" onClick={resetGoals}>{t("chargingGoals.reset.action")}</button> : <span />}
            <div>
              <button type="button" className="pill ghostPill" onClick={requestClose}>{t("common.cancel")}</button>
              <button type="submit" className="btnPrimary">{t("chargingGoals.form.save")}</button>
            </div>
          </footer>
        </form>
      </aside>
    </div>
  );
}
