import MedianSnapshotPanel from "../../ui/MedianSnapshotPanel.jsx";
import PowerCurveCard from "../../ui/PowerCurveCard.jsx";
import SocWindowAnalysis from "../../ui/SocWindowAnalysis.jsx";
import EfficiencyPanel from "../panels/EfficiencyPanel.jsx";

export default function EfficiencyMode({
  displayEfficiency,
  displayStats,
  socWindowAnalysis,
  year,
}) {
  return (
    <>
      <EfficiencyPanel displayEfficiency={displayEfficiency} year={year} />
      <MedianSnapshotPanel stats={displayStats} year={year} />
      <SocWindowAnalysis analysis={socWindowAnalysis} year={year} />
      <PowerCurveCard analysis={socWindowAnalysis} year={year} />
    </>
  );
}
