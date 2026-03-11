import VehicleHero from "../ui/VehicleHero.jsx";
import KpiTitle from "./KpiTitle.jsx";
import { num } from "./formatters.js";

export default function DashboardHeroStage({
  displayStats,
  heroMetrics,
  latestDateLabel,
  spotlightCard,
  vehicleProfile,
  year,
  yearWeekdayFact,
}) {
  return (
    <section className="premiumHeroStage">
      <VehicleHero profile={vehicleProfile} latestDateLabel={latestDateLabel} year={year} />

      <div className="premiumHeroRail">
        <div className="premiumMetricRail">
          {heroMetrics.map((item) => (
            <article key={item.key} className="card glass premiumMetricCard">
              <KpiTitle label={item.label} tip={item.tip} />
              <div className="premiumMetricValue" style={item.tone ? { color: item.tone } : undefined}>
                {item.value}
              </div>
              <div className="premiumMetricSub">{item.sub}</div>
            </article>
          ))}
        </div>

        <article className="card glassStrong premiumSpotlightCard">
          <div className="premiumSpotlightEyebrow">{spotlightCard.eyebrow}</div>
          <div className="premiumSpotlightTitle">{spotlightCard.title}</div>
          <div className="premiumSpotlightValue">{spotlightCard.value}</div>
          <div className="premiumSpotlightMeta">{spotlightCard.meta}</div>
          <p className="premiumSpotlightText">{spotlightCard.body}</p>
          <div className="premiumSpotlightFoot">
            <span>{displayStats ? `${num(displayStats.count, 0)} Sessions` : "Keine Sessions"}</span>
            <span>
              {yearWeekdayFact?.label
                ? `${yearWeekdayFact.label} häufigster Tag`
                : displayStats?.avg_power_kw != null
                  ? `${num(displayStats.avg_power_kw, 1)} kW Ø`
                  : "Kein Leistungsschnitt"}
            </span>
          </div>
        </article>
      </div>
    </section>
  );
}
