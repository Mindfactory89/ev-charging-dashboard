import OutlierAnalysis from "../../ui/OutlierAnalysis.jsx";
import SmartInsightsCard from "../../ui/SmartInsightsCard.jsx";

export default function SignalsMode({
  displayStats,
  monthly,
  outliers,
  sessions,
  socWindowAnalysis,
  year,
}) {
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
