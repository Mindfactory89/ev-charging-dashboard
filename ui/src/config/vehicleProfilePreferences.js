import { getWindow, readQueryParam } from "../platform/runtime.js";
import {
  DEFAULT_VEHICLE_PROFILE_ID,
  VEHICLE_PROFILES,
} from "./vehicleProfiles.js";
import { isSafeVehicleImageDataUrl } from "../ui/vehicleImage.js";

export const CUSTOM_VEHICLE_PROFILES_STORAGE_KEY = "mobility.customVehicleProfiles.v1";
export const ACTIVE_VEHICLE_PROFILE_STORAGE_KEY = "mobility.activeVehicleProfile.v1";
export const VEHICLE_PROFILE_IMAGES_STORAGE_KEY = "mobility.vehicleProfileImages.v1";

function storageTarget(target) {
  if (target?.localStorage) return target.localStorage;
  return target || getWindow()?.localStorage || null;
}

function cleanText(value, maxLength = 80) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function optionalNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function decimalLabel(value) {
  return Number(value).toFixed(1).replace(".", ",");
}

export function validateVehicleProfileDraft(profile = {}) {
  const errors = {};
  const name = cleanText(profile.name);
  const batteryKwh = optionalNumber(profile.batteryKwh);
  const consumptionKwhPer100Km = optionalNumber(profile.consumptionKwhPer100Km);
  const chargingPowerKw = optionalNumber(profile.chargingPowerKw);

  if (!name) errors.name = "name";
  if (batteryKwh == null || batteryKwh < 10 || batteryKwh > 300) errors.batteryKwh = "battery";
  if (consumptionKwhPer100Km == null || consumptionKwhPer100Km < 5 || consumptionKwhPer100Km > 60) {
    errors.consumptionKwhPer100Km = "consumption";
  }
  if (chargingPowerKw != null && (chargingPowerKw < 1 || chargingPowerKw > 1000)) {
    errors.chargingPowerKw = "power";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

function cleanCustomProfile(profile) {
  const id = cleanText(profile?.id);
  const name = cleanText(profile?.name);
  if (!id || !name) return null;
  const batteryKwh = optionalNumber(profile?.batteryKwh);
  const consumptionKwhPer100Km = optionalNumber(profile?.consumptionKwhPer100Km);
  const chargingPowerKw = optionalNumber(profile?.chargingPowerKw);
  const validation = validateVehicleProfileDraft({ name, batteryKwh, consumptionKwhPer100Km, chargingPowerKw });
  if (!validation.valid) return null;

  return {
    id,
    name,
    catalogId: cleanText(profile?.catalogId),
    manufacturer: cleanText(profile?.manufacturer, 60),
    model: cleanText(profile?.model, 80),
    variant: cleanText(profile?.variant, 80),
    modelYear: optionalNumber(profile?.modelYear),
    bodyType: cleanText(profile?.bodyType, 30) || "other",
    sessionVehicleName: cleanText(profile?.sessionVehicleName) || name,
    batteryKwh: Number(batteryKwh.toFixed(1)),
    consumptionKwhPer100Km: Number(consumptionKwhPer100Km.toFixed(1)),
    chargingPowerKw: chargingPowerKw == null ? null : Number(chargingPowerKw.toFixed(0)),
    updatedAt: cleanText(profile?.updatedAt) || new Date().toISOString(),
  };
}

function readVehicleProfileImages(target) {
  try {
    const raw = storageTarget(target)?.getItem?.(VEHICLE_PROFILE_IMAGES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([id, value]) => cleanText(id) && isSafeVehicleImageDataUrl(value))
    );
  } catch {
    return {};
  }
}

function writeVehicleProfileImages(images, target) {
  const cleaned = Object.fromEntries(
    Object.entries(images || {}).filter(([id, value]) => cleanText(id) && isSafeVehicleImageDataUrl(value))
  );
  try {
    storageTarget(target)?.setItem?.(VEHICLE_PROFILE_IMAGES_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    return false;
  }
  return true;
}

function toDisplayProfile(profile, target) {
  const clean = cleanCustomProfile(profile);
  if (!clean) return null;
  const imageSrc = readVehicleProfileImages(target)[clean.id] || "";
  const specs = [
    { id: "custom", label: clean.sessionVehicleName, icon: "trim" },
    clean.chargingPowerKw ? { id: "power", label: `${clean.chargingPowerKw} kW`, icon: "power" } : null,
    { id: "battery", label: `${decimalLabel(clean.batteryKwh)} kWh`, icon: "battery", accent: true },
    { id: "consumption", label: `${decimalLabel(clean.consumptionKwhPer100Km)} kWh/100 km`, icon: "consumption" },
  ].filter(Boolean);
  return {
    ...clean,
    isCustom: true,
    isCatalog: false,
    imageSrc,
    imageAlt: clean.name,
    imageSource: imageSrc ? "user" : "fallback",
    fallbackLabel: clean.name,
    fallbackHint: `${decimalLabel(clean.batteryKwh)} kWh · ${decimalLabel(clean.consumptionKwhPer100Km)} kWh/100 km`,
    sectionKicker: "Fahrzeugprofil",
    specs,
  };
}

export function getBuiltInVehicleProfiles() {
  return Object.values(VEHICLE_PROFILES).map((profile) => ({ ...profile, isCustom: false, isCatalog: true }));
}

export function readCustomVehicleProfiles(target) {
  try {
    const raw = storageTarget(target)?.getItem?.(CUSTOM_VEHICLE_PROFILES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(cleanCustomProfile).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function writeCustomVehicleProfiles(profiles, target) {
  const cleaned = (Array.isArray(profiles) ? profiles : []).map(cleanCustomProfile).filter(Boolean);
  try {
    storageTarget(target)?.setItem?.(CUSTOM_VEHICLE_PROFILES_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Local storage may be unavailable in restricted browser contexts.
  }
  return cleaned;
}

export function getAvailableVehicleProfiles(target) {
  return [
    ...getBuiltInVehicleProfiles(),
    ...readCustomVehicleProfiles(target).map((profile) => toDisplayProfile(profile, target)).filter(Boolean),
  ];
}

export function readActiveVehicleProfileId(target, profiles = getAvailableVehicleProfiles(target)) {
  const explicitQueryId = target ? "" : cleanText(readQueryParam("vehicle"));
  let storedId = "";
  try {
    storedId = cleanText(storageTarget(target)?.getItem?.(ACTIVE_VEHICLE_PROFILE_STORAGE_KEY));
  } catch {}
  const candidate = explicitQueryId || storedId || DEFAULT_VEHICLE_PROFILE_ID;
  return profiles.some((profile) => profile.id === candidate) ? candidate : DEFAULT_VEHICLE_PROFILE_ID;
}

export function readVehicleProfileState(target) {
  const profiles = getAvailableVehicleProfiles(target);
  const activeProfileId = readActiveVehicleProfileId(target, profiles);
  return {
    profiles,
    activeProfileId,
    activeProfile: profiles.find((profile) => profile.id === activeProfileId) || profiles[0],
  };
}

export function setActiveVehicleProfile(profileId, target) {
  const profiles = getAvailableVehicleProfiles(target);
  const nextId = profiles.some((profile) => profile.id === profileId) ? profileId : DEFAULT_VEHICLE_PROFILE_ID;
  try {
    storageTarget(target)?.setItem?.(ACTIVE_VEHICLE_PROFILE_STORAGE_KEY, nextId);
  } catch {}
  return readVehicleProfileState(target);
}

export function saveCustomVehicleProfile(profile, profiles = null, target, options = {}) {
  const id = cleanText(profile?.id) || `vehicle-${Date.now()}`;
  const cleaned = cleanCustomProfile({ ...profile, id, updatedAt: new Date().toISOString() });
  if (!cleaned) return { profile: null, profiles: readCustomVehicleProfiles(target) };
  const current = Array.isArray(profiles) ? profiles.map(cleanCustomProfile).filter(Boolean) : readCustomVehicleProfiles(target);
  const next = [...current.filter((entry) => entry.id !== id), cleaned].sort((left, right) => left.name.localeCompare(right.name));
  const writtenProfiles = writeCustomVehicleProfiles(next, target);
  let imageSaved = true;
  if (options.allowImages !== false && Object.prototype.hasOwnProperty.call(profile || {}, "imageDataUrl")) {
    const images = readVehicleProfileImages(target);
    if (isSafeVehicleImageDataUrl(profile.imageDataUrl)) images[id] = profile.imageDataUrl;
    else delete images[id];
    imageSaved = writeVehicleProfileImages(images, target);
  }
  return { profile: toDisplayProfile(cleaned, target), profiles: writtenProfiles, imageSaved };
}

export function deleteCustomVehicleProfile(profileId, target) {
  let wasActive = false;
  try {
    wasActive = storageTarget(target)?.getItem?.(ACTIVE_VEHICLE_PROFILE_STORAGE_KEY) === profileId;
  } catch {}
  const next = writeCustomVehicleProfiles(
    readCustomVehicleProfiles(target).filter((profile) => profile.id !== profileId),
    target
  );
  const images = readVehicleProfileImages(target);
  delete images[profileId];
  writeVehicleProfileImages(images, target);
  let state = readVehicleProfileState(target);
  if (wasActive) state = setActiveVehicleProfile(DEFAULT_VEHICLE_PROFILE_ID, target);
  return { profiles: next, state };
}

export function getVehicleReferenceConsumption(vehicleName, target) {
  const state = readVehicleProfileState(target);
  const normalizedName = cleanText(vehicleName).toLocaleLowerCase();
  const matched = normalizedName
    ? state.profiles.find((profile) => [profile.name, profile.sessionVehicleName].some((name) => cleanText(name).toLocaleLowerCase() === normalizedName))
    : state.activeProfile;
  return Number(matched?.consumptionKwhPer100Km) || 17.2;
}
