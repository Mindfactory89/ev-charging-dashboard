import Tooltip from "../../ui/Tooltip.jsx";
import { monthLabel } from "../../ui/monthLabels.js";
import { num, trendPctLabel } from "../formatters.js";

export default function PricePanel({ priceSummary, year }) {
  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">Preis</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">Preisentwicklung ({year})</div>
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
                <div className="summarySub">{priceSummary.cheapest ? monthLabel(priceSummary.cheapest.month) : "–"}</div>
              </div>

              <div className="summaryCard danger">
                <div className="summaryLabel">Teuerster Monat</div>
                <div className="summaryValue" style={{ color: "rgba(255,132,132,0.92)" }}>
                  {num(priceSummary.priciest?.price_per_kwh, 3)} €/kWh
                </div>
                <div className="summarySub">{priceSummary.priciest ? monthLabel(priceSummary.priciest.month) : "–"}</div>
              </div>
            </>
          ) : (
            <div className="emptyStateCard">Noch keine Preisdaten für {year}.</div>
          )}
        </div>
      </div>
    </section>
  );
}
