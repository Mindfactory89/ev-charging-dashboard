import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import Tooltip from "./Tooltip.jsx";
import { monthLabel } from "./monthLabels.js";
import { getWeekdayUsage } from "./loadRhythm.js";
import { euro, num } from "../app/formatters.js";

function monthMedians(sessions, month) {
  const values = (sessions || [])
    .filter((session) => {
      const date = new Date(session.date);
      return !Number.isNaN(date.getTime()) && date.getUTCMonth() + 1 === month;
    });

  const costValues = values.map((session) => Number(session.total_cost)).filter((value) => Number.isFinite(value));
  const priceValues = values
    .map((session) => {
      const energy = Number(session.energy_kwh);
      const cost = Number(session.total_cost);
      return Number.isFinite(energy) && energy > 0 && Number.isFinite(cost) ? cost / energy : null;
    })
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  function median(clean) {
    if (!clean.length) return null;
    const mid = Math.floor(clean.length / 2);
    if (clean.length % 2 === 1) return clean[mid];
    return (clean[mid - 1] + clean[mid]) / 2;
  }

  return {
    cost: median([...costValues].sort((left, right) => left - right)),
    price: median(priceValues),
  };
}

export default function MonthlyReportCard({ months, sessions = [], year = 2026 }) {
  const { t } = useI18n();
  const activeMonths = React.useMemo(
    () => (Array.isArray(months) ? months.filter((month) => Number(month?.count || 0) > 0) : []),
    [months]
  );

  const current = activeMonths[activeMonths.length - 1] || null;
  const previous = activeMonths.length > 1 ? activeMonths[activeMonths.length - 2] : null;
  const currentMedian = current ? monthMedians(sessions, current.month) : { cost: null, price: null };
  const currentWeekday = React.useMemo(
    () => (current ? getWeekdayUsage(sessions, { year, month: current.month }).top : null),
    [current, sessions, year]
  );
  const yearWeekday = React.useMemo(() => getWeekdayUsage(sessions, { year }).top, [sessions, year]);

  function delta(currentValue, previousValue, digits = 1, suffix = "") {
    const left = Number(currentValue);
    const right = Number(previousValue);
    if (!Number.isFinite(left) || !Number.isFinite(right) || right === 0) return "–";
    const diff = ((left - right) / right) * 100;
    return `${diff > 0 ? "+" : ""}${num(diff, digits)}%${suffix}`;
  }

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel premiumEditorialReportCard">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">{t("monthlyReport.kicker")}</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">{t("monthlyReport.title", { year })}</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content={t("monthlyReport.tooltipContent")}
              >
                <button className="ttTrigger" type="button" aria-label={t("monthlyReport.tooltipLabel")}>
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {current ? t("monthlyReport.focus", { month: monthLabel(current.month) }) : t("monthlyReport.noMonthlyData")}
          </div>
        </div>

        <div className="summaryGrid premiumEditorialSummaryGrid">
          {current ? (
            <>
              <div className="summaryCard warm">
                <div className="summaryLabel">{t("monthlyReport.monthlyCost")}</div>
                <div className="summaryValue">{euro(current.cost)}</div>
                <div className="summarySub">
                  {previous ? `${delta(current.cost, previous.cost, 0)} vs. ${monthLabel(previous.month)}` : t("monthlyReport.firstActiveMonth")}
                </div>
              </div>

              <div className="summaryCard frost">
                <div className="summaryLabel">{t("monthlyReport.monthlyEnergy")}</div>
                <div className="summaryValue">{`${num(current.energy_kwh, 1)} kWh`}</div>
                <div className="summarySub">
                  {previous ? `${delta(current.energy_kwh, previous.energy_kwh, 0)} vs. ${monthLabel(previous.month)}` : t("monthlyReport.firstActiveMonth")}
                </div>
              </div>

              <div className="summaryCard mint">
                <div className="summaryLabel">{t("monthlyReport.medianCost")}</div>
                <div className="summaryValue">{euro(currentMedian.cost)}</div>
                <div className="summarySub">{t("monthlyReport.medianCostSub")}</div>
              </div>

              <div className="summaryCard">
                <div className="summaryLabel">{t("monthlyReport.medianPrice")}</div>
                <div className="summaryValue">{currentMedian.price != null ? `${num(currentMedian.price, 3)} €/kWh` : "–"}</div>
                <div className="summarySub">{t("monthlyReport.medianPriceSub")}</div>
              </div>

              <div className="summaryCard frost">
                <div className="summaryLabel">{t("monthlyReport.topWeekdayMonth")}</div>
                <div className="summaryValue">{currentWeekday?.label || "–"}</div>
                <div className="summarySub">
                  {currentWeekday ? `${num(currentWeekday.count, 0)} Sessions • ${num(currentWeekday.share, 0)} % Anteil` : t("monthlyReport.noClearRhythm")}
                </div>
              </div>

              <div className="summaryCard mint">
                <div className="summaryLabel">{t("monthlyReport.topWeekdayYear")}</div>
                <div className="summaryValue">{yearWeekday?.label || "–"}</div>
                <div className="summarySub">
                  {yearWeekday
                    ? `${num(yearWeekday.count, 0)} Sessions • ${t("monthlyReport.recurringWeekday")}`
                    : t("monthlyReport.noYearRhythm")}
                </div>
              </div>
            </>
          ) : (
            <div className="emptyStateCard">{t("monthlyReport.empty", { year })}</div>
          )}
        </div>

        {current ? (
          <div className="metricNarrative">
            <b>{t("monthlyReport.narrativeIntro", {
              month: monthLabel(current.month),
              count: num(current.count, 0),
              cost: euro(current.cost),
            })}</b>{" "}
            {currentWeekday ? `${t("monthlyReport.narrativeWeekday", { weekday: currentWeekday.label })} ` : ""}
            {previous
              ? t("monthlyReport.narrativeDelta", { month: monthLabel(previous.month) })
              : t("monthlyReport.narrativeAwaitingComparison")}
          </div>
        ) : null}
      </div>
    </section>
  );
}
