import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ladeAuswertung,
  ladeLadevorgaenge,
  ladeMonatsauswertung,
  ladeSaisonauswertung,
  ladeEfficiencyScore,
  ladeAusreisserAnalyse,
  computeSocWindowAnalysis,
  getMonthlyCsvUrl,
  getSeasonsCsvUrl,
  isDemoMode,
} from "./ui/api.js";
import Charts from "./ui/Charts.jsx";
import MonthlyChart from "./ui/MonthlyChart.jsx";
import SessionsCard from "./ui/SessionsCard.jsx";
import AddSessionCard from "./ui/AddSessionCard.jsx";
import OutlierAnalysis from "./ui/OutlierAnalysis.jsx";
import SocWindowAnalysis from "./ui/SocWindowAnalysis.jsx";
import Tooltip from "./ui/Tooltip.jsx";
import VehicleHero from "./ui/VehicleHero.jsx";
import MedianSnapshotPanel from "./ui/MedianSnapshotPanel.jsx";
import YearComparisonPanel from "./ui/YearComparisonPanel.jsx";
import PowerCurveCard from "./ui/PowerCurveCard.jsx";
import MonthlyReportCard from "./ui/MonthlyReportCard.jsx";
import ForecastCard from "./ui/ForecastCard.jsx";
import SmartInsightsCard from "./ui/SmartInsightsCard.jsx";
import { monthLabel } from "./ui/monthLabels.js";
import { resolveVehicleProfile } from "./config/vehicleProfiles.js";

const YEARS = [2026, 2027, 2028];

function euro(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "–";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(v);
}

function num(n, digits = 1) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "–";
  return v.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function minutesFromSeconds(seconds) {
  const v = Number(seconds);
  if (!Number.isFinite(v)) return "–";
  return `${Math.round(v / 60)} min`;
}

function sessionPricePerKwh(session) {
  const direct = Number(session?.price_per_kwh);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const energy = Number(session?.energy_kwh);
  const totalCost = Number(session?.total_cost);
  if (!Number.isFinite(energy) || energy <= 0 || !Number.isFinite(totalCost) || totalCost < 0) return null;
  return totalCost / energy;
}

function datumDE(value) {
  try {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "–";
    return dt.toLocaleDateString("de-DE");
  } catch {
    return "–";
  }
}

function calcTrend(currentVal, prevVal) {
  const cur = Number(currentVal);
  const prev = Number(prevVal);
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) return null;
  const delta = cur - prev;
  return {
    delta,
    pct: delta / prev,
  };
}

function trendPctLabel(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  const sign = v > 0 ? "+" : "";
  return `${sign}${Math.round(v * 100)}%`;
}

function scoreTone(score) {
  const v = Number(score);
  if (!Number.isFinite(v)) return "rgba(255,255,255,0.78)";
  if (v >= 80) return "rgba(86, 214, 156, 0.95)";
  if (v >= 65) return "rgba(216, 140, 78, 0.95)";
  if (v >= 50) return "rgba(255, 210, 120, 0.95)";
  return "rgba(255, 132, 132, 0.95)";
}

function scoreLabel(score) {
  const v = Number(score);
  if (!Number.isFinite(v)) return "Keine Daten";
  if (v >= 80) return "Sehr effizient";
  if (v >= 65) return "Effizient";
  if (v >= 50) return "Solide";
  return "Optimierungspotenzial";
}

function KpiTitle({ label, tip }) {
  if (!tip) return <div className="kpiTitle">{label}</div>;
  return (
    <Tooltip content={tip} placement="top" openDelayMs={120} closeDelayMs={220}>
      <span className="kpiTitle kpiTitleTip" tabIndex={0}>
        {label}
      </span>
    </Tooltip>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null, info: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    console.error("🚨 UI Crash:", err, info);
    this.setState({ info });
  }

  render() {
    if (this.state.err) {
      const msg = String(this.state.err?.message || this.state.err);
      const stack = String(this.state.err?.stack || "");
      const comp = String(this.state.info?.componentStack || "");

      return (
        <div className="app">
          <div className="card glassStrong" style={{ padding: 16, border: "1px solid rgba(255,120,120,0.45)" }}>
            <div className="sectionKicker">Fehler</div>
            <div className="sectionTitle" style={{ marginTop: 6 }}>
              UI ist abgestürzt
            </div>

            <div style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.9)", lineHeight: 1.5 }}>
              <b>Message:</b> {msg}
              <div style={{ marginTop: 8, opacity: 0.8 }}>
                Kopier mir diese Box + Console-Log hier rein, dann fixen wir es sauber.
              </div>
            </div>

            <pre
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 14,
                overflow: "auto",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.10)",
                fontSize: 12,
                color: "rgba(255,255,255,0.86)",
                whiteSpace: "pre-wrap",
              }}
            >
              {stack || "(no stack)"}
              {comp ? `\n\n--- component stack ---\n${comp}` : ""}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const dashboardTitle = "eMobility Dashboard";
  const vehicleProfile = useMemo(() => resolveVehicleProfile(), []);
  const demo = typeof isDemoMode === "function" ? isDemoMode() : !!isDemoMode;

  const [jahr, setJahr] = useState(2026);
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [monthly, setMonthly] = useState(null);
  const [seasons, setSeasons] = useState(null);
  const [efficiency, setEfficiency] = useState(null);
  const [outliers, setOutliers] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshRequestRef = useRef(0);
  const [activeScreen, setActiveScreen] = useState("overview");
  const [overviewMode, setOverviewMode] = useState("cost");
  const [analysisMode, setAnalysisMode] = useState("compare");

  const [addOpen, setAddOpen] = useState(false);
  const addSectionRef = useRef(null);
  const addPanelRef = useRef(null);

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

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequestRef.current;
    setLoading(true);
    setErr(null);
    setStats(null);
    setSessions([]);
    setMonthly(null);
    setSeasons(null);
    setEfficiency(null);
    setOutliers(null);

    try {
      const [statsData, sessionsData, monthlyData, seasonsData, efficiencyData, outlierData] = await Promise.all([
        ladeAuswertung(jahr),
        ladeLadevorgaenge(jahr),
        ladeMonatsauswertung(jahr),
        ladeSaisonauswertung(jahr),
        ladeEfficiencyScore(jahr),
        ladeAusreisserAnalyse(jahr),
      ]);

      if (requestId !== refreshRequestRef.current) return;

      setStats(statsData ?? null);
      setSessions(Array.isArray(sessionsData) ? sessionsData : []);
      setMonthly(monthlyData ?? null);
      setSeasons(seasonsData ?? null);
      setEfficiency(efficiencyData ?? null);
      setOutliers(outlierData ?? null);
    } catch (e) {
      if (requestId !== refreshRequestRef.current) return;
      setErr(String(e?.message || e));
    } finally {
      if (requestId === refreshRequestRef.current) {
        setLoading(false);
      }
    }
  }, [jahr]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const latestSession = useMemo(() => {
    if (!Array.isArray(sessions) || sessions.length === 0) return null;
    return [...sessions]
      .filter((session) => session?.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || null;
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
    return months.sort((a, b) => (Number(a?.month) || 0) - (Number(b?.month) || 0));
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

  const socWindowAnalysis = useMemo(() => computeSocWindowAnalysis(sessions, jahr), [sessions, jahr]);
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

  const monthlyCsvUrl = useMemo(() => getMonthlyCsvUrl(jahr), [jahr]);
  const seasonsCsvUrl = useMemo(() => getSeasonsCsvUrl(jahr), [jahr]);

  const onDownloadMonthlyCsv = useCallback(() => {
    if (!monthlyCsvUrl) return;
    window.open(monthlyCsvUrl, "_blank", "noopener,noreferrer");
  }, [monthlyCsvUrl]);

  const onDownloadSeasonCsv = useCallback(() => {
    if (!seasonsCsvUrl) return;
    window.open(seasonsCsvUrl, "_blank", "noopener,noreferrer");
  }, [seasonsCsvUrl]);

  const primaryInsight = insights[0] || null;
  const latestSessionPrice = useMemo(() => sessionPricePerKwh(latestSession), [latestSession]);

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
      title: `Jahr ${jahr}`,
      value: "Keine Daten",
      meta: "Noch keine Sessions vorhanden",
      body: `Für ${jahr} sind aktuell noch keine Werte vorhanden.`,
    };
  }, [currentPrev.current, jahr, latestSession, latestSessionPrice, primaryInsight]);

  const spotlightImpulseValue =
    currentPrev.current?.trend?.cost?.pct != null
      ? trendPctLabel(currentPrev.current.trend.cost.pct)
      : currentPrev.prev
        ? trendPctLabel(calcTrend(currentPrev.current?.cost, currentPrev.prev?.cost)?.pct) ?? "–"
        : "–";

  function renderEfficiencyPanel() {
    return (
      <section className="row">
        <div className="card glassStrong analysisPanel">
          <div className="panelHeader">
            <div>
              <div className="sectionKicker">Efficiency</div>
              <div className="ttTitleRow panelTitleRow">
                <div className="sectionTitle">Cost Efficiency Score ({jahr})</div>
                <Tooltip
                  content="Der Cost Efficiency Score ist ein relativer Jahres-Score auf Basis von Preis pro kWh, Ladeleistung und Zeit pro kWh."
                  placement="top"
                  openDelayMs={120}
                  closeDelayMs={220}
                >
                  <button className="ttTrigger" type="button" aria-label="Erklärung: Cost Efficiency Score">
                    i
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className="pill panelMetaPill pillWarm" style={{ color: scoreTone(displayEfficiency?.overall_score) }}>
              {displayEfficiency
                ? `${num(displayEfficiency.overall_score, 1)}/100 • ${displayEfficiency.score_label || scoreLabel(displayEfficiency.overall_score)}`
                : "Keine Daten"}
            </div>
          </div>

          {displayEfficiency?.session_count ? (
            <div className="summaryGrid">
              <div className="summaryCard warm heroMetric">
                <div className="summaryLabel">Gesamt-Score</div>
                <div className="summaryValue" style={{ color: scoreTone(displayEfficiency.overall_score) }}>
                  {num(displayEfficiency.overall_score, 1)}/100
                </div>
                <div className="summarySub">{displayEfficiency.score_label || scoreLabel(displayEfficiency.overall_score)}</div>
              </div>

              <div className="summaryCard">
                <div className="summaryLabel">Ø Preis / kWh</div>
                <div className="summaryValue">
                  {displayEfficiency.averages?.price_per_kwh != null ? `${num(displayEfficiency.averages.price_per_kwh, 3)} €/kWh` : "–"}
                </div>
                <div className="summarySub">Mittelwert der bewerteten Sessions</div>
              </div>

              <div className="summaryCard frost">
                <div className="summaryLabel">Ø Ladeleistung</div>
                <div className="summaryValue">
                  {displayEfficiency.averages?.power_kw != null ? `${num(displayEfficiency.averages.power_kw, 1)} kW` : "–"}
                </div>
                <div className="summarySub">Berechnet aus Energie und Dauer</div>
              </div>

              <div className="summaryCard mint">
                <div className="summaryLabel">Beste Session</div>
                <div className="summaryValue">
                  {displayEfficiency.best_session?.score != null ? `${num(displayEfficiency.best_session.score, 1)}/100` : "–"}
                </div>
                <div className="summarySub">
                  {displayEfficiency.best_session?.date ? datumDE(displayEfficiency.best_session.date) : "Keine Daten"}
                </div>
              </div>
            </div>
          ) : (
            <div className="summaryGrid">
              <div className="emptyStateCard">Keine Effizienzdaten für {jahr} vorhanden.</div>
            </div>
          )}

          <div className="metricNarrative">
            Gewichtung: <b>Preis/kWh 55 %</b> • <b>Ø Ladeleistung 25 %</b> • <b>Zeit pro kWh 20 %</b>
          </div>
        </div>
      </section>
    );
  }

  function renderSeasonPanel() {
    return (
      <section className="row">
        <div className="card glassStrong analysisPanel">
          <div className="panelHeader">
            <div>
              <div className="sectionKicker">Saisons</div>
              <div className="ttTitleRow panelTitleRow">
                <div className="sectionTitle">Saisonanalyse ({jahr})</div>
                <Tooltip
                  content="Die Saisonanalyse gruppiert alle Sessions nach Winter, Frühling, Sommer und Herbst."
                  placement="top"
                  openDelayMs={120}
                  closeDelayMs={220}
                >
                  <button className="ttTrigger" type="button" aria-label="Erklärung: Saisonanalyse">
                    i
                  </button>
                </Tooltip>
              </div>
            </div>

            <button
              type="button"
              className="pill pillWarm"
              onClick={onDownloadSeasonCsv}
              style={{ cursor: seasonsCsvUrl ? "pointer" : "not-allowed" }}
              aria-label="Season CSV herunterladen"
              title="Season CSV herunterladen"
              disabled={!seasonsCsvUrl}
            >
              Season CSV ↓
            </button>
          </div>

          <div className="detailCardGrid">
            {seasonRows.length ? (
              seasonRows.map((season) => (
                <article key={season.key} className={`detailCard ${season.key}`}>
                  <div className="detailCardTop">
                    <div className="detailCardTitle">{season.label}</div>
                    <div className="detailCardMeta">{Array.isArray(season.months) ? season.months.join(" • ") : ""}</div>
                  </div>

                  <div className="summaryValue detailScoreValue" style={{ color: scoreTone(season.efficiency_score) }}>
                    {season.efficiency_score != null ? `${num(season.efficiency_score, 1)}/100` : "–"}
                  </div>
                  <div className="detailCardSub">Efficiency Score</div>

                  <div className="metricMiniGrid">
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">Sessions</div>
                      <div className="metricMiniValue">{num(season.count, 0)}</div>
                    </div>
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">kWh</div>
                      <div className="metricMiniValue">{num(season.energy_kwh, 1)}</div>
                    </div>
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">Kosten</div>
                      <div className="metricMiniValue">{euro(season.cost)}</div>
                    </div>
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">Ø €/kWh</div>
                      <div className="metricMiniValue">
                        {season.avg_price_per_kwh != null ? `${num(season.avg_price_per_kwh, 3)} €/kWh` : "–"}
                      </div>
                    </div>
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">Ø Dauer</div>
                      <div className="metricMiniValue">{minutesFromSeconds(season.avg_duration_seconds)}</div>
                    </div>
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">Ø kW</div>
                      <div className="metricMiniValue">
                        {season.avg_power_kw != null ? `${num(season.avg_power_kw, 1)} kW` : "–"}
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="emptyStateCard">Noch keine Saisonanalyse für {jahr}.</div>
            )}
          </div>

          {seasonRows.length ? (
            <div className="summaryGrid">
              <div className="summaryCard warm">
                <div className="summaryLabel">Beste Saison</div>
                <div className="summaryValue">{seasons?.highlights?.best_efficiency_season?.label || "–"}</div>
                <div className="summarySub">
                  {seasons?.highlights?.best_efficiency_season?.efficiency_score != null
                    ? `${num(seasons.highlights.best_efficiency_season.efficiency_score, 1)}/100`
                    : "Keine Daten"}
                </div>
              </div>

              <div className="summaryCard frost">
                <div className="summaryLabel">Günstigste Saison</div>
                <div className="summaryValue">{seasons?.highlights?.cheapest_season?.label || "–"}</div>
                <div className="summarySub">
                  {seasons?.highlights?.cheapest_season?.avg_price_per_kwh != null
                    ? `${num(seasons.highlights.cheapest_season.avg_price_per_kwh, 3)} €/kWh`
                    : "Keine Daten"}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  function renderPricePanel() {
    return (
      <section className="row">
        <div className="card glassStrong analysisPanel">
          <div className="panelHeader">
            <div>
              <div className="sectionKicker">Preis</div>
              <div className="ttTitleRow panelTitleRow">
                <div className="sectionTitle">Preisentwicklung ({jahr})</div>
                <Tooltip
                  content="Effektiver durchschnittlicher Preis pro kWh pro Monat."
                  placement="top"
                  openDelayMs={120}
                  closeDelayMs={220}
                >
                  <button className="ttTrigger" type="button" aria-label="Erklärung: Preisentwicklung">
                    i
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className="pill ghostPill panelMetaPill">
              {priceSummary.trend?.pct != null ? `${trendPctLabel(priceSummary.trend.pct)} vs. Vormonat` : "Monatliche €/kWh"}
            </div>
          </div>

          <div className="summaryGrid">
            {priceSummary.latest ? (
              <>
                <div className="summaryCard">
                  <div className="summaryLabel">Letzter Monatswert</div>
                  <div className="summaryValue">{num(priceSummary.latest.price_per_kwh, 3)} €/kWh</div>
                  <div className="summarySub">{monthLabel(priceSummary.latest.month)}</div>
                </div>

                <div className="summaryCard mint">
                  <div className="summaryLabel">Günstigster Monat</div>
                  <div className="summaryValue" style={{ color: "rgba(120,210,160,0.92)" }}>
                    {num(priceSummary.cheapest?.price_per_kwh, 3)} €/kWh
                  </div>
                  <div className="summarySub">
                    {priceSummary.cheapest ? monthLabel(priceSummary.cheapest.month) : "–"}
                  </div>
                </div>

                <div className="summaryCard danger">
                  <div className="summaryLabel">Teuerster Monat</div>
                  <div className="summaryValue" style={{ color: "rgba(255,132,132,0.92)" }}>
                    {num(priceSummary.priciest?.price_per_kwh, 3)} €/kWh
                  </div>
                  <div className="summarySub">
                    {priceSummary.priciest ? monthLabel(priceSummary.priciest.month) : "–"}
                  </div>
                </div>
              </>
            ) : (
              <div className="emptyStateCard">Noch keine Preisdaten für {jahr}.</div>
            )}
          </div>
        </div>
      </section>
    );
  }

  function renderMonthlyPanel() {
    return (
      <section className="row">
        <div className="card glassStrong analysisPanel">
          <div className="panelHeader">
            <div>
              <div className="sectionKicker">Monate</div>
              <div className="sectionTitle sectionTitleSpaced">Monatsauswertung ({jahr})</div>
            </div>

            <button
              type="button"
              className="pill pillWarm"
              onClick={onDownloadMonthlyCsv}
              style={{ cursor: monthlyCsvUrl ? "pointer" : "not-allowed" }}
              aria-label="Monthly CSV herunterladen"
              title="Monthly CSV herunterladen"
              disabled={!monthlyCsvUrl}
            >
              Monthly CSV ↓
            </button>
          </div>

          <div className="chartPanel">
            {activeMonths.length ? (
              <MonthlyChart months={monthlySorted} />
            ) : (
              <div className="emptyStateCard">Keine Monatswerte für {jahr} vorhanden.</div>
            )}
          </div>
        </div>
      </section>
    );
  }

  function renderOverviewFocus() {
    if (overviewMode === "behavior") {
      return <PowerCurveCard analysis={socWindowAnalysis} year={jahr} />;
    }

    if (overviewMode === "compare") {
      return (
        <YearComparisonPanel
          key={`overview-comparison-${jahr}`}
          availableYears={YEARS}
          initialLeftYear={jahr}
          initialRightYear={jahr === YEARS[0] ? YEARS[1] : YEARS[0]}
        />
      );
    }

    if (overviewMode === "forecast") {
      return <ForecastCard months={monthlySorted} year={jahr} />;
    }

    return (
      <section className="row">
        <div className="card glassStrong analysisPanel premiumFeatureCard premiumFeatureChartPanel">
          <div className="panelHeader">
            <div>
              <div className="sectionKicker">Kosten</div>
              <div className="ttTitleRow panelTitleRow">
                <div className="sectionTitle">Monatsverlauf ({jahr})</div>
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
              <MonthlyChart months={monthlySorted} />
            ) : (
              <div className="emptyStateCard">Keine Monatswerte für {jahr} vorhanden.</div>
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

  function renderAnalysisContent() {
    if (analysisMode === "signals") {
      return (
        <>
          <SmartInsightsCard
            stats={displayStats}
            monthly={monthly}
            outliers={outliers}
            socWindowAnalysis={socWindowAnalysis}
            sessions={sessions}
            year={jahr}
          />
          <OutlierAnalysis analysis={outliers} year={jahr} />
        </>
      );
    }

    if (analysisMode === "efficiency") {
      return (
        <>
          {renderEfficiencyPanel()}
          <MedianSnapshotPanel stats={displayStats} year={jahr} />
          <SocWindowAnalysis analysis={socWindowAnalysis} year={jahr} />
          <PowerCurveCard analysis={socWindowAnalysis} year={jahr} />
        </>
      );
    }

    if (analysisMode === "time") {
      return (
        <>
          <MonthlyReportCard months={monthlySorted} sessions={sessions} year={jahr} />
          <ForecastCard months={monthlySorted} year={jahr} />
          {renderSeasonPanel()}
          {renderPricePanel()}
          {renderMonthlyPanel()}
          <section className="row">
            {sessions.length ? (
              <Charts sessions={sessions} />
            ) : (
              <div className="card glassStrong">
                <div className="emptyStateCard">Keine Verlaufswerte für {jahr} vorhanden.</div>
              </div>
            )}
          </section>
        </>
      );
    }

    return (
      <YearComparisonPanel
        key={`analysis-comparison-${jahr}`}
        availableYears={YEARS}
        initialLeftYear={jahr}
        initialRightYear={jahr === YEARS[0] ? YEARS[1] : YEARS[0]}
      />
    );
  }

  const fabStyle = useMemo(
    () => ({
      position: "fixed",
      right: 22,
      bottom: 22,
      zIndex: 50,
      padding: "12px 16px",
      borderRadius: 999,
      color: "white",
      background: "linear-gradient(180deg, rgba(24,24,30,0.90), rgba(12,12,16,0.88))",
      border: "1px solid rgba(255,255,255,0.10)",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 22px 56px rgba(0,0,0,0.50)",
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      cursor: "pointer",
      fontWeight: 650,
      letterSpacing: 0.15,
    }),
    []
  );

  return (
    <ErrorBoundary>
      <div className="app">
        <button
          type="button"
          onClick={openAdd}
          title="Ladevorgang hinzufügen"
          aria-label="Ladevorgang hinzufügen"
          style={fabStyle}
        >
          + Ladevorgang
        </button>

        <header className="topBar topBarPremium">
          <div className="topLeft premiumTopCopy">
            <div className="kicker">Cupra Charging Intelligence</div>
            <h1 className="title">{dashboardTitle}</h1>
            <div className="sub">Ein ruhiges Charging-Cockpit mit Fokus auf Verlauf, Preisniveau und Ladequalität.</div>

            {demo ? (
              <div className="demoBanner" role="status" aria-live="polite">
                <div className="demoBannerLeft">
                  <span className="demoPill">DEMO</span>
                  <span className="demoText">Demo-Daten aktiv – keine Speicherung, keine API/DB</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="premiumTopControls">
            <div className="filters premiumYearRail">
              <div className="chipLabel">Jahr</div>
              <div className="chipRow">
                {YEARS.map((itemYear) => (
                  <button
                    key={itemYear}
                    type="button"
                    className={jahr === itemYear ? "chip" : "chip ghost"}
                    onClick={() => setJahr(itemYear)}
                  >
                    {itemYear}
                  </button>
                ))}
              </div>
            </div>

            <div className="premiumHeaderMeta">
              <div className="pill ghostPill">{loading ? "Synchronisiert…" : `${num(sessions.length, 0)} Sessions`}</div>
              <div className="pill ghostPill">
                {latestSession?.date ? `Zuletzt ${datumDE(latestSession.date)}` : `Jahr ${jahr}`}
              </div>
            </div>
          </div>
        </header>

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
                <div className="emptyStateCard">Für {jahr} sind keine Werte vorhanden.</div>
              </div>
            </section>
          ) : null}

          <section className="premiumHeroStage">
            <VehicleHero
              profile={vehicleProfile}
              latestDateLabel={latestSession?.date ? datumDE(latestSession.date) : null}
              year={jahr}
            />

            <div className="premiumHeroRail">
              <div className="premiumMetricRail">
                {heroMetrics.map((item) => (
                  <article key={item.key} className="card glass premiumMetricCard">
                    <KpiTitle label={item.label} tip={item.tip} />
                    <div className="premiumMetricValue" style={item.tone ? { color: item.tone } : undefined}>
                      {item.value}
                    </div>
                    <div className="premiumMetricSub">{item.sub}</div>
                  </article>
                ))}
              </div>

              <article className="card glassStrong premiumSpotlightCard">
                <div className="premiumSpotlightEyebrow">{spotlightCard.eyebrow}</div>
                <div className="premiumSpotlightTitle">{spotlightCard.title}</div>
                <div className="premiumSpotlightValue">{spotlightCard.value}</div>
                <div className="premiumSpotlightMeta">{spotlightCard.meta}</div>
                <p className="premiumSpotlightText">{spotlightCard.body}</p>
                <div className="premiumSpotlightFoot">
                  <span>{displayStats ? `${num(displayStats.count, 0)} Sessions` : "Keine Sessions"}</span>
                  <span>{displayStats?.avg_power_kw != null ? `${num(displayStats.avg_power_kw, 1)} kW Ø` : "Kein Leistungsschnitt"}</span>
                </div>
              </article>
            </div>
          </section>

          {activeScreen === "overview" ? (
            <>
              <section className="premiumModeBar">
                <div className="premiumModeIntro">
                  <div className="sectionKicker">Fokusfläche</div>
                  <div className="premiumModeTitle">Eine dominante Fläche statt Kartenwand</div>
                </div>

                <div className="toggle premiumModeToggle" aria-label="Übersicht Fokus">
                  <button
                    type="button"
                    className={overviewMode === "cost" ? "toggleBtn active" : "toggleBtn"}
                    onClick={() => setOverviewMode("cost")}
                  >
                    Kosten
                  </button>
                  <button
                    type="button"
                    className={overviewMode === "behavior" ? "toggleBtn active" : "toggleBtn"}
                    onClick={() => setOverviewMode("behavior")}
                  >
                    Ladeverhalten
                  </button>
                  <button
                    type="button"
                    className={overviewMode === "compare" ? "toggleBtn active" : "toggleBtn"}
                    onClick={() => setOverviewMode("compare")}
                  >
                    Vergleich
                  </button>
                  <button
                    type="button"
                    className={overviewMode === "forecast" ? "toggleBtn active" : "toggleBtn"}
                    onClick={() => setOverviewMode("forecast")}
                  >
                    Forecast
                  </button>
                </div>
              </section>

              {renderOverviewFocus()}

              <div className="premiumSecondaryGrid">
                <div className="premiumSecondarySlot">
                  <MonthlyReportCard months={monthlySorted} sessions={sessions} year={jahr} />
                </div>

                <div className="premiumSecondarySlot premiumSecondarySpotlight">
                  <section className="row">
                    <div className="card glassStrong analysisPanel premiumSpotlightReportCard">
                      <div className="panelHeader">
                        <div>
                          <div className="sectionKicker">Spotlight</div>
                          <div className="sectionTitle sectionTitleSpaced">Jahresfokus ({jahr})</div>
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

                        <article className="summaryCard premiumSpotlightImpulseCard">
                          <div className="summaryLabel">Monatsimpuls</div>
                          <div className="summaryValue">{spotlightImpulseValue}</div>
                          <div className="summarySub">Kosten vs. Vormonat</div>
                        </article>
                      </div>

                      <div className="metricNarrative">
                        <b>{spotlightCard.title}</b> steht aktuell für <b>{spotlightCard.value}</b>. {spotlightCard.body}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </>
          ) : null}

          {activeScreen === "analysis" ? (
            <>
              <section className="premiumModeBar">
                <div className="premiumModeIntro">
                  <div className="sectionKicker">Analyse</div>
                  <div className="premiumModeTitle">Tiefgang nur dann, wenn du ihn wirklich brauchst</div>
                </div>

                <div className="toggle premiumModeToggle" aria-label="Analyse Fokus">
                  <button
                    type="button"
                    className={analysisMode === "compare" ? "toggleBtn active" : "toggleBtn"}
                    onClick={() => setAnalysisMode("compare")}
                  >
                    Vergleich
                  </button>
                  <button
                    type="button"
                    className={analysisMode === "efficiency" ? "toggleBtn active" : "toggleBtn"}
                    onClick={() => setAnalysisMode("efficiency")}
                  >
                    Effizienz
                  </button>
                  <button
                    type="button"
                    className={analysisMode === "signals" ? "toggleBtn active" : "toggleBtn"}
                    onClick={() => setAnalysisMode("signals")}
                  >
                    Signale
                  </button>
                  <button
                    type="button"
                    className={analysisMode === "time" ? "toggleBtn active" : "toggleBtn"}
                    onClick={() => setAnalysisMode("time")}
                  >
                    Zeiträume
                  </button>
                </div>
              </section>

              {renderAnalysisContent()}
            </>
          ) : null}

          {activeScreen === "verlauf" ? (
            <>
              <section className="row">
                <div className="card glassStrong premiumDataIntro">
                  <div className="premiumDataIntroEyebrow">Verlauf</div>
                  <div className="premiumDataIntroTitle">Sessions pflegen ohne visuelle Unruhe</div>
                  <div className="premiumDataIntroText">
                    Tabelle, Inline-Edit und Composer sind hier bewusst separat gebündelt. So bleibt die Übersicht oben ruhig
                    und die operative Pflege unten schnell.
                  </div>
                </div>
              </section>

              <section className="row">
                <SessionsCard
                  sessions={sessions}
                  year={jahr}
                  onChanged={refresh}
                  sessionScoresById={sessionScoresById}
                  sessionOutliersById={sessionOutliersById}
                />
              </section>

              <section className="row" ref={addSectionRef} style={{ marginTop: 18 }}>
                <div className={`card glassStrong addComposer ${addOpen ? "open" : "closed"}`}>
                  <div className="addComposerGlow" aria-hidden="true" />

                  <div className="addComposerInner">
                    <div className="panelHeader">
                      <div>
                        <div className="sectionKicker">Action</div>
                        <div className="sectionTitle sectionTitleSpaced">Ladevorgang hinzufügen</div>
                      </div>

                      <div className="panelActions">
                        {!addOpen ? (
                          <button type="button" className="pill pillWarm" onClick={openAdd} aria-expanded={addOpen} style={{ cursor: "pointer" }}>
                            Öffnen ↓
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="pill ghostPill"
                            onClick={closeAdd}
                            aria-expanded={addOpen}
                            style={{ cursor: "pointer" }}
                          >
                            Einklappen
                          </button>
                        )}
                      </div>
                    </div>

                    {!addOpen ? (
                      <div className="addComposerClosed">
                        <div className="addComposerLead">
                          Neue Session direkt im Verlauf ergänzen. So bleibt die Übersicht oberhalb ruhig und die Pflege darunter fokussiert.
                        </div>
                        <div className="addComposerMiniGrid">
                          <div className="summaryCard warm addComposerStatCard">
                            <div className="summaryLabel">Live Sync</div>
                            <div className="summaryValue">Sofort</div>
                            <div className="summarySub">fließt direkt in Vergleich, Forecast und Score ein</div>
                          </div>
                          <div className="summaryCard addComposerStatCard">
                            <div className="summaryLabel">Pflegezone</div>
                            <div className="summaryValue">Nur Verlauf</div>
                            <div className="summarySub">Sessions pflegen, ohne die Analysefläche zu überladen</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div ref={addPanelRef} tabIndex={-1} className="addComposerFrame">
                        <AddSessionCard onCreated={refresh} demo={demo} />
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </main>

        <footer className="footer">
          <span>Lokales Dashboard über Tailscale • Daten bleiben bei dir</span>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
