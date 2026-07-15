import { useRef } from "react";
import AddSessionCard from "../../ui/AddSessionCard.jsx";
import ImportSessionsCard from "../../ui/ImportSessionsCard.jsx";
import SessionsCard from "../../ui/SessionsCard.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { datumDE, num } from "../formatters.js";
import { monthLabel } from "../../ui/monthLabels.js";

function HistoryActionIcon({ type }) {
  if (type === "import") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v10" />
        <path d="m8 10 4 4 4-4" />
        <path d="M5 19h14" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

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
  const importDetailsRef = useRef(null);

  function sourceLabel(source) {
    if (source === "analysis") return t("history.source.analysis");
    if (source === "overview") return t("history.source.overview");
    return t("history.source.history");
  }

  function openImport() {
    if (!importDetailsRef.current) return;
    importDetailsRef.current.open = true;
    requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      importDetailsRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  }

  const filterLabels = [
    historyFilters?.month ? t("history.filters.month", { value: monthLabel(Number(historyFilters.month)) }) : null,
    historyFilters?.provider ? t("history.filters.provider", { value: historyFilters.provider }) : null,
    historyFilters?.location ? t("history.filters.location", { value: historyFilters.location }) : null,
    historyFilters?.vehicle ? t("history.filters.vehicle", { value: historyFilters.vehicle }) : null,
    historyFilters?.tag ? t("history.filters.tag", { value: historyFilters.tag }) : null,
  ].filter(Boolean);
  const hasHistoryContext = Boolean(drilldownSource) || filterLabels.length > 0;
  const totalEnergy = sessions.reduce((sum, session) => sum + (Number(session.energy_kwh) || 0), 0);
  const latestSession = [...sessions]
    .filter((session) => session?.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

  return (
    <>
      <section className="historyWorkspaceHero card glassStrong" aria-labelledby="history-workspace-title">
        <div className="historyWorkspaceHeader">
          <div className="historyWorkspaceCopy">
            <div className="sectionKicker">{t("history.intro.eyebrow")}</div>
            <h3 id="history-workspace-title" className="historyWorkspaceTitle">
              {t("history.intro.title")}
            </h3>
            <p>{t("history.intro.text")}</p>
          </div>

          <div className="historyActionRow">
            <button
              type="button"
              className="historyWorkspaceAction primary"
              onClick={openAdd}
              aria-expanded={addOpen}
              aria-controls="add-session-composer"
            >
              <HistoryActionIcon type="add" />
              <span>{t("history.actions.add")}</span>
            </button>
            <button type="button" className="historyWorkspaceAction" onClick={openImport}>
              <HistoryActionIcon type="import" />
              <span>{t("history.actions.import")}</span>
            </button>
          </div>
        </div>

        <dl className="historyQuickStats">
          <div>
            <dt>{t("history.stats.sessions")}</dt>
            <dd>{num(sessions.length, 0)}</dd>
          </div>
          <div>
            <dt>{t("history.stats.energy")}</dt>
            <dd>{num(totalEnergy, 1)} kWh</dd>
          </div>
          <div>
            <dt>{filterLabels.length ? t("history.stats.filters") : t("history.stats.latest")}</dt>
            <dd>{filterLabels.length ? num(filterLabels.length, 0) : latestSession ? datumDE(latestSession.date) : "–"}</dd>
          </div>
        </dl>
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

            <div className="historyBreadcrumbTrail" aria-label={t("history.drilldown.activeContext")}>
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

      <section
        id="add-session-composer"
        className="historyComposerSection"
        ref={addSectionRef}
        hidden={!addOpen}
        aria-labelledby="add-session-composer-title"
      >
        <div className="historyComposerHeader">
          <div>
            <div className="sectionKicker">{t("history.composer.kicker")}</div>
            <h3 id="add-session-composer-title" ref={addPanelRef} tabIndex={-1} className="historyComposerTitle">
              {t("history.composer.title")}
            </h3>
          </div>
          <button
            type="button"
            className="pill ghostPill"
            onClick={closeAdd}
            aria-expanded={addOpen}
            aria-controls="add-session-composer"
          >
            {t("common.collapse")}
          </button>
        </div>
        <AddSessionCard onCreated={onCreated} demo={demo} intelligence={intelligence} sessions={sessions} />
      </section>

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

      <details id="history-import" className="historyImportDisclosure" ref={importDetailsRef}>
        <summary>
          <span className="historyImportIcon">
            <HistoryActionIcon type="import" />
          </span>
          <span>
            <strong>{t("history.import.title")}</strong>
            <small>{t("history.import.text")}</small>
          </span>
          <span className="historyImportState" aria-hidden="true">+</span>
        </summary>
        <div className="historyImportContent">
          <ImportSessionsCard onImported={onCreated} sessions={sessions} />
        </div>
      </details>
    </>
  );
}
