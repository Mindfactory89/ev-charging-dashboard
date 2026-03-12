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

export default function SessionDetailDrawer({ session, sessions = [], score, outlier, onClose, onEdit }) {
  const { t } = useI18n();
  const panelRef = React.useRef(null);

  React.useEffect(() => {
    if (!session) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => panelRef.current?.focus?.(), 40);

    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [session, onClose]);

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
    <div className="sessionDrawerOverlay" role="presentation" onClick={onClose}>
      <aside
        className="sessionDrawer"
        role="dialog"
        aria-modal="true"
        aria-label={t("sessionDetail.ariaLabel", { date: datumDE(session.date) })}
        tabIndex={-1}
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sessionDrawerHeader">
          <div>
            <div className="sectionKicker">{t("sessionDetail.kicker")}</div>
            <div className="sessionDrawerTitle">{datumDE(session.date)}</div>
            <div className="sessionDrawerMeta">
              <span>{session.connector || "–"}</span>
              <span>{pricePerKwh != null ? `${num(pricePerKwh, 3)} €/kWh` : t("sessionDetail.noPrice")}</span>
            </div>
          </div>

          <button type="button" className="pill ghostPill" onClick={onClose}>
            {t("sessionDetail.close")}
          </button>
        </div>

        <div className="summaryGrid compactSummaryGrid">
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

        {session.note ? <div className="metricNarrative">{session.note}</div> : null}

        <div className="sessionDrawerActions">
          <button type="button" className="pill pillWarm" onClick={() => onEdit?.(session)}>
            {t("sessionDetail.actions.edit")}
          </button>
          <button type="button" className="pill ghostPill" onClick={onClose}>
            {t("sessionDetail.actions.back")}
          </button>
        </div>
      </aside>
    </div>
  );
}
