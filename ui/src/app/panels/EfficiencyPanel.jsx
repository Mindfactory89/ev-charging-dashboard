import Tooltip from "../../ui/Tooltip.jsx";
import { datumDE, num, scoreLabel, scoreTone } from "../formatters.js";

export default function EfficiencyPanel({ displayEfficiency, year }) {
  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">Efficiency</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">Cost Efficiency Score ({year})</div>
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
            <div className="emptyStateCard">Keine Effizienzdaten für {year} vorhanden.</div>
          </div>
        )}

        <div className="metricNarrative">
          Gewichtung: <b>Preis/kWh 55 %</b> • <b>Ø Ladeleistung 25 %</b> • <b>Zeit pro kWh 20 %</b>
        </div>
      </div>
    </section>
  );
}
