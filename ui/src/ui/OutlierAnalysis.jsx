import React, { useMemo } from "react";
import Tooltip from "./Tooltip.jsx";

function num(n, digits = 1) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "–";
  return v.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function datumDE(value) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "–";
    return date.toLocaleDateString("de-DE");
  } catch {
    return "–";
  }
}

function minutesFromSeconds(seconds) {
  const v = Number(seconds);
  if (!Number.isFinite(v) || v <= 0) return "–";
  return `${Math.round(v / 60)} min`;
}

function buildAutoHints(analysis) {
  const hints = [];
  const highlights = analysis?.highlights || {};
  const baselines = analysis?.baselines || {};

  if (highlights?.weakest_score_outlier?.score != null) {
    hints.push({
      id: "weakest_score",
      title: "Schwächster Score",
      value: `${num(highlights.weakest_score_outlier.score, 1)}/100`,
      detail: `${datumDE(highlights.weakest_score_outlier.date)} • Median ${num(baselines?.score?.median, 1)}/100`,
    });
  }

  if (highlights?.priciest_outlier?.price_per_kwh != null) {
    hints.push({
      id: "priciest",
      title: "Preis-Ausreißer",
      value: `${num(highlights.priciest_outlier.price_per_kwh, 3)} €/kWh`,
      detail: `${datumDE(highlights.priciest_outlier.date)} • Median ${num(baselines?.price_per_kwh?.median, 3)} €/kWh`,
    });
  }

  if (highlights?.lowest_power_outlier?.avg_power_kw != null) {
    hints.push({
      id: "lowest_power",
      title: "Schwächste Leistung",
      value: `${num(highlights.lowest_power_outlier.avg_power_kw, 1)} kW`,
      detail: `${datumDE(highlights.lowest_power_outlier.date)} • Median ${num(baselines?.avg_power_kw?.median, 1)} kW`,
    });
  }

  if (highlights?.longest_outlier?.duration_seconds != null) {
    hints.push({
      id: "longest",
      title: "Längste Abweichung",
      value: minutesFromSeconds(highlights.longest_outlier.duration_seconds),
      detail: `${datumDE(highlights.longest_outlier.date)} • Median ${minutesFromSeconds(baselines?.duration_seconds?.median)}`,
    });
  }

  if (highlights?.worst_session?.flag_count > 1) {
    hints.push({
      id: "worst_session",
      title: "Kritische Session",
      value: datumDE(highlights.worst_session.date),
      detail: `${num(highlights.worst_session.flag_count, 0)} Auffälligkeiten in einer Session`,
    });
  }

  return hints.slice(0, 4);
}

export default function OutlierAnalysis({ analysis, year = 2026 }) {
  const sessions = Array.isArray(analysis?.flagged_sessions) ? analysis.flagged_sessions : [];
  const hints = useMemo(() => buildAutoHints(analysis), [analysis]);

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">Ausreißer</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">Ausreißer & Hinweise ({year})</div>
              <Tooltip
                content="Die Erkennung markiert Sessions, die im Jahresvergleich auffällig teuer, langsam, lang oder schwach im Efficiency Score sind. Je nach Datenlage werden IQR-Grenzen oder Median-basierte Schwellen genutzt."
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
              >
                <button className="ttTrigger" type="button" aria-label="Erklärung: Ausreißer-Erkennung">
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {analysis?.session_count
              ? `${num(analysis.outlier_count, 0)} von ${num(analysis.session_count, 0)} Sessions auffällig`
              : "Keine Daten"}
          </div>
        </div>

        <div className="summaryGrid">
          {hints.length ? (
            hints.map((hint) => (
              <div key={hint.id} className="summaryCard">
                <div className="summaryLabel">{hint.title}</div>
                <div className="summaryValue">{hint.value}</div>
                <div className="summarySub">{hint.detail}</div>
              </div>
            ))
          ) : (
            <div className="emptyStateCard">Keine auffälligen Sessions für {year} erkannt.</div>
          )}
        </div>

        <div className="detailCardGrid">
          {sessions.length ? (
            sessions.map((session) => (
              <article key={session.session_id} className={`detailCard ${session.flag_count > 1 ? "featured" : ""}`}>
                <div className="detailCardTop">
                  <div className="detailCardTitle">{datumDE(session.date)}</div>
                  <div className="detailCardMeta">{num(session.flag_count, 0)} Flags</div>
                </div>

                <div className="detailCardSub">{session.connector || "–"}</div>

                <div className="reasonPillRow">
                  {session.reasons.map((reason) => (
                    <div key={`${session.session_id}-${reason.key}`} className={`reasonPill ${reason.severity || "low"}`}>
                      {reason.label}
                    </div>
                  ))}
                </div>

                <div className="metricMiniGrid">
                  <div className="metricMiniItem">
                    <div className="metricMiniLabel">Score</div>
                    <div className="metricMiniValue">{session.score != null ? `${num(session.score, 1)}/100` : "–"}</div>
                  </div>
                  <div className="metricMiniItem">
                    <div className="metricMiniLabel">€/kWh</div>
                    <div className="metricMiniValue">
                      {session.price_per_kwh != null ? `${num(session.price_per_kwh, 3)} €` : "–"}
                    </div>
                  </div>
                  <div className="metricMiniItem">
                    <div className="metricMiniLabel">Ø kW</div>
                    <div className="metricMiniValue">
                      {session.avg_power_kw != null ? `${num(session.avg_power_kw, 1)} kW` : "–"}
                    </div>
                  </div>
                  <div className="metricMiniItem">
                    <div className="metricMiniLabel">Dauer</div>
                    <div className="metricMiniValue">{minutesFromSeconds(session.duration_seconds)}</div>
                  </div>
                </div>

                {session.reasons.length ? (
                  <div className="detailCardFootnote">
                    {session.reasons
                      .slice(0, 2)
                      .map((reason) => {
                        const deviation =
                          reason.deviation_pct != null ? `${num(reason.deviation_pct, 0)} %` : "spürbar";
                        return `${reason.label}: ${deviation} vom Median`;
                      })
                      .join(" • ")}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className="emptyStateCard detailEmpty">Keine Details für {year}.</div>
          )}
        </div>
      </div>
    </section>
  );
}
