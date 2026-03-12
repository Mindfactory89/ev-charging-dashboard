import { useI18n } from "../i18n/I18nProvider.jsx";

export default function LazySectionFallback({ label = "Bereich wird geladen…" }) {
  const { t } = useI18n();

  return (
    <section className="row">
      <div className="card glassStrong lazySectionCard">
        <div className="lazySectionHeader">
          <div className="lazySectionEyebrow">{t("lazyFallback.eyebrow")}</div>
          <div className="lazySectionLabel">{label || t("common.loadingSection")}</div>
        </div>
        <div className="lazySectionSkeleton" aria-hidden="true">
          <div className="lazySectionSkeletonHero" />
          <div className="lazySectionSkeletonGrid">
            <div className="lazySectionSkeletonCard" />
            <div className="lazySectionSkeletonCard" />
            <div className="lazySectionSkeletonCard" />
          </div>
          <div className="lazySectionSkeletonBars">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    </section>
  );
}
