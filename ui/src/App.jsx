import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getMonthlyCsvUrl,
  getSeasonsCsvUrl,
  isDemoMode,
} from "./ui/api.js";
import { monthLabel } from "./ui/monthLabels.js";
import { getWeekdayUsage } from "./ui/loadRhythm.js";
import { resolveVehicleProfile } from "./config/vehicleProfiles.js";
import { downloadFileFromUrl } from "./platform/download.js";
import { showAlert } from "./platform/runtime.js";
import DashboardHeader from "./app/DashboardHeader.jsx";
import DashboardHeroStage from "./app/DashboardHeroStage.jsx";
import ErrorBoundary from "./app/ErrorBoundary.jsx";
import LazySectionFallback from "./app/LazySectionFallback.jsx";
import RuntimeFeedbackHost from "./app/RuntimeFeedbackHost.jsx";
import { floatingAddButtonStyle, YEARS } from "./app/constants.js";
import {
  calcTrend,
  datumDE,
  euro,
  num,
  scoreLabel,
  scoreTone,
  sessionPricePerKwh,
  trendPctLabel,
} from "./app/formatters.js";
import {
  clearHistoryFilters,
  mergeHistoryFilters,
  readPersistedUiState,
  writePersistedUiState,
} from "./app/persistedUiState.js";
import { useDashboardData } from "./app/useDashboardData.js";

const AnalysisScreen = lazy(() => import("./app/screens/AnalysisScreen.jsx"));
const HistoryScreen = lazy(() => import("./app/screens/HistoryScreen.jsx"));
const OverviewScreen = lazy(() => import("./app/screens/OverviewScreen.jsx"));

export default function App() {
  const dashboardTitle = "eMobility Dashboard";
  const vehicleProfile = useMemo(() => resolveVehicleProfile(), []);
  const demo = typeof isDemoMode === "function" ? isDemoMode() : !!isDemoMode;
  const initialUiState = useMemo(() => readPersistedUiState(), []);

  const [year, setYear] = useState(initialUiState.year);
  const [activeScreen, setActiveScreen] = useState(initialUiState.activeScreen);
  const [overviewMode, setOverviewMode] = useState(initialUiState.overviewMode);
  const [analysisMode, setAnalysisMode] = useState(initialUiState.analysisMode);
  const [historyFilters, setHistoryFilters] = useState(initialUiState.historyFilters);
  const [addOpen, setAddOpen] = useState(false);

  const addSectionRef = useRef(null);
  const addPanelRef = useRef(null);

  const {
    availableYears,
    efficiency,
    err,
    intelligence,
    loading,
    monthly,
    outliers,
    refreshing,
    refresh,
    seasons,
    sessions,
    socWindowAnalysis,
    stats,
  } = useDashboardData(year);

  useEffect(() => {
    writePersistedUiState({
      year,
      activeScreen,
      overviewMode,
      analysisMode,
      historyFilters,
    });
  }, [activeScreen, analysisMode, historyFilters, overviewMode, year]);

  const openAdd = useCallback(() => {
    setActiveScreen("verlauf");
    setAddOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        addSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => addPanelRef.current?.focus?.(), 350);
      });
    });
  }, []);

  const closeAdd = useCallback(() => setAddOpen(false), []);

  const openHistoryDrilldown = useCallback((filters = {}) => {
    setActiveScreen("verlauf");
    setAddOpen(false);
    setHistoryFilters(mergeHistoryFilters(clearHistoryFilters(), filters));
  }, []);

  const clearHistoryDrilldown = useCallback(() => {
    setHistoryFilters(clearHistoryFilters());
  }, []);

  const latestSession = useMemo(() => {
    if (!Array.isArray(sessions) || sessions.length === 0) return null;
    return [...sessions]
      .filter((session) => session?.date)
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0] || null;
  }, [sessions]);

  const kpiTips = useMemo(
    () => ({
      totalCost:
        "Summe aller Kosten im gewählten Jahr. Enthält jede erfasste Session und bildet dein reales Kostenniveau ab.",
      totalEnergy:
        "Gesamte geladene Energie im Jahr. Das ist die Basis für Kosten-, Trend- und Effizienzanalysen.",
      efficiency:
        "Relativer Jahres-Score auf Basis deiner Sessions. Bewertet Preis pro kWh, Ladeleistung und Zeit pro kWh.",
    }),
    []
  );

  const monthlySorted = useMemo(() => {
    const months = Array.isArray(monthly?.months) ? [...monthly.months] : [];
    return months.sort((left, right) => (Number(left?.month) || 0) - (Number(right?.month) || 0));
  }, [monthly]);

  const activeMonths = useMemo(
    () => monthlySorted.filter((month) => Number(month?.count || 0) > 0),
    [monthlySorted]
  );

  const currentPrev = useMemo(() => {
    if (activeMonths.length < 2) {
      return { current: activeMonths[activeMonths.length - 1] || null, prev: null };
    }
    return {
      current: activeMonths[activeMonths.length - 1],
      prev: activeMonths[activeMonths.length - 2],
    };
  }, [activeMonths]);

  const priceMonths = useMemo(
    () =>
      monthlySorted.filter((month) => {
        const price = Number(month?.price_per_kwh);
        return Number(month?.count || 0) > 0 && Number.isFinite(price) && price > 0;
      }),
    [monthlySorted]
  );

  const priceSummary = useMemo(() => {
    const latest = priceMonths[priceMonths.length - 1] || null;
    const previous = priceMonths.length > 1 ? priceMonths[priceMonths.length - 2] : null;

    const cheapest = priceMonths.reduce((best, month) => {
      if (!best) return month;
      return Number(month.price_per_kwh) < Number(best.price_per_kwh) ? month : best;
    }, null);

    const priciest = priceMonths.reduce((best, month) => {
      if (!best) return month;
      return Number(month.price_per_kwh) > Number(best.price_per_kwh) ? month : best;
    }, null);

    const trend =
      latest && previous
        ? latest?.trend?.price_per_kwh ?? calcTrend(latest?.price_per_kwh, previous?.price_per_kwh)
        : null;

    return { latest, previous, cheapest, priciest, trend };
  }, [priceMonths]);

  const sessionScoresById = useMemo(() => {
    const entries = Array.isArray(efficiency?.sessions) ? efficiency.sessions : [];
    return Object.fromEntries(entries.map((row) => [String(row.session_id), row]));
  }, [efficiency]);
  const sessionOutliersById = useMemo(() => {
    const entries = Array.isArray(outliers?.flagged_sessions) ? outliers.flagged_sessions : [];
    return Object.fromEntries(entries.map((row) => [String(row.session_id), row]));
  }, [outliers]);
  const seasonRows = useMemo(
    () =>
      Array.isArray(seasons?.seasons)
        ? seasons.seasons.filter((season) => Number(season?.count || 0) > 0)
        : [],
    [seasons]
  );

  const hasYearData = (Number(stats?.count) || 0) > 0 || sessions.length > 0;
  const noYearData = !loading && !err && !hasYearData;
  const displayStats = hasYearData ? stats : null;
  const displayEfficiency = hasYearData ? efficiency : null;
  const effectiveAvailableYears = useMemo(() => {
    const values = Array.isArray(availableYears) ? availableYears : [];
    const merged = new Set([...(YEARS || []), year, ...values]);
    return Array.from(merged).sort((left, right) => left - right);
  }, [availableYears, year]);

  const insights = useMemo(() => {
    const items = [];

    if (outliers?.highlights?.priciest_outlier?.price_per_kwh != null) {
      items.push({
        id: "outlier_price",
        titel: "Preis-Ausreißer",
        wert: `${num(outliers.highlights.priciest_outlier.price_per_kwh, 3)} €/kWh`,
        sub: outliers.highlights.priciest_outlier.date ? datumDE(outliers.highlights.priciest_outlier.date) : "–",
        tip:
          outliers?.baselines?.price_per_kwh?.median != null
            ? `Jahresmedian: ${num(outliers.baselines.price_per_kwh.median, 3)} €/kWh`
            : "Auffällig hoher Preis im Jahresvergleich.",
      });
    }

    if (outliers?.highlights?.lowest_power_outlier?.avg_power_kw != null) {
      items.push({
        id: "outlier_power",
        titel: "Schwächste Ladeleistung",
        wert: `${num(outliers.highlights.lowest_power_outlier.avg_power_kw, 1)} kW`,
        sub: outliers.highlights.lowest_power_outlier.date ? datumDE(outliers.highlights.lowest_power_outlier.date) : "–",
        tip:
          outliers?.baselines?.avg_power_kw?.median != null
            ? `Jahresmedian: ${num(outliers.baselines.avg_power_kw.median, 1)} kW`
            : "Auffällig niedrige Ladeleistung im Jahresvergleich.",
      });
    }

    if (monthly?.top_energy_month?.month) {
      items.push({
        id: "top_energy",
        titel: "Intensivster Monat",
        wert: monthLabel(monthly.top_energy_month.month),
        sub: `${num(monthly.top_energy_month.energy_kwh, 1)} kWh`,
        tip: "Monat mit der höchsten geladenen Energie.",
      });
    }

    if (seasons?.highlights?.best_efficiency_season?.label) {
      items.push({
        id: "best_season",
        titel: "Stärkste Saison",
        wert: seasons.highlights.best_efficiency_season.label,
        sub:
          seasons.highlights.best_efficiency_season.efficiency_score != null
            ? `${num(seasons.highlights.best_efficiency_season.efficiency_score, 1)}/100`
            : "–",
        tip: "Saison mit dem höchsten durchschnittlichen Effizienz-Score.",
      });
    }

    if (socWindowAnalysis?.highlights?.best_efficiency_window?.label) {
      items.push({
        id: "best_soc_window",
        titel: "Bestes SoC-Fenster",
        wert: socWindowAnalysis.highlights.best_efficiency_window.label,
        sub:
          socWindowAnalysis.highlights.best_efficiency_window.avg_score != null
            ? `${num(socWindowAnalysis.highlights.best_efficiency_window.avg_score, 1)}/100`
            : "–",
        tip: "Das SoC-Fenster mit dem besten durchschnittlichen Score.",
      });
    }

    if (efficiency?.overall_score != null) {
      items.push({
        id: "efficiency",
        titel: "Cost Efficiency",
        wert: `${num(efficiency.overall_score, 1)}/100`,
        sub: efficiency.score_label || scoreLabel(efficiency.overall_score),
        tip: "Relativer Effizienz-Score des gewählten Jahres.",
      });
    }

    const { current, prev } = currentPrev;
    if (current && prev) {
      const energyTrend = current?.trend?.energy?.pct ?? calcTrend(current?.energy_kwh, prev?.energy_kwh)?.pct ?? null;
      if (energyTrend != null) {
        items.push({
          id: "trend_energy",
          titel: "Trend Energie",
          wert: trendPctLabel(energyTrend) ?? "–",
          sub: "vs. Vormonat",
          tip: "Änderung der geladenen Energie gegenüber dem Vormonat.",
          trendPct: energyTrend,
        });
      }

      const costTrend = current?.trend?.cost?.pct ?? calcTrend(current?.cost, prev?.cost)?.pct ?? null;
      if (costTrend != null) {
        items.push({
          id: "trend_cost",
          titel: "Trend Kosten",
          wert: trendPctLabel(costTrend) ?? "–",
          sub: "vs. Vormonat",
          tip: "Änderung der Kosten gegenüber dem Vormonat.",
          trendPct: costTrend,
        });
      }
    }

    return items.slice(0, 5);
  }, [outliers, monthly, seasons, socWindowAnalysis, efficiency, currentPrev]);

  const monthlyCsvUrl = useMemo(() => getMonthlyCsvUrl(year), [year]);
  const seasonsCsvUrl = useMemo(() => getSeasonsCsvUrl(year), [year]);

  const onDownloadMonthlyCsv = useCallback(() => {
    if (!monthlyCsvUrl) return;
    downloadFileFromUrl(monthlyCsvUrl, {
      fileName: `charging-months-${year}.csv`,
      title: `Monatsreport ${year}`,
    }).catch((error) => {
      showAlert(String(error?.message || error));
    });
  }, [year, monthlyCsvUrl]);

  const onDownloadSeasonCsv = useCallback(() => {
    if (!seasonsCsvUrl) return;
    downloadFileFromUrl(seasonsCsvUrl, {
      fileName: `charging-seasons-${year}.csv`,
      title: `Saisonauswertung ${year}`,
    }).catch((error) => {
      showAlert(String(error?.message || error));
    });
  }, [year, seasonsCsvUrl]);

  const primaryInsight = insights[0] || null;
  const latestSessionPrice = useMemo(() => sessionPricePerKwh(latestSession), [latestSession]);
  const yearWeekdayFact = useMemo(() => getWeekdayUsage(sessions, { year }).top, [sessions, year]);
  const focusMonthWeekdayFact = useMemo(
    () => (currentPrev.current?.month ? getWeekdayUsage(sessions, { year, month: currentPrev.current.month }).top : null),
    [currentPrev.current, sessions, year]
  );

  const heroMetrics = useMemo(
    () => [
      {
        key: "cost",
        label: "Gesamtkosten",
        tip: kpiTips.totalCost,
        value: euro(displayStats?.total_cost),
        sub:
          displayStats?.medians?.price_per_kwh != null
            ? `Median ${num(displayStats.medians.price_per_kwh, 3)} €/kWh`
            : noYearData
              ? "Keine Werte vorhanden"
              : `${num(displayStats?.count, 0)} Sessions`,
      },
      {
        key: "energy",
        label: "Geladene Energie",
        tip: kpiTips.totalEnergy,
        value: displayStats ? `${num(displayStats.total_energy_kwh, 1)} kWh` : "–",
        sub:
          currentPrev.current?.energy_kwh != null
            ? `${monthLabel(currentPrev.current.month)} ${num(currentPrev.current.energy_kwh, 1)} kWh`
            : noYearData
              ? "Keine Werte vorhanden"
              : "Jahressumme",
      },
      {
        key: "efficiency",
        label: "Effizienz",
        tip: kpiTips.efficiency,
        value: displayEfficiency ? `${num(displayEfficiency.overall_score, 1)}/100` : "–",
        sub:
          noYearData
            ? "Keine Werte vorhanden"
            : displayEfficiency?.score_label || scoreLabel(displayEfficiency?.overall_score),
        tone: scoreTone(displayEfficiency?.overall_score),
      },
    ],
    [currentPrev.current, displayEfficiency, displayStats, kpiTips, noYearData]
  );

  const spotlightCard = useMemo(() => {
    if (primaryInsight) {
      return {
        eyebrow: "Signal",
        title: primaryInsight.titel,
        value: primaryInsight.wert,
        meta: primaryInsight.sub || "Jahresfokus",
        body: primaryInsight.tip || "Markantestes Signal des gewählten Jahres.",
      };
    }

    if (latestSession) {
      return {
        eyebrow: "Letzte Session",
        title: datumDE(latestSession.date),
        value: `${num(latestSession.energy_kwh, 1)} kWh`,
        meta: [latestSessionPrice != null ? `${num(latestSessionPrice, 3)} €/kWh` : null, latestSession.connector || null]
          .filter(Boolean)
          .join(" • "),
        body: latestSession.note || "Zuletzt erfasster Ladevorgang.",
      };
    }

    const latestMonth = currentPrev.current || null;
    if (latestMonth) {
      return {
        eyebrow: "Monat",
        title: monthLabel(latestMonth.month),
        value: euro(latestMonth.cost),
        meta: `${num(latestMonth.energy_kwh, 1)} kWh • ${num(latestMonth.price_per_kwh, 3)} €/kWh`,
        body: "Aktuell stärkster Monatsimpuls im gewählten Jahr.",
      };
    }

    return {
      eyebrow: "Status",
      title: `Jahr ${year}`,
      value: "Keine Daten",
      meta: "Noch keine Sessions vorhanden",
      body: `Für ${year} sind aktuell noch keine Werte vorhanden.`,
    };
  }, [currentPrev.current, year, latestSession, latestSessionPrice, primaryInsight]);

  const spotlightImpulseValue =
    currentPrev.current?.trend?.cost?.pct != null
      ? trendPctLabel(currentPrev.current.trend.cost.pct)
      : currentPrev.prev
        ? trendPctLabel(calcTrend(currentPrev.current?.cost, currentPrev.prev?.cost)?.pct) ?? "–"
        : "–";

  return (
    <ErrorBoundary>
      <div className="app">
        <button
          type="button"
          onClick={openAdd}
          title="Ladevorgang hinzufügen"
          aria-label="Ladevorgang hinzufügen"
          style={floatingAddButtonStyle}
        >
          + Ladevorgang
        </button>

        <DashboardHeader
          availableYears={effectiveAvailableYears}
          dashboardTitle={dashboardTitle}
          demo={demo}
          latestSession={latestSession}
          loading={loading}
          refreshing={refreshing}
          onSelectYear={setYear}
          sessionsCount={sessions.length}
          year={year}
        />

        <main className="layout premiumLayout">
          {err ? <div className="errorBox">{err}</div> : null}

          <section className="premiumScreenBar">
            <div className="toggle premiumScreenToggle" aria-label="Dashboard Bereiche">
              <button
                type="button"
                className={activeScreen === "overview" ? "toggleBtn active" : "toggleBtn"}
                onClick={() => setActiveScreen("overview")}
              >
                Übersicht
              </button>
              <button
                type="button"
                className={activeScreen === "analysis" ? "toggleBtn active" : "toggleBtn"}
                onClick={() => setActiveScreen("analysis")}
              >
                Analyse
              </button>
              <button
                type="button"
                className={activeScreen === "verlauf" ? "toggleBtn active" : "toggleBtn"}
                onClick={() => setActiveScreen("verlauf")}
              >
                Verlauf
              </button>
            </div>

            <div className="premiumScreenMeta">
              {activeScreen === "overview"
                ? "Hero, Fokus-Chart und wenige starke Signale."
                : activeScreen === "analysis"
                  ? "Tiefe Auswertung ohne Kartenwand."
                  : "Sessions pflegen, editieren und ergänzen."}
            </div>
          </section>

          {noYearData ? (
            <section className="row">
              <div className="card glassStrong premiumEmptyNotice">
                <div className="emptyStateCard">Für {year} sind keine Werte vorhanden.</div>
              </div>
            </section>
          ) : null}

          <DashboardHeroStage
            displayStats={displayStats}
            heroMetrics={heroMetrics}
            latestDateLabel={latestSession?.date ? datumDE(latestSession.date) : null}
            spotlightCard={spotlightCard}
            vehicleProfile={vehicleProfile}
            year={year}
            yearWeekdayFact={yearWeekdayFact}
          />

          <Suspense fallback={<LazySectionFallback label="Bereich wird geladen…" />}>
            {activeScreen === "overview" ? (
              <OverviewScreen
                activeMonths={activeMonths}
                availableYears={effectiveAvailableYears}
                currentPrev={currentPrev}
                displayStats={displayStats}
                focusMonthWeekdayFact={focusMonthWeekdayFact}
                loading={loading || refreshing}
                latestSession={latestSession}
                monthlySorted={monthlySorted}
                noYearData={noYearData}
                onOpenHistoryDrilldown={openHistoryDrilldown}
                onOverviewModeChange={setOverviewMode}
                overviewMode={overviewMode}
                priceSummary={priceSummary}
                sessions={sessions}
                socWindowAnalysis={socWindowAnalysis}
                spotlightCard={spotlightCard}
                spotlightImpulseValue={spotlightImpulseValue}
                year={year}
                yearWeekdayFact={yearWeekdayFact}
              />
            ) : null}

            {activeScreen === "analysis" ? (
              <AnalysisScreen
                availableYears={effectiveAvailableYears}
                analysisMode={analysisMode}
                displayEfficiency={displayEfficiency}
                displayStats={displayStats}
                intelligence={intelligence}
                monthly={monthly}
                monthlyCsvUrl={monthlyCsvUrl}
                monthlySorted={monthlySorted}
                onDrilldownHistory={openHistoryDrilldown}
                onAnalysisModeChange={setAnalysisMode}
                onDownloadMonthlyCsv={onDownloadMonthlyCsv}
                onDownloadSeasonCsv={onDownloadSeasonCsv}
                outliers={outliers}
                priceSummary={priceSummary}
                seasonRows={seasonRows}
                seasons={seasons}
                seasonsCsvUrl={seasonsCsvUrl}
                sessions={sessions}
                socWindowAnalysis={socWindowAnalysis}
                year={year}
              />
            ) : null}

            {activeScreen === "verlauf" ? (
              <HistoryScreen
                addOpen={addOpen}
                addPanelRef={addPanelRef}
                addSectionRef={addSectionRef}
                closeAdd={closeAdd}
                demo={demo}
                onCreated={refresh}
                openAdd={openAdd}
                historyFilters={historyFilters}
                intelligence={intelligence}
                onClearHistoryFilters={clearHistoryDrilldown}
                onHistoryFiltersChange={setHistoryFilters}
                sessionOutliersById={sessionOutliersById}
                sessionScoresById={sessionScoresById}
                sessions={sessions}
                year={year}
              />
            ) : null}
          </Suspense>
        </main>

        <footer className="footer">
          <span>Lokales Dashboard über Tailscale • Daten bleiben bei dir</span>
        </footer>

        <RuntimeFeedbackHost />
      </div>
    </ErrorBoundary>
  );
}
