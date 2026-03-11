import { Suspense, lazy } from "react";
import LazySectionFallback from "../LazySectionFallback.jsx";

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
          <div className="sectionKicker">Analyse</div>
          <div className="premiumModeTitle">Tiefgang nur dann, wenn du ihn wirklich brauchst</div>
        </div>

        <div className="toggle premiumModeToggle" aria-label="Analyse Fokus">
          <button type="button" className={analysisMode === "compare" ? "toggleBtn active" : "toggleBtn"} onClick={() => onAnalysisModeChange("compare")}>
            Vergleich
          </button>
          <button
            type="button"
            className={analysisMode === "efficiency" ? "toggleBtn active" : "toggleBtn"}
            onClick={() => onAnalysisModeChange("efficiency")}
          >
            Effizienz
          </button>
          <button
            type="button"
            className={analysisMode === "signals" ? "toggleBtn active" : "toggleBtn"}
            onClick={() => onAnalysisModeChange("signals")}
          >
            Signale
          </button>
          <button
            type="button"
            className={analysisMode === "mobility" ? "toggleBtn active" : "toggleBtn"}
            onClick={() => onAnalysisModeChange("mobility")}
          >
            Mobilität
          </button>
          <button type="button" className={analysisMode === "time" ? "toggleBtn active" : "toggleBtn"} onClick={() => onAnalysisModeChange("time")}>
            Zeiträume
          </button>
        </div>
      </section>

      <Suspense fallback={<LazySectionFallback label="Analysebereich wird geladen…" />}>
        {renderAnalysisContent()}
      </Suspense>
    </>
  );
}
