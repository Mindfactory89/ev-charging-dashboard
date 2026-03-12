import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { minutesFromSeconds, num } from "../app/formatters.js";
import Tooltip from "./Tooltip.jsx";

function scoreTone(score) {
  const v = Number(score);
  if (!Number.isFinite(v)) return "";
  if (v >= 80) return "success";
  if (v >= 65) return "warm";
  if (v >= 50) return "warn";
  return "danger";
}

export default function SocWindowAnalysis({ analysis, year = 2026 }) {
  const { t } = useI18n();
  const windows = Array.isArray(analysis?.bands) && analysis.bands.length ? analysis.bands : Array.isArray(analysis?.windows) ? analysis.windows : [];
  const highlights = analysis?.highlights || {};
  const hasAnalyzedSessions = Number(analysis?.analyzed_session_count || 0) > 0;

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">{t("socWindow.kicker")}</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">{t("socWindow.title", { year })}</div>
              <Tooltip
                content={t("socWindow.tooltipContent")}
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
              >
                <button className="ttTrigger" type="button" aria-label={t("socWindow.tooltipLabel")}>
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {analysis?.analyzed_session_count
              ? t("socWindow.analyzedSessions", { count: num(analysis.analyzed_session_count, 0) })
              : t("socWindow.noSocData")}
          </div>
        </div>

        {hasAnalyzedSessions ? (
          <div className="summaryGrid">
            <div className="summaryCard warm">
              <div className="summaryLabel">{t("socWindow.bestBand")}</div>
              <div className="summaryValue">{highlights?.best_efficiency_window?.label || "–"}</div>
              <div className="summarySub">
                {highlights?.best_efficiency_window?.avg_score != null
                  ? `${num(highlights.best_efficiency_window.avg_score, 1)}/100`
                  : t("common.noData")}
              </div>
            </div>

            <div className="summaryCard">
              <div className="summaryLabel">{t("socWindow.cheapestBand")}</div>
              <div className="summaryValue">{highlights?.cheapest_window?.label || "–"}</div>
              <div className="summarySub">
                {highlights?.cheapest_window?.avg_price_per_kwh != null
                  ? `${num(highlights.cheapest_window.avg_price_per_kwh, 3)} €/kWh`
                  : t("common.noData")}
              </div>
            </div>

            <div className="summaryCard frost">
              <div className="summaryLabel">{t("socWindow.fastestBand")}</div>
              <div className="summaryValue">{highlights?.fastest_window?.label || "–"}</div>
              <div className="summarySub">
                {highlights?.fastest_window?.avg_power_kw != null
                  ? `${num(highlights.fastest_window.avg_power_kw, 1)} kW`
                  : t("common.noData")}
              </div>
            </div>

            <div className="summaryCard mint">
              <div className="summaryLabel">{t("socWindow.widestWindow")}</div>
              <div className="summaryValue">{highlights?.widest_window?.label || "–"}</div>
              <div className="summarySub">
                {highlights?.widest_window?.avg_soc_delta != null
                  ? `${num(highlights.widest_window.avg_soc_delta, 1)} %-Punkte`
                  : t("common.noData")}
              </div>
            </div>
          </div>
        ) : (
          <div className="summaryGrid">
            <div className="emptyStateCard">{t("socWindow.noValues", { year })}</div>
          </div>
        )}

        <div className="detailCardGrid">
          {windows.length ? (
            windows.map((window) => {
              const isBest = highlights?.best_efficiency_window?.key === window.key;
              return (
                <article key={window.key} className={`detailCard ${isBest ? "featured" : ""}`}>
                  <div className="detailCardTop">
                    <div className="detailCardTitle">{window.label}</div>
                    <div className="detailCardMeta">{t("socWindow.shareMeta", { value: num(window.coverage_pct ?? window.share_pct, 1) })}</div>
                  </div>

                  <div className={`summaryValue detailScoreValue ${scoreTone(window.avg_score)}`}>
                    {window.avg_score != null ? `${num(window.avg_score, 1)}/100` : "–"}
                  </div>
                  <div className="detailCardSub">{t("socWindow.detailSub")}</div>

                  <div className="metricMiniGrid">
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">{t("common.sessions")}</div>
                      <div className="metricMiniValue">{num(window.count, 0)}</div>
                    </div>
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">{t("socWindow.avgPrice")}</div>
                      <div className="metricMiniValue">
                        {window.avg_price_per_kwh != null ? `${num(window.avg_price_per_kwh, 3)} €/kWh` : "–"}
                      </div>
                    </div>
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">{t("socWindow.avgPower")}</div>
                      <div className="metricMiniValue">
                        {window.avg_power_kw != null ? `${num(window.avg_power_kw, 1)} kW` : "–"}
                      </div>
                    </div>
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">{t("socWindow.avgDuration")}</div>
                      <div className="metricMiniValue">{minutesFromSeconds(window.avg_duration_seconds)}</div>
                    </div>
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">{t("socWindow.avgEnergy")}</div>
                      <div className="metricMiniValue">
                        {window.avg_energy_kwh != null ? `${num(window.avg_energy_kwh, 1)} kWh` : "–"}
                      </div>
                    </div>
                    <div className="metricMiniItem">
                      <div className="metricMiniLabel">{t("socWindow.avgSocDelta")}</div>
                      <div className="metricMiniValue">
                        {window.avg_soc_delta != null ? `${num(window.avg_soc_delta, 1)} %` : "–"}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="emptyStateCard">
              {hasAnalyzedSessions ? t("socWindow.noEnoughData", { year }) : t("socWindow.noValues", { year })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
