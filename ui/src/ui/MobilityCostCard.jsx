import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { num } from "../app/formatters.js";
import Tooltip from "./Tooltip.jsx";
import { buildDrivingEfficiencyProfile } from "./sessionIntelligence.js";

export default function MobilityCostCard({ sessions = [], year = 2026 }) {
  const { formatDate, t } = useI18n();
  const mobility = React.useMemo(() => buildDrivingEfficiencyProfile(sessions), [sessions]);

  function dateLabel(value) {
    return value ? formatDate(value) : "–";
  }

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel mobilityPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">{t("mobilityCost.kicker")}</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">{t("mobilityCost.title", { year })}</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content={t("mobilityCost.tooltipContent")}
              >
                <button className="ttTrigger" type="button" aria-label={t("mobilityCost.tooltipLabel")}>
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {mobility.coveredSessions.length ? t("mobilityCost.coverage", { value: num(mobility.coveragePct, 0) }) : t("mobilityCost.noKmBasis")}
          </div>
        </div>

        {mobility.coveredSessions.length ? (
          <>
            <div className="summaryGrid">
              <article className="summaryCard warm">
                <div className="summaryLabel">{t("mobilityCost.drivingProfile")}</div>
                <div className={`summaryValue mobilityLabelValue tone-${mobility.tone}`}>{mobility.label}</div>
                <div className="summarySub">
                  {mobility.score != null ? t("mobilityCost.scoreMeta", { value: num(mobility.score, 0) }) : t("mobilityProfile.statuses.noRating")}
                  {mobility.coverageBadge ? ` • ${mobility.coverageBadge}` : ""}
                </div>
                {mobility.summaryHint ? <div className="mobilitySummaryHint">{mobility.summaryHint}</div> : null}
                {mobility.chips.length ? (
                  <div className="mobilityChipRow" aria-label={t("mobilityCost.contextFactorsAria")}>
                    {mobility.chips.map((chip) => (
                      <span key={`${chip.icon}-${chip.label}`} className={`mobilityChip tone-${chip.tone}`}>
                        <span aria-hidden="true">{chip.icon}</span>
                        <span>{chip.label}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>

              <article className="summaryCard frost">
                <div className="summaryLabel">{t("mobilityCost.avgCostPer100Km")}</div>
                <div className="summaryValue">{mobility.avgCostPer100Km != null ? `${num(mobility.avgCostPer100Km, 2)} €` : "–"}</div>
                <div className="summarySub">{t("mobilityCost.avgCostPer100KmSub")}</div>
              </article>

              <article className="summaryCard mint">
                <div className="summaryLabel">{t("mobilityCost.avgEnergyPer100Km")}</div>
                <div className="summaryValue">{mobility.avgEnergyPer100Km != null ? `${num(mobility.avgEnergyPer100Km, 1)} kWh` : "–"}</div>
                <div className="summarySub">{t("mobilityCost.avgEnergyPer100KmSub")}</div>
              </article>

              <article className="summaryCard">
                <div className="summaryLabel">{t("mobilityCost.trackedDistance")}</div>
                <div className="summaryValue">{num(mobility.totalDistanceKm, 0)} km</div>
                <div className="summarySub">
                  {t("mobilityCost.trackedDistanceSub", {
                    segments: num(mobility.coveredSessions.length, 0),
                    avgDistance: mobility.avgDistanceKm != null ? num(mobility.avgDistanceKm, 0) : "–",
                  })}
                </div>
              </article>
            </div>

            <div className="summaryGrid compactSummaryGrid">
              <article className="summaryCard glassLite">
                <div className="summaryLabel">{t("mobilityCost.bestTrip")}</div>
                <div className="summaryValue">
                  {mobility.bestTrip?.costPer100Km != null ? `${num(mobility.bestTrip.costPer100Km, 2)} €/100 km` : "–"}
                </div>
                <div className="summarySub">{mobility.bestTrip ? `${dateLabel(mobility.bestTrip.date)} • ${num(mobility.bestTrip.distanceKm, 0)} km` : t("mobilityCost.noComparisonTrip")}</div>
              </article>

              <article className="summaryCard glassLite">
                <div className="summaryLabel">{t("mobilityCost.worstTrip")}</div>
                <div className="summaryValue">
                  {mobility.worstTrip?.costPer100Km != null ? `${num(mobility.worstTrip.costPer100Km, 2)} €/100 km` : "–"}
                </div>
                <div className="summarySub">{mobility.worstTrip ? `${dateLabel(mobility.worstTrip.date)} • ${num(mobility.worstTrip.distanceKm, 0)} km` : t("mobilityCost.noComparisonTrip")}</div>
              </article>
            </div>

            <div className="efficiencyTipsGrid">
              {mobility.tips.map((tip, index) => (
                <article key={`eff-tip-${index}`} className="efficiencyTipCard">
                  <div className="summaryLabel">{t("mobilityCost.tripTip", { index: index + 1 })}</div>
                  <div className="summarySub">{tip}</div>
                </article>
              ))}
            </div>

            <div className="metricNarrative">
              {mobility.narrative}{" "}
              {mobility.avgCostPer100Km != null ? t("mobilityCost.narrativeAppend", { value: num(mobility.avgCostPer100Km, 2) }) : ""}
            </div>
          </>
        ) : (
          <div className="emptyStateCard">{t("mobilityCost.empty", { year })}</div>
        )}
      </div>
    </section>
  );
}
