import { useEffect, useId, useMemo, useState } from "react";
import { euro, num } from "../app/formatters.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import {
  buildPersonalActions,
  clearHiddenPersonalActions,
  hidePersonalAction,
  readPersonalActionPreferences,
  restorePersonalAction,
} from "./personalActionCenter.js";
import AppIcon from "../design-system/icons.jsx";
import ExplainabilityDisclosure from "./ExplainabilityDisclosure.jsx";
import { buildActionExplanation } from "./explainability.js";

const INITIAL_ACTION_COUNT = 3;

function ActionCenterIcon() {
  return <AppIcon name="check" />;
}

function ActionIcon({ kind }) {
  const name = kind === "goalBudget" ? "budget"
    : kind === "goalPrice" || kind === "providerOpportunity" ? "tag"
      : kind === "goalEfficiency" ? "efficiency"
        : kind === "outliers" ? "warning" : "spark";
  return <AppIcon name={name} />;
}

function DismissIcon() {
  return <AppIcon name="close" />;
}

function metricParams(action) {
  const metric = action.metric || {};
  if (action.kind === "goalBudget") {
    return { actual: euro(metric.actual), target: euro(metric.target), delta: euro(metric.delta) };
  }
  if (action.kind === "goalPrice") {
    return { actual: num(metric.actual, 3), target: num(metric.target, 3), delta: num(metric.delta, 3) };
  }
  if (action.kind === "goalEfficiency") {
    return { actual: num(metric.actual, 1), target: num(metric.target, 1), delta: num(metric.delta, 1) };
  }
  if (action.kind === "outliers") return { count: num(metric.actual, 0) };
  if (action.kind === "providerOpportunity") {
    return {
      provider: action.context?.provider,
      actual: num(metric.actual, 3),
      target: num(metric.target, 3),
      delta: num(metric.delta, 3),
    };
  }
  return {
    share: num(metric.actual, 0),
    count: num(metric.count, 0),
    total: num(metric.total, 0),
  };
}

export default function PersonalActionCenter({
  goalProgress,
  intelligence,
  onNavigate,
  outliers,
  sessions,
  stats,
  year,
}) {
  const { t } = useI18n();
  const headingId = useId();
  const [hidden, setHidden] = useState(() => readPersonalActionPreferences(year).hidden);
  const [expanded, setExpanded] = useState(false);
  const [lastDismissed, setLastDismissed] = useState(null);
  const actions = useMemo(() => buildPersonalActions({
    goalProgress,
    intelligence,
    outliers,
    sessions,
    stats,
  }), [goalProgress, intelligence, outliers, sessions, stats]);

  useEffect(() => {
    setHidden(readPersonalActionPreferences(year).hidden);
    setExpanded(false);
    setLastDismissed(null);
  }, [year]);

  const hiddenActionCount = actions.filter((action) => hidden.includes(action.id)).length;
  const visibleActions = actions.filter((action) => !hidden.includes(action.id));
  const renderedActions = expanded ? visibleActions : visibleActions.slice(0, INITIAL_ACTION_COUNT);
  const remainingCount = Math.max(visibleActions.length - INITIAL_ACTION_COUNT, 0);

  function dismiss(action) {
    setHidden(hidePersonalAction(year, action.id));
    setLastDismissed(action);
  }

  function undoDismiss() {
    if (!lastDismissed) return;
    setHidden(restorePersonalAction(year, lastDismissed.id));
    setLastDismissed(null);
  }

  function restoreAll() {
    setHidden(clearHiddenPersonalActions(year));
    setLastDismissed(null);
  }

  return (
    <section className="personalActionCenter" aria-labelledby={headingId}>
      <header className="personalActionHeader">
        <div className="personalActionIdentity">
          <span className="personalActionCenterIcon"><ActionCenterIcon /></span>
          <div>
            <div className="sectionKicker">{t("actionCenter.kicker")}</div>
            <h3 id={headingId}>{t("actionCenter.title")}</h3>
            <p>{t("actionCenter.text")}</p>
          </div>
        </div>
        <div className="personalActionHeaderMeta">
          <span className="pill ghostPill">{t("actionCenter.summary", { count: visibleActions.length })}</span>
          {hiddenActionCount ? (
            <button type="button" className="pill ghostPill" onClick={restoreAll}>
              {t("actionCenter.restoreAll", { count: hiddenActionCount })}
            </button>
          ) : null}
        </div>
      </header>

      {visibleActions.length ? (
        <div className="personalActionGrid">
          {renderedActions.map((action, index) => {
            const params = metricParams(action);
            const title = t(`actionCenter.items.${action.kind}.title`, params);
            return (
              <article key={action.id} className={`personalActionCard ${action.tone}`}>
                <div className="personalActionCardTop">
                  <span className="personalActionIcon"><ActionIcon kind={action.kind} /></span>
                  <span className={`personalActionPriority ${action.tone}`}>
                    {t(`actionCenter.priority.${action.tone}`)}
                  </span>
                  <button
                    type="button"
                    className="personalActionDismiss"
                    onClick={() => dismiss(action)}
                    aria-label={t("actionCenter.hide", { title, year })}
                    title={t("actionCenter.hideShort")}
                  >
                    <DismissIcon />
                  </button>
                </div>
                <div className="personalActionRank">{t("actionCenter.rank", { rank: index + 1 })}</div>
                <h4>{title}</h4>
                <p>{t(`actionCenter.items.${action.kind}.text`, params)}</p>
                <div className="personalActionMetric">{t(`actionCenter.items.${action.kind}.metric`, params)}</div>
                <ExplainabilityDisclosure explanation={buildActionExplanation(action, { sessions, stats })} />
                <button type="button" className="personalActionCta" onClick={() => onNavigate?.(action.destination)}>
                  <span>{t(`actionCenter.items.${action.kind}.action`, params)}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="personalActionEmpty">
          <span className="personalActionEmptyIcon" aria-hidden="true">✓</span>
          <div>
            <h4>{t(hiddenActionCount ? "actionCenter.hiddenEmpty.title" : "actionCenter.empty.title", { year })}</h4>
            <p>{t(hiddenActionCount ? "actionCenter.hiddenEmpty.text" : "actionCenter.empty.text", { year })}</p>
          </div>
          {hiddenActionCount ? <button type="button" className="btnSecondary" onClick={restoreAll}>{t("actionCenter.hiddenEmpty.action")}</button> : null}
        </div>
      )}

      {visibleActions.length > INITIAL_ACTION_COUNT ? (
        <button type="button" className="personalActionMore" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
          {expanded ? t("actionCenter.showLess") : t("actionCenter.showMore", { count: remainingCount })}
        </button>
      ) : null}

      {lastDismissed ? (
        <div className="personalActionUndo" role="status">
          <span>{t("actionCenter.undo.text", { title: t(`actionCenter.items.${lastDismissed.kind}.title`, metricParams(lastDismissed)), year })}</span>
          <button type="button" onClick={undoDismiss}>{t("actionCenter.undo.action")}</button>
        </div>
      ) : null}
    </section>
  );
}
