import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { euro, num } from "../app/formatters.js";
import Tooltip from "./Tooltip.jsx";
import { buildChargingMix, buildShiftScenario, segmentDefinitions } from "./sessionIntelligence.js";

const SOURCE_PRIORITY = ["public_dc", "public_ac", "home"];
const TARGET_PRIORITY = ["home", "public_ac", "public_dc"];

function pickSegmentKey(availableKeys = [], preferredOrder = [], excludeKey = null) {
  for (const key of preferredOrder) {
    if (availableKeys.includes(key) && key !== excludeKey) return key;
  }

  return availableKeys.find((key) => key !== excludeKey) || null;
}

export default function WhatIfCard({ sessions = [], year = 2026 }) {
  const { locale, t } = useI18n();
  const [shiftPct, setShiftPct] = React.useState(20);
  const [sourceKey, setSourceKey] = React.useState("public_dc");
  const [targetKey, setTargetKey] = React.useState("home");
  const segmentCatalog = React.useMemo(() => Object.values(segmentDefinitions()), [locale]);
  const mix = React.useMemo(() => buildChargingMix(sessions), [sessions]);
  const availableSegments = React.useMemo(
    () =>
      segmentCatalog
        .map((segment) => ({ ...segment, row: mix.byKey?.[segment.key] || null }))
        .filter((segment) => segment.row),
    [segmentCatalog, mix]
  );
  const availableKeys = React.useMemo(() => availableSegments.map((segment) => segment.key), [availableSegments]);

  React.useEffect(() => {
    if (!availableKeys.length) return;

    setSourceKey((current) => {
      if (availableKeys.includes(current)) return current;
      return pickSegmentKey(availableKeys, SOURCE_PRIORITY) || current;
    });
  }, [availableKeys]);

  React.useEffect(() => {
    if (!availableKeys.length) return;

    setTargetKey((current) => {
      if (current && current !== sourceKey && availableKeys.includes(current)) return current;
      return pickSegmentKey(availableKeys, TARGET_PRIORITY, sourceKey) || current;
    });
  }, [availableKeys, sourceKey]);

  const sourceOptions = availableSegments;
  const targetOptions = availableSegments.filter((segment) => segment.key !== sourceKey);
  const scenario = React.useMemo(
    () => buildShiftScenario(sessions, { shiftPct, sourceKey, targetKey }),
    [sessions, shiftPct, sourceKey, targetKey]
  );

  function onSourceChange(nextKey) {
    setSourceKey(nextKey);
    setTargetKey((current) => {
      if (current && current !== nextKey && availableKeys.includes(current)) return current;
      return pickSegmentKey(availableKeys, TARGET_PRIORITY, nextKey) || current;
    });
  }

  const routeLabel =
    scenario.ok && scenario.source && scenario.target
      ? t("whatIf.routeLabel", { shift: scenario.shiftPct, source: scenario.source.shortLabel, target: scenario.target.shortLabel })
      : t("whatIf.noScenarioBasis");
  const currentAvgPrice =
    mix.totalEnergyKwh > 0 ? `${num(mix.totalCost / mix.totalEnergyKwh, 3)} €/kWh` : "–";
  const hasAdvantage = Number(scenario.deltaPricePerKwh) > 0;

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel mobilityPanel whatIfPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">{t("whatIf.kicker")}</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">{t("whatIf.title", { year })}</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content={t("whatIf.tooltipContent")}
              >
                <button className="ttTrigger" type="button" aria-label={t("whatIf.tooltipLabel")}>
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">{routeLabel}</div>
        </div>

        {scenario.ok ? (
          <>
            <div className="whatIfRouteDeck">
              <article className={`whatIfSegmentCard tone-${scenario.source?.tone || "warm"}`}>
                <div className="whatIfSegmentEyebrow">{t("whatIf.from")}</div>
                <label className="field fieldTight">
                  <span>{t("whatIf.sourceChannel")}</span>
                  <select className="input" value={sourceKey} onChange={(event) => onSourceChange(event.target.value)}>
                    {sourceOptions.map((option) => (
                      <option key={`source-${option.key}`} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="whatIfSegmentStats">
                  <div>
                    <div className="whatIfSegmentStatLabel">{t("whatIf.medianPrice")}</div>
                    <div className="whatIfSegmentStatValue">
                      {scenario.source?.medianPricePerKwh != null ? `${num(scenario.source.medianPricePerKwh, 3)} €/kWh` : "–"}
                    </div>
                  </div>
                  <div>
                    <div className="whatIfSegmentStatLabel">{t("whatIf.energyShare")}</div>
                    <div className="whatIfSegmentStatValue">{scenario.source?.energySharePct != null ? `${num(scenario.source.energySharePct, 0)} %` : "–"}</div>
                  </div>
                </div>
              </article>

              <div className="whatIfRouteBridge" aria-hidden="true">
                <span>→</span>
              </div>

              <article className={`whatIfSegmentCard tone-${scenario.target?.tone || "mint"}`}>
                <div className="whatIfSegmentEyebrow">{t("whatIf.to")}</div>
                <label className="field fieldTight">
                  <span>{t("whatIf.targetChannel")}</span>
                  <select className="input" value={targetKey} onChange={(event) => setTargetKey(event.target.value)}>
                    {targetOptions.map((option) => (
                      <option key={`target-${option.key}`} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="whatIfSegmentStats">
                  <div>
                    <div className="whatIfSegmentStatLabel">{t("whatIf.medianPrice")}</div>
                    <div className="whatIfSegmentStatValue">
                      {scenario.target?.medianPricePerKwh != null ? `${num(scenario.target.medianPricePerKwh, 3)} €/kWh` : "–"}
                    </div>
                  </div>
                  <div>
                    <div className="whatIfSegmentStatLabel">{t("whatIf.sessionCount")}</div>
                    <div className="whatIfSegmentStatValue">{scenario.target?.count != null ? num(scenario.target.count, 0) : "–"}</div>
                  </div>
                </div>
              </article>

              <article className="whatIfShiftCard">
                <div className="whatIfSegmentEyebrow">{t("whatIf.shift")}</div>
                <div className="whatIfShiftValue">{shiftPct} %</div>
                <input
                  className="input inputRange"
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={shiftPct}
                  onChange={(event) => setShiftPct(Number(event.target.value))}
                />
                <div className="rangeMeta">
                  <span>5 %</span>
                  <strong>{shiftPct} %</strong>
                  <span>50 %</span>
                </div>
              </article>
            </div>

            <div className="summaryGrid compactSummaryGrid">
              <article className="summaryCard warm">
                <div className="summaryLabel">{t("whatIf.potentialSavings")}</div>
                <div className="summaryValue">{euro(scenario.annualSavings)}</div>
                <div className="summarySub">{t("whatIf.potentialSavingsSub")}</div>
              </article>

              <article className="summaryCard mint">
                <div className="summaryLabel">{t("whatIf.shiftedEnergy")}</div>
                <div className="summaryValue">{scenario.shiftEnergyKwh != null ? `${num(scenario.shiftEnergyKwh, 1)} kWh` : "–"}</div>
                <div className="summarySub">{t("whatIf.shiftedEnergySub", { label: scenario.source?.label })}</div>
              </article>

              <article className="summaryCard frost">
                <div className="summaryLabel">{t("whatIf.newPriceLevel")}</div>
                <div className="summaryValue">
                  {scenario.projectedAvgPricePerKwh != null ? `${num(scenario.projectedAvgPricePerKwh, 3)} €/kWh` : "–"}
                </div>
                <div className="summarySub">{t("whatIf.newPriceLevelSub", { value: currentAvgPrice })}</div>
              </article>

              <article className="summaryCard">
                <div className="summaryLabel">{t("whatIf.priceLever")}</div>
                <div className="summaryValue">
                  {scenario.deltaPricePerKwh != null ? `${num(scenario.deltaPricePerKwh, 3)} €/kWh` : "–"}
                </div>
                <div className="summarySub">
                  {scenario.source?.shortLabel} gegen {scenario.target?.shortLabel}
                </div>
              </article>
            </div>

            <div className="metricNarrative whatIfNarrative">
              {hasAdvantage ? (
                t("whatIf.hasAdvantage", {
                  shift: scenario.shiftPct,
                  source: scenario.source?.label,
                  target: scenario.target?.label,
                  lever: num(scenario.deltaPricePerKwh, 3),
                  savings: euro(scenario.annualSavings),
                })
              ) : (
                t("whatIf.noUsefulAdvantage", {
                  source: scenario.source?.label,
                  target: scenario.target?.label,
                })
              )}
            </div>
          </>
        ) : (
          <div className="emptyStateCard">{t("whatIf.empty")}</div>
        )}
      </div>
    </section>
  );
}
