import React, { useMemo } from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { datumDE, minutesFromSeconds, num } from "../app/formatters.js";
import Tooltip from "./Tooltip.jsx";

function buildAutoHints(analysis, t) {
  const hints = [];
  const highlights = analysis?.highlights || {};
  const baselines = analysis?.baselines || {};

  if (highlights?.weakest_score_outlier?.score != null) {
    hints.push({
      id: "weakest_score",
      title: t("outliers.hintTitles.weakestScore"),
      value: `${num(highlights.weakest_score_outlier.score, 1)}/100`,
      detail: `${datumDE(highlights.weakest_score_outlier.date)} • Median ${num(baselines?.score?.median, 1)}/100`,
    });
  }

  if (highlights?.priciest_outlier?.price_per_kwh != null) {
    hints.push({
      id: "priciest",
      title: t("outliers.hintTitles.priciest"),
      value: `${num(highlights.priciest_outlier.price_per_kwh, 3)} €/kWh`,
      detail: `${datumDE(highlights.priciest_outlier.date)} • Median ${num(baselines?.price_per_kwh?.median, 3)} €/kWh`,
    });
  }

  if (highlights?.lowest_power_outlier?.avg_power_kw != null) {
    hints.push({
      id: "lowest_power",
      title: t("outliers.hintTitles.lowestPower"),
      value: `${num(highlights.lowest_power_outlier.avg_power_kw, 1)} kW`,
      detail: `${datumDE(highlights.lowest_power_outlier.date)} • Median ${num(baselines?.avg_power_kw?.median, 1)} kW`,
    });
  }

  if (highlights?.longest_outlier?.duration_seconds != null) {
    hints.push({
      id: "longest",
      title: t("outliers.hintTitles.longest"),
      value: minutesFromSeconds(highlights.longest_outlier.duration_seconds),
      detail: `${datumDE(highlights.longest_outlier.date)} • Median ${minutesFromSeconds(baselines?.duration_seconds?.median)}`,
    });
  }

  if (highlights?.worst_session?.flag_count > 1) {
    hints.push({
      id: "worst_session",
      title: t("outliers.hintTitles.worstSession"),
      value: datumDE(highlights.worst_session.date),
      detail: t("outliers.anomaliesInOneSession", { count: num(highlights.worst_session.flag_count, 0) }),
    });
  }

  return hints.slice(0, 4);
}

export default function OutlierAnalysis({ analysis, year = 2026 }) {
  const { t } = useI18n();
  const sessions = Array.isArray(analysis?.flagged_sessions) ? analysis.flagged_sessions : [];
  const hints = useMemo(() => buildAutoHints(analysis, t), [analysis, t]);
  const hasSessions = Number(analysis?.session_count || 0) > 0;

  function reasonLabel(reason) {
    const key = String(reason?.key || "");
    if (key && t(`outliers.reasonLabels.${key}`) !== `outliers.reasonLabels.${key}`) {
      return t(`outliers.reasonLabels.${key}`);
    }
    return reason?.label || "–";
  }

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">{t("outliers.kicker")}</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">{t("outliers.title", { year })}</div>
              <Tooltip
                content={t("outliers.tooltipContent")}
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
              >
                <button className="ttTrigger" type="button" aria-label={t("outliers.tooltipLabel")}>
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {analysis?.session_count
              ? t("outliers.meta", {
                  outliers: num(analysis.outlier_count, 0),
                  sessions: num(analysis.session_count, 0),
                })
              : t("common.noData")}
          </div>
        </div>

        <div className="summaryGrid">
          {hints.length ? (
            hints.map((hint) => (
              <div key={hint.id} className="summaryCard">
                <div className="summaryLabel">{hint.title}</div>
                <div className="summaryValue">{hint.value}</div>
                <div className="summarySub">{hint.detail}</div>
              </div>
            ))
          ) : (
            <div className="emptyStateCard">
              {hasSessions ? t("outliers.noneFound", { year }) : t("outliers.noValues", { year })}
            </div>
          )}
        </div>

        <div className="detailCardGrid">
          {sessions.length ? (
            sessions.map((session) => (
              <article key={session.session_id} className={`detailCard ${session.flag_count > 1 ? "featured" : ""}`}>
                <div className="detailCardTop">
                  <div className="detailCardTitle">{datumDE(session.date)}</div>
                  <div className="detailCardMeta">{t("outliers.flags", { count: num(session.flag_count, 0) })}</div>
                </div>

                <div className="detailCardSub">{session.connector || "–"}</div>

                <div className="reasonPillRow">
                  {session.reasons.map((reason) => (
                    <div key={`${session.session_id}-${reason.key}`} className={`reasonPill ${reason.severity || "low"}`}>
                      {reasonLabel(reason)}
                    </div>
                  ))}
                </div>

                <div className="metricMiniGrid">
                  <div className="metricMiniItem">
                    <div className="metricMiniLabel">{t("common.score")}</div>
                    <div className="metricMiniValue">{session.score != null ? `${num(session.score, 1)}/100` : "–"}</div>
                  </div>
                  <div className="metricMiniItem">
                    <div className="metricMiniLabel">{t("common.pricePerKwh")}</div>
                    <div className="metricMiniValue">
                      {session.price_per_kwh != null ? `${num(session.price_per_kwh, 3)} €/kWh` : "–"}
                    </div>
                  </div>
                  <div className="metricMiniItem">
                    <div className="metricMiniLabel">{t("common.avgPower")}</div>
                    <div className="metricMiniValue">
                      {session.avg_power_kw != null ? `${num(session.avg_power_kw, 1)} kW` : "–"}
                    </div>
                  </div>
                  <div className="metricMiniItem">
                    <div className="metricMiniLabel">{t("common.duration")}</div>
                    <div className="metricMiniValue">{minutesFromSeconds(session.duration_seconds)}</div>
                  </div>
                </div>

                {session.reasons.length ? (
                  <div className="detailCardFootnote">
                    {session.reasons
                      .slice(0, 2)
                      .map((reason) => {
                        const deviation =
                          reason.deviation_pct != null ? `${num(reason.deviation_pct, 0)} %` : t("outliers.noticeable");
                        return t("outliers.detailFromMedian", { label: reasonLabel(reason), deviation });
                      })
                      .join(" • ")}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className="emptyStateCard detailEmpty">
              {hasSessions ? t("outliers.noDetails", { year }) : t("outliers.noValues", { year })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
