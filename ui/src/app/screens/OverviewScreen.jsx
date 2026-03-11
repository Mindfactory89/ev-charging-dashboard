import { Suspense, lazy } from "react";
import MonthlyChart from "../../ui/MonthlyChart.jsx";
import MonthlyReportCard from "../../ui/MonthlyReportCard.jsx";
import Tooltip from "../../ui/Tooltip.jsx";
import LazySectionFallback from "../LazySectionFallback.jsx";
import { monthLabel } from "../../ui/monthLabels.js";
import { datumDE, euro, num } from "../formatters.js";

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
  function renderDeferredOverview(node, label) {
    return <Suspense fallback={<LazySectionFallback label={label} />}>{node}</Suspense>;
  }

  function renderOverviewFocus() {
    if (overviewMode === "behavior") {
      return renderDeferredOverview(
        <PowerCurveCard analysis={socWindowAnalysis} year={year} />,
        "Ladeverhalten wird geladen…"
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
        "Vergleich wird geladen…"
      );
    }

    if (overviewMode === "forecast") {
      return renderDeferredOverview(
        <ForecastCard months={monthlySorted} year={year} />,
        "Forecast wird geladen…"
      );
    }

    return (
      <section className="row">
        <div className="card glassStrong analysisPanel premiumFeatureCard premiumFeatureChartPanel">
          <div className="panelHeader">
            <div>
              <div className="sectionKicker">Kosten</div>
              <div className="ttTitleRow panelTitleRow">
                <div className="sectionTitle">Monatsverlauf ({year})</div>
                <Tooltip
                  content="Ein ruhiger Überblick über Kosten, Preisniveau und Monatsimpuls des gewählten Jahres."
                  placement="top"
                  openDelayMs={120}
                  closeDelayMs={220}
                >
                  <button className="ttTrigger" type="button" aria-label="Erklärung: Monatsverlauf">
                    i
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className="pill ghostPill panelMetaPill">
              {priceSummary.latest ? `${num(priceSummary.latest.price_per_kwh, 3)} €/kWh aktuell` : "Noch keine Monatswerte"}
            </div>
          </div>

          <div className="chartPanel premiumChartFeature">
            {activeMonths.length ? (
              <MonthlyChart months={monthlySorted} onMonthSelect={(month) => onOpenHistoryDrilldown?.({ month })} />
            ) : (
              <div className="emptyStateCard">Keine Monatswerte für {year} vorhanden.</div>
            )}
          </div>

          <div className="premiumMiniGrid premiumFeatureStats">
            <article className="premiumMiniCard premiumFeatureStatCard">
              <div className="premiumMiniLabel">Letzter Monatswert</div>
              <div className="premiumMiniValue">
                {priceSummary.latest ? `${num(priceSummary.latest.price_per_kwh, 3)} €/kWh` : "–"}
              </div>
              <div className="premiumMiniSub">
                {priceSummary.latest ? monthLabel(priceSummary.latest.month) : "Keine Daten"}
              </div>
            </article>

            <article className="premiumMiniCard premiumFeatureStatCard">
              <div className="premiumMiniLabel">Günstigster Monat</div>
              <div className="premiumMiniValue">
                {priceSummary.cheapest ? `${num(priceSummary.cheapest.price_per_kwh, 3)} €/kWh` : "–"}
              </div>
              <div className="premiumMiniSub">
                {priceSummary.cheapest ? monthLabel(priceSummary.cheapest.month) : "Keine Daten"}
              </div>
            </article>

            <article className="premiumMiniCard premiumFeatureStatCard">
              <div className="premiumMiniLabel">Teuerster Monat</div>
              <div className="premiumMiniValue">
                {priceSummary.priciest ? `${num(priceSummary.priciest.price_per_kwh, 3)} €/kWh` : "–"}
              </div>
              <div className="premiumMiniSub">
                {priceSummary.priciest ? monthLabel(priceSummary.priciest.month) : "Keine Daten"}
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
          <div className="sectionKicker">Fokusfläche</div>
          <div className="premiumModeTitle">Eine dominante Fläche statt Kartenwand</div>
        </div>

        <div className="toggle premiumModeToggle" aria-label="Übersicht Fokus">
          <button type="button" className={overviewMode === "cost" ? "toggleBtn active" : "toggleBtn"} onClick={() => onOverviewModeChange("cost")}>
            Kosten
          </button>
          <button
            type="button"
            className={overviewMode === "behavior" ? "toggleBtn active" : "toggleBtn"}
            onClick={() => onOverviewModeChange("behavior")}
          >
            Ladeverhalten
          </button>
          <button
            type="button"
            className={overviewMode === "compare" ? "toggleBtn active" : "toggleBtn"}
            onClick={() => onOverviewModeChange("compare")}
          >
            Vergleich
          </button>
          <button
            type="button"
            className={overviewMode === "forecast" ? "toggleBtn active" : "toggleBtn"}
            onClick={() => onOverviewModeChange("forecast")}
          >
            Forecast
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
                  <div className="sectionKicker">Spotlight</div>
                  <div className="sectionTitle sectionTitleSpaced">Jahresfokus ({year})</div>
                </div>
                <div className="pill ghostPill panelMetaPill">
                  {loading ? "Aktualisiert…" : noYearData ? "Keine Werte" : "Kuratiert"}
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
                  <div className="summaryLabel">Letzte Session</div>
                  <div className="summaryValue">{latestSession?.date ? datumDE(latestSession.date) : "–"}</div>
                  <div className="summarySub">
                    {latestSession ? `${num(latestSession.energy_kwh, 1)} kWh` : "Noch keine Session"}
                  </div>
                </article>

                <article className="summaryCard mint">
                  <div className="summaryLabel">Medianpreis</div>
                  <div className="summaryValue">
                    {displayStats?.medians?.price_per_kwh != null ? `${num(displayStats.medians.price_per_kwh, 3)} €/kWh` : "–"}
                  </div>
                  <div className="summarySub">Ruhiger Preisanker des Jahres</div>
                </article>

                <article className="summaryCard">
                  <div className="summaryLabel">Top-Ladetag</div>
                  <div className="summaryValue">{yearWeekdayFact?.label || "–"}</div>
                  <div className="summarySub">
                    {yearWeekdayFact
                      ? `${num(yearWeekdayFact.count, 0)} Sessions • ${num(yearWeekdayFact.share, 0)} % Anteil`
                      : "Noch kein Jahresrhythmus"}
                  </div>
                </article>

                <article className="summaryCard premiumSpotlightImpulseCard">
                  <div className="summaryLabel">Monatsimpuls</div>
                  <div className="summaryValue">{spotlightImpulseValue}</div>
                  <div className="summarySub">
                    {focusMonthWeekdayFact?.label
                      ? `${focusMonthWeekdayFact.label} prägt ${currentPrev.current ? monthLabel(currentPrev.current.month) : "den Fokusmonat"}`
                      : "Kosten vs. Vormonat"}
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
