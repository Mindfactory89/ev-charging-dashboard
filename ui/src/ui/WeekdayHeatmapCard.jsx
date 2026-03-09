import React from "react";
import Tooltip from "./Tooltip.jsx";
import { WEEKDAY_LABELS } from "./loadRhythm.js";
import { buildWeekdayHeatmap } from "./sessionIntelligence.js";

function num(value, digits = 1) {
  const numValue = Number(value);
  if (!Number.isFinite(numValue)) return "–";
  return numValue.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

export default function WeekdayHeatmapCard({ sessions = [], year = 2026 }) {
  const heatmap = React.useMemo(() => buildWeekdayHeatmap(sessions, { year }), [sessions, year]);

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel heatmapPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">Rhythmus</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">Wochentag-Heatmap ({year})</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content="Zeigt, in welchen Monaten und an welchen Wochentagen du am häufigsten geladen hast. Dunklere Felder bedeuten mehr Sessions."
              >
                <button className="ttTrigger" type="button" aria-label="Erklärung: Wochentag-Heatmap">
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {heatmap.strongestCell ? `${heatmap.strongestCell.monthLabel} · ${heatmap.strongestCell.label}` : "Noch keine Heatmap"}
          </div>
        </div>

        {heatmap.maxCount > 0 ? (
          <>
            <div className="summaryGrid">
              <article className="summaryCard warm">
                <div className="summaryLabel">Stärkster Wochentag</div>
                <div className="summaryValue">{heatmap.topWeekday?.label || "–"}</div>
                <div className="summarySub">{heatmap.topWeekday ? `${num(heatmap.topWeekday.count, 0)} Sessions über das Jahr` : "Noch kein Muster"}</div>
              </article>

              <article className="summaryCard frost">
                <div className="summaryLabel">Busiest Month</div>
                <div className="summaryValue">{heatmap.topMonth?.label || "–"}</div>
                <div className="summarySub">{heatmap.topMonth ? `${num(heatmap.topMonth.count, 0)} Ladevorgänge` : "Noch kein Fokusmonat"}</div>
              </article>

              <article className="summaryCard mint">
                <div className="summaryLabel">Stärkste Zelle</div>
                <div className="summaryValue">{heatmap.strongestCell?.label || "–"}</div>
                <div className="summarySub">
                  {heatmap.strongestCell ? `${heatmap.strongestCell.monthLabel} • ${num(heatmap.strongestCell.count, 0)} Sessions` : "Noch keine Zellspitze"}
                </div>
              </article>
            </div>

            <div className="heatmapShell">
              <div className="heatmapGrid heatmapHeader">
                <div className="heatmapMonthCell">Monat</div>
                {WEEKDAY_LABELS.map((label) => (
                  <div key={`weekday-${label}`} className="heatmapWeekdayCell">
                    {label.slice(0, 2)}
                  </div>
                ))}
              </div>

              {heatmap.months.map((monthRow) => (
                <div key={`heatmap-month-${monthRow.month}`} className="heatmapGrid heatmapRow">
                  <div className="heatmapMonthCell">{monthRow.label}</div>
                  {monthRow.cells.map((cell) => {
                    const intensity = heatmap.maxCount > 0 ? cell.count / heatmap.maxCount : 0;
                    return (
                      <Tooltip
                        key={`${monthRow.month}-${cell.weekday}`}
                        placement="top"
                        openDelayMs={90}
                        closeDelayMs={150}
                        content={`${monthRow.label} · ${cell.label}: ${num(cell.count, 0)} Sessions • ${num(cell.energyKwh, 1)} kWh`}
                      >
                        <button
                          type="button"
                          className={`heatmapCell ${cell.count > 0 ? "active" : "idle"}`}
                          style={{
                            ["--heat-intensity"]: `${Math.max(0.08, intensity)}`,
                          }}
                          aria-label={`${monthRow.label} ${cell.label}: ${num(cell.count, 0)} Sessions`}
                        >
                          <span>{cell.count > 0 ? num(cell.count, 0) : "–"}</span>
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="metricNarrative">
              <b>{heatmap.topWeekday?.label || "Der häufigste Tag"}</b> prägt dein Jahresmuster.{" "}
              {heatmap.strongestCell
                ? `Die dichteste Kombination liegt aktuell in ${heatmap.strongestCell.monthLabel} am ${heatmap.strongestCell.label}.`
                : "Mit mehr Sessions wird hier automatisch die stärkste Kombination aus Monat und Wochentag beschrieben."}
            </div>
          </>
        ) : (
          <div className="emptyStateCard">Noch keine Sessions für eine Wochentag-Heatmap in {year} vorhanden.</div>
        )}
      </div>
    </section>
  );
}
