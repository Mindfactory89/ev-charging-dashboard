import React from "react";
import Tooltip from "./Tooltip.jsx";

function num(n, digits = 1) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "–";
  return v.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function minutesFromSeconds(s) {
  const v = Number(s);
  if (!Number.isFinite(v) || v <= 0) return "–";
  return `${Math.round(v / 60)} min`;
}

function scoreTone(score) {
  const v = Number(score);
  if (!Number.isFinite(v)) return "";
  if (v >= 80) return "success";
  if (v >= 65) return "warm";
  if (v >= 50) return "warn";
  return "danger";
}

export default function SocWindowAnalysis({ analysis, year = 2026 }) {
  const windows = Array.isArray(analysis?.bands) && analysis.bands.length ? analysis.bands : Array.isArray(analysis?.windows) ? analysis.windows : [];
  const highlights = analysis?.highlights || {};
  const hasAnalyzedSessions = Number(analysis?.analyzed_session_count || 0) > 0;

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">SoC</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">SoC-Band-Analyse ({year})</div>
              <Tooltip
                content="Die Analyse bricht deine Sessions in feine 10%-SoC-Bänder herunter, damit Preis, Ladeleistung, Score und SoC-Hub deutlich granularer sichtbar werden."
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
              >
                <button className="ttTrigger" type="button" aria-label="Erklärung: SoC-Band-Analyse">
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {analysis?.analyzed_session_count ? `${num(analysis.analyzed_session_count, 0)} Sessions analysiert` : "Keine SoC-Daten"}
          </div>
        </div>

        {hasAnalyzedSessions ? (
          <div className="summaryGrid">
            <div className="summaryCard warm">
              <div className="summaryLabel">Bestes Band</div>
              <div className="summaryValue">{highlights?.best_efficiency_window?.label || "–"}</div>
              <div className="summarySub">
                {highlights?.best_efficiency_window?.avg_score != null
                  ? `${num(highlights.best_efficiency_window.avg_score, 1)}/100`
                  : "Keine Daten"}
              </div>
            </div>

            <div className="summaryCard">
              <div className="summaryLabel">Günstigstes Band</div>
              <div className="summaryValue">{highlights?.cheapest_window?.label || "–"}</div>
              <div className="summarySub">
                {highlights?.cheapest_window?.avg_price_per_kwh != null
                  ? `${num(highlights.cheapest_window.avg_price_per_kwh, 3)} €/kWh`
                  : "Keine Daten"}
              </div>
            </div>

            <div className="summaryCard frost">
              <div className="summaryLabel">Schnellstes Band</div>
              <div className="summaryValue">{highlights?.fastest_window?.label || "–"}</div>
              <div className="summarySub">
                {highlights?.fastest_window?.avg_power_kw != null
                  ? `${num(highlights.fastest_window.avg_power_kw, 1)} kW`
                  : "Keine Daten"}
              </div>
            </div>

            <div className="summaryCard mint">
              <div className="summaryLabel">Größter SoC-Hub</div>
              <div className="summaryValue">{highlights?.widest_window?.label || "–"}</div>
              <div className="summarySub">
                {highlights?.widest_window?.avg_soc_delta != null
                  ? `${num(highlights.widest_window.avg_soc_delta, 1)} %-Punkte`
                  : "Keine Daten"}
              </div>
            </div>
          </div>
        ) : (
          <div className="summaryGrid">
            <div className="emptyStateCard">Keine Werte für {year} vorhanden.</div>
          </div>
        )}

        <div className="detailCardGrid">
          {windows.length ? (
            windows.map((window) => {
              const isBest = highlights?.best_efficiency_window?.key === window.key;
              return (
                <article key={window.key} className={`detailCard ${isBest ? "featured" : ""}`}>
                  <div className="detailCardTop">
                    <div className="detailCardTitle">{window.label}</div>
                    <div className="detailCardMeta">{num(window.coverage_pct ?? window.share_pct, 1)}% der Sessions</div>
                  </div>

                  <div className={`summaryValue detailScoreValue ${scoreTone(window.avg_score)}`}>
                    {window.avg_score != null ? `${num(window.avg_score, 1)}/100` : "–"}
                  </div>
                  <div className="detailCardSub">Durchschnittlicher Efficiency Score</div>

                  <div className="metricMiniGrid">
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">Sessions</div>
                      <div className="metricMiniValue">{num(window.count, 0)}</div>
                    </div>
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">Ø €/kWh</div>
                      <div className="metricMiniValue">
                        {window.avg_price_per_kwh != null ? `${num(window.avg_price_per_kwh, 3)} €/kWh` : "–"}
                      </div>
                    </div>
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">Ø kW</div>
                      <div className="metricMiniValue">
                        {window.avg_power_kw != null ? `${num(window.avg_power_kw, 1)} kW` : "–"}
                      </div>
                    </div>
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">Ø Dauer</div>
                      <div className="metricMiniValue">{minutesFromSeconds(window.avg_duration_seconds)}</div>
                    </div>
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">Ø kWh</div>
                      <div className="metricMiniValue">
                        {window.avg_energy_kwh != null ? `${num(window.avg_energy_kwh, 1)} kWh` : "–"}
                      </div>
                    </div>
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">Ø SoC-Hub</div>
                      <div className="metricMiniValue">
                        {window.avg_soc_delta != null ? `${num(window.avg_soc_delta, 1)} %` : "–"}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="emptyStateCard">
              {hasAnalyzedSessions ? `Noch keine ausreichenden SoC-Daten für ${year}.` : `Keine Werte für ${year} vorhanden.`}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
