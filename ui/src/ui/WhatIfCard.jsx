import React from "react";
import Tooltip from "./Tooltip.jsx";
import { buildShiftScenario } from "./sessionIntelligence.js";

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

const TARGET_OPTIONS = [
  { value: "home", label: "Wallbox AC" },
  { value: "public_ac", label: "Public AC" },
];

export default function WhatIfCard({ sessions = [], year = 2026 }) {
  const [shiftPct, setShiftPct] = React.useState(20);
  const [targetKey, setTargetKey] = React.useState("home");
  const scenario = React.useMemo(() => buildShiftScenario(sessions, { shiftPct, targetKey }), [sessions, shiftPct, targetKey]);

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel mobilityPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">Simulation</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">Was-wäre-wenn-Rechner ({year})</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content="Schätzt, wie sich dein Jahresniveau verändern würde, wenn ein Teil deiner DC-Energie in günstigere Kanäle verschoben wird."
              >
                <button className="ttTrigger" type="button" aria-label="Erklärung: Was-wäre-wenn-Rechner">
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">{scenario.ok ? `${scenario.shiftPct} % DC-Verschiebung` : "Noch keine Szenario-Basis"}</div>
        </div>

        {scenario.ok ? (
          <>
            <div className="whatIfControls">
              <label className="field fieldWide">
                <span>Von Public DC zu</span>
                <select className="input" value={targetKey} onChange={(event) => setTargetKey(event.target.value)}>
                  {TARGET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field fieldWide">
                <span>Verschiebung</span>
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
              </label>
            </div>

            <div className="summaryGrid">
              <article className="summaryCard warm">
                <div className="summaryLabel">Potenzielle Ersparnis</div>
                <div className="summaryValue">{euro(scenario.annualSavings)}</div>
                <div className="summarySub">geschätzt pro Jahr auf Basis deines aktuellen Mix</div>
              </article>

              <article className="summaryCard mint">
                <div className="summaryLabel">Verschobene Energie</div>
                <div className="summaryValue">{scenario.shiftEnergyKwh != null ? `${num(scenario.shiftEnergyKwh, 1)} kWh` : "–"}</div>
                <div className="summarySub">aus dem heutigen Public-DC-Anteil</div>
              </article>

              <article className="summaryCard frost">
                <div className="summaryLabel">Neues Preisniveau</div>
                <div className="summaryValue">
                  {scenario.projectedAvgPricePerKwh != null ? `${num(scenario.projectedAvgPricePerKwh, 3)} €/kWh` : "–"}
                </div>
                <div className="summarySub">
                  heute {scenario.mix.totalEnergyKwh > 0 ? `${num(scenario.mix.totalCost / scenario.mix.totalEnergyKwh, 3)} €/kWh` : "–"}
                </div>
              </article>
            </div>

            <div className="metricNarrative">
              Wenn du rund <b>{scenario.shiftPct} %</b> deiner heutigen Public-DC-Energie in <b>{scenario.target?.label}</b> verschieben könntest,
              läge dein Preishebel aktuell bei etwa <b>{num(scenario.deltaPricePerKwh, 3)} €/kWh</b>. Das entspräche ungefähr <b>{euro(scenario.annualSavings)}</b> Sparpotenzial.
            </div>
          </>
        ) : (
          <div className="emptyStateCard">
            Für ein realistisches Szenario braucht das Jahr sowohl Public-DC-Sessions als auch einen günstigeren Zielkanal wie Wallbox oder Public AC.
          </div>
        )}
      </div>
    </section>
  );
}
