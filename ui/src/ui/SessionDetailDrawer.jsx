import React from "react";
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

function num(value, digits = 1) {
  const numValue = Number(value);
  if (!Number.isFinite(numValue)) return "–";
  return numValue.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function euro(value) {
  const numValue = Number(value);
  if (!Number.isFinite(numValue)) return "–";
  return numValue.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function dateLabel(value) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleDateString("de-DE");
}

function secsToHHMM(value) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return "–";
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export default function SessionDetailDrawer({ session, sessions = [], score, outlier, onClose, onEdit }) {
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

  return (
    <div className="sessionDrawerOverlay" role="presentation" onClick={onClose}>
      <aside
        className="sessionDrawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Session Details ${dateLabel(session.date)}`}
        tabIndex={-1}
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sessionDrawerHeader">
          <div>
            <div className="sectionKicker">Session Detail</div>
            <div className="sessionDrawerTitle">{dateLabel(session.date)}</div>
            <div className="sessionDrawerMeta">
              <span>{session.connector || "–"}</span>
              <span>{pricePerKwh != null ? `${num(pricePerKwh, 3)} €/kWh` : "Kein Preis"}</span>
            </div>
          </div>

          <button type="button" className="pill ghostPill" onClick={onClose}>
            Schließen
          </button>
        </div>

        <div className="summaryGrid compactSummaryGrid">
          <article className="summaryCard warm">
            <div className="summaryLabel">Kosten</div>
            <div className="summaryValue">{euro(session.total_cost)}</div>
            <div className="summarySub">{num(session.energy_kwh, 1)} kWh</div>
          </article>

          <article className="summaryCard frost">
            <div className="summaryLabel">Ladeprofil</div>
            <div className="summaryValue">{avgPower != null ? `${num(avgPower, 1)} kW` : "–"}</div>
            <div className="summarySub">{secsToHHMM(session.duration_seconds)} Dauer</div>
          </article>

          <article className="summaryCard mint">
            <div className="summaryLabel">SoC-Fenster</div>
            <div className="summaryValue">
              {num(session.soc_start, 0)} → {num(session.soc_end, 0)} %
            </div>
            <div className="summarySub">{num(Number(session.soc_end || 0) - Number(session.soc_start || 0), 0)} %-Hub</div>
          </article>

          <article className="summaryCard">
            <div className="summaryLabel">Range Recovered</div>
            <div className="summaryValue">{recoveredRangeKm != null ? `${num(recoveredRangeKm, 0)} km` : "–"}</div>
            <div className="summarySub">abgeleitet aus 17,2 kWh / 100 km</div>
          </article>
        </div>

        <div className="sessionDrawerInfoGrid">
          <article className="sessionDrawerBlock">
            <div className="summaryLabel">Mobilität</div>
            <div className="sessionDrawerLines">
              <div><span>Distanz seit letzter KM-Erfassung</span><strong>{distanceKm != null ? `${num(distanceKm, 0)} km` : "–"}</strong></div>
              <div><span>Aktueller Kilometerstand</span><strong>{odometerKm != null ? `${num(odometerKm, 0)} km` : "–"}</strong></div>
              <div><span>Kosten / 100 km</span><strong>{costPer100Km != null ? `${num(costPer100Km, 2)} €` : "–"}</strong></div>
              <div><span>Verbrauch / 100 km</span><strong>{energyPer100Km != null ? `${num(energyPer100Km, 1)} kWh` : "–"}</strong></div>
            </div>
          </article>

          <article className="sessionDrawerBlock">
            <div className="summaryLabel">Score & Qualität</div>
            <div className="sessionDrawerLines">
              <div><span>Session Score</span><strong>{score?.score != null ? `${num(score.score, 1)}/100` : "–"}</strong></div>
              <div><span>Preis-Score</span><strong>{score?.breakdown?.price_score != null ? `${num(score.breakdown.price_score, 0)}` : "–"}</strong></div>
              <div><span>Ausreißer-Hinweise</span><strong>{outlier?.flag_count != null ? `${num(outlier.flag_count, 0)}` : "0"}</strong></div>
            </div>
          </article>
        </div>

        {Array.isArray(outlier?.reasons) && outlier.reasons.length ? (
          <div className="sessionDrawerReasonList">
            {outlier.reasons.map((reason) => (
              <div key={`${reason.key}-${reason.label}`} className="sessionDrawerReason">
                <span>{reason.label}</span>
                <strong>{reason.deviation_pct != null ? `${num(reason.deviation_pct, 0)} % Abweichung` : "Auffällig"}</strong>
              </div>
            ))}
          </div>
        ) : null}

        {session.note ? <div className="metricNarrative">{session.note}</div> : null}

        <div className="sessionDrawerActions">
          <button type="button" className="pill pillWarm" onClick={() => onEdit?.(session)}>
            Bearbeiten
          </button>
          <button type="button" className="pill ghostPill" onClick={onClose}>
            Zurück zur Tabelle
          </button>
        </div>
      </aside>
    </div>
  );
}
