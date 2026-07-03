import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { num } from "../app/formatters.js";
import Tooltip from "./Tooltip.jsx";
import { buildDrivingEfficiencyProfile } from "./sessionIntelligence.js";

function MobilityIcon({ kind, size = "1em" }) {
  const common = {
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
    focusable: "false",
    style: { width: size, height: size, flex: "0 0 auto" },
  };

  if (kind === "shortTrips") {
    return (
      <svg {...common}>
        <path d="M4 20V9l5-3v14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M13 20V5h7v15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M7 12h.01M7 16h.01M16 8h.01M16 12h.01M16 16h.01" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "winter") {
    return (
      <svg {...common}>
        <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8.5 5.3 12 7.2l3.5-1.9M8.5 18.7l3.5-1.9 3.5 1.9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.72" />
      </svg>
    );
  }

  if (kind === "highDc") {
    return (
      <svg {...common}>
        <path d="M13 2 4 14h7l-1 8 10-14h-7l0-6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === "highSoc") {
    return (
      <svg {...common}>
        <path d="M3 8.5h16v7H3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M19 10h2v4h-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M6 12h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.72" />
      </svg>
    );
  }

  if (kind === "homeCharging") {
    return (
      <svg {...common}>
        <path d="M3.5 11 12 4l8.5 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 10.5V20h13v-9.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M10 20v-5h4v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" opacity="0.72" />
      </svg>
    );
  }

  if (kind === "consistent") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === "veryEfficient" || kind === "efficient") {
    return (
      <svg {...common}>
        <path d="M5 16a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="m9 17 2 2 4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === "optimizable" || kind === "highConsumption") {
    return (
      <svg {...common}>
        <path d="M5 16a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 8v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 17h.01" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "balanced") {
    return (
      <svg {...common}>
        <path d="M5 16a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 16l3-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 19h8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.72" />
      </svg>
    );
  }

  return null;
}

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
                <div
                  className={`summaryValue mobilityLabelValue tone-${mobility.tone}`}
                  style={{ display: "flex", alignItems: "center", gap: 10, letterSpacing: 0 }}
                >
                  <MobilityIcon kind={mobility.profileIconKey} size="0.86em" />
                  <span style={{ minWidth: 0 }}>{mobility.label}</span>
                </div>
                <div className="summarySub">
                  {mobility.score != null ? t("mobilityCost.scoreMeta", { value: num(mobility.score, 0) }) : t("mobilityProfile.statuses.noRating")}
                  {mobility.coverageBadge ? ` • ${mobility.coverageBadge}` : ""}
                </div>
                {mobility.summaryHint ? <div className="mobilitySummaryHint">{mobility.summaryHint}</div> : null}
                {mobility.chips.length ? (
                  <div className="mobilityChipRow" aria-label={t("mobilityCost.contextFactorsAria")}>
                    {mobility.chips.map((chip) => (
                      <span key={`${chip.iconKey}-${chip.label}`} className={`mobilityChip tone-${chip.tone}`}>
                        <MobilityIcon kind={chip.iconKey} size="14px" />
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
