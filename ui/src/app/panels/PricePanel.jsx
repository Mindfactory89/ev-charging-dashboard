import { useI18n } from "../../i18n/I18nProvider.jsx";
import Tooltip from "../../ui/Tooltip.jsx";
import { monthLabel } from "../../ui/monthLabels.js";
import { num, trendPctLabel } from "../formatters.js";

export default function PricePanel({ priceSummary, year }) {
  const { t } = useI18n();

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">{t("pricePanel.kicker")}</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">{t("pricePanel.title", { year })}</div>
              <Tooltip
                content={t("pricePanel.tooltipContent")}
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
              >
                <button className="ttTrigger" type="button" aria-label={t("pricePanel.tooltipLabel")}>
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {priceSummary.trend?.pct != null
              ? t("pricePanel.trendMeta", { value: trendPctLabel(priceSummary.trend.pct) })
              : t("pricePanel.fallbackMeta")}
          </div>
        </div>

        <div className="summaryGrid">
          {priceSummary.latest ? (
            <>
              <div className="summaryCard">
                <div className="summaryLabel">{t("pricePanel.latestValue")}</div>
                <div className="summaryValue">{num(priceSummary.latest.price_per_kwh, 3)} €/kWh</div>
                <div className="summarySub">{monthLabel(priceSummary.latest.month)}</div>
              </div>

              <div className="summaryCard mint">
                <div className="summaryLabel">{t("pricePanel.cheapestMonth")}</div>
                <div className="summaryValue" style={{ color: "rgba(120,210,160,0.92)" }}>
                  {num(priceSummary.cheapest?.price_per_kwh, 3)} €/kWh
                </div>
                <div className="summarySub">{priceSummary.cheapest ? monthLabel(priceSummary.cheapest.month) : "–"}</div>
              </div>

              <div className="summaryCard danger">
                <div className="summaryLabel">{t("pricePanel.priciestMonth")}</div>
                <div className="summaryValue" style={{ color: "rgba(255,132,132,0.92)" }}>
                  {num(priceSummary.priciest?.price_per_kwh, 3)} €/kWh
                </div>
                <div className="summarySub">{priceSummary.priciest ? monthLabel(priceSummary.priciest.month) : "–"}</div>
              </div>
            </>
          ) : (
            <div className="emptyStateCard">{t("pricePanel.empty", { year })}</div>
          )}
        </div>
      </div>
    </section>
  );
}
