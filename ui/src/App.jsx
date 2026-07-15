import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "./i18n/I18nProvider.jsx";
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
import AppNavigation from "./app/AppNavigation.jsx";
import GuidedEmptyState from "./app/GuidedEmptyState.jsx";
import OnboardingFlow from "./app/OnboardingFlow.jsx";
import ErrorBoundary from "./app/ErrorBoundary.jsx";
import LazySectionFallback from "./app/LazySectionFallback.jsx";
import RuntimeFeedbackHost from "./app/RuntimeFeedbackHost.jsx";
import { YEARS } from "./app/constants.js";
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
import { completeOnboarding, shouldShowOnboarding } from "./app/onboardingState.js";

const AnalysisScreen = lazy(() => import("./app/screens/AnalysisScreen.jsx"));
const HistoryScreen = lazy(() => import("./app/screens/HistoryScreen.jsx"));
const OverviewScreen = lazy(() => import("./app/screens/OverviewScreen.jsx"));

export default function App() {
  const { t } = useI18n();
  const dashboardTitle = t("app.dashboardTitle");
  const vehicleProfile = useMemo(() => resolveVehicleProfile(), []);
  const demo = typeof isDemoMode === "function" ? isDemoMode() : !!isDemoMode;
  const initialUiState = useMemo(() => readPersistedUiState(), []);

  const [year, setYear] = useState(initialUiState.year);
  const [activeScreen, setActiveScreen] = useState(initialUiState.activeScreen);
  const [overviewMode, setOverviewMode] = useState(initialUiState.overviewMode);
  const [analysisMode, setAnalysisMode] = useState(initialUiState.analysisMode);
  const [historyFilters, setHistoryFilters] = useState(initialUiState.historyFilters);
  const [historyDrilldownSource, setHistoryDrilldownSource] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(() => shouldShowOnboarding());

  const addSectionRef = useRef(null);
  const addPanelRef = useRef(null);
  const mainContentRef = useRef(null);
  const nextHistoryModeRef = useRef("replace");
  const applyingPopStateRef = useRef(false);

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
    if (applyingPopStateRef.current) {
      applyingPopStateRef.current = false;
      writePersistedUiState({
        year,
        activeScreen,
        overviewMode,
        analysisMode,
        historyFilters,
      });
      return;
    }

    const historyMode = nextHistoryModeRef.current;
    nextHistoryModeRef.current = "replace";

    writePersistedUiState({
      year,
      activeScreen,
      overviewMode,
      analysisMode,
      historyFilters,
      historyMode,
    });
  }, [activeScreen, analysisMode, historyFilters, overviewMode, year]);

  useEffect(() => {
    function onPopState() {
      const nextUiState = readPersistedUiState();
      applyingPopStateRef.current = true;
      nextHistoryModeRef.current = "replace";
      setYear(nextUiState.year);
      setActiveScreen(nextUiState.activeScreen);
      setOverviewMode(nextUiState.overviewMode);
      setAnalysisMode(nextUiState.analysisMode);
      setHistoryFilters(nextUiState.historyFilters);
      setHistoryDrilldownSource(null);
      setAddOpen(false);
      window.setTimeout(() => {
        applyingPopStateRef.current = false;
      }, 0);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const markHistoryPush = useCallback(() => {
    nextHistoryModeRef.current = "push";
  }, []);

  const selectYear = useCallback((nextYear) => {
    markHistoryPush();
    setYear(nextYear);
  }, [markHistoryPush]);

  const selectScreen = useCallback((nextScreen) => {
    if (nextScreen !== activeScreen) {
      markHistoryPush();
      setActiveScreen(nextScreen);
      setAddOpen(false);
    }

    requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      requestAnimationFrame(() => mainContentRef.current?.focus({ preventScroll: true }));
    });
  }, [activeScreen, markHistoryPush]);

  const selectOverviewMode = useCallback((nextMode) => {
    markHistoryPush();
    setOverviewMode(nextMode);
  }, [markHistoryPush]);

  const selectAnalysisMode = useCallback((nextMode) => {
    markHistoryPush();
    setAnalysisMode(nextMode);
  }, [markHistoryPush]);

  const updateHistoryFilters = useCallback((nextFilters) => {
    markHistoryPush();
    setHistoryFilters(nextFilters);
  }, [markHistoryPush]);

  const openAdd = useCallback(() => {
    markHistoryPush();
    setActiveScreen("verlauf");
    setAddOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        addSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => addPanelRef.current?.focus?.(), 350);
      });
    });
  }, [markHistoryPush]);

  const closeAdd = useCallback(() => setAddOpen(false), []);

  const dismissOnboarding = useCallback(() => {
    completeOnboarding();
    setOnboardingOpen(false);
  }, []);

  const completeOnboardingAtScreen = useCallback((nextScreen) => {
    completeOnboarding();
    setOnboardingOpen(false);
    selectScreen(nextScreen || "overview");
  }, [selectScreen]);

  const completeOnboardingWithAdd = useCallback(() => {
    completeOnboarding();
    setOnboardingOpen(false);
    openAdd();
  }, [openAdd]);

  const openHistoryDrilldown = useCallback((filters = {}) => {
    markHistoryPush();
    setHistoryDrilldownSource(activeScreen === "verlauf" ? null : activeScreen);
    setActiveScreen("verlauf");
    setAddOpen(false);
    setHistoryFilters(mergeHistoryFilters(clearHistoryFilters(), filters));
  }, [activeScreen, markHistoryPush]);

  const clearHistoryDrilldown = useCallback(() => {
    markHistoryPush();
    setHistoryDrilldownSource(null);
    setHistoryFilters(clearHistoryFilters());
  }, [markHistoryPush]);

  const returnToHistorySource = useCallback(() => {
    if (!historyDrilldownSource) return;
    markHistoryPush();
    setActiveScreen(historyDrilldownSource);
  }, [historyDrilldownSource, markHistoryPush]);

  const latestSession = useMemo(() => {
    if (!Array.isArray(sessions) || sessions.length === 0) return null;
    return [...sessions]
      .filter((session) => session?.date)
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0] || null;
  }, [sessions]);

  const kpiTips = useMemo(
    () => ({
      totalCost: t("app.kpiTips.totalCost"),
      totalEnergy: t("app.kpiTips.totalEnergy"),
      efficiency: t("app.kpiTips.efficiency"),
    }),
    [t]
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
  const recoveryYear = useMemo(
    () => (Array.isArray(availableYears) ? availableYears : []).map(Number).find((itemYear) => itemYear !== year) ?? null,
    [availableYears, year]
  );

  const insights = useMemo(() => {
    const items = [];

    if (outliers?.highlights?.priciest_outlier?.price_per_kwh != null) {
        items.push({
          id: "outlier_price",
          titel: t("app.insights.priceOutlier.title"),
          wert: `${num(outliers.highlights.priciest_outlier.price_per_kwh, 3)} €/kWh`,
          sub: outliers.highlights.priciest_outlier.date ? datumDE(outliers.highlights.priciest_outlier.date) : "–",
          tip:
          outliers?.baselines?.price_per_kwh?.median != null
            ? `${t("app.insights.priceOutlier.medianPrefix")} ${num(outliers.baselines.price_per_kwh.median, 3)} €/kWh`
            : t("app.insights.priceOutlier.fallback"),
        });
      }

      if (outliers?.highlights?.lowest_power_outlier?.avg_power_kw != null) {
        items.push({
          id: "outlier_power",
          titel: t("app.insights.weakestPower.title"),
          wert: `${num(outliers.highlights.lowest_power_outlier.avg_power_kw, 1)} kW`,
          sub: outliers.highlights.lowest_power_outlier.date ? datumDE(outliers.highlights.lowest_power_outlier.date) : "–",
          tip:
            outliers?.baselines?.avg_power_kw?.median != null
              ? `${t("app.insights.weakestPower.medianPrefix")} ${num(outliers.baselines.avg_power_kw.median, 1)} kW`
              : t("app.insights.weakestPower.fallback"),
        });
      }

      if (monthly?.top_energy_month?.month) {
        items.push({
          id: "top_energy",
          titel: t("app.insights.topEnergyMonth.title"),
          wert: monthLabel(monthly.top_energy_month.month),
          sub: `${num(monthly.top_energy_month.energy_kwh, 1)} kWh`,
          tip: t("app.insights.topEnergyMonth.tip"),
        });
      }

      if (seasons?.highlights?.best_efficiency_season?.label) {
        items.push({
          id: "best_season",
          titel: t("app.insights.bestSeason.title"),
          wert: seasons.highlights.best_efficiency_season.label,
          sub:
            seasons.highlights.best_efficiency_season.efficiency_score != null
              ? `${num(seasons.highlights.best_efficiency_season.efficiency_score, 1)}/100`
              : "–",
          tip: t("app.insights.bestSeason.tip"),
        });
      }

    if (socWindowAnalysis?.highlights?.best_efficiency_window?.label) {
      items.push({
        id: "best_soc_window",
        titel: t("app.insights.bestSocWindow.title"),
        wert: socWindowAnalysis.highlights.best_efficiency_window.label,
        sub:
          socWindowAnalysis.highlights.best_efficiency_window.avg_score != null
            ? `${num(socWindowAnalysis.highlights.best_efficiency_window.avg_score, 1)}/100`
            : "–",
        tip: t("app.insights.bestSocWindow.tip"),
      });
    }

    if (efficiency?.overall_score != null) {
      items.push({
        id: "efficiency",
        titel: t("app.insights.efficiency.title"),
        wert: `${num(efficiency.overall_score, 1)}/100`,
        sub: scoreLabel(efficiency.overall_score),
        tip: t("app.insights.efficiency.tip"),
      });
    }

    const { current, prev } = currentPrev;
    if (current && prev) {
      const energyTrend = current?.trend?.energy?.pct ?? calcTrend(current?.energy_kwh, prev?.energy_kwh)?.pct ?? null;
      if (energyTrend != null) {
        items.push({
          id: "trend_energy",
          titel: t("app.insights.trendEnergy.title"),
          wert: trendPctLabel(energyTrend) ?? "–",
          sub: t("app.insights.trendEnergy.sub"),
          tip: t("app.insights.trendEnergy.tip"),
          trendPct: energyTrend,
        });
      }

      const costTrend = current?.trend?.cost?.pct ?? calcTrend(current?.cost, prev?.cost)?.pct ?? null;
      if (costTrend != null) {
        items.push({
          id: "trend_cost",
          titel: t("app.insights.trendCost.title"),
          wert: trendPctLabel(costTrend) ?? "–",
          sub: t("app.insights.trendCost.sub"),
          tip: t("app.insights.trendCost.tip"),
          trendPct: costTrend,
        });
      }
    }

    return items.slice(0, 5);
  }, [currentPrev, efficiency, monthly, outliers, seasons, socWindowAnalysis, t]);

  const monthlyCsvUrl = useMemo(() => getMonthlyCsvUrl(year), [year]);
  const seasonsCsvUrl = useMemo(() => getSeasonsCsvUrl(year), [year]);

  const onDownloadMonthlyCsv = useCallback(() => {
    if (!monthlyCsvUrl) return;
    downloadFileFromUrl(monthlyCsvUrl, {
      fileName: `charging-months-${year}.csv`,
      title: t("app.csv.monthlyTitle", { year }),
    }).catch((error) => {
      showAlert(String(error?.message || error));
    });
  }, [monthlyCsvUrl, t, year]);

  const onDownloadSeasonCsv = useCallback(() => {
    if (!seasonsCsvUrl) return;
    downloadFileFromUrl(seasonsCsvUrl, {
      fileName: `charging-seasons-${year}.csv`,
      title: t("app.csv.seasonsTitle", { year }),
    }).catch((error) => {
      showAlert(String(error?.message || error));
    });
  }, [seasonsCsvUrl, t, year]);

  const primaryInsight = insights[0] || null;
  const latestSessionPrice = useMemo(() => sessionPricePerKwh(latestSession), [latestSession]);
  const yearWeekdayFact = useMemo(() => getWeekdayUsage(sessions, { year }).top, [sessions, year]);
  const focusMonthWeekdayFact = useMemo(
    () => (currentPrev.current?.month ? getWeekdayUsage(sessions, { year, month: currentPrev.current.month }).top : null),
    [currentPrev.current, sessions, year]
  );

  const latestCostTrend = currentPrev.current && currentPrev.prev
    ? currentPrev.current?.trend?.cost?.pct ?? calcTrend(currentPrev.current?.cost, currentPrev.prev?.cost)?.pct ?? null
    : null;
  const latestEnergyTrend = currentPrev.current && currentPrev.prev
    ? currentPrev.current?.trend?.energy?.pct ?? calcTrend(currentPrev.current?.energy_kwh, currentPrev.prev?.energy_kwh)?.pct ?? null
    : null;

  const heroMetrics = useMemo(
    () => [
      {
        key: "cost",
        label: t("app.heroMetrics.totalCost"),
        tip: kpiTips.totalCost,
        value: euro(displayStats?.total_cost),
        sub:
          displayStats?.medians?.price_per_kwh != null
            ? `${t("app.heroMetrics.medianPricePrefix")} ${num(displayStats.medians.price_per_kwh, 3)} €/kWh`
            : noYearData
              ? t("common.noValues")
              : `${num(displayStats?.count, 0)} ${t("common.sessions")}`,
        context: latestCostTrend != null
          ? t("app.heroMetrics.vsPrevious", { value: trendPctLabel(latestCostTrend) })
          : t("app.heroMetrics.yearScope", { year }),
        contextTone: latestCostTrend == null ? "neutral" : latestCostTrend > 0 ? "negative" : "positive",
      },
      {
        key: "energy",
        label: t("app.heroMetrics.totalEnergy"),
        tip: kpiTips.totalEnergy,
        value: displayStats ? `${num(displayStats.total_energy_kwh, 1)} kWh` : "–",
        sub:
          currentPrev.current?.energy_kwh != null
            ? `${monthLabel(currentPrev.current.month)} ${num(currentPrev.current.energy_kwh, 1)} kWh`
            : noYearData
              ? t("common.noValues")
              : t("app.heroMetrics.yearTotal"),
        context: latestEnergyTrend != null
          ? t("app.heroMetrics.vsPrevious", { value: trendPctLabel(latestEnergyTrend) })
          : t("app.heroMetrics.yearScope", { year }),
        contextTone: "neutral",
      },
      {
        key: "efficiency",
        label: t("app.heroMetrics.efficiency"),
        tip: kpiTips.efficiency,
        value: displayEfficiency ? `${num(displayEfficiency.overall_score, 1)}/100` : "–",
        sub:
          noYearData
            ? t("common.noValues")
            : scoreLabel(displayEfficiency?.overall_score),
        tone: scoreTone(displayEfficiency?.overall_score),
        context: noYearData
          ? t("common.noValues")
          : t("app.heroMetrics.yearScope", { year }),
        contextTone: "neutral",
      },
    ],
    [currentPrev.current, displayEfficiency, displayStats, kpiTips, latestCostTrend, latestEnergyTrend, noYearData, t, year]
  );

  const spotlightCard = useMemo(() => {
    if (primaryInsight) {
      return {
        eyebrow: t("app.spotlight.signal"),
        title: primaryInsight.titel,
        value: primaryInsight.wert,
        meta: primaryInsight.sub || t("app.spotlight.yearFocus"),
        body: primaryInsight.tip || t("app.spotlight.standoutSignal"),
      };
    }

    if (latestSession) {
      return {
        eyebrow: t("app.spotlight.latestSession"),
        title: datumDE(latestSession.date),
        value: `${num(latestSession.energy_kwh, 1)} kWh`,
        meta: [latestSessionPrice != null ? `${num(latestSessionPrice, 3)} €/kWh` : null, latestSession.connector || null]
          .filter(Boolean)
          .join(" • "),
        body: latestSession.note || t("app.spotlight.latestRecordedSession"),
      };
    }

    const latestMonth = currentPrev.current || null;
    if (latestMonth) {
      return {
        eyebrow: t("app.spotlight.month"),
        title: monthLabel(latestMonth.month),
        value: euro(latestMonth.cost),
        meta: `${num(latestMonth.energy_kwh, 1)} kWh • ${num(latestMonth.price_per_kwh, 3)} €/kWh`,
        body: t("app.spotlight.strongestMonthImpulse"),
      };
    }

    return {
      eyebrow: t("app.spotlight.status"),
      title: `Jahr ${year}`,
      value: t("app.spotlight.noData"),
      meta: t("app.spotlight.noSessions"),
      body: t("app.spotlight.noYearValues", { year }),
    };
  }, [currentPrev.current, latestSession, latestSessionPrice, primaryInsight, t, year]);

  const spotlightImpulseValue =
    currentPrev.current?.trend?.cost?.pct != null
      ? trendPctLabel(currentPrev.current.trend.cost.pct)
      : currentPrev.prev
        ? trendPctLabel(calcTrend(currentPrev.current?.cost, currentPrev.prev?.cost)?.pct) ?? "–"
        : "–";
  const screenOptions = [
    {
      id: "overview",
      label: t("app.screens.overview"),
      meta: t("app.screenMeta.overview"),
      shortMeta: t("app.shell.shortMeta.overview"),
    },
    {
      id: "analysis",
      label: t("app.screens.analysis"),
      meta: t("app.screenMeta.analysis"),
      shortMeta: t("app.shell.shortMeta.analysis"),
    },
    {
      id: "verlauf",
      label: t("app.screens.history"),
      meta: t("app.screenMeta.history"),
      shortMeta: t("app.shell.shortMeta.history"),
    },
  ];
  const activeScreenOption = screenOptions.find((option) => option.id === activeScreen) ?? screenOptions[0];

  return (
    <ErrorBoundary>
      <div className="app">
        <a className="skipLink" href="#main-content">
          {t("app.skipMain")}
        </a>

        <div className="appShell">
          <AppNavigation
            activeScreen={activeScreen}
            addLabel={t("app.shell.addSession")}
            addOpen={addOpen}
            label={t("app.screenNavLabel")}
            onAdd={openAdd}
            onSelectScreen={selectScreen}
            options={screenOptions}
            showAddAction={!noYearData}
          />

          <div className="appWorkspace">
            <DashboardHeader
              availableYears={effectiveAvailableYears}
              dashboardTitle={dashboardTitle}
              demo={demo}
              latestSession={latestSession}
              loading={loading}
              refreshing={refreshing}
              onSelectYear={selectYear}
              onOpenOnboarding={() => setOnboardingOpen(true)}
              sessionsCount={sessions.length}
              year={year}
            />

            {!noYearData ? (
              <button
                type="button"
                onClick={openAdd}
                title={t("app.addSessionTitle")}
                aria-label={t("app.addSessionAria")}
                className="floatingAddButton"
                aria-expanded={addOpen}
                aria-controls="add-session-composer"
              >
                {t("app.addSessionButton")}
              </button>
            ) : null}

            <main
              id="main-content"
              ref={mainContentRef}
              className="layout premiumLayout"
              tabIndex={-1}
              aria-labelledby="active-screen-title"
              aria-busy={loading || refreshing ? "true" : "false"}
            >
              {err ? <div className="errorBox">{err}</div> : null}

              <section className="appScreenIntro" aria-live="polite">
                <div>
                  <div className="screenMetaCurrent">{t("app.shell.currentSection")}</div>
                  <h2 id="active-screen-title">{activeScreenOption.label}</h2>
                  <p>{activeScreenOption.meta}</p>
                </div>
                <div className="appScreenContext" aria-label={t("app.shell.contextLabel")}>
                  <span>{year}</span>
                  <span>{t("header.sessionsCount", { count: num(sessions.length, 0) })}</span>
                </div>
              </section>

              {noYearData ? (
                <section className="row">
                  <div className="card glassStrong premiumEmptyNotice">
                    <GuidedEmptyState
                      onAdd={openAdd}
                      onSelectYear={selectYear}
                      recoveryYear={recoveryYear}
                      year={year}
                    />
                  </div>
                </section>
              ) : null}

              {activeScreen === "overview" ? (
                <DashboardHeroStage
                  displayStats={displayStats}
                  heroMetrics={heroMetrics}
                  latestDateLabel={latestSession?.date ? datumDE(latestSession.date) : null}
                  spotlightCard={spotlightCard}
                  vehicleProfile={vehicleProfile}
                  year={year}
                  yearWeekdayFact={yearWeekdayFact}
                />
              ) : null}

              <Suspense fallback={<LazySectionFallback label={t("common.loadingSection")} />}>
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
                onOverviewModeChange={selectOverviewMode}
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
                onAnalysisModeChange={selectAnalysisMode}
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
              drilldownSource={historyDrilldownSource}
              onClearHistoryFilters={clearHistoryDrilldown}
              onHistoryFiltersChange={updateHistoryFilters}
              onReturnToSource={returnToHistorySource}
              sessionOutliersById={sessionOutliersById}
              sessionScoresById={sessionScoresById}
              sessions={sessions}
                year={year}
              />
            ) : null}
              </Suspense>
            </main>

            <footer className="footer">
              <span>{t("app.footer")}</span>
            </footer>
          </div>
        </div>

        <RuntimeFeedbackHost />
        {onboardingOpen ? (
          <OnboardingFlow
            activeScreen={activeScreen}
            onAdd={completeOnboardingWithAdd}
            onComplete={completeOnboardingAtScreen}
            onDismiss={dismissOnboarding}
            open
            screenOptions={screenOptions}
          />
        ) : null}
      </div>
    </ErrorBoundary>
  );
}
