import VehicleHero from "../ui/VehicleHero.jsx";
import KpiTitle from "./KpiTitle.jsx";
import { num } from "./formatters.js";
import { useI18n } from "../i18n/I18nProvider.jsx";

function MetricIcon({ kind }) {
  if (kind === "cost") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18.5 7.5A7 7 0 1 0 18.5 16.5" />
        <path d="M5 10h9M5 14h8" />
      </svg>
    );
  }

  if (kind === "energy") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13.5 2 5 13h6l-.5 9L19 10h-6l.5-8Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 15.5a8 8 0 1 1 16 0" />
      <path d="m12 12 4-3M7 18h10" />
    </svg>
  );
}

function SignalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 16.5 9 12l3 2.5L20 7" />
      <path d="M15 7h5v5" />
    </svg>
  );
}

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
    <section className="premiumHeroStage" aria-label={t("hero.dashboardSummary", { year })}>
      <VehicleHero profile={vehicleProfile} latestDateLabel={latestDateLabel} year={year} />

      <div className="premiumHeroRail">
        <article className="card glassStrong premiumSpotlightCard">
          <div className="premiumSpotlightHeader">
            <span className="premiumSpotlightIcon"><SignalIcon /></span>
            <span className="premiumSpotlightEyebrow">{spotlightCard.eyebrow}</span>
            <span className="premiumSpotlightScope">{year}</span>
          </div>
          <h3 className="premiumSpotlightTitle">{spotlightCard.title}</h3>
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

      <div className="premiumMetricRail" role="list" aria-label={t("hero.keyMetrics", { year })}>
        {heroMetrics.map((item) => (
          <article key={item.key} className={`card glass premiumMetricCard metric-${item.key}`} role="listitem">
            <div className="premiumMetricHeader">
              <span className="premiumMetricIcon"><MetricIcon kind={item.key} /></span>
              <KpiTitle label={item.label} tip={item.tip} />
              {item.context ? (
                <span className={`premiumMetricContext ${item.contextTone || "neutral"}`}>{item.context}</span>
              ) : null}
            </div>
            <div className="premiumMetricValue" style={item.tone ? { color: item.tone } : undefined}>
              {item.value}
            </div>
            <div className="premiumMetricSub">{item.sub}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
