import { readQueryParam } from "../platform/runtime.js";

const PROFILE_QUERY_PARAM = "vehicle";
const DEFAULT_PROFILE_ID = "cupra-born";
const ENV_PROFILE_ID = (import.meta.env.VITE_VEHICLE_PROFILE || "").trim();

export const VEHICLE_PROFILES = {
  "cupra-born": {
    id: "cupra-born",
    name: "Cupra Born",
    imageSrc: "/cupra-hero.png",
    imageAlt: "Cupra Born",
    fallbackLabel: "Hero-Bild",
    sectionKicker: "Fahrzeugprofil",
    specs: [
      { id: "trim", label: "Edition Dynamic", icon: "trim" },
      { id: "power", label: "170 kW", icon: "power" },
      { id: "horsepower", label: "231 PS", icon: "horsepower" },
      { id: "battery", label: "79 kWh", icon: "battery", accent: true },
    ],
  },
  "generic-ev": {
    id: "generic-ev",
    name: "eMobility Vehicle",
    imageSrc: "",
    imageAlt: "Electric vehicle",
    fallbackLabel: "Hero-Asset konfigurieren",
    sectionKicker: "Fahrzeugprofil",
    specs: [
      { id: "profile", label: "Profil frei", icon: "trim" },
      { id: "power-free", label: "Leistung frei", icon: "power" },
      { id: "battery-free", label: "Akku frei", icon: "battery", accent: true },
    ],
  },
};

function getRequestedProfileId() {
  const queryValue = (readQueryParam(PROFILE_QUERY_PARAM) || "").trim();
  if (queryValue) return queryValue;

  if (ENV_PROFILE_ID) return ENV_PROFILE_ID;
  return DEFAULT_PROFILE_ID;
}

export function resolveVehicleProfile() {
  const requestedId = getRequestedProfileId();
  return VEHICLE_PROFILES[requestedId] || VEHICLE_PROFILES[DEFAULT_PROFILE_ID];
}

export function getVehicleProfileOptions() {
  return Object.values(VEHICLE_PROFILES).map((profile) => ({
    id: profile.id,
    name: profile.name,
  }));
}
