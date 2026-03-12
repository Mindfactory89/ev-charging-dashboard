import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { num } from "../app/formatters.js";
import Tooltip from "./Tooltip.jsx";
import { getWeekdayUsage } from "./loadRhythm.js";

function smartInsights({ stats, monthly, outliers, socWindowAnalysis, sessions = [], t }) {
  const items = [];
  const activeMonths = Array.isArray(monthly?.months)
    ? monthly.months.filter((month) => Number(month?.count || 0) > 0)
    : [];
  const latestMonth = activeMonths[activeMonths.length - 1] || null;
  const previousMonth = activeMonths.length > 1 ? activeMonths[activeMonths.length - 2] : null;
  const weekdayFact = getWeekdayUsage(sessions).top;
  const latestMonthWeekdayFact = latestMonth ? getWeekdayUsage(sessions, { month: latestMonth.month }).top : null;

  if (latestMonth && previousMonth && latestMonth.price_per_kwh != null && previousMonth.price_per_kwh != null) {
    const trend = previousMonth.price_per_kwh > 0 ? ((latestMonth.price_per_kwh - previousMonth.price_per_kwh) / previousMonth.price_per_kwh) * 100 : 0;
    if (Math.abs(trend) >= 6) {
      items.push({
        id: "price-trend",
        title: t("smartInsights.items.priceTrend.title"),
        value: `${trend > 0 ? "+" : ""}${num(trend, 0)}%`,
        text: t("smartInsights.items.priceTrend.text"),
      });
    }
  }

  if (weekdayFact?.label && weekdayFact.count > 0) {
    items.push({
      id: "weekday-peak",
      title: t("smartInsights.items.weekdayPeak.title"),
      value: weekdayFact.label,
      text: t("smartInsights.items.weekdayPeak.text", {
        day: weekdayFact.label,
        count: num(weekdayFact.count, 0),
        share: weekdayFact.share ? t("smartInsights.items.shareSuffix", { share: num(weekdayFact.share, 0) }) : "",
      }),
    });
  }

  if (latestMonth?.month && latestMonthWeekdayFact?.label) {
    items.push({
      id: "focus-month-weekday",
      title: t("smartInsights.items.focusMonthWeekday.title"),
      value: latestMonthWeekdayFact.label,
      text: t("smartInsights.items.focusMonthWeekday.text", {
        day: latestMonthWeekdayFact.label,
        count: num(latestMonthWeekdayFact.count, 0),
        share: latestMonthWeekdayFact.share
          ? t("smartInsights.items.focusShareSuffix", { share: num(latestMonthWeekdayFact.share, 0) })
          : "",
      }),
    });
  }

  if (stats?.avg_power_kw != null && stats?.medians?.power_kw != null) {
    const avgPower = Number(stats.avg_power_kw);
    const medianPower = Number(stats.medians.power_kw);
    if (avgPower > 0 && medianPower > 0) {
      const drift = ((avgPower - medianPower) / medianPower) * 100;
      if (Math.abs(drift) >= 12) {
        items.push({
          id: "power-drift",
          title: t("smartInsights.items.powerDrift.title"),
          value: `${drift > 0 ? "+" : ""}${num(drift, 0)}%`,
          text: drift > 0 ? t("smartInsights.items.powerDrift.above") : t("smartInsights.items.powerDrift.below"),
        });
      }
    }
  }

  if (socWindowAnalysis?.highlights?.fastest_window?.label && socWindowAnalysis?.highlights?.best_efficiency_window?.label) {
    items.push({
      id: "soc-window",
      title: t("smartInsights.items.socWindow.title"),
      value: socWindowAnalysis.highlights.best_efficiency_window.label,
      text:
        socWindowAnalysis.highlights.fastest_window.label === socWindowAnalysis.highlights.best_efficiency_window.label
          ? t("smartInsights.items.socWindow.same")
          : t("smartInsights.items.socWindow.different", {
              best: socWindowAnalysis.highlights.best_efficiency_window.label,
              fastest: socWindowAnalysis.highlights.fastest_window.label,
            }),
    });
  }

  if (outliers?.outlier_count) {
    items.push({
      id: "outliers",
      title: t("smartInsights.items.outliers.title"),
      value: `${num(outliers.outlier_count, 0)}`,
      text: t("smartInsights.items.outliers.text", { count: num(outliers.outlier_count, 0) }),
    });
  }

  const overEighty = sessions.filter((session) => Number(session?.soc_end) >= 80 && Number(session?.duration_seconds) > 0);
  const underEighty = sessions.filter((session) => Number(session?.soc_end) < 80 && Number(session?.duration_seconds) > 0);
  if (overEighty.length >= 2 && underEighty.length >= 2) {
    const avgPower = (rows) =>
      rows.reduce((sum, session) => sum + Number(session.energy_kwh || 0) / (Number(session.duration_seconds || 0) / 3600), 0) /
      rows.length;
    const high = avgPower(overEighty);
    const low = avgPower(underEighty);
    if (Number.isFinite(high) && Number.isFinite(low) && low > 0) {
      const diff = ((high - low) / low) * 100;
      if (Math.abs(diff) >= 10) {
        items.push({
          id: "eighty-cutoff",
          title: t("smartInsights.items.eightyCutoff.title"),
          value: `${diff > 0 ? "+" : ""}${num(diff, 0)}%`,
          text: diff > 0 ? t("smartInsights.items.eightyCutoff.above") : t("smartInsights.items.eightyCutoff.below"),
        });
      }
    }
  }

  return items.slice(0, 5);
}

export default function SmartInsightsCard({ stats, monthly, outliers, socWindowAnalysis, sessions = [], year = 2026 }) {
  const { t } = useI18n();
  const items = React.useMemo(
    () => smartInsights({ stats, monthly, outliers, socWindowAnalysis, sessions, t }),
    [stats, monthly, outliers, socWindowAnalysis, sessions, t]
  );

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">{t("smartInsights.kicker")}</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">{t("smartInsights.title", { year })}</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content={t("smartInsights.tooltipContent")}
              >
                <button className="ttTrigger" type="button" aria-label={t("smartInsights.tooltipLabel")}>
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {items.length ? t("smartInsights.meta", { count: num(items.length, 0) }) : t("smartInsights.empty", { year })}
          </div>
        </div>

        <div className="detailCardGrid">
          {items.length ? (
            items.map((item) => (
              <article key={item.id} className="detailCard featured">
                <div className="detailCardTop">
                  <div className="detailCardTitle">{item.title}</div>
                  <div className="detailCardMeta">{item.value}</div>
                </div>
                <div className="detailCardSub">{item.text}</div>
              </article>
            ))
          ) : (
            <div className="emptyStateCard">{t("smartInsights.empty", { year })}</div>
          )}
        </div>
      </div>
    </section>
  );
}
