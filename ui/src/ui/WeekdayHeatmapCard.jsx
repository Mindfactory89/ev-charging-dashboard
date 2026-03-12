import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import Tooltip from "./Tooltip.jsx";
import { getWeekdayLabels } from "./loadRhythm.js";
import { buildWeekdayHeatmap } from "./sessionIntelligence.js";
import { num } from "../app/formatters.js";

export default function WeekdayHeatmapCard({ sessions = [], year = 2026 }) {
  const { locale, t } = useI18n();
  const heatmap = React.useMemo(() => buildWeekdayHeatmap(sessions, { year }), [sessions, year]);
  const weekdayLabels = React.useMemo(() => getWeekdayLabels(), [locale]);

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel heatmapPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">{t("weekdayHeatmap.kicker")}</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">{t("weekdayHeatmap.title", { year })}</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content={t("weekdayHeatmap.tooltipContent")}
              >
                <button className="ttTrigger" type="button" aria-label={t("weekdayHeatmap.tooltipLabel")}>
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {heatmap.strongestCell ? `${heatmap.strongestCell.monthLabel} · ${heatmap.strongestCell.label}` : t("weekdayHeatmap.noHeatmap")}
          </div>
        </div>

        {heatmap.maxCount > 0 ? (
          <>
            <div className="summaryGrid">
              <article className="summaryCard warm">
                <div className="summaryLabel">{t("weekdayHeatmap.strongestWeekday")}</div>
                <div className="summaryValue">{heatmap.topWeekday?.label || "–"}</div>
                <div className="summarySub">
                  {heatmap.topWeekday ? t("weekdayHeatmap.yearSessions", { count: num(heatmap.topWeekday.count, 0) }) : t("weekdayHeatmap.noPattern")}
                </div>
              </article>

              <article className="summaryCard frost">
                <div className="summaryLabel">{t("weekdayHeatmap.busiestMonth")}</div>
                <div className="summaryValue">{heatmap.topMonth?.label || "–"}</div>
                <div className="summarySub">
                  {heatmap.topMonth ? t("weekdayHeatmap.chargingEvents", { count: num(heatmap.topMonth.count, 0) }) : t("weekdayHeatmap.noFocusMonth")}
                </div>
              </article>

              <article className="summaryCard mint">
                <div className="summaryLabel">{t("weekdayHeatmap.strongestCell")}</div>
                <div className="summaryValue">{heatmap.strongestCell?.label || "–"}</div>
                <div className="summarySub">
                  {heatmap.strongestCell
                    ? `${heatmap.strongestCell.monthLabel} • ${t("weekdayHeatmap.cellSessions", { count: num(heatmap.strongestCell.count, 0) })}`
                    : t("weekdayHeatmap.noCellPeak")}
                </div>
              </article>
            </div>

            <div className="heatmapShell">
              <div className="heatmapGrid heatmapHeader">
                <div className="heatmapMonthCell">{t("weekdayHeatmap.monthHeader")}</div>
                {weekdayLabels.map((label) => (
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
              <b>{heatmap.topWeekday?.label || t("weekdayHeatmap.narrativeFallback")}</b> {t("weekdayHeatmap.narrativeLead")}{" "}
              {heatmap.strongestCell
                ? t("weekdayHeatmap.narrativeStrongestCell", {
                    month: heatmap.strongestCell.monthLabel,
                    day: heatmap.strongestCell.label,
                  })
                : t("weekdayHeatmap.narrativePending")}
            </div>
          </>
        ) : (
          <div className="emptyStateCard">{t("weekdayHeatmap.empty", { year })}</div>
        )}
      </div>
    </section>
  );
}
