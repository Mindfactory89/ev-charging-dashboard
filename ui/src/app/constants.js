import sharedConfig from "../../../shared/domain/config.cjs";

export const YEARS = Array.isArray(sharedConfig?.visibleYears) ? sharedConfig.visibleYears : [2026, 2027, 2028];
export const DEFAULT_VEHICLE = String(sharedConfig?.defaultVehicle || "CUPRA Born 79 kWh");
export const CONNECTOR_OPTIONS = Array.isArray(sharedConfig?.connectorOptions)
  ? sharedConfig.connectorOptions
  : ["CCS - DC", "CCS AC", "Wallbox AC"];

export const floatingAddButtonStyle = {
  position: "fixed",
  right: 22,
  bottom: 22,
  zIndex: 50,
  padding: "12px 16px",
  borderRadius: 999,
  color: "white",
  background: "linear-gradient(180deg, rgba(24,24,30,0.90), rgba(12,12,16,0.88))",
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 22px 56px rgba(0,0,0,0.50)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  cursor: "pointer",
  fontWeight: 650,
  letterSpacing: 0.15,
};
