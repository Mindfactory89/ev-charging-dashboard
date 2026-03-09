import React from "react";
import Tooltip from "./Tooltip.jsx";
import { buildDrivingEfficiencyProfile } from "./sessionIntelligence.js";

function num(value, digits = 1) {
  const numValue = Number(value);
  if (!Number.isFinite(numValue)) return "–";
  return numValue.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function dateLabel(value) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleDateString("de-DE");
}

export default function MobilityCostCard({ sessions = [], year = 2026 }) {
  const mobility = React.useMemo(() => buildDrivingEfficiencyProfile(sessions), [sessions]);

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel mobilityPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">Fahreffizienz</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">Fahrprofil & Effizienz ({year})</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content="Pro Ladevorgang reicht der aktuelle Kilometerstand nach dem Laden. Das Dashboard berechnet daraus automatisch die Differenz zum vorherigen Eintrag sowie Distanz, Verbrauch, Effizienzlabel und Fahrtipps."
              >
                <button className="ttTrigger" type="button" aria-label="Erklärung: Fahrprofil und Effizienz">
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {mobility.coveredSessions.length ? `${num(mobility.coveragePct, 0)} % Abdeckung` : "Noch keine km-Basis"}
          </div>
        </div>

        {mobility.coveredSessions.length ? (
          <>
            <div className="summaryGrid">
              <article className="summaryCard warm">
                <div className="summaryLabel">Fahrprofil</div>
                <div className={`summaryValue mobilityLabelValue tone-${mobility.tone}`}>{mobility.label}</div>
                <div className="summarySub">{mobility.score != null ? `${num(mobility.score, 0)}/100 Effizienzscore` : "Noch keine Bewertung"}</div>
              </article>

              <article className="summaryCard frost">
                <div className="summaryLabel">Ø Kosten / 100 km</div>
                <div className="summaryValue">{mobility.avgCostPer100Km != null ? `${num(mobility.avgCostPer100Km, 2)} €` : "–"}</div>
                <div className="summarySub">auf Basis der KM-Differenzen zwischen den Einträgen</div>
              </article>

              <article className="summaryCard mint">
                <div className="summaryLabel">Ø Verbrauch / 100 km</div>
                <div className="summaryValue">{mobility.avgEnergyPer100Km != null ? `${num(mobility.avgEnergyPer100Km, 1)} kWh` : "–"}</div>
                <div className="summarySub">reiner Ladeverbrauch aus der Distanz zwischen zwei KM-Ständen</div>
              </article>

              <article className="summaryCard">
                <div className="summaryLabel">Erfasste Fahrleistung</div>
                <div className="summaryValue">{num(mobility.totalDistanceKm, 0)} km</div>
                <div className="summarySub">
                  {num(mobility.coveredSessions.length, 0)} Distanzsegmente • Ø {mobility.avgDistanceKm != null ? `${num(mobility.avgDistanceKm, 0)} km` : "–"}
                </div>
              </article>
            </div>

            <div className="summaryGrid compactSummaryGrid">
              <article className="summaryCard glassLite">
                <div className="summaryLabel">Effizienteste Fahrt</div>
                <div className="summaryValue">
                  {mobility.bestTrip?.costPer100Km != null ? `${num(mobility.bestTrip.costPer100Km, 2)} €/100 km` : "–"}
                </div>
                <div className="summarySub">{mobility.bestTrip ? `${dateLabel(mobility.bestTrip.date)} • ${num(mobility.bestTrip.distanceKm, 0)} km` : "Keine Vergleichsfahrt"}</div>
              </article>

              <article className="summaryCard glassLite">
                <div className="summaryLabel">Teuerste Fahrt</div>
                <div className="summaryValue">
                  {mobility.worstTrip?.costPer100Km != null ? `${num(mobility.worstTrip.costPer100Km, 2)} €/100 km` : "–"}
                </div>
                <div className="summarySub">{mobility.worstTrip ? `${dateLabel(mobility.worstTrip.date)} • ${num(mobility.worstTrip.distanceKm, 0)} km` : "Keine Vergleichsfahrt"}</div>
              </article>
            </div>

            <div className="efficiencyTipsGrid">
              {mobility.tips.map((tip, index) => (
                <article key={`eff-tip-${index}`} className="efficiencyTipCard">
                  <div className="summaryLabel">Fahrtipp {index + 1}</div>
                  <div className="summarySub">{tip}</div>
                </article>
              ))}
            </div>

            <div className="metricNarrative">
              {mobility.narrative}{" "}
              {mobility.avgCostPer100Km != null ? `Aktuell entspricht das rund ${num(mobility.avgCostPer100Km, 2)} € pro 100 km.` : ""}
            </div>
          </>
        ) : (
          <div className="emptyStateCard">
            Für {year} fehlen noch Sessions mit Kilometerstand. Erfasse pro Ladevorgang einfach den aktuellen KM-Stand nach dem Laden, dann berechnet das Dashboard Distanz, Verbrauch und Fahrprofil automatisch aus der Differenz zum vorherigen Eintrag.
          </div>
        )}
      </div>
    </section>
  );
}
