import React from "react";
import Tooltip from "./Tooltip.jsx";

function num(n, digits = 1) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "–";
  return value.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function euro(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "–";
  return value.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function minutesFromSeconds(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return "–";
  return `${Math.round(value / 60)} min`;
}

export default function MedianSnapshotPanel({ stats, year = 2026 }) {
  const medians = stats?.medians || null;
  const hasValues = medians && Object.values(medians).some((value) => value != null);

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">Median</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">Median Snapshot ({year})</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content="Medianwerte zeigen den typischen Ladevorgang robuster als Durchschnittswerte, weil einzelne Ausreißer weniger verzerren."
              >
                <button className="ttTrigger" type="button" aria-label="Erklärung: Median Snapshot">
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">{hasValues ? "Typischer Ladevorgang" : "Keine Daten"}</div>
        </div>

        <div className="summaryGrid">
          {hasValues ? (
            <>
              <div className="summaryCard warm">
                <div className="summaryLabel">Median Energie</div>
                <div className="summaryValue">{medians?.energy_kwh != null ? `${num(medians.energy_kwh, 1)} kWh` : "–"}</div>
                <div className="summarySub">Typische Energiemenge pro Session</div>
              </div>

              <div className="summaryCard">
                <div className="summaryLabel">Median Kosten</div>
                <div className="summaryValue">{euro(medians?.cost_per_session)}</div>
                <div className="summarySub">Typische Kosten pro Ladevorgang</div>
              </div>

              <div className="summaryCard frost">
                <div className="summaryLabel">Median Preis</div>
                <div className="summaryValue">{medians?.price_per_kwh != null ? `${num(medians.price_per_kwh, 3)} €/kWh` : "–"}</div>
                <div className="summarySub">Effektives Preisniveau ohne Ausreißer-Bias</div>
              </div>

              <div className="summaryCard mint">
                <div className="summaryLabel">Median Ladeleistung</div>
                <div className="summaryValue">{medians?.power_kw != null ? `${num(medians.power_kw, 1)} kW` : "–"}</div>
                <div className="summarySub">Typische Ladegeschwindigkeit</div>
              </div>

              <div className="summaryCard">
                <div className="summaryLabel">Median Dauer</div>
                <div className="summaryValue">{minutesFromSeconds(medians?.duration_seconds)}</div>
                <div className="summarySub">Typische Sessiondauer</div>
              </div>
            </>
          ) : (
            <div className="emptyStateCard">Keine Medianwerte für {year} vorhanden.</div>
          )}
        </div>
      </div>
    </section>
  );
}
