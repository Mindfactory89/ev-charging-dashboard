import { readQueryParam } from "../platform/runtime.js";

const PROFILE_QUERY_PARAM = "vehicle";
export const DEFAULT_VEHICLE_PROFILE_ID = "generic-ev";
const ENV_PROFILE_ID = (import.meta.env?.VITE_VEHICLE_PROFILE || "").trim();

export const VEHICLE_BODY_TYPES = Object.freeze(["hatchback", "sedan", "suv", "wagon", "van", "other"]);

export const VEHICLE_CATALOG = Object.freeze([
  { id: "generic-ev", manufacturer: "", model: "Elektroauto", variant: "Eigenes Fahrzeug", bodyType: "other", batteryKwh: null, consumptionKwhPer100Km: 17.2, chargingPowerKw: null },
  { id: "volkswagen-id3-pro-s", manufacturer: "Volkswagen", model: "ID.3", variant: "Pro S", bodyType: "hatchback", batteryKwh: 79, consumptionKwhPer100Km: 16.0, chargingPowerKw: 185 },
  { id: "tesla-model-3-long-range", manufacturer: "Tesla", model: "Model 3", variant: "Long Range", bodyType: "sedan", batteryKwh: 75, consumptionKwhPer100Km: 15.0, chargingPowerKw: 250 },
  { id: "hyundai-ioniq-5", manufacturer: "Hyundai", model: "IONIQ 5", variant: "Long Range", bodyType: "suv", batteryKwh: 84, consumptionKwhPer100Km: 18.2, chargingPowerKw: 260 },
  { id: "kia-ev6", manufacturer: "Kia", model: "EV6", variant: "Long Range", bodyType: "suv", batteryKwh: 84, consumptionKwhPer100Km: 17.7, chargingPowerKw: 258 },
  { id: "skoda-enyaq-85", manufacturer: "Škoda", model: "Enyaq", variant: "85", bodyType: "suv", batteryKwh: 77, consumptionKwhPer100Km: 16.4, chargingPowerKw: 175 },
  { id: "bmw-i4-edrive40", manufacturer: "BMW", model: "i4", variant: "eDrive40", bodyType: "sedan", batteryKwh: 81.1, consumptionKwhPer100Km: 16.1, chargingPowerKw: 205 },
  { id: "renault-scenic-e-tech", manufacturer: "Renault", model: "Scenic E-Tech", variant: "Long Range", bodyType: "suv", batteryKwh: 87, consumptionKwhPer100Km: 17.0, chargingPowerKw: 150 },
  { id: "volvo-ex30-extended-range", manufacturer: "Volvo", model: "EX30", variant: "Extended Range", bodyType: "suv", batteryKwh: 64, consumptionKwhPer100Km: 16.7, chargingPowerKw: 153 },
  { id: "polestar-2-long-range", manufacturer: "Polestar", model: "2", variant: "Long Range", bodyType: "sedan", batteryKwh: 79, consumptionKwhPer100Km: 16.0, chargingPowerKw: 205 },
  { id: "nissan-ariya-87", manufacturer: "Nissan", model: "Ariya", variant: "87 kWh", bodyType: "suv", batteryKwh: 87, consumptionKwhPer100Km: 19.0, chargingPowerKw: 130 },
  { id: "cupra-born", manufacturer: "CUPRA", model: "Born", variant: "79 kWh", bodyType: "hatchback", batteryKwh: 79, consumptionKwhPer100Km: 17.2, chargingPowerKw: 170, imageSrc: "/cupra-hero.png" },
  { id: "cupra-tavascan", manufacturer: "CUPRA", model: "Tavascan", variant: "VZ", bodyType: "suv", batteryKwh: 77, consumptionKwhPer100Km: 19, chargingPowerKw: 250, imageSrc: "/cupra-tavascan-hero.png" },
  { id: "cupra-raval", manufacturer: "CUPRA", model: "Raval", variant: "Electric", bodyType: "hatchback", batteryKwh: 56, consumptionKwhPer100Km: 15.5, chargingPowerKw: 155, imageSrc: "/cupra-raval-hero.png" },
]);

function decimalLabel(value) {
  return Number(value).toFixed(1).replace(".", ",");
}

function displayName(entry) {
  return [entry.manufacturer, entry.model].filter(Boolean).join(" ") || "Elektroauto";
}

function toProfile(entry) {
  const name = displayName(entry);
  const specs = [
    { id: "variant", label: entry.variant || name, icon: "trim" },
    entry.chargingPowerKw ? { id: "power", label: `${entry.chargingPowerKw} kW`, icon: "power" } : null,
    entry.batteryKwh ? { id: "battery", label: `${decimalLabel(entry.batteryKwh)} kWh`, icon: "battery", accent: true } : null,
    entry.consumptionKwhPer100Km ? { id: "consumption", label: `${decimalLabel(entry.consumptionKwhPer100Km)} kWh/100 km`, icon: "consumption" } : null,
  ].filter(Boolean);
  return {
    ...entry,
    catalogId: entry.id,
    name,
    sessionVehicleName: [name, entry.variant].filter(Boolean).join(" "),
    imageSrc: entry.imageSrc || "",
    imageAlt: name,
    imageSource: entry.imageSrc ? "catalog" : "fallback",
    fallbackLabel: name,
    fallbackHint: [entry.variant, entry.batteryKwh ? `${decimalLabel(entry.batteryKwh)} kWh` : null].filter(Boolean).join(" · "),
    sectionKicker: "Fahrzeugprofil",
    specs,
  };
}

export const VEHICLE_PROFILES = Object.freeze(Object.fromEntries(VEHICLE_CATALOG.map((entry) => [entry.id, toProfile(entry)])));

export function searchVehicleCatalog(query = "") {
  const normalized = String(query || "").trim().toLocaleLowerCase();
  if (!normalized) return Object.values(VEHICLE_PROFILES);
  const terms = normalized.split(/\s+/).filter(Boolean);
  return Object.values(VEHICLE_PROFILES).filter((profile) => {
    const haystack = [profile.manufacturer, profile.model, profile.variant, profile.bodyType, profile.name]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

function getRequestedProfileId() {
  const queryValue = (readQueryParam(PROFILE_QUERY_PARAM) || "").trim();
  if (queryValue) return queryValue;
  if (ENV_PROFILE_ID) return ENV_PROFILE_ID;
  return DEFAULT_VEHICLE_PROFILE_ID;
}

export function resolveVehicleProfile(profileId = "") {
  const requestedId = String(profileId || "").trim() || getRequestedProfileId();
  return VEHICLE_PROFILES[requestedId] || VEHICLE_PROFILES[DEFAULT_VEHICLE_PROFILE_ID];
}

export function getVehicleProfileOptions() {
  return Object.values(VEHICLE_PROFILES).map((profile) => ({ id: profile.id, name: profile.name }));
}
