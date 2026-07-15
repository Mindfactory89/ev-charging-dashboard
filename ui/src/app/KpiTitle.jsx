import Tooltip from "../ui/Tooltip.jsx";

export default function KpiTitle({ label, tip }) {
  if (!tip) return <h3 className="kpiTitle">{label}</h3>;
  return (
    <Tooltip content={tip} placement="top" openDelayMs={120} closeDelayMs={220}>
      <h3 className="kpiTitle kpiTitleTip" tabIndex={0}>
        {label}
      </h3>
    </Tooltip>
  );
}
