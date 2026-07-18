import { useEffect, useMemo, useState } from "react";
import { datumDE, num } from "../app/formatters.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { updateSession } from "./api.js";
import {
  clearReviewedDataQualityIssues,
  reviewDataQualityIssues,
} from "./dataQuality.js";
import { formatTags, parseTags } from "./sessionMetadata.js";

const INITIAL_ISSUE_COUNT = 5;

function QualityIcon({ kind = "quality" }) {
  if (kind === "duplicate") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="12" height="12" rx="2" /><path d="M5 15H4V5a1 1 0 0 1 1-1h10v1" /></svg>;
  }
  if (kind === "outlier") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 3.5 19h17L12 4Z" /><path d="M12 9v4M12 16h.01" /></svg>;
  }
  if (kind === "context") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M6 19c.7-3 2.7-5 6-5s5.3 2 6 5" /></svg>;
  }
  if (kind === "metrics") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M12 19V5M19 19v-7" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 9.2 17 19 7" /><path d="M5 5.5h5M5 19.5h14" /></svg>;
}

function issueParams(issue, t) {
  return {
    count: num(issue.count || issue.fields?.length || 1, 0),
    date: issue.date ? datumDE(issue.date) : t("common.noData"),
    fields: (issue.fields || []).map((field) => t(`dataQuality.fields.${field}`)).join(", "),
  };
}

export default function DataQualityCenter({
  onChanged,
  onEditSession,
  onReviewedChange,
  report,
  reviewed = [],
  sessions = [],
  year,
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState([]);
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const issues = report?.actionableIssues || [];
  const filteredIssues = useMemo(
    () => filter === "all" ? issues : issues.filter((issue) => issue.kind === filter),
    [filter, issues]
  );
  const renderedIssues = expanded ? filteredIssues : filteredIssues.slice(0, INITIAL_ISSUE_COUNT);
  const selectedSet = new Set(selected);

  useEffect(() => {
    setSelected((current) => current.filter((id) => issues.some((issue) => issue.id === id)));
  }, [issues]);

  function toggleIssue(issueId) {
    setSelected((current) => current.includes(issueId) ? current.filter((id) => id !== issueId) : [...current, issueId]);
  }

  function toggleAll() {
    const visibleIds = filteredIssues.map((issue) => issue.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
    setSelected(allSelected ? selected.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selected, ...visibleIds])));
  }

  function markReviewed(issueIds = selected) {
    const ids = Array.isArray(issueIds) ? issueIds : [issueIds];
    if (!ids.length) return;
    const next = reviewDataQualityIssues(year, ids);
    onReviewedChange?.(next);
    setSelected((current) => current.filter((id) => !ids.includes(id)));
    setStatus({ tone: "success", text: t("dataQuality.feedback.reviewed", { count: ids.length }) });
  }

  function restoreReviewed() {
    const next = clearReviewedDataQualityIssues(year);
    onReviewedChange?.(next);
    setStatus({ tone: "neutral", text: t("dataQuality.feedback.restored") });
  }

  async function applyTag() {
    const addedTags = parseTags(tag);
    const selectedIssues = issues.filter((issue) => selectedSet.has(issue.id));
    const sessionIds = Array.from(new Set(selectedIssues.map((issue) => issue.sessionId)));
    if (!addedTags.length || !sessionIds.length) return;
    setBusy(true);
    setStatus(null);
    const results = await Promise.allSettled(sessionIds.map((id) => {
      const session = sessions.find((row) => String(row.id) === String(id));
      const tags = formatTags(Array.from(new Set([...parseTags(session?.tags), ...addedTags])).join(", "));
      return updateSession(id, { tags });
    }));
    const successCount = results.filter((result) => result.status === "fulfilled").length;
    const errorCount = results.length - successCount;
    if (successCount) await onChanged?.();
    setTag("");
    setBusy(false);
    setStatus({
      tone: errorCount ? "warning" : "success",
      text: errorCount
        ? t("dataQuality.feedback.partial", { success: successCount, errors: errorCount })
        : t("dataQuality.feedback.tagged", { count: successCount }),
    });
  }

  return (
    <section id="data-quality-center" className="dataQualityCenter" aria-labelledby="data-quality-title">
      <header className="dataQualityHeader">
        <div className="dataQualityIdentity">
          <span className="dataQualityMainIcon"><QualityIcon /></span>
          <div>
            <div className="sectionKicker">{t("dataQuality.kicker")}</div>
            <h3 id="data-quality-title">{t("dataQuality.title")}</h3>
            <p>{t("dataQuality.text", { year })}</p>
          </div>
        </div>
        <div className={`dataQualityScore ${report?.score >= 90 ? "positive" : report?.score >= 70 ? "warning" : "danger"}`}>
          <strong>{num(report?.score ?? 100, 0)}</strong>
          <span>{t("dataQuality.score")}</span>
        </div>
      </header>

      <div className="dataQualityMetrics" aria-label={t("dataQuality.metrics.ariaLabel")}>
        <article><strong>{num(report?.metrics?.clean || 0, 0)}</strong><span>{t("dataQuality.metrics.clean")}</span></article>
        <article><strong>{num(report?.metrics?.affected || 0, 0)}</strong><span>{t("dataQuality.metrics.affected")}</span></article>
        <article><strong>{num(report?.metrics?.duplicateGroups || 0, 0)}</strong><span>{t("dataQuality.metrics.duplicates")}</span></article>
        <article><strong>{num(report?.reviewedCount || 0, 0)}</strong><span>{t("dataQuality.metrics.reviewed")}</span></article>
      </div>

      <div className="dataQualityToolbar">
        <div className="dataQualityFilters" role="group" aria-label={t("dataQuality.filters.ariaLabel")}>
          {["all", "duplicate", "outlier", "context", "metrics"].map((kind) => (
            <button key={kind} type="button" className={filter === kind ? "active" : ""} onClick={() => { setFilter(kind); setExpanded(false); }} aria-pressed={filter === kind}>
              {t(`dataQuality.filters.${kind}`)}
            </button>
          ))}
        </div>
        {reviewed.length ? <button type="button" className="dataQualityRestore" onClick={restoreReviewed}>{t("dataQuality.restoreReviewed", { count: reviewed.length })}</button> : null}
      </div>

      {filteredIssues.length ? (
        <>
          <div className="dataQualitySelectBar">
            <label>
              <input type="checkbox" checked={filteredIssues.every((issue) => selectedSet.has(issue.id))} onChange={toggleAll} />
              <span>{t("dataQuality.selectAll", { count: filteredIssues.length })}</span>
            </label>
            <span role="status">{t("dataQuality.selected", { count: selected.length })}</span>
          </div>

          <div className="dataQualityIssueList">
            {renderedIssues.map((issue) => {
              const params = issueParams(issue, t);
              const session = sessions.find((row) => String(row.id) === String(issue.sessionId));
              return (
                <article key={issue.id} className={`dataQualityIssue ${issue.severity}`}>
                  <label className="dataQualityIssueSelect">
                    <input type="checkbox" checked={selectedSet.has(issue.id)} onChange={() => toggleIssue(issue.id)} />
                    <span className="srOnly">{t("dataQuality.selectIssue", { title: t(`dataQuality.issues.${issue.kind}.title`, params) })}</span>
                  </label>
                  <span className="dataQualityIssueIcon"><QualityIcon kind={issue.kind} /></span>
                  <div className="dataQualityIssueCopy">
                    <div className="dataQualityIssueMeta">
                      <span>{t(`dataQuality.severity.${issue.severity}`)}</span>
                      <span>{params.date}</span>
                    </div>
                    <h4>{t(`dataQuality.issues.${issue.kind}.title`, params)}</h4>
                    <p>{t(`dataQuality.issues.${issue.kind}.text`, { ...params, provider: session?.provider || t("common.noData") })}</p>
                  </div>
                  <div className="dataQualityIssueActions">
                    <button type="button" className="btnSecondary" onClick={() => onEditSession?.(issue.sessionId)}>{t("dataQuality.actions.edit")}</button>
                    <button type="button" className="pill ghostPill" onClick={() => markReviewed(issue.id)}>{t("dataQuality.actions.reviewed")}</button>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredIssues.length > INITIAL_ISSUE_COUNT ? (
            <button type="button" className="dataQualityMore" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
              {expanded ? t("dataQuality.showLess") : t("dataQuality.showMore", { count: filteredIssues.length - INITIAL_ISSUE_COUNT })}
            </button>
          ) : null}

          {selected.length ? (
            <div className="dataQualityBulkBar">
              <div>
                <strong>{t("dataQuality.bulk.title", { count: selected.length })}</strong>
                <span>{t("dataQuality.bulk.text")}</span>
              </div>
              <label>
                <span>{t("dataQuality.bulk.tagLabel")}</span>
                <input className="input" value={tag} onChange={(event) => setTag(event.target.value)} placeholder={t("dataQuality.bulk.tagPlaceholder")} />
              </label>
              <button type="button" className="btnSecondary" onClick={applyTag} disabled={busy || !parseTags(tag).length}>
                {busy ? t("dataQuality.bulk.applying") : t("dataQuality.bulk.applyTag")}
              </button>
              <button type="button" className="btnPrimary" onClick={() => markReviewed()} disabled={busy}>{t("dataQuality.bulk.reviewed")}</button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="dataQualityEmpty">
          <span className="dataQualityMainIcon"><QualityIcon /></span>
          <div><h4>{t("dataQuality.empty.title")}</h4><p>{t("dataQuality.empty.text")}</p></div>
          {reviewed.length ? <button type="button" className="btnSecondary" onClick={restoreReviewed}>{t("dataQuality.empty.restore")}</button> : null}
        </div>
      )}

      {status ? <div className={`dataQualityStatus ${status.tone}`} role="status" aria-live="polite">{status.text}</div> : null}
    </section>
  );
}
