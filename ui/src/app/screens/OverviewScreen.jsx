import { Suspense, lazy } from "react";
import MonthlyChart from "../../ui/MonthlyChart.jsx";
import MonthlyReportCard from "../../ui/MonthlyReportCard.jsx";
import Tooltip from "../../ui/Tooltip.jsx";
import LazySectionFallback from "../LazySectionFallback.jsx";
import { monthLabel } from "../../ui/monthLabels.js";
import { datumDE, euro, num } from "../formatters.js";
import { useI18n } from "../../i18n/I18nProvider.jsx";

const ForecastCard = lazy(() => import("../../ui/ForecastCard.jsx"));
const PowerCurveCard = lazy(() => import("../../ui/PowerCurveCard.jsx"));
const YearComparisonPanel = lazy(() => import("../../ui/YearComparisonPanel.jsx"));

function comparisonRightYear(year, availableYears) {
  const alternatives = (availableYears || []).filter((entry) => Number(entry) !== Number(year));
  return alternatives[0] ?? year;
}

export default function OverviewScreen({
  activeMonths,
  availableYears,
  currentPrev,
  displayStats,
  focusMonthWeekdayFact,
  loading,
  latestSession,
  monthlySorted,
  noYearData,
  onOpenHistoryDrilldown,
  onOverviewModeChange,
  overviewMode,
  priceSummary,
  sessions,
  socWindowAnalysis,
  spotlightCard,
  spotlightImpulseValue,
  year,
  yearWeekdayFact,
}) {
  const { t } = useI18n();

  function renderDeferredOverview(node, label) {
    return <Suspense fallback={<LazySectionFallback label={label} />}>{node}</Suspense>;
  }

  function renderOverviewFocus() {
    if (overviewMode === "behavior") {
      return renderDeferredOverview(
        <PowerCurveCard analysis={socWindowAnalysis} year={year} />,
        t("overview.loading.behavior")
      );
    }

    if (overviewMode === "compare") {
      return renderDeferredOverview(
        <YearComparisonPanel
          key={`overview-comparison-${year}`}
          availableYears={availableYears}
          initialLeftYear={year}
          initialRightYear={comparisonRightYear(year, availableYears)}
        />,
        t("overview.loading.compare")
      );
    }

    if (overviewMode === "forecast") {
      return renderDeferredOverview(
        <ForecastCard months={monthlySorted} year={year} />,
        t("overview.loading.forecast")
      );
    }

    return (
      <section className="row">
        <div className="card glassStrong analysisPanel premiumFeatureCard premiumFeatureChartPanel">
          <div className="panelHeader">
            <div>
              <div className="sectionKicker">{t("overview.costPanel.kicker")}</div>
              <div className="ttTitleRow panelTitleRow">
                <div className="sectionTitle">{t("overview.costPanel.title", { year })}</div>
                <Tooltip
                  content={t("overview.costPanel.tip")}
                  placement="top"
                  openDelayMs={120}
                  closeDelayMs={220}
                >
                  <button className="ttTrigger" type="button" aria-label={t("overview.costPanel.tooltipLabel")}>
                    i
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className="pill ghostPill panelMetaPill">
              {priceSummary.latest
                ? t("overview.costPanel.latestPrice", { value: num(priceSummary.latest.price_per_kwh, 3) })
                : t("overview.costPanel.noMonthlyValues")}
            </div>
          </div>

          <div className="chartPanel premiumChartFeature">
            {activeMonths.length ? (
              <MonthlyChart months={monthlySorted} onMonthSelect={(month) => onOpenHistoryDrilldown?.({ month })} />
            ) : (
              <div className="emptyStateCard">{t("overview.costPanel.empty", { year })}</div>
            )}
          </div>

          <div className="premiumMiniGrid premiumFeatureStats">
            <article className="premiumMiniCard premiumFeatureStatCard">
              <div className="premiumMiniLabel">{t("overview.costPanel.latestMonthValue")}</div>
              <div className="premiumMiniValue">
                {priceSummary.latest ? `${num(priceSummary.latest.price_per_kwh, 3)} €/kWh` : "–"}
              </div>
              <div className="premiumMiniSub">
                {priceSummary.latest ? monthLabel(priceSummary.latest.month) : t("common.noData")}
              </div>
            </article>

            <article className="premiumMiniCard premiumFeatureStatCard">
              <div className="premiumMiniLabel">{t("overview.costPanel.cheapestMonth")}</div>
              <div className="premiumMiniValue">
                {priceSummary.cheapest ? `${num(priceSummary.cheapest.price_per_kwh, 3)} €/kWh` : "–"}
              </div>
              <div className="premiumMiniSub">
                {priceSummary.cheapest ? monthLabel(priceSummary.cheapest.month) : t("common.noData")}
              </div>
            </article>

            <article className="premiumMiniCard premiumFeatureStatCard">
              <div className="premiumMiniLabel">{t("overview.costPanel.priciestMonth")}</div>
              <div className="premiumMiniValue">
                {priceSummary.priciest ? `${num(priceSummary.priciest.price_per_kwh, 3)} €/kWh` : "–"}
              </div>
              <div className="premiumMiniSub">
                {priceSummary.priciest ? monthLabel(priceSummary.priciest.month) : t("common.noData")}
              </div>
            </article>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="premiumModeBar">
        <div className="premiumModeIntro">
          <div className="sectionKicker">{t("overview.focusKicker")}</div>
          <div className="premiumModeTitle">{t("overview.focusTitle")}</div>
        </div>

        <div className="toggle premiumModeToggle" aria-label="Übersicht Fokus">
          <button type="button" className={overviewMode === "cost" ? "toggleBtn active" : "toggleBtn"} onClick={() => onOverviewModeChange("cost")}>
            {t("overview.modes.cost")}
          </button>
          <button
            type="button"
            className={overviewMode === "behavior" ? "toggleBtn active" : "toggleBtn"}
            onClick={() => onOverviewModeChange("behavior")}
          >
            {t("overview.modes.behavior")}
          </button>
          <button
            type="button"
            className={overviewMode === "compare" ? "toggleBtn active" : "toggleBtn"}
            onClick={() => onOverviewModeChange("compare")}
          >
            {t("overview.modes.compare")}
          </button>
          <button
            type="button"
            className={overviewMode === "forecast" ? "toggleBtn active" : "toggleBtn"}
            onClick={() => onOverviewModeChange("forecast")}
          >
            {t("overview.modes.forecast")}
          </button>
        </div>
      </section>

      {renderOverviewFocus()}

      <div className="premiumSecondaryGrid">
        <div className="premiumSecondarySlot">
          <MonthlyReportCard months={monthlySorted} sessions={sessions} year={year} />
        </div>

        <div className="premiumSecondarySlot premiumSecondarySpotlight">
          <section className="row">
            <div className="card glassStrong analysisPanel premiumSpotlightReportCard">
              <div className="panelHeader">
                <div>
                  <div className="sectionKicker">{t("overview.spotlight.kicker")}</div>
                  <div className="sectionTitle sectionTitleSpaced">{t("overview.spotlight.title", { year })}</div>
                </div>
                <div className="pill ghostPill panelMetaPill">
                  {loading ? t("common.refreshing") : noYearData ? t("common.noValues") : t("overview.spotlight.curated")}
                </div>
              </div>

              <div className="summaryGrid premiumSpotlightSummaryGrid">
                <article className="summaryCard warm premiumSpotlightSignalCard">
                  <div className="summaryLabel">{spotlightCard.eyebrow}</div>
                  <div className="summaryValue">{spotlightCard.value}</div>
                  <div className="summarySub">{spotlightCard.title}</div>
                  <div className="summarySub premiumSpotlightMetaLine">{spotlightCard.meta}</div>
                </article>

                <article className="summaryCard frost">
                  <div className="summaryLabel">{t("overview.spotlight.latestSession")}</div>
                  <div className="summaryValue">{latestSession?.date ? datumDE(latestSession.date) : "–"}</div>
                  <div className="summarySub">
                    {latestSession ? `${num(latestSession.energy_kwh, 1)} kWh` : t("overview.spotlight.noSessionYet")}
                  </div>
                </article>

                <article className="summaryCard mint">
                  <div className="summaryLabel">{t("overview.spotlight.medianPrice")}</div>
                  <div className="summaryValue">
                    {displayStats?.medians?.price_per_kwh != null ? `${num(displayStats.medians.price_per_kwh, 3)} €/kWh` : "–"}
                  </div>
                  <div className="summarySub">{t("overview.spotlight.quietAnchor")}</div>
                </article>

                <article className="summaryCard">
                  <div className="summaryLabel">{t("overview.spotlight.topChargingDay")}</div>
                  <div className="summaryValue">{yearWeekdayFact?.label || "–"}</div>
                  <div className="summarySub">
                    {yearWeekdayFact
                      ? `${num(yearWeekdayFact.count, 0)} Sessions • ${num(yearWeekdayFact.share, 0)} % Anteil`
                      : t("overview.spotlight.noRhythmYet")}
                  </div>
                </article>

                <article className="summaryCard premiumSpotlightImpulseCard">
                  <div className="summaryLabel">{t("overview.spotlight.monthlyImpulse")}</div>
                  <div className="summaryValue">{spotlightImpulseValue}</div>
                  <div className="summarySub">
                    {focusMonthWeekdayFact?.label
                      ? t("overview.modeNarrative.currentMonth", {
                          day: focusMonthWeekdayFact.label,
                          month: currentPrev.current ? monthLabel(currentPrev.current.month) : t("app.spotlight.focusMonth"),
                        })
                      : t("overview.modeNarrative.fallback")}
                  </div>
                </article>
              </div>

              <div className="metricNarrative">
                <b>{spotlightCard.title}</b> steht aktuell für <b>{spotlightCard.value}</b>. {spotlightCard.body}{" "}
                {yearWeekdayFact ? `${yearWeekdayFact.label} ist aktuell dein dominantester Ladetag im Jahr.` : ""}
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
