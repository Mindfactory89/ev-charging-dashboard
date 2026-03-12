import { useI18n } from "../../i18n/I18nProvider.jsx";
import Tooltip from "../../ui/Tooltip.jsx";
import { euro, minutesFromSeconds, num, scoreTone } from "../formatters.js";
import { monthLabel } from "../../ui/monthLabels.js";

export default function SeasonPanel({ onDownloadSeasonCsv, seasonRows, seasons, seasonsCsvUrl, year }) {
  const { t } = useI18n();

  function seasonLabel(season) {
    const key = String(season?.key || "");
    if (key === "winter") return t("seasons.winter");
    if (key === "spring") return t("seasons.spring");
    if (key === "summer") return t("seasons.summer");
    if (key === "autumn") return t("seasons.autumn");
    return season?.label || "–";
  }

  function seasonMonthsLabel(season) {
    if (!Array.isArray(season?.months)) return "";
    return season.months
      .map((month) => {
        if (Number.isInteger(month)) return monthLabel(month);
        return String(month || "");
      })
      .filter(Boolean)
      .join(" • ");
  }

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">{t("seasonPanel.kicker")}</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">{t("seasonPanel.title", { year })}</div>
              <Tooltip
                content={t("seasonPanel.tooltipContent")}
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
              >
                <button className="ttTrigger" type="button" aria-label={t("seasonPanel.tooltipLabel")}>
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
            aria-label={t("seasonPanel.downloadLabel")}
            title={t("seasonPanel.downloadTitle")}
            disabled={!seasonsCsvUrl}
          >
            {t("seasonPanel.downloadButton")}
          </button>
        </div>

        <div className="detailCardGrid">
          {seasonRows.length ? (
            seasonRows.map((season) => (
              <article key={season.key} className={`detailCard ${season.key}`}>
                <div className="detailCardTop">
                  <div className="detailCardTitle">{seasonLabel(season)}</div>
                  <div className="detailCardMeta">{seasonMonthsLabel(season)}</div>
                </div>

                <div className="summaryValue detailScoreValue" style={{ color: scoreTone(season.efficiency_score) }}>
                  {season.efficiency_score != null ? `${num(season.efficiency_score, 1)}/100` : "–"}
                </div>
                <div className="detailCardSub">{t("seasonPanel.efficiencyScore")}</div>

                <div className="metricMiniGrid">
                  <div className="metricMiniItem">
                    <div className="metricMiniLabel">{t("common.sessions")}</div>
                    <div className="metricMiniValue">{num(season.count, 0)}</div>
                  </div>
                  <div className="metricMiniItem">
                    <div className="metricMiniLabel">kWh</div>
                    <div className="metricMiniValue">{num(season.energy_kwh, 1)}</div>
                  </div>
                  <div className="metricMiniItem">
                    <div className="metricMiniLabel">{t("common.cost")}</div>
                    <div className="metricMiniValue">{euro(season.cost)}</div>
                  </div>
                  <div className="metricMiniItem">
                    <div className="metricMiniLabel">{t("seasonPanel.avgPrice")}</div>
                    <div className="metricMiniValue">
                      {season.avg_price_per_kwh != null ? `${num(season.avg_price_per_kwh, 3)} €/kWh` : "–"}
                    </div>
                  </div>
                  <div className="metricMiniItem">
                    <div className="metricMiniLabel">{t("seasonPanel.avgDuration")}</div>
                    <div className="metricMiniValue">{minutesFromSeconds(season.avg_duration_seconds)}</div>
                  </div>
                  <div className="metricMiniItem">
                    <div className="metricMiniLabel">{t("seasonPanel.avgPower")}</div>
                    <div className="metricMiniValue">
                      {season.avg_power_kw != null ? `${num(season.avg_power_kw, 1)} kW` : "–"}
                    </div>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="emptyStateCard">{t("seasonPanel.empty", { year })}</div>
          )}
        </div>

        {seasonRows.length ? (
          <div className="summaryGrid">
            <div className="summaryCard warm">
              <div className="summaryLabel">{t("seasonPanel.bestSeason")}</div>
              <div className="summaryValue">
                {seasons?.highlights?.best_efficiency_season ? seasonLabel(seasons.highlights.best_efficiency_season) : "–"}
              </div>
              <div className="summarySub">
                {seasons?.highlights?.best_efficiency_season?.efficiency_score != null
                  ? `${num(seasons.highlights.best_efficiency_season.efficiency_score, 1)}/100`
                  : t("common.noData")}
              </div>
            </div>

            <div className="summaryCard frost">
              <div className="summaryLabel">{t("seasonPanel.cheapestSeason")}</div>
              <div className="summaryValue">
                {seasons?.highlights?.cheapest_season ? seasonLabel(seasons.highlights.cheapest_season) : "–"}
              </div>
              <div className="summarySub">
                {seasons?.highlights?.cheapest_season?.avg_price_per_kwh != null
                  ? `${num(seasons.highlights.cheapest_season.avg_price_per_kwh, 3)} €/kWh`
                  : t("common.noData")}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
