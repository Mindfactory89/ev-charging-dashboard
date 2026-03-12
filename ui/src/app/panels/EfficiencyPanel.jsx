import { useI18n } from "../../i18n/I18nProvider.jsx";
import Tooltip from "../../ui/Tooltip.jsx";
import { datumDE, num, scoreLabel, scoreTone } from "../formatters.js";

export default function EfficiencyPanel({ displayEfficiency, year }) {
  const { t } = useI18n();

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">{t("efficiencyPanel.kicker")}</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">{t("efficiencyPanel.title", { year })}</div>
              <Tooltip
                content={t("efficiencyPanel.tooltipContent")}
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
              >
                <button className="ttTrigger" type="button" aria-label={t("efficiencyPanel.tooltipLabel")}>
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill panelMetaPill pillWarm" style={{ color: scoreTone(displayEfficiency?.overall_score) }}>
            {displayEfficiency
              ? `${num(displayEfficiency.overall_score, 1)}/100 • ${scoreLabel(displayEfficiency.overall_score)}`
              : t("common.noData")}
          </div>
        </div>

        {displayEfficiency?.session_count ? (
          <div className="summaryGrid">
            <div className="summaryCard warm heroMetric">
              <div className="summaryLabel">{t("efficiencyPanel.overallScore")}</div>
              <div className="summaryValue" style={{ color: scoreTone(displayEfficiency.overall_score) }}>
                {num(displayEfficiency.overall_score, 1)}/100
              </div>
              <div className="summarySub">{scoreLabel(displayEfficiency.overall_score)}</div>
            </div>

            <div className="summaryCard">
              <div className="summaryLabel">{t("efficiencyPanel.avgPrice")}</div>
              <div className="summaryValue">
                {displayEfficiency.averages?.price_per_kwh != null ? `${num(displayEfficiency.averages.price_per_kwh, 3)} €/kWh` : "–"}
              </div>
              <div className="summarySub">{t("efficiencyPanel.avgPriceSub")}</div>
            </div>

            <div className="summaryCard frost">
              <div className="summaryLabel">{t("efficiencyPanel.avgPower")}</div>
              <div className="summaryValue">
                {displayEfficiency.averages?.power_kw != null ? `${num(displayEfficiency.averages.power_kw, 1)} kW` : "–"}
              </div>
              <div className="summarySub">{t("efficiencyPanel.avgPowerSub")}</div>
            </div>

            <div className="summaryCard mint">
              <div className="summaryLabel">{t("efficiencyPanel.bestSession")}</div>
              <div className="summaryValue">
                {displayEfficiency.best_session?.score != null ? `${num(displayEfficiency.best_session.score, 1)}/100` : "–"}
              </div>
              <div className="summarySub">
                {displayEfficiency.best_session?.date ? datumDE(displayEfficiency.best_session.date) : t("common.noData")}
              </div>
            </div>
          </div>
        ) : (
          <div className="summaryGrid">
            <div className="emptyStateCard">{t("efficiencyPanel.empty", { year })}</div>
          </div>
        )}

        <div className="metricNarrative">{t("efficiencyPanel.weighting")}</div>
      </div>
    </section>
  );
}
