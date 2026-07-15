import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { euro, num, datumDE } from "../app/formatters.js";
import {
  averagePowerKw,
  deriveMobilityForSession,
  effectivePricePerKwh,
  getCostPer100Km,
  getDistanceKm,
  getEnergyPer100Km,
  getRecoveredRangeKm,
  getSessionOdometerKm,
} from "./sessionIntelligence.js";
import { parseTags } from "./sessionMetadata.js";

function secsToHHMM(value) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return "–";
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function SessionDetailDrawer({ session, sessions = [], score, outlier, onClose, onEdit, onDelete, deleteBusy = false }) {
  const { t } = useI18n();
  const panelRef = React.useRef(null);
  const closeRef = React.useRef(onClose);

  React.useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!session) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => panelRef.current?.focus?.(), 40);

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
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
  }, [session?.id]);

  if (!session) return null;

  const enrichedSession = deriveMobilityForSession(sessions, session) || session;
  const pricePerKwh = effectivePricePerKwh(session);
  const avgPower = averagePowerKw(session);
  const distanceKm = getDistanceKm(enrichedSession);
  const costPer100Km = getCostPer100Km(enrichedSession);
  const energyPer100Km = getEnergyPer100Km(enrichedSession);
  const recoveredRangeKm = getRecoveredRangeKm(enrichedSession);
  const odometerKm = getSessionOdometerKm(enrichedSession);
  const reasonLabel = (reason) => {
    const key = String(reason?.key || "");
    if (key && t(`outliers.reasonLabels.${key}`) !== `outliers.reasonLabels.${key}`) {
      return t(`outliers.reasonLabels.${key}`);
    }
    return reason?.label || "–";
  };

  return (
    <div className="sessionDrawerOverlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <aside
        className="sessionDrawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-detail-title"
        aria-describedby="session-detail-description"
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="sessionDrawerHeader sessionDetailHeader">
          <div className="sessionDrawerIdentity">
            <span className="sessionDrawerGlyph" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M13 2 6.5 13H12l-1 9 6.5-11H12l1-9Z" /></svg>
            </span>
            <div>
              <div className="sectionKicker">{t("sessionDetail.kicker")}</div>
              <h2 className="sessionDrawerTitle" id="session-detail-title">{datumDE(session.date)}</h2>
              <p className="sessionDrawerDescription" id="session-detail-description">{t("sessionDetail.description")}</p>
            <div className="sessionDrawerMeta">
                <span className="sessionMetaChip">{session.connector || "–"}</span>
                <span className="sessionMetaChip">{pricePerKwh != null ? `${num(pricePerKwh, 3)} €/kWh` : t("sessionDetail.noPrice")}</span>
                {score?.score != null ? <span className="sessionMetaChip accent">{num(score.score, 1)}/100</span> : null}
              </div>
            </div>
          </div>

          <button type="button" className="sessionDrawerClose" onClick={onClose} aria-label={t("sessionDetail.close")}>
            <CloseIcon />
          </button>
        </header>

        <section className="summaryGrid compactSummaryGrid sessionDetailSummary" aria-label={t("sessionDetail.summaryLabel")}>
          <article className="summaryCard warm">
            <div className="summaryLabel">{t("common.cost")}</div>
            <div className="summaryValue">{euro(session.total_cost)}</div>
            <div className="summarySub">{num(session.energy_kwh, 1)} kWh</div>
          </article>

          <article className="summaryCard frost">
            <div className="summaryLabel">{t("sessionDetail.loadProfile")}</div>
            <div className="summaryValue">{avgPower != null ? `${num(avgPower, 1)} kW` : "–"}</div>
            <div className="summarySub">{secsToHHMM(session.duration_seconds)} {t("common.duration")}</div>
          </article>

          <article className="summaryCard mint">
            <div className="summaryLabel">{t("sessionDetail.socWindow")}</div>
            <div className="summaryValue">
              {num(session.soc_start, 0)} → {num(session.soc_end, 0)} %
            </div>
            <div className="summarySub">
              {t("sessionsCard.table.socDelta", {
                value: num(Number(session.soc_end || 0) - Number(session.soc_start || 0), 0),
              })}
            </div>
          </article>

          <article className="summaryCard">
            <div className="summaryLabel">{t("sessionDetail.rangeRecovered")}</div>
            <div className="summaryValue">{recoveredRangeKm != null ? `${num(recoveredRangeKm, 0)} km` : "–"}</div>
            <div className="summarySub">{t("sessionDetail.rangeRecoveredSub")}</div>
          </article>
        </section>

        <div className="sessionDrawerSectionHeading">
          <div>
            <div className="sectionKicker">{t("sessionDetail.metricsKicker")}</div>
            <h3>{t("sessionDetail.metricsTitle")}</h3>
          </div>
        </div>

        <div className="sessionDrawerInfoGrid">
          <article className="sessionDrawerBlock">
            <div className="summaryLabel">{t("sessionDetail.mobility.title")}</div>
            <div className="sessionDrawerLines">
              <div><span>{t("sessionDetail.mobility.distanceSinceLast")}</span><strong>{distanceKm != null ? `${num(distanceKm, 0)} km` : "–"}</strong></div>
              <div><span>{t("sessionDetail.mobility.currentOdometer")}</span><strong>{odometerKm != null ? `${num(odometerKm, 0)} km` : "–"}</strong></div>
              <div><span>{t("sessionDetail.mobility.costPer100Km")}</span><strong>{costPer100Km != null ? `${num(costPer100Km, 2)} €` : "–"}</strong></div>
              <div><span>{t("sessionDetail.mobility.energyPer100Km")}</span><strong>{energyPer100Km != null ? `${num(energyPer100Km, 1)} kWh` : "–"}</strong></div>
            </div>
          </article>

          <article className="sessionDrawerBlock">
            <div className="summaryLabel">{t("sessionDetail.quality.title")}</div>
            <div className="sessionDrawerLines">
              <div><span>{t("sessionDetail.quality.sessionScore")}</span><strong>{score?.score != null ? `${num(score.score, 1)}/100` : "–"}</strong></div>
              <div><span>{t("sessionDetail.quality.priceScore")}</span><strong>{score?.breakdown?.price_score != null ? `${num(score.breakdown.price_score, 0)}` : "–"}</strong></div>
              <div><span>{t("sessionDetail.quality.outlierHints")}</span><strong>{outlier?.flag_count != null ? `${num(outlier.flag_count, 0)}` : "0"}</strong></div>
            </div>
          </article>
        </div>

        <div className="sessionDrawerInfoGrid">
          <article className="sessionDrawerBlock">
            <div className="summaryLabel">{t("sessionDetail.context.title")}</div>
            <div className="sessionDrawerLines">
              <div><span>{t("sessionDetail.context.provider")}</span><strong>{session.provider || "–"}</strong></div>
              <div><span>{t("sessionDetail.context.location")}</span><strong>{session.location || "–"}</strong></div>
              <div><span>{t("sessionDetail.context.vehicle")}</span><strong>{session.vehicle || "–"}</strong></div>
              <div><span>{t("sessionDetail.context.tags")}</span><strong>{parseTags(session.tags).join(", ") || "–"}</strong></div>
            </div>
          </article>
        </div>

        {Array.isArray(outlier?.reasons) && outlier.reasons.length ? (
          <div className="sessionDrawerReasonList">
            {outlier.reasons.map((reason) => (
              <div key={`${reason.key}-${reason.label}`} className="sessionDrawerReason">
                <span>{reasonLabel(reason)}</span>
                <strong>
                  {reason.deviation_pct != null
                    ? t("sessionDetail.reasons.deviation", { value: num(reason.deviation_pct, 0) })
                    : t("sessionDetail.reasons.notable")}
                </strong>
              </div>
            ))}
          </div>
        ) : null}

        {session.note ? (
          <section className="sessionDrawerNote" aria-label={t("sessionDetail.noteTitle")}>
            <span>{t("sessionDetail.noteTitle")}</span>
            <p>{session.note}</p>
          </section>
        ) : null}

        <footer className="sessionDrawerActions sessionDetailActions">
          <button type="button" className="pill pillWarm" onClick={() => onEdit?.(session)}>
            {t("sessionDetail.actions.edit")}
          </button>
          <button type="button" className="pill sessionDeleteAction" onClick={() => onDelete?.(session)} disabled={deleteBusy}>
            {deleteBusy ? t("sessionsCard.buttons.deleting") : t("sessionDetail.actions.delete")}
          </button>
          <button type="button" className="pill ghostPill sessionBackAction" onClick={onClose}>{t("sessionDetail.actions.back")}</button>
        </footer>
      </aside>
    </div>
  );
}
