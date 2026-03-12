import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { euro, num } from "../app/formatters.js";
import Tooltip from "./Tooltip.jsx";
import { buildChargingMix } from "./sessionIntelligence.js";

export default function ChargingMixCard({ sessions = [], year = 2026 }) {
  const { t } = useI18n();
  const mix = React.useMemo(() => buildChargingMix(sessions), [sessions]);
  const home = mix.byKey.home || null;
  const publicAc = mix.byKey.public_ac || null;
  const publicDc = mix.byKey.public_dc || null;
  const publicEnergy = (publicAc?.totalEnergyKwh || 0) + (publicDc?.totalEnergyKwh || 0);
  const homeSharePct = mix.totalEnergyKwh > 0 ? Math.round(((home?.totalEnergyKwh || 0) / mix.totalEnergyKwh) * 100) : 0;
  const publicSharePct = mix.totalEnergyKwh > 0 ? Math.round((publicEnergy / mix.totalEnergyKwh) * 100) : 0;
  const dcToHomeDelta =
    publicDc?.medianPricePerKwh != null && home?.medianPricePerKwh != null
      ? publicDc.medianPricePerKwh - home.medianPricePerKwh
      : null;

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel mobilityPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">{t("chargingMix.kicker")}</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">{t("chargingMix.title", { year })}</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content={t("chargingMix.tooltipContent")}
              >
                <button className="ttTrigger" type="button" aria-label={t("chargingMix.tooltipLabel")}>
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {mix.rows.length ? t("chargingMix.meta", { value: num(mix.totalEnergyKwh, 1) }) : t("chargingMix.noMix")}
          </div>
        </div>

        {mix.rows.length ? (
          <>
            <div className="summaryGrid">
              <article className="summaryCard warm">
                <div className="summaryLabel">{t("chargingMix.dominantChannel")}</div>
                <div className="summaryValue">{mix.dominant?.shortLabel || "–"}</div>
                <div className="summarySub">
                  {mix.dominant ? t("chargingMix.segmentMeta", {
                    sessions: num(mix.dominant.count, 0),
                    energy: num(mix.dominant.totalEnergyKwh, 1),
                    cost: euro(mix.dominant.totalCost),
                  }) : t("chargingMix.noSessions")}
                </div>
              </article>

              <article className="summaryCard mint">
                <div className="summaryLabel">{t("chargingMix.cheapestChannel")}</div>
                <div className="summaryValue">{mix.cheapest?.shortLabel || "–"}</div>
                <div className="summarySub">
                  {mix.cheapest?.medianPricePerKwh != null ? `${num(mix.cheapest.medianPricePerKwh, 3)} €/kWh Median` : t("chargingMix.noPriceBasis")}
                </div>
              </article>

              <article className="summaryCard frost">
                <div className="summaryLabel">{t("chargingMix.homeVsPublic")}</div>
                <div className="summaryValue">{`${homeSharePct}/${publicSharePct}`}</div>
                <div className="summarySub">{t("chargingMix.homeVsPublicSub")}</div>
              </article>

              <article className="summaryCard">
                <div className="summaryLabel">{t("chargingMix.dcLever")}</div>
                <div className="summaryValue">{dcToHomeDelta != null ? `${num(dcToHomeDelta, 3)} €/kWh` : "–"}</div>
                <div className="summarySub">{t("chargingMix.dcLeverSub")}</div>
              </article>
            </div>

            <div className="mixSegmentStack">
              {mix.rows.map((row) => {
                const energyShare = mix.totalEnergyKwh > 0 ? (row.totalEnergyKwh / mix.totalEnergyKwh) * 100 : 0;
                return (
                  <article key={row.key} className={`mixSegmentRow tone-${row.tone}`}>
                    <div className="mixSegmentTop">
                      <div>
                        <div className="mixSegmentLabel">{row.label}</div>
                        <div className="mixSegmentSub">
                          {t("chargingMix.segmentMeta", {
                            sessions: num(row.count, 0),
                            energy: num(row.totalEnergyKwh, 1),
                            cost: euro(row.totalCost),
                          })}
                        </div>
                      </div>
                      <div className="mixSegmentMeta">
                        <span>{t("chargingMix.shareLabel", { value: num(energyShare, 0) })}</span>
                        <span>{row.medianPricePerKwh != null ? `${num(row.medianPricePerKwh, 3)} €/kWh` : "–"}</span>
                      </div>
                    </div>

                    <div className="mixMeter" aria-hidden="true">
                      <span className="mixMeterFill" style={{ width: `${Math.max(8, energyShare)}%` }} />
                    </div>

                    <div className="mixSegmentStats">
                      <span>{row.avgPowerKw != null ? t("chargingMix.avgPowerMeta", { value: num(row.avgPowerKw, 1) }) : t("chargingMix.noAvgPower")}</span>
                      <span>{row.avgCostPer100Km != null ? t("chargingMix.avgCostPer100Km", { value: num(row.avgCostPer100Km, 2) }) : t("chargingMix.noKmData")}</span>
                      <span>{row.totalDistanceKm > 0 ? t("chargingMix.recordedKm", { value: num(row.totalDistanceKm, 0) }) : t("chargingMix.noDistance")}</span>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="metricNarrative">
              <b>{t("chargingMix.narrative.base", { channel: mix.dominant?.label || t("chargingMix.dominantChannel") })}</b>{" "}
              {mix.cheapest ? `${t("chargingMix.narrative.cheapest", { channel: mix.cheapest.label })} ` : ""}
              {dcToHomeDelta != null && dcToHomeDelta > 0
                ? t("chargingMix.narrative.lever", { value: num(dcToHomeDelta, 3) })
                : t("chargingMix.narrative.pending")}
            </div>
          </>
        ) : (
          <div className="emptyStateCard">{t("chargingMix.empty", { year })}</div>
        )}
      </div>
    </section>
  );
}
