import Charts from "../../ui/Charts.jsx";
import ChargingMixCard from "../../ui/ChargingMixCard.jsx";
import ForecastCard from "../../ui/ForecastCard.jsx";
import MedianSnapshotPanel from "../../ui/MedianSnapshotPanel.jsx";
import MobilityCostCard from "../../ui/MobilityCostCard.jsx";
import MonthlyReportCard from "../../ui/MonthlyReportCard.jsx";
import OutlierAnalysis from "../../ui/OutlierAnalysis.jsx";
import PowerCurveCard from "../../ui/PowerCurveCard.jsx";
import SmartInsightsCard from "../../ui/SmartInsightsCard.jsx";
import SocWindowAnalysis from "../../ui/SocWindowAnalysis.jsx";
import WeekdayHeatmapCard from "../../ui/WeekdayHeatmapCard.jsx";
import WhatIfCard from "../../ui/WhatIfCard.jsx";
import YearComparisonPanel from "../../ui/YearComparisonPanel.jsx";
import { YEARS } from "../constants.js";
import EfficiencyPanel from "../panels/EfficiencyPanel.jsx";
import MonthlyPanel from "../panels/MonthlyPanel.jsx";
import PricePanel from "../panels/PricePanel.jsx";
import SeasonPanel from "../panels/SeasonPanel.jsx";

function comparisonRightYear(year) {
  return year === YEARS[0] ? YEARS[1] : YEARS[0];
}

export default function AnalysisScreen({
  analysisMode,
  displayEfficiency,
  displayStats,
  monthly,
  monthlyCsvUrl,
  monthlySorted,
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
        <>
          <SmartInsightsCard
            stats={displayStats}
            monthly={monthly}
            outliers={outliers}
            socWindowAnalysis={socWindowAnalysis}
            sessions={sessions}
            year={year}
          />
          <OutlierAnalysis analysis={outliers} year={year} />
        </>
      );
    }

    if (analysisMode === "efficiency") {
      return (
        <>
          <EfficiencyPanel displayEfficiency={displayEfficiency} year={year} />
          <MedianSnapshotPanel stats={displayStats} year={year} />
          <SocWindowAnalysis analysis={socWindowAnalysis} year={year} />
          <PowerCurveCard analysis={socWindowAnalysis} year={year} />
        </>
      );
    }

    if (analysisMode === "time") {
      return (
        <>
          <MonthlyReportCard months={monthlySorted} sessions={sessions} year={year} />
          <ForecastCard months={monthlySorted} year={year} />
          <SeasonPanel
            onDownloadSeasonCsv={onDownloadSeasonCsv}
            seasonRows={seasonRows}
            seasons={seasons}
            seasonsCsvUrl={seasonsCsvUrl}
            year={year}
          />
          <PricePanel priceSummary={priceSummary} year={year} />
          <MonthlyPanel
            activeMonths={monthlySorted.filter((month) => Number(month?.count || 0) > 0)}
            monthlyCsvUrl={monthlyCsvUrl}
            monthlySorted={monthlySorted}
            onDownloadMonthlyCsv={onDownloadMonthlyCsv}
            year={year}
          />
          <section className="row">
            {sessions.length ? (
              <Charts sessions={sessions} />
            ) : (
              <div className="card glassStrong">
                <div className="emptyStateCard">Keine Verlaufswerte für {year} vorhanden.</div>
              </div>
            )}
          </section>
        </>
      );
    }

    if (analysisMode === "mobility") {
      return (
        <>
          <ChargingMixCard sessions={sessions} year={year} />
          <MobilityCostCard sessions={sessions} year={year} />
          <WeekdayHeatmapCard sessions={sessions} year={year} />
          <WhatIfCard sessions={sessions} year={year} />
        </>
      );
    }

    return (
      <YearComparisonPanel
        key={`analysis-comparison-${year}`}
        availableYears={YEARS}
        initialLeftYear={year}
        initialRightYear={comparisonRightYear(year)}
      />
    );
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

      {renderAnalysisContent()}
    </>
  );
}
