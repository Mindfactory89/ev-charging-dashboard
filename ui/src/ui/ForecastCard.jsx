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

export default function ForecastCard({ months, year = 2026 }) {
  const activeMonths = React.useMemo(
    () => (Array.isArray(months) ? months.filter((month) => Number(month?.count || 0) > 0) : []),
    [months]
  );

  const snapshot = React.useMemo(() => {
    if (!activeMonths.length) return null;

    const latestMonth = activeMonths[activeMonths.length - 1];
    const monthIndex = Math.max(1, Number(latestMonth?.month || activeMonths.length));
    const totals = activeMonths.reduce(
      (sum, month) => ({
        cost: sum.cost + Number(month.cost || 0),
        energy: sum.energy + Number(month.energy_kwh || 0),
        count: sum.count + Number(month.count || 0),
      }),
      { cost: 0, energy: 0, count: 0 }
    );

    const multiplier = 12 / monthIndex;
    return {
      monthIndex,
      realizedCost: totals.cost,
      realizedEnergy: totals.energy,
      realizedCount: totals.count,
      projectedCost: totals.cost * multiplier,
      projectedEnergy: totals.energy * multiplier,
      projectedCount: totals.count * multiplier,
      confidence: monthIndex >= 8 ? "hoch" : monthIndex >= 5 ? "mittel" : "früh",
      progressPct: (monthIndex / 12) * 100,
    };
  }, [activeMonths]);

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">Forecast</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">Jahreshochrechnung ({year})</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content="Hochrechnung auf Basis des bisherigen Jahrespaces. Je weiter das Jahr fortgeschritten ist, desto stabiler wird die Prognose."
              >
                <button className="ttTrigger" type="button" aria-label="Erklärung: Jahreshochrechnung">
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {snapshot ? `Sicherheit ${snapshot.confidence}` : "Keine Basis"}
          </div>
        </div>

        <div className="summaryGrid">
          {snapshot ? (
            <>
              <div className="summaryCard warm">
                <div className="summaryLabel">Forecast Kosten</div>
                <div className="summaryValue">{euro(snapshot.projectedCost)}</div>
                <div className="summarySub">{`Bisher: ${euro(snapshot.realizedCost)}`}</div>
              </div>

              <div className="summaryCard frost">
                <div className="summaryLabel">Forecast Energie</div>
                <div className="summaryValue">{`${num(snapshot.projectedEnergy, 1)} kWh`}</div>
                <div className="summarySub">{`Bisher: ${num(snapshot.realizedEnergy, 1)} kWh`}</div>
              </div>

              <div className="summaryCard mint">
                <div className="summaryLabel">Forecast Sessions</div>
                <div className="summaryValue">{num(snapshot.projectedCount, 0)}</div>
                <div className="summarySub">{`Bisher: ${num(snapshot.realizedCount, 0)} Sessions`}</div>
              </div>
            </>
          ) : (
            <div className="emptyStateCard">Für {year} gibt es noch keine Basis für eine Hochrechnung.</div>
          )}
        </div>

        {snapshot ? (
          <>
            <div className="forecastBarShell">
              <div className="forecastBarFill" style={{ width: `${Math.max(8, Math.min(100, snapshot.progressPct))}%` }} />
            </div>

            <div className="metricNarrative">
              Stand nach <b>{num(snapshot.monthIndex, 0)} von 12 Monaten</b>: Wenn dein bisheriger Pace anhält, endet {year}{" "}
              voraussichtlich bei <b>{euro(snapshot.projectedCost)}</b>, <b>{num(snapshot.projectedEnergy, 1)} kWh</b> und{" "}
              <b>{num(snapshot.projectedCount, 0)} Sessions</b>.
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
