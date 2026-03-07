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
import CategorySection from "./ui/CategorySection.jsx";
import MonthlyChart from "./ui/MonthlyChart.jsx";
import SessionsCard from "./ui/SessionsCard.jsx";
import AddSessionCard from "./ui/AddSessionCard.jsx";
import OutlierAnalysis from "./ui/OutlierAnalysis.jsx";
import SocWindowAnalysis from "./ui/SocWindowAnalysis.jsx";
import Tooltip from "./ui/Tooltip.jsx";
import VehicleHero from "./ui/VehicleHero.jsx";
import { resolveVehicleProfile } from "./config/vehicleProfiles.js";

const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const CATEGORY_STORAGE_KEY = "mobility-dashboard.category-state.v1";
const CATEGORY_DEFAULTS = {
  signals: true,
  efficiency: true,
  trends: false,
  data: true,
};

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

function trendClass(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return "";
  if (v > 0) return "trendUp";
  if (v < 0) return "trendDown";
  return "trendFlat";
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

function CategoryGlyph({ kind }) {
  if (kind === "signals") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 14c2.2 0 2.8-6 5-6s2.8 10 5 10 2.8-7 6-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (kind === "efficiency") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M13 2L5 13h5l-1 9 10-13h-5l1-7z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (kind === "trends") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 16l5-5 4 3 7-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18 6h2v2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
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

  const [addOpen, setAddOpen] = useState(false);
  const addSectionRef = useRef(null);
  const addPanelRef = useRef(null);
  const [categoryOpen, setCategoryOpen] = useState(() => {
    if (typeof window === "undefined") return CATEGORY_DEFAULTS;
    try {
      const raw = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
      if (!raw) return CATEGORY_DEFAULTS;
      return { ...CATEGORY_DEFAULTS, ...(JSON.parse(raw) || {}) };
    } catch {
      return CATEGORY_DEFAULTS;
    }
  });

  const openAdd = useCallback(() => {
    setCategoryOpen((prev) => ({ ...prev, data: true }));
    setAddOpen(true);
    requestAnimationFrame(() => {
      addSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => addPanelRef.current?.focus?.(), 350);
    });
  }, []);

  const closeAdd = useCallback(() => setAddOpen(false), []);

  const toggleCategory = useCallback((key) => {
    setCategoryOpen((prev) => {
      const nextOpen = !prev[key];
      if (key === "data" && !nextOpen) {
        setAddOpen(false);
      }
      return { ...prev, [key]: nextOpen };
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categoryOpen));
    } catch {
      // ignore
    }
  }, [categoryOpen]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [statsData, sessionsData, monthlyData, seasonsData, efficiencyData, outlierData] = await Promise.all([
        ladeAuswertung(jahr),
        ladeLadevorgaenge(jahr),
        ladeMonatsauswertung(jahr),
        ladeSaisonauswertung(jahr),
        ladeEfficiencyScore(jahr),
        ladeAusreisserAnalyse(jahr),
      ]);

      setStats(statsData ?? null);
      setSessions(Array.isArray(sessionsData) ? sessionsData : []);
      setMonthly(monthlyData ?? null);
      setSeasons(seasonsData ?? null);
      setEfficiency(efficiencyData ?? null);
      setOutliers(outlierData ?? null);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
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
      avgKwh:
        "Durchschnittlich geladene Energie pro Session. Zeigt, ob du eher kleinere Top-ups oder größere Ladeblöcke fährst.",
      avgDur:
        "Durchschnittliche Dauer je Session. Zusammen mit kWh ergibt sich daraus deine durchschnittliche Ladeleistung.",
      avgPrice: "Durchschnittliche Kosten pro Ladung. Gut, um kostspielige Sessions schneller einzuordnen.",
      avgPower:
        "Durchschnittliche Ladeleistung auf Basis von Energie und Dauer. Das ist keine Peak-Leistung der Säule.",
      efficiency:
        "Relativer Jahres-Score auf Basis deiner Sessions. Bewertet Preis pro kWh, Ladeleistung und Zeit pro kWh.",
      sessionCount: "Anzahl aller erfassten Ladevorgänge im gewählten Jahr.",
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
  const seasonRows = useMemo(() => (Array.isArray(seasons?.seasons) ? [...seasons.seasons] : []), [seasons]);

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
        wert: MONATE[(monthly.top_energy_month.month || 1) - 1] || "–",
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

  const categoryPills = useMemo(
    () => ({
      signals: [
        insights.length ? `${num(insights.length, 0)} Insights` : "Keine Insights",
        outliers?.outlier_count ? `${num(outliers.outlier_count, 0)} Auffällig` : "Keine Ausreißer",
      ],
      efficiency: [
        efficiency?.overall_score != null ? `${num(efficiency.overall_score, 1)}/100 Score` : "Kein Score",
        socWindowAnalysis?.analyzed_session_count
          ? `${num(socWindowAnalysis.analyzed_session_count, 0)} SoC-Sessions`
          : "Keine SoC-Fenster",
      ],
      trends: [
        seasonRows.length ? `${num(seasonRows.length, 0)} Saisons` : "Keine Saisons",
        priceMonths.length ? `${num(priceMonths.length, 0)} Preis-Monate` : "Keine Preisreihe",
        activeMonths.length ? `${num(activeMonths.length, 0)} Aktiv` : "Keine Monatsdaten",
      ],
      data: [`${num(sessions.length, 0)} Sessions`, addOpen ? "Formular offen" : "Formular geschlossen"],
    }),
    [insights.length, outliers, efficiency, socWindowAnalysis, seasonRows.length, priceMonths.length, activeMonths.length, sessions.length, addOpen]
  );

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

        <header className="topBar">
          <div className="topLeft">
            <div className="kicker">Private Charging Intelligence</div>
            <h1 className="title">{dashboardTitle}</h1>
            <div className="sub">
              Modulares Analyse-Cockpit für Ladevorgänge, Kosten und Effizienz. Hero-Fahrzeug, Asset und Story können
              später frei ausgetauscht werden.
            </div>

            {demo ? (
              <div className="demoBanner" role="status" aria-live="polite">
                <div className="demoBannerLeft">
                  <span className="demoPill">DEMO</span>
                  <span className="demoText">Demo-Daten aktiv – keine Speicherung, keine API/DB</span>
                </div>
              </div>
            ) : null}

            <div className="filters">
              <div className="chipLabel">Jahr</div>
              <div className="chipRow">
                <button type="button" className={jahr === 2026 ? "chip" : "chip ghost"} onClick={() => setJahr(2026)}>
                  2026
                </button>
                <button type="button" className={jahr === 2027 ? "chip" : "chip ghost"} onClick={() => setJahr(2027)}>
                  2027
                </button>
                <button type="button" className={jahr === 2028 ? "chip" : "chip ghost"} onClick={() => setJahr(2028)}>
                  2028
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="layout">
          {err ? <div className="errorBox">{err}</div> : null}

          <section className="row heroRowGrid">
            <VehicleHero
              profile={vehicleProfile}
              latestDateLabel={latestSession?.date ? datumDE(latestSession.date) : null}
              year={jahr}
            />

            <div className="kpiGrid">
              <div className="card glass kpi accent">
                <KpiTitle label="Gesamtkosten" tip={kpiTips.totalCost} />
                <div className="kpiValue">{euro(stats?.total_cost)}</div>
                <div className="kpiSub">Summe ({jahr})</div>
              </div>

              <div className="card glass kpi">
                <KpiTitle label="Gesamtenergie" tip={kpiTips.totalEnergy} />
                <div className="kpiValue">{num(stats?.total_energy_kwh, 1)} kWh</div>
                <div className="kpiSub">geladene Energie</div>
              </div>

              <div className="card glass kpi">
                <KpiTitle label="Ø pro Ladevorgang" tip={kpiTips.avgKwh} />
                <div className="kpiValue">{num(stats?.avg_kwh_per_session, 1)} kWh</div>
                <div className="kpiSub">Durchschnitt</div>
              </div>

              <div className="card glass kpi">
                <KpiTitle label="Ø Ladedauer" tip={kpiTips.avgDur} />
                <div className="kpiValue">{minutesFromSeconds(stats?.avg_duration_seconds)}</div>
                <div className="kpiSub">pro Ladevorgang</div>
              </div>

              <div className="card glass kpi">
                <KpiTitle label="Ø Preis pro Ladung" tip={kpiTips.avgPrice} />
                <div className="kpiValue">{euro(stats?.avg_price_per_charge)}</div>
                <div className="kpiSub">Durchschnitt</div>
              </div>

              <div className="card glass kpi">
                <KpiTitle label="Ø Ladeleistung" tip={kpiTips.avgPower} />
                <div className="kpiValue">{num(stats?.avg_power_kw, 1)} kW</div>
                <div className="kpiSub">aus kWh & Dauer</div>
              </div>

              <div className="card glass kpi" style={{ borderColor: "rgba(216,140,78,0.38)" }}>
                <KpiTitle label="Cost Efficiency" tip={kpiTips.efficiency} />
                <div className="kpiValue" style={{ color: scoreTone(efficiency?.overall_score) }}>
                  {num(efficiency?.overall_score, 1)}/100
                </div>
                <div className="kpiSub">{efficiency?.score_label || scoreLabel(efficiency?.overall_score)}</div>
              </div>

              <div className="card glass kpi">
                <KpiTitle label="Ladevorgänge" tip={kpiTips.sessionCount} />
                <div className="kpiValue">{num(stats?.count, 0)}</div>
                <div className="kpiSub">erfasste Sessions</div>
              </div>
            </div>
          </section>

          <CategorySection
            id="signals"
            kicker="Kategorie 1"
            title="Signale & Auffälligkeiten"
            summary="Alles, was sofort Interpretation liefert: Highlights, Ausreißer und automatische Hinweise auf ungewöhnliche Sessions."
            pills={categoryPills.signals}
            open={categoryOpen.signals}
            onToggle={toggleCategory}
            tone="signals"
            icon={<CategoryGlyph kind="signals" />}
          >
            <section className="row">
              <div className="card glassStrong insightsCard">
                <div className="sectionHeader">
                  <div>
                    <div className="sectionKicker">Insights</div>
                    <div className="ttTitleRow" style={{ marginTop: 2 }}>
                      <div className="sectionTitle">Auswertung ({jahr})</div>
                      <Tooltip
                        content="Insights sind Highlights aus Sessions, Monats- und Saisonanalyse, SoC-Fenstern, Effizienz und Ausreißer-Erkennung."
                        placement="top"
                        openDelayMs={120}
                        closeDelayMs={220}
                      >
                        <button className="ttTrigger" type="button" aria-label="Erklärung: Insights">
                          i
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="pill ghostPill">{loading ? "Lädt…" : "Aktuell"}</div>
                </div>

                <div className="insightsGrid">
                  {insights.length ? (
                    insights.map((item) => (
                      <Tooltip key={item.id} content={item.tip || ""} placement="top" openDelayMs={120} closeDelayMs={220}>
                        <div className="insightTile" tabIndex={0}>
                          <div className="insightLabel">{item.titel}</div>
                          <div className="insightValue">{item.wert}</div>
                          {item.sub ? <div className="insightSub">{item.sub}</div> : null}
                          {Number.isFinite(item.trendPct) ? (
                            <div className={`trendBadge ${trendClass(item.trendPct)}`}>
                              <span className="trendArrow">{item.trendPct > 0 ? "↑" : item.trendPct < 0 ? "↓" : "→"}</span>
                              {trendPctLabel(item.trendPct)}
                            </div>
                          ) : null}
                        </div>
                      </Tooltip>
                    ))
                  ) : (
                    <div className="insightTile">
                      <div className="insightLabel">Noch keine Insights</div>
                      <div className="insightValue">–</div>
                      <div className="insightSub">Importiere Ladevorgänge für {jahr}</div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <OutlierAnalysis analysis={outliers} year={jahr} />
          </CategorySection>

          <CategorySection
            id="efficiency"
            kicker="Kategorie 2"
            title="Effizienz & Ladefenster"
            summary="Score, Ladequalität und SoC-Fenster an einem Ort, damit Effizienzregeln und Ladeverhalten zusammen gelesen werden können."
            pills={categoryPills.efficiency}
            open={categoryOpen.efficiency}
            onToggle={toggleCategory}
            tone="efficiency"
            icon={<CategoryGlyph kind="efficiency" />}
          >
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

                  <div className="pill panelMetaPill pillWarm" style={{ color: scoreTone(efficiency?.overall_score) }}>
                    {num(efficiency?.overall_score, 1)}/100 • {efficiency?.score_label || scoreLabel(efficiency?.overall_score)}
                  </div>
                </div>

                <div className="summaryGrid">
                  <div className="summaryCard warm heroMetric">
                    <div className="summaryLabel">Gesamt-Score</div>
                    <div className="summaryValue" style={{ color: scoreTone(efficiency?.overall_score) }}>
                      {num(efficiency?.overall_score, 1)}/100
                    </div>
                    <div className="summarySub">{efficiency?.score_label || scoreLabel(efficiency?.overall_score)}</div>
                  </div>

                  <div className="summaryCard">
                    <div className="summaryLabel">Ø Preis / kWh</div>
                    <div className="summaryValue">
                      {efficiency?.averages?.price_per_kwh != null ? `${num(efficiency.averages.price_per_kwh, 3)} €` : "–"}
                    </div>
                    <div className="summarySub">Mittelwert der bewerteten Sessions</div>
                  </div>

                  <div className="summaryCard frost">
                    <div className="summaryLabel">Ø Ladeleistung</div>
                    <div className="summaryValue">
                      {efficiency?.averages?.power_kw != null ? `${num(efficiency.averages.power_kw, 1)} kW` : "–"}
                    </div>
                    <div className="summarySub">Berechnet aus Energie und Dauer</div>
                  </div>

                  <div className="summaryCard mint">
                    <div className="summaryLabel">Beste Session</div>
                    <div className="summaryValue">
                      {efficiency?.best_session?.score != null ? `${num(efficiency.best_session.score, 1)}/100` : "–"}
                    </div>
                    <div className="summarySub">
                      {efficiency?.best_session?.date ? datumDE(efficiency.best_session.date) : "Keine Daten"}
                    </div>
                  </div>
                </div>

                <div className="metricNarrative">
                  Gewichtung: <b>Preis/kWh 55 %</b> • <b>Ø Ladeleistung 25 %</b> • <b>Zeit pro kWh 20 %</b>
                </div>
              </div>
            </section>

            <SocWindowAnalysis analysis={socWindowAnalysis} year={jahr} />
          </CategorySection>

          <CategorySection
            id="trends"
            kicker="Kategorie 3"
            title="Zeiträume & Trends"
            summary="Monate, Saisons und Preisentwicklung in einer Gruppe. Hier liegt alles, was sich über Zeit verändert oder vergleichen lässt."
            pills={categoryPills.trends}
            open={categoryOpen.trends}
            onToggle={toggleCategory}
            tone="trends"
            icon={<CategoryGlyph kind="trends" />}
          >
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
                              {season.avg_price_per_kwh != null ? `${num(season.avg_price_per_kwh, 3)} €` : "–"}
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
              </div>
            </section>

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
                        <div className="summarySub">{MONATE[(priceSummary.latest.month || 1) - 1] || "–"}</div>
                      </div>

                      <div className="summaryCard mint">
                        <div className="summaryLabel">Günstigster Monat</div>
                        <div className="summaryValue" style={{ color: "rgba(120,210,160,0.92)" }}>
                          {num(priceSummary.cheapest?.price_per_kwh, 3)} €/kWh
                        </div>
                        <div className="summarySub">
                          {priceSummary.cheapest ? MONATE[(priceSummary.cheapest.month || 1) - 1] || "–" : "–"}
                        </div>
                      </div>

                      <div className="summaryCard danger">
                        <div className="summaryLabel">Teuerster Monat</div>
                        <div className="summaryValue" style={{ color: "rgba(255,132,132,0.92)" }}>
                          {num(priceSummary.priciest?.price_per_kwh, 3)} €/kWh
                        </div>
                        <div className="summarySub">
                          {priceSummary.priciest ? MONATE[(priceSummary.priciest.month || 1) - 1] || "–" : "–"}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="emptyStateCard">Noch keine Preisdaten für {jahr}.</div>
                  )}
                </div>
              </div>
            </section>

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
                  <MonthlyChart months={monthlySorted} />
                </div>
              </div>
            </section>

            <section className="row">
              <Charts sessions={sessions} />
            </section>
          </CategorySection>

          <CategorySection
            id="data"
            kicker="Kategorie 4"
            title="Sessions & Pflege"
            summary="Die operativen Datenblöcke: letzte Ladevorgänge, Rohdaten und das Formular zur Erfassung neuer Sessions."
            pills={categoryPills.data}
            open={categoryOpen.data}
            onToggle={toggleCategory}
            tone="data"
            icon={<CategoryGlyph kind="data" />}
          >
            <section className="row">
              <SessionsCard sessions={sessions} year={jahr} onDeleted={refresh} />
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
                        Du willst eine neue Session erfassen? Öffne den Composer unten oder nutze den schwebenden
                        <b> + Ladevorgang</b>-Button.
                      </div>
                      <div className="addComposerMiniGrid">
                        <div className="summaryCard warm">
                          <div className="summaryLabel">Direkt live</div>
                          <div className="summaryValue">DB</div>
                          <div className="summarySub">fließt sofort in KPI, Saisons und Trends ein</div>
                        </div>
                        <div className="summaryCard">
                          <div className="summaryLabel">Ohne Umweg</div>
                          <div className="summaryValue">1 Schritt</div>
                          <div className="summarySub">keine Excel-Pflege, keine spätere Nacharbeit</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div ref={addPanelRef} tabIndex={-1} className="addComposerFrame">
                      <AddSessionCard onCreated={refresh} />
                    </div>
                  )}
                </div>
              </div>
            </section>
          </CategorySection>
        </main>

        <footer className="footer">
          <span>Lokales Dashboard über Tailscale • Daten bleiben bei dir</span>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
