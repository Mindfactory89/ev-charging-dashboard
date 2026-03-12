import VehicleHero from "../ui/VehicleHero.jsx";
import KpiTitle from "./KpiTitle.jsx";
import { num } from "./formatters.js";
import { useI18n } from "../i18n/I18nProvider.jsx";

export default function DashboardHeroStage({
  displayStats,
  heroMetrics,
  latestDateLabel,
  spotlightCard,
  vehicleProfile,
  year,
  yearWeekdayFact,
}) {
  const { t } = useI18n();

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
            <span>{displayStats ? `${num(displayStats.count, 0)} ${t("common.sessions")}` : t("hero.noSessions")}</span>
            <span>
              {yearWeekdayFact?.label
                ? t("hero.mostFrequentDay", { day: yearWeekdayFact.label })
                : displayStats?.avg_power_kw != null
                  ? t("hero.averagePower", { value: num(displayStats.avg_power_kw, 1) })
                  : t("hero.noPowerAverage")}
            </span>
          </div>
        </article>
      </div>
    </section>
  );
}
