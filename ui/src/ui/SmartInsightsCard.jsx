import React from "react";
import Tooltip from "./Tooltip.jsx";

function num(n, digits = 1) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "–";
  return value.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function smartInsights({ stats, monthly, outliers, socWindowAnalysis, sessions = [] }) {
  const items = [];
  const activeMonths = Array.isArray(monthly?.months)
    ? monthly.months.filter((month) => Number(month?.count || 0) > 0)
    : [];
  const latestMonth = activeMonths[activeMonths.length - 1] || null;
  const previousMonth = activeMonths.length > 1 ? activeMonths[activeMonths.length - 2] : null;

  if (latestMonth && previousMonth && latestMonth.price_per_kwh != null && previousMonth.price_per_kwh != null) {
    const trend = previousMonth.price_per_kwh > 0 ? ((latestMonth.price_per_kwh - previousMonth.price_per_kwh) / previousMonth.price_per_kwh) * 100 : 0;
    if (Math.abs(trend) >= 6) {
      items.push({
        id: "price-trend",
        title: "Preisimpuls",
        value: `${trend > 0 ? "+" : ""}${num(trend, 0)}%`,
        text: `Das effektive Preisniveau hat sich gegenüber dem letzten aktiven Monat deutlich bewegt. Das ist ein Signal für Tarif-, Standort- oder Session-Mix-Effekte.`,
      });
    }
  }

  if (stats?.avg_power_kw != null && stats?.medians?.power_kw != null) {
    const avgPower = Number(stats.avg_power_kw);
    const medianPower = Number(stats.medians.power_kw);
    if (avgPower > 0 && medianPower > 0) {
      const drift = ((avgPower - medianPower) / medianPower) * 100;
      if (Math.abs(drift) >= 12) {
        items.push({
          id: "power-drift",
          title: "Durchschnitt vs. Median",
          value: `${drift > 0 ? "+" : ""}${num(drift, 0)}%`,
          text: `Der Durchschnitt der Ladeleistung liegt spürbar ${drift > 0 ? "über" : "unter"} dem Median. Einzelne Sessions ziehen deine Jahresleistung also merklich.`,
        });
      }
    }
  }

  if (socWindowAnalysis?.highlights?.fastest_window?.label && socWindowAnalysis?.highlights?.best_efficiency_window?.label) {
    items.push({
      id: "soc-window",
      title: "Bestes Ladefenster",
      value: socWindowAnalysis.highlights.best_efficiency_window.label,
      text:
        socWindowAnalysis.highlights.fastest_window.label === socWindowAnalysis.highlights.best_efficiency_window.label
          ? `Dieses Fenster ist aktuell gleichzeitig dein schnellstes und effizientestes Ladefenster.`
          : `Effizientestes Fenster: ${socWindowAnalysis.highlights.best_efficiency_window.label}. Schnellstes Fenster: ${socWindowAnalysis.highlights.fastest_window.label}.`,
    });
  }

  if (outliers?.outlier_count) {
    items.push({
      id: "outliers",
      title: "Auffällige Sessions",
      value: `${num(outliers.outlier_count, 0)}`,
      text: `Es wurden ${num(outliers.outlier_count, 0)} Sessions mit auffälligem Preis, Score, Dauer oder Leistung erkannt. Diese Sessions haben derzeit den größten Hebel für Verbesserungen.`,
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
          title: "80%-Effekt",
          value: `${diff > 0 ? "+" : ""}${num(diff, 0)}%`,
          text: `Sessions mit Ziel-SoC ${diff > 0 ? "über" : "unter"} 80 % verhalten sich bei der mittleren Ladeleistung deutlich anders als der Rest deines Ladeverhaltens.`,
        });
      }
    }
  }

  return items.slice(0, 4);
}

export default function SmartInsightsCard({ stats, monthly, outliers, socWindowAnalysis, sessions = [], year = 2026 }) {
  const items = React.useMemo(
    () => smartInsights({ stats, monthly, outliers, socWindowAnalysis, sessions }),
    [stats, monthly, outliers, socWindowAnalysis, sessions]
  );

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">Smart</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">Smart Insights ({year})</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content="Kombiniert Preis, Median, SoC-Fenster, Monatsverlauf und Ausreißer zu kurzen produktnahen Hinweisen."
              >
                <button className="ttTrigger" type="button" aria-label="Erklärung: Smart Insights">
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {items.length ? `${num(items.length, 0)} Signale` : "Keine Smart Insights"}
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
            <div className="emptyStateCard">Noch keine Smart Insights für {year} vorhanden.</div>
          )}
        </div>
      </div>
    </section>
  );
}
