import sharedConfig from "../../../shared/domain/config.json" with { type: "json" };

export const YEARS = Array.isArray(sharedConfig?.visibleYears) ? sharedConfig.visibleYears : [2026, 2027, 2028];
export const DEFAULT_VEHICLE = String(sharedConfig?.defaultVehicle || "CUPRA Born 79 kWh");
export const CONNECTOR_OPTIONS = Array.isArray(sharedConfig?.connectorOptions)
  ? sharedConfig.connectorOptions
  : ["CCS - DC", "CCS AC", "Wallbox AC"];
