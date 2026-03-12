import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { euro, num } from "../app/formatters.js";

function DrilldownList({ title, rows = [], onSelect, filterKey, t }) {
  return (
    <article className="card glassStrong analysisPanel">
      <div className="panelHeader">
        <div>
          <div className="sectionKicker">{t("sessionIntelligence.drilldown.kicker")}</div>
          <div className="sectionTitle sectionTitleSpaced">{title}</div>
        </div>
        <div className="pill ghostPill panelMetaPill">{t("common.entries", { count: rows.length })}</div>
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
              <strong>{t("sessionIntelligence.drilldown.valueMeta", { cost: euro(row.cost), count: num(row.count, 0) })}</strong>
            </button>
          ))}
        </div>
      ) : (
        <div className="emptyStateCard">{t("sessionIntelligence.drilldown.empty")}</div>
      )}
    </article>
  );
}

export default function SessionIntelligencePanel({ intelligence, onDrilldownHistory, year }) {
  const { t } = useI18n();
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
              <div className="sectionKicker">{t("sessionIntelligence.kicker")}</div>
              <div className="sectionTitle sectionTitleSpaced">{t("sessionIntelligence.title", { year })}</div>
            </div>
            <div className="pill ghostPill panelMetaPill">
              {t("sessionIntelligence.meta", { providers: providers.length, locations: locations.length })}
            </div>
          </div>

          <div className="summaryGrid">
            <article className="summaryCard warm">
              <div className="summaryLabel">{t("sessionIntelligence.cheapestProvider")}</div>
              <div className="summaryValue">{intelligence?.highlights?.cheapest_provider?.label || "–"}</div>
              <div className="summarySub">
                {intelligence?.highlights?.cheapest_provider?.avg_price_per_kwh != null
                  ? `${num(intelligence.highlights.cheapest_provider.avg_price_per_kwh, 3)} €/kWh`
                  : t("sessionIntelligence.noPriceBasis")}
              </div>
            </article>

            <article className="summaryCard frost">
              <div className="summaryLabel">{t("sessionIntelligence.fastestProvider")}</div>
              <div className="summaryValue">{intelligence?.highlights?.fastest_provider?.label || "–"}</div>
              <div className="summarySub">
                {intelligence?.highlights?.fastest_provider?.avg_power_kw != null
                  ? `${num(intelligence.highlights.fastest_provider.avg_power_kw, 1)} kW Ø`
                  : t("sessionIntelligence.noPowerBasis")}
              </div>
            </article>

            <article className="summaryCard mint">
              <div className="summaryLabel">{t("sessionIntelligence.dominantVehicle")}</div>
              <div className="summaryValue">{intelligence?.highlights?.dominant_vehicle?.label || "–"}</div>
              <div className="summarySub">
                {intelligence?.highlights?.dominant_vehicle?.count != null
                  ? `${num(intelligence.highlights.dominant_vehicle.count, 0)} Sessions`
                  : t("sessionIntelligence.noVehicleBasis")}
              </div>
            </article>

            <article className="summaryCard">
              <div className="summaryLabel">{t("sessionIntelligence.strongestLocation")}</div>
              <div className="summaryValue">{intelligence?.highlights?.strongest_location?.label || "–"}</div>
              <div className="summarySub">
                {intelligence?.highlights?.strongest_location?.cost != null
                  ? t("sessionIntelligence.locationRevenue", { value: euro(intelligence.highlights.strongest_location.cost) })
                  : t("sessionIntelligence.noLocationBasis")}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="premiumSecondaryGrid">
        <div className="premiumSecondarySlot">
          <DrilldownList title={t("sessionIntelligence.drilldown.topProviders")} rows={providers} onSelect={onDrilldownHistory} filterKey="provider" t={t} />
        </div>
        <div className="premiumSecondarySlot">
          <DrilldownList title={t("sessionIntelligence.drilldown.topLocations")} rows={locations} onSelect={onDrilldownHistory} filterKey="location" t={t} />
        </div>
      </section>

      <section className="premiumSecondaryGrid">
        <div className="premiumSecondarySlot">
          <DrilldownList title={t("sessionIntelligence.drilldown.vehicles")} rows={vehicles} onSelect={onDrilldownHistory} filterKey="vehicle" t={t} />
        </div>
        <div className="premiumSecondarySlot">
          <DrilldownList title={t("sessionIntelligence.drilldown.tags")} rows={tags} onSelect={onDrilldownHistory} filterKey="tag" t={t} />
        </div>
      </section>
    </>
  );
}
