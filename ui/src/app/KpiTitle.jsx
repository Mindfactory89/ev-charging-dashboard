import Tooltip from "../ui/Tooltip.jsx";

export default function KpiTitle({ label, tip }) {
  if (!tip) return <div className="kpiTitle">{label}</div>;
  return (
    <Tooltip content={tip} placement="top" openDelayMs={120} closeDelayMs={220}>
      <span className="kpiTitle kpiTitleTip" tabIndex={0}>
        {label}
      </span>
    </Tooltip>
  );
}
