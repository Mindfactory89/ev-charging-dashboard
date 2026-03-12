import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { euro, minutesFromSeconds, num } from "../app/formatters.js";
import Tooltip from "./Tooltip.jsx";

export default function MedianSnapshotPanel({ stats, year = 2026 }) {
  const { t } = useI18n();
  const medians = stats?.medians || null;
  const hasValues = medians && Object.values(medians).some((value) => value != null);

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">{t("medianSnapshot.kicker")}</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">{t("medianSnapshot.title", { year })}</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content={t("medianSnapshot.tooltipContent")}
              >
                <button className="ttTrigger" type="button" aria-label={t("medianSnapshot.tooltipLabel")}>
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {hasValues ? t("medianSnapshot.typicalSession") : t("medianSnapshot.noDataStatus")}
          </div>
        </div>

        <div className="summaryGrid">
          {hasValues ? (
            <>
              <div className="summaryCard warm">
                <div className="summaryLabel">{t("medianSnapshot.energy")}</div>
                <div className="summaryValue">{medians?.energy_kwh != null ? `${num(medians.energy_kwh, 1)} kWh` : "–"}</div>
                <div className="summarySub">{t("medianSnapshot.energySub")}</div>
              </div>

              <div className="summaryCard">
                <div className="summaryLabel">{t("medianSnapshot.cost")}</div>
                <div className="summaryValue">{euro(medians?.cost_per_session)}</div>
                <div className="summarySub">{t("medianSnapshot.costSub")}</div>
              </div>

              <div className="summaryCard frost">
                <div className="summaryLabel">{t("medianSnapshot.price")}</div>
                <div className="summaryValue">{medians?.price_per_kwh != null ? `${num(medians.price_per_kwh, 3)} €/kWh` : "–"}</div>
                <div className="summarySub">{t("medianSnapshot.priceSub")}</div>
              </div>

              <div className="summaryCard mint">
                <div className="summaryLabel">{t("medianSnapshot.power")}</div>
                <div className="summaryValue">{medians?.power_kw != null ? `${num(medians.power_kw, 1)} kW` : "–"}</div>
                <div className="summarySub">{t("medianSnapshot.powerSub")}</div>
              </div>

              <div className="summaryCard">
                <div className="summaryLabel">{t("medianSnapshot.duration")}</div>
                <div className="summaryValue">{minutesFromSeconds(medians?.duration_seconds)}</div>
                <div className="summarySub">{t("medianSnapshot.durationSub")}</div>
              </div>
            </>
          ) : (
            <div className="emptyStateCard">{t("medianSnapshot.empty", { year })}</div>
          )}
        </div>
      </div>
    </section>
  );
}
