import { Suspense, lazy } from "react";
import LazySectionFallback from "../LazySectionFallback.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";

const CompareMode = lazy(() => import("../analysisModes/CompareMode.jsx"));
const EfficiencyMode = lazy(() => import("../analysisModes/EfficiencyMode.jsx"));
const SignalsMode = lazy(() => import("../analysisModes/SignalsMode.jsx"));
const TimeMode = lazy(() => import("../analysisModes/TimeMode.jsx"));
const MobilityMode = lazy(() => import("../analysisModes/MobilityMode.jsx"));

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

  function renderAnalysisContent() {
    if (analysisMode === "signals") {
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

    if (analysisMode === "efficiency") {
      return (
        <EfficiencyMode
          displayEfficiency={displayEfficiency}
          displayStats={displayStats}
          socWindowAnalysis={socWindowAnalysis}
          year={year}
        />
      );
    }

    if (analysisMode === "time") {
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

    if (analysisMode === "mobility") {
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
      <section className="premiumModeBar">
        <div className="premiumModeIntro">
          <div className="sectionKicker">{t("analysis.kicker")}</div>
          <div className="premiumModeTitle">{t("analysis.title")}</div>
        </div>

        <div className="toggle premiumModeToggle" aria-label="Analyse Fokus">
          <button type="button" className={analysisMode === "compare" ? "toggleBtn active" : "toggleBtn"} onClick={() => onAnalysisModeChange("compare")}>
            {t("analysis.modes.compare")}
          </button>
          <button
            type="button"
            className={analysisMode === "efficiency" ? "toggleBtn active" : "toggleBtn"}
            onClick={() => onAnalysisModeChange("efficiency")}
          >
            {t("analysis.modes.efficiency")}
          </button>
          <button
            type="button"
            className={analysisMode === "signals" ? "toggleBtn active" : "toggleBtn"}
            onClick={() => onAnalysisModeChange("signals")}
          >
            {t("analysis.modes.signals")}
          </button>
          <button
            type="button"
            className={analysisMode === "mobility" ? "toggleBtn active" : "toggleBtn"}
            onClick={() => onAnalysisModeChange("mobility")}
          >
            {t("analysis.modes.mobility")}
          </button>
          <button type="button" className={analysisMode === "time" ? "toggleBtn active" : "toggleBtn"} onClick={() => onAnalysisModeChange("time")}>
            {t("analysis.modes.time")}
          </button>
        </div>
      </section>

      <Suspense fallback={<LazySectionFallback label={t("analysis.loading")} />}>
        {renderAnalysisContent()}
      </Suspense>
    </>
  );
}
