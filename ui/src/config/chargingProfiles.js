import { getWindow } from "../platform/runtime.js";

export const CHARGING_PROFILES_STORAGE_KEY = "mobility.chargingProfiles.v1";
export const MAX_CHARGING_PROFILES = 8;

const DEFAULT_PROFILE = Object.freeze({
  id: "home-default",
  name: "Zuhause",
  context: "home",
  energySource: "grid",
  tariffType: "fixed",
  basePrice: 0.32,
  peakPrice: 0.42,
  offPeakPrice: 0.25,
  offPeakStart: "22:00",
  offPeakEnd: "06:00",
  windowStart: "22:00",
  windowEnd: "06:00",
  pvShare: 0,
  provider: "",
});

function storageTarget(target) {
  if (target?.localStorage) return target.localStorage;
  return target || getWindow()?.localStorage || null;
}

function numberInRange(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

function cleanTime(value, fallback) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : fallback;
}

function cleanId(value, fallback = "") {
  return String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

export function normalizeChargingProfile(value, fallbackId = "") {
  const source = value && typeof value === "object" ? value : {};
  const id = cleanId(source.id, fallbackId) || `profile-${Date.now()}`;
  return {
    id,
    name: String(source.name || "").trim().slice(0, 48) || "Ladeprofil",
    context: ["home", "public"].includes(source.context) ? source.context : "home",
    energySource: ["grid", "pv", "mixed"].includes(source.energySource) ? source.energySource : "grid",
    tariffType: ["fixed", "timeOfUse"].includes(source.tariffType) ? source.tariffType : "fixed",
    basePrice: numberInRange(source.basePrice, 0, 5, 0.32),
    peakPrice: numberInRange(source.peakPrice, 0, 5, 0.42),
    offPeakPrice: numberInRange(source.offPeakPrice, 0, 5, 0.25),
    offPeakStart: cleanTime(source.offPeakStart, "22:00"),
    offPeakEnd: cleanTime(source.offPeakEnd, "06:00"),
    windowStart: cleanTime(source.windowStart, "22:00"),
    windowEnd: cleanTime(source.windowEnd, "06:00"),
    pvShare: numberInRange(source.pvShare, 0, 100, 0),
    provider: String(source.provider || "").trim().slice(0, 80),
  };
}

function cleanState(value) {
  const rawProfiles = Array.isArray(value?.profiles) ? value.profiles : [];
  const profiles = rawProfiles.slice(0, MAX_CHARGING_PROFILES).map((profile, index) => normalizeChargingProfile(profile, `profile-${index + 1}`));
  const uniqueProfiles = Array.from(new Map(profiles.map((profile) => [profile.id, profile])).values());
  const activeProfileId = uniqueProfiles.some((profile) => profile.id === value?.activeProfileId)
    ? value.activeProfileId
    : uniqueProfiles[0]?.id || null;
  return { profiles: uniqueProfiles, activeProfileId, activeProfile: uniqueProfiles.find((profile) => profile.id === activeProfileId) || null };
}

export function readChargingProfileState(target) {
  try {
    const raw = storageTarget(target)?.getItem?.(CHARGING_PROFILES_STORAGE_KEY);
    return raw ? cleanState(JSON.parse(raw)) : cleanState({ profiles: [DEFAULT_PROFILE], activeProfileId: DEFAULT_PROFILE.id });
  } catch {
    return cleanState({ profiles: [DEFAULT_PROFILE], activeProfileId: DEFAULT_PROFILE.id });
  }
}

function writeState(state, target) {
  const cleaned = cleanState(state);
  try {
    storageTarget(target)?.setItem?.(CHARGING_PROFILES_STORAGE_KEY, JSON.stringify({
      profiles: cleaned.profiles,
      activeProfileId: cleaned.activeProfileId,
    }));
  } catch {
    // Keep profiles usable in memory when browser storage is unavailable.
  }
  return cleaned;
}

export function saveChargingProfile(draft, target) {
  const current = readChargingProfileState(target);
  const requestedId = cleanId(draft?.id);
  const profile = normalizeChargingProfile(draft, requestedId || `profile-${Date.now()}`);
  const existingIndex = current.profiles.findIndex((item) => item.id === profile.id);
  const profiles = existingIndex >= 0
    ? current.profiles.map((item) => item.id === profile.id ? profile : item)
    : [...current.profiles, profile].slice(-MAX_CHARGING_PROFILES);
  return { profile, state: writeState({ profiles, activeProfileId: profile.id }, target) };
}

export function setActiveChargingProfile(profileId, target) {
  const current = readChargingProfileState(target);
  return writeState({ ...current, activeProfileId: profileId }, target);
}

export function deleteChargingProfile(profileId, target) {
  const current = readChargingProfileState(target);
  const profiles = current.profiles.filter((profile) => profile.id !== profileId);
  return writeState({ profiles, activeProfileId: current.activeProfileId === profileId ? profiles[0]?.id : current.activeProfileId }, target);
}

function minutes(time) {
  const [hours, mins] = String(time || "00:00").split(":").map(Number);
  return hours * 60 + mins;
}

export function isTimeInWindow(time, start, end) {
  const current = minutes(time);
  const from = minutes(start);
  const to = minutes(end);
  return from <= to ? current >= from && current < to : current >= from || current < to;
}

export function priceForChargingProfile(profile, date = new Date()) {
  if (!profile) return null;
  if (profile.tariffType !== "timeOfUse") return Number(profile.basePrice);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return isTimeInWindow(time, profile.offPeakStart, profile.offPeakEnd)
    ? Number(profile.offPeakPrice)
    : Number(profile.peakPrice);
}

export function addSessionDefaultsForChargingProfile(profile, date = new Date()) {
  if (!profile) return {};
  const price = priceForChargingProfile(profile, date);
  return {
    connector: profile.context === "home" ? "Wallbox AC" : "CCS - DC",
    location: profile.context === "home" ? "Zuhause" : "",
    provider: profile.provider,
    pricePerKwh: Number.isFinite(price) ? price.toFixed(3).replace(".", ",") : "",
    tags: [profile.context, profile.energySource === "pv" ? "pv" : profile.energySource === "mixed" ? "pv-mix" : null].filter(Boolean).join(", "),
  };
}
