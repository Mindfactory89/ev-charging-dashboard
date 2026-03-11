import React from "react";

function num(value, digits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "–";
  return numeric.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function euro(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "–";
  return numeric.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function DrilldownList({ title, rows = [], onSelect, filterKey }) {
  return (
    <article className="card glassStrong analysisPanel">
      <div className="panelHeader">
        <div>
          <div className="sectionKicker">Drilldown</div>
          <div className="sectionTitle sectionTitleSpaced">{title}</div>
        </div>
        <div className="pill ghostPill panelMetaPill">{rows.length} Einträge</div>
      </div>

      {rows.length ? (
        <div className="sessionDrawerLines">
          {rows.slice(0, 5).map((row) => (
            <button
              key={`${filterKey}-${row.key}`}
              type="button"
              className="rowDetailBtn"
              onClick={() => onSelect?.({ [filterKey]: row.label })}
              style={{ width: "100%", justifyContent: "space-between", display: "flex", marginBottom: 8 }}
            >
              <span>{row.label}</span>
              <strong>{euro(row.cost)} • {num(row.count, 0)} Sessions</strong>
            </button>
          ))}
        </div>
      ) : (
        <div className="emptyStateCard">Noch keine Werte vorhanden.</div>
      )}
    </article>
  );
}

export default function SessionIntelligencePanel({ intelligence, onDrilldownHistory, year }) {
  const providers = Array.isArray(intelligence?.providers) ? intelligence.providers : [];
  const locations = Array.isArray(intelligence?.locations) ? intelligence.locations : [];
  const vehicles = Array.isArray(intelligence?.vehicles) ? intelligence.vehicles : [];
  const tags = Array.isArray(intelligence?.tags) ? intelligence.tags : [];

  return (
    <>
      <section className="row">
        <div className="card glassStrong analysisPanel">
          <div className="panelHeader">
            <div>
              <div className="sectionKicker">Intelligence</div>
              <div className="sectionTitle sectionTitleSpaced">Anbieter, Orte und Fahrzeuge im Vergleich ({year})</div>
            </div>
            <div className="pill ghostPill panelMetaPill">
              {providers.length} Anbieter • {locations.length} Orte
            </div>
          </div>

          <div className="summaryGrid">
            <article className="summaryCard warm">
              <div className="summaryLabel">Günstigster Anbieter</div>
              <div className="summaryValue">{intelligence?.highlights?.cheapest_provider?.label || "–"}</div>
              <div className="summarySub">
                {intelligence?.highlights?.cheapest_provider?.avg_price_per_kwh != null
                  ? `${num(intelligence.highlights.cheapest_provider.avg_price_per_kwh, 3)} €/kWh`
                  : "Noch keine Preisbasis"}
              </div>
            </article>

            <article className="summaryCard frost">
              <div className="summaryLabel">Schnellster Anbieter</div>
              <div className="summaryValue">{intelligence?.highlights?.fastest_provider?.label || "–"}</div>
              <div className="summarySub">
                {intelligence?.highlights?.fastest_provider?.avg_power_kw != null
                  ? `${num(intelligence.highlights.fastest_provider.avg_power_kw, 1)} kW Ø`
                  : "Noch keine Leistungsbasis"}
              </div>
            </article>

            <article className="summaryCard mint">
              <div className="summaryLabel">Dominantes Fahrzeug</div>
              <div className="summaryValue">{intelligence?.highlights?.dominant_vehicle?.label || "–"}</div>
              <div className="summarySub">
                {intelligence?.highlights?.dominant_vehicle?.count != null
                  ? `${num(intelligence.highlights.dominant_vehicle.count, 0)} Sessions`
                  : "Noch keine Fahrzeugbasis"}
              </div>
            </article>

            <article className="summaryCard">
              <div className="summaryLabel">Stärkster Standort</div>
              <div className="summaryValue">{intelligence?.highlights?.strongest_location?.label || "–"}</div>
              <div className="summarySub">
                {intelligence?.highlights?.strongest_location?.cost != null
                  ? `${euro(intelligence.highlights.strongest_location.cost)} Umsatz`
                  : "Noch keine Standortbasis"}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="premiumSecondaryGrid">
        <div className="premiumSecondarySlot">
          <DrilldownList title="Top Anbieter" rows={providers} onSelect={onDrilldownHistory} filterKey="provider" />
        </div>
        <div className="premiumSecondarySlot">
          <DrilldownList title="Top Orte" rows={locations} onSelect={onDrilldownHistory} filterKey="location" />
        </div>
      </section>

      <section className="premiumSecondaryGrid">
        <div className="premiumSecondarySlot">
          <DrilldownList title="Fahrzeuge" rows={vehicles} onSelect={onDrilldownHistory} filterKey="vehicle" />
        </div>
        <div className="premiumSecondarySlot">
          <DrilldownList title="Tags" rows={tags} onSelect={onDrilldownHistory} filterKey="tag" />
        </div>
      </section>
    </>
  );
}
