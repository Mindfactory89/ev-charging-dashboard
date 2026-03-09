import React from "react";
import Tooltip from "./Tooltip.jsx";
import { buildChargingMix } from "./sessionIntelligence.js";

function num(value, digits = 1) {
  const numValue = Number(value);
  if (!Number.isFinite(numValue)) return "–";
  return numValue.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function euro(value) {
  const numValue = Number(value);
  if (!Number.isFinite(numValue)) return "–";
  return numValue.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export default function ChargingMixCard({ sessions = [], year = 2026 }) {
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
            <div className="sectionKicker">Mobilität</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">Home vs. Public Intelligence ({year})</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content="Zeigt dir, wie stark Wallbox, öffentliches AC und öffentliches DC dein Jahresprofil prägen und wo dein größter Kostenhebel liegt."
              >
                <button className="ttTrigger" type="button" aria-label="Erklärung: Home vs. Public Intelligence">
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {mix.rows.length ? `${mix.totalEnergyKwh.toLocaleString("de-DE", { maximumFractionDigits: 1 })} kWh Mix` : "Noch kein Segmentmix"}
          </div>
        </div>

        {mix.rows.length ? (
          <>
            <div className="summaryGrid">
              <article className="summaryCard warm">
                <div className="summaryLabel">Dominanter Kanal</div>
                <div className="summaryValue">{mix.dominant?.shortLabel || "–"}</div>
                <div className="summarySub">
                  {mix.dominant ? `${num(mix.dominant.totalEnergyKwh, 1)} kWh • ${num(mix.dominant.count, 0)} Sessions` : "Noch keine Sessions"}
                </div>
              </article>

              <article className="summaryCard mint">
                <div className="summaryLabel">Günstigster Kanal</div>
                <div className="summaryValue">{mix.cheapest?.shortLabel || "–"}</div>
                <div className="summarySub">
                  {mix.cheapest?.medianPricePerKwh != null ? `${num(mix.cheapest.medianPricePerKwh, 3)} €/kWh Median` : "Noch keine Preisbasis"}
                </div>
              </article>

              <article className="summaryCard frost">
                <div className="summaryLabel">Home vs. Public</div>
                <div className="summaryValue">{`${homeSharePct}/${publicSharePct}`}</div>
                <div className="summarySub">Anteil an der Jahresenergie in %</div>
              </article>

              <article className="summaryCard">
                <div className="summaryLabel">DC zu Home Hebel</div>
                <div className="summaryValue">{dcToHomeDelta != null ? `${num(dcToHomeDelta, 3)} €/kWh` : "–"}</div>
                <div className="summarySub">Median-Differenz zwischen Public DC und Wallbox</div>
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
                          {num(row.count, 0)} Sessions • {num(row.totalEnergyKwh, 1)} kWh • {euro(row.totalCost)}
                        </div>
                      </div>
                      <div className="mixSegmentMeta">
                        <span>{num(energyShare, 0)} % Anteil</span>
                        <span>{row.medianPricePerKwh != null ? `${num(row.medianPricePerKwh, 3)} €/kWh` : "–"}</span>
                      </div>
                    </div>

                    <div className="mixMeter" aria-hidden="true">
                      <span className="mixMeterFill" style={{ width: `${Math.max(8, energyShare)}%` }} />
                    </div>

                    <div className="mixSegmentStats">
                      <span>{row.avgPowerKw != null ? `${num(row.avgPowerKw, 1)} kW Ø` : "Kein Ø kW"}</span>
                      <span>{row.avgCostPer100Km != null ? `${num(row.avgCostPer100Km, 2)} €/100 km` : "Noch keine km-Daten"}</span>
                      <span>{row.totalDistanceKm > 0 ? `${num(row.totalDistanceKm, 0)} km erfasst` : "Keine Fahrdistanz"}</span>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="metricNarrative">
              <b>{mix.dominant?.label || "Der stärkste Kanal"}</b> prägt aktuell dein Jahresprofil.{" "}
              {mix.cheapest ? `${mix.cheapest.label} ist derzeit dein ruhigster Preisanker. ` : ""}
              {dcToHomeDelta != null && dcToHomeDelta > 0
                ? `Zwischen Public DC und Wallbox liegt aktuell ein Preishebel von rund ${num(dcToHomeDelta, 3)} €/kWh.`
                : "Sobald genügend Segmente vorliegen, wird hier automatisch der stärkste Kostenhebel hervorgehoben."}
            </div>
          </>
        ) : (
          <div className="emptyStateCard">Noch keine Segmentdaten für {year} vorhanden.</div>
        )}
      </div>
    </section>
  );
}
