import ChargingMixCard from "../../ui/ChargingMixCard.jsx";
import MobilityCostCard from "../../ui/MobilityCostCard.jsx";
import SessionIntelligencePanel from "../../ui/SessionIntelligencePanel.jsx";
import WeekdayHeatmapCard from "../../ui/WeekdayHeatmapCard.jsx";
import WhatIfCard from "../../ui/WhatIfCard.jsx";

export default function MobilityMode({
  intelligence,
  onDrilldownHistory,
  sessions,
  year,
}) {
  return (
    <>
      <SessionIntelligencePanel intelligence={intelligence} onDrilldownHistory={onDrilldownHistory} year={year} />
      <ChargingMixCard sessions={sessions} year={year} />
      <MobilityCostCard sessions={sessions} year={year} />
      <WeekdayHeatmapCard sessions={sessions} year={year} />
      <WhatIfCard sessions={sessions} year={year} />
    </>
  );
}
