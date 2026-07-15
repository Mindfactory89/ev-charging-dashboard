import { Suspense, lazy } from "react";
import LazySectionFallback from "../LazySectionFallback.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";

const CompareMode = lazy(() => import("../analysisModes/CompareMode.jsx"));
const EfficiencyMode = lazy(() => import("../analysisModes/EfficiencyMode.jsx"));
const SignalsMode = lazy(() => import("../analysisModes/SignalsMode.jsx"));
const TimeMode = lazy(() => import("../analysisModes/TimeMode.jsx"));
const MobilityMode = lazy(() => import("../analysisModes/MobilityMode.jsx"));

const ANALYSIS_MODES = ["compare", "efficiency", "signals", "mobility", "time"];

function AnalysisModeIcon({ mode }) {
  if (mode === "efficiency") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 18a8 8 0 1 1 14 0" />
        <path d="m12 14 4-4" />
        <path d="M8 18h8" />
      </svg>
    );
  }

  if (mode === "signals") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17V7" />
        <path d="M8 17v-4" />
        <path d="M12 17V9" />
        <path d="M16 17V5" />
        <path d="M20 17v-7" />
      </svg>
    );
  }

  if (mode === "mobility") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 16h16" />
        <path d="m6 16 1.5-5h9L19 16" />
        <path d="M8 11 10 7h4l2 4" />
        <circle cx="7" cy="18" r="1.5" />
        <circle cx="17" cy="18" r="1.5" />
      </svg>
    );
  }

  if (mode === "time") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14" />
      <path d="m8 4-3 3 3 3" />
      <path d="M19 17H5" />
      <path d="m16 14 3 3-3 3" />
    </svg>
  );
}

export default function AnalysisScreen({
  availableYears,
  analysisMode,
  displayEfficiency,
  displayStats,
  intelligence,
  monthly,
  monthlyCsvUrl,
  monthlySorted,
  onDrilldownHistory,
  onAnalysisModeChange,
  onDownloadMonthlyCsv,
  onDownloadSeasonCsv,
  outliers,
  priceSummary,
  seasonRows,
  seasons,
  seasonsCsvUrl,
  sessions,
  socWindowAnalysis,
  year,
}) {
  const { t } = useI18n();
  const activeMode = ANALYSIS_MODES.includes(analysisMode) ? analysisMode : "compare";

  function renderAnalysisContent() {
    if (activeMode === "signals") {
      return (
        <SignalsMode
          displayStats={displayStats}
          monthly={monthly}
          outliers={outliers}
          sessions={sessions}
          socWindowAnalysis={socWindowAnalysis}
          year={year}
        />
      );
    }

    if (activeMode === "efficiency") {
      return (
        <EfficiencyMode
          displayEfficiency={displayEfficiency}
          displayStats={displayStats}
          socWindowAnalysis={socWindowAnalysis}
          year={year}
        />
      );
    }

    if (activeMode === "time") {
      return (
        <TimeMode
          monthlyCsvUrl={monthlyCsvUrl}
          monthly={monthly}
          monthlySorted={monthlySorted}
          onDownloadMonthlyCsv={onDownloadMonthlyCsv}
          onDownloadSeasonCsv={onDownloadSeasonCsv}
          priceSummary={priceSummary}
          seasonRows={seasonRows}
          seasons={seasons}
          seasonsCsvUrl={seasonsCsvUrl}
          sessions={sessions}
          year={year}
        />
      );
    }

    if (activeMode === "mobility") {
      return (
        <MobilityMode
          intelligence={intelligence}
          onDrilldownHistory={onDrilldownHistory}
          sessions={sessions}
          year={year}
        />
      );
    }

    return <CompareMode availableYears={availableYears} year={year} />;
  }

  return (
    <>
      <section className="analysisWorkspace card glassStrong" aria-labelledby="analysis-workspace-title">
        <div className="analysisWorkspaceHeader">
          <div>
            <div className="sectionKicker">{t("analysis.kicker")}</div>
            <h3 id="analysis-workspace-title" className="analysisWorkspaceTitle">
              {t("analysis.title")}
            </h3>
          </div>
          <div className="analysisWorkspaceScope">
            {t("analysis.scope", { count: sessions.length, year })}
          </div>
        </div>

        <div className="analysisModeGrid" role="group" aria-label={t("analysis.modeAria")}>
          {ANALYSIS_MODES.map((mode) => {
            const active = activeMode === mode;
            return (
              <button
                key={mode}
                type="button"
                className={active ? "analysisModeCard active" : "analysisModeCard"}
                onClick={() => onAnalysisModeChange(mode)}
                aria-pressed={active}
              >
                <span className="analysisModeIcon">
                  <AnalysisModeIcon mode={mode} />
                </span>
                <span>{t(`analysis.modes.${mode}`)}</span>
              </button>
            );
          })}
        </div>

        <div className="analysisActiveSummary" aria-live="polite">
          <span className="analysisActiveSummaryIcon">
            <AnalysisModeIcon mode={activeMode} />
          </span>
          <div>
            <div className="analysisActiveLabel">{t("analysis.activeLabel")}</div>
            <strong>{t(`analysis.modes.${activeMode}`)}</strong>
            <p>{t(`analysis.modeDescriptions.${activeMode}`)}</p>
          </div>
        </div>
      </section>

      <Suspense fallback={<LazySectionFallback label={t("analysis.loading")} />}>
        {renderAnalysisContent()}
      </Suspense>
    </>
  );
}
