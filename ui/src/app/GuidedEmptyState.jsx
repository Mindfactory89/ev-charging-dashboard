import { useI18n } from "../i18n/I18nProvider.jsx";

export default function GuidedEmptyState({ onAdd, onSelectYear, recoveryYear, year }) {
  const { t } = useI18n();

  return (
    <section className="guidedEmptyState" aria-labelledby="guided-empty-title">
      <div className="guidedEmptyVisual" aria-hidden="true">
        <svg viewBox="0 0 120 92" fill="none">
          <rect x="14" y="15" width="92" height="62" rx="14" />
          <path d="M31 59V45m18 14V32m18 27V41m18 18V25" />
          <path d="M27 67h62" />
        </svg>
      </div>
      <div className="guidedEmptyCopy">
        <div className="sectionKicker">{t("emptyState.kicker")}</div>
        <h3 id="guided-empty-title">{t("emptyState.title", { year })}</h3>
        <p>{t("emptyState.text")}</p>
        <div className="guidedEmptyActions">
          <button type="button" className="btnPrimary" onClick={onAdd}>{t("emptyState.add")}</button>
          {recoveryYear != null ? (
            <button type="button" className="chip ghost" onClick={() => onSelectYear(recoveryYear)}>
              {t("emptyState.openYear", { year: recoveryYear })}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
