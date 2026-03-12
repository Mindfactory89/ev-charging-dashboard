import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { euro, num } from "../app/formatters.js";
import Tooltip from "./Tooltip.jsx";

export default function ForecastCard({ months, year = 2026 }) {
  const { t } = useI18n();
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
      confidence: monthIndex >= 8 ? "high" : monthIndex >= 5 ? "medium" : "early",
      progressPct: (monthIndex / 12) * 100,
    };
  }, [activeMonths]);

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">{t("forecast.kicker")}</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">{t("forecast.title", { year })}</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content={t("forecast.tooltipContent")}
              >
                <button className="ttTrigger" type="button" aria-label={t("forecast.tooltipLabel")}>
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {snapshot
              ? t("forecast.confidenceMeta", { confidence: t(`forecast.confidence.${snapshot.confidence}`) })
              : t("forecast.noBasis")}
          </div>
        </div>

        <div className="summaryGrid">
          {snapshot ? (
            <>
              <div className="summaryCard warm">
                <div className="summaryLabel">{t("forecast.projectedCost")}</div>
                <div className="summaryValue">{euro(snapshot.projectedCost)}</div>
                <div className="summarySub">{t("forecast.soFarCost", { value: euro(snapshot.realizedCost) })}</div>
              </div>

              <div className="summaryCard frost">
                <div className="summaryLabel">{t("forecast.projectedEnergy")}</div>
                <div className="summaryValue">{`${num(snapshot.projectedEnergy, 1)} kWh`}</div>
                <div className="summarySub">{t("forecast.soFarEnergy", { value: num(snapshot.realizedEnergy, 1) })}</div>
              </div>

              <div className="summaryCard mint">
                <div className="summaryLabel">{t("forecast.projectedSessions")}</div>
                <div className="summaryValue">{num(snapshot.projectedCount, 0)}</div>
                <div className="summarySub">{t("forecast.soFarSessions", { value: num(snapshot.realizedCount, 0) })}</div>
              </div>
            </>
          ) : (
            <div className="emptyStateCard">{t("forecast.empty", { year })}</div>
          )}
        </div>

        {snapshot ? (
          <>
            <div className="forecastBarShell">
              <div className="forecastBarFill" style={{ width: `${Math.max(8, Math.min(100, snapshot.progressPct))}%` }} />
            </div>

            <div className="metricNarrative">
              <b>
                {t("forecast.narrative", {
                  monthIndex: num(snapshot.monthIndex, 0),
                  year,
                  cost: euro(snapshot.projectedCost),
                  energy: num(snapshot.projectedEnergy, 1),
                  count: num(snapshot.projectedCount, 0),
                })}
              </b>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
