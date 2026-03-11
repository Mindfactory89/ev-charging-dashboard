import Tooltip from "../../ui/Tooltip.jsx";
import { euro, minutesFromSeconds, num, scoreTone } from "../formatters.js";

export default function SeasonPanel({ onDownloadSeasonCsv, seasonRows, seasons, seasonsCsvUrl, year }) {
  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">Saisons</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">Saisonanalyse ({year})</div>
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
            <div className="emptyStateCard">Noch keine Saisonanalyse für {year}.</div>
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
