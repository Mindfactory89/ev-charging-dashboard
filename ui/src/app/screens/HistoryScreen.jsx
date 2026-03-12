import AddSessionCard from "../../ui/AddSessionCard.jsx";
import ImportSessionsCard from "../../ui/ImportSessionsCard.jsx";
import SessionsCard from "../../ui/SessionsCard.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { monthLabel } from "../../ui/monthLabels.js";

export default function HistoryScreen({
  addOpen,
  addPanelRef,
  addSectionRef,
  closeAdd,
  demo,
  drilldownSource,
  historyFilters,
  intelligence,
  onCreated,
  onClearHistoryFilters,
  onHistoryFiltersChange,
  onReturnToSource,
  openAdd,
  sessionOutliersById,
  sessionScoresById,
  sessions,
  year,
}) {
  const { t } = useI18n();

  function sourceLabel(source) {
    if (source === "analysis") return t("history.source.analysis");
    if (source === "overview") return t("history.source.overview");
    return t("history.source.history");
  }

  const filterLabels = [
    historyFilters?.month ? t("history.filters.month", { value: monthLabel(Number(historyFilters.month)) }) : null,
    historyFilters?.provider ? t("history.filters.provider", { value: historyFilters.provider }) : null,
    historyFilters?.location ? t("history.filters.location", { value: historyFilters.location }) : null,
    historyFilters?.vehicle ? t("history.filters.vehicle", { value: historyFilters.vehicle }) : null,
    historyFilters?.tag ? t("history.filters.tag", { value: historyFilters.tag }) : null,
  ].filter(Boolean);
  const hasHistoryContext = Boolean(drilldownSource) || filterLabels.length > 0;

  return (
    <>
      <section className="row">
        <div className="card glassStrong premiumDataIntro">
          <div className="premiumDataIntroEyebrow">{t("history.intro.eyebrow")}</div>
          <div className="premiumDataIntroTitle">{t("history.intro.title")}</div>
          <div className="premiumDataIntroText">{t("history.intro.text")}</div>
        </div>
      </section>

      {hasHistoryContext ? (
        <section className="row">
          <div className="card glassStrong historyBreadcrumbCard">
            <div className="panelHeader">
              <div>
                <div className="sectionKicker">{t("history.drilldown.kicker")}</div>
                <div className="sectionTitle sectionTitleSpaced">{t("history.drilldown.title", { year })}</div>
              </div>

              <div className="panelActions">
                {drilldownSource ? (
                  <button type="button" className="pill ghostPill" onClick={onReturnToSource}>
                    {t("common.backTo", { target: sourceLabel(drilldownSource) })}
                  </button>
                ) : null}
                {filterLabels.length ? (
                  <button type="button" className="pill ghostPill" onClick={onClearHistoryFilters}>
                    {t("common.clearFilters")}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="historyBreadcrumbTrail">
              {drilldownSource ? (
                <span className="historyBreadcrumbPill">
                  {t("history.drilldown.breadcrumb", { source: sourceLabel(drilldownSource) })}
                </span>
              ) : null}
              {filterLabels.map((label) => (
                <span key={label} className="historyFilterPill">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="row">
        <SessionsCard
          filters={historyFilters}
          intelligence={intelligence}
          onFiltersChange={onHistoryFiltersChange}
          sessions={sessions}
          year={year}
          onChanged={onCreated}
          sessionScoresById={sessionScoresById}
          sessionOutliersById={sessionOutliersById}
        />
      </section>

      <section className="row" style={{ marginTop: 18 }}>
        <ImportSessionsCard onImported={onCreated} sessions={sessions} />
      </section>

      <section className="row" ref={addSectionRef} style={{ marginTop: 18 }}>
        <div className={`card glassStrong addComposer ${addOpen ? "open" : "closed"}`}>
          <div className="addComposerGlow" aria-hidden="true" />

          <div className="addComposerInner">
            <div className="panelHeader">
              <div>
                <div className="sectionKicker">{t("history.composer.kicker")}</div>
                <div className="sectionTitle sectionTitleSpaced">{t("history.composer.title")}</div>
              </div>

              <div className="panelActions">
                {(historyFilters?.month || historyFilters?.provider || historyFilters?.location || historyFilters?.vehicle || historyFilters?.tag) ? (
                  <button
                    type="button"
                    className="pill ghostPill"
                    onClick={onClearHistoryFilters}
                    style={{ cursor: "pointer" }}
                  >
                    {t("common.clearFilters")}
                  </button>
                ) : null}
                {!addOpen ? (
                  <button type="button" className="pill pillWarm" onClick={openAdd} aria-expanded={addOpen} style={{ cursor: "pointer" }}>
                    {t("common.open")} ↓
                  </button>
                ) : (
                  <button
                    type="button"
                    className="pill ghostPill"
                    onClick={closeAdd}
                    aria-expanded={addOpen}
                    style={{ cursor: "pointer" }}
                  >
                    {t("common.collapse")}
                  </button>
                )}
              </div>
            </div>

            {!addOpen ? (
              <div className="addComposerClosed">
                <div className="addComposerLead">{t("history.composer.lead")}</div>
                <div className="addComposerMiniGrid">
                  <div className="summaryCard warm addComposerStatCard">
                    <div className="summaryLabel">{t("history.composer.liveSyncLabel")}</div>
                    <div className="summaryValue">{t("history.composer.liveSyncValue")}</div>
                    <div className="summarySub">{t("history.composer.liveSyncSub")}</div>
                  </div>
                  <div className="summaryCard addComposerStatCard">
                    <div className="summaryLabel">{t("history.composer.maintenanceLabel")}</div>
                    <div className="summaryValue">{t("history.composer.maintenanceValue")}</div>
                    <div className="summarySub">{t("history.composer.maintenanceSub")}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div ref={addPanelRef} tabIndex={-1} className="addComposerFrame">
                <AddSessionCard onCreated={onCreated} demo={demo} intelligence={intelligence} sessions={sessions} />
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
