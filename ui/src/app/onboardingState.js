export const ONBOARDING_STORAGE_KEY = "mobility-dashboard-onboarding-v1";

function getWindow(win) {
  return win ?? (typeof window !== "undefined" ? window : null);
}

export function readOnboardingState(win) {
  const target = getWindow(win);
  if (!target) return { status: "completed", completedAt: null };

  try {
    const stored = JSON.parse(target.localStorage?.getItem(ONBOARDING_STORAGE_KEY) || "null");
    if (stored?.status === "completed") {
      return {
        status: "completed",
        completedAt: typeof stored.completedAt === "string" ? stored.completedAt : null,
      };
    }
  } catch {}

  return { status: "new", completedAt: null };
}

export function shouldShowOnboarding(win) {
  const target = getWindow(win);
  if (!target) return false;

  try {
    const params = new URLSearchParams(target.location?.search || "");
    if (params.get("onboarding") === "1") return true;
  } catch {}

  return readOnboardingState(target).status !== "completed";
}

function removeReplayParameter(target) {
  try {
    const params = new URLSearchParams(target.location?.search || "");
    if (!params.has("onboarding")) return;
    params.delete("onboarding");
    const query = params.toString();
    const nextUrl = `${target.location.pathname || "/"}${query ? `?${query}` : ""}${target.location.hash || ""}`;
    target.history?.replaceState?.({ mobilityDashboard: true }, "", nextUrl);
  } catch {}
}

export function completeOnboarding(win, completedAt = new Date().toISOString()) {
  const target = getWindow(win);
  if (!target) return;

  try {
    target.localStorage?.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({ status: "completed", completedAt })
    );
  } catch {}

  removeReplayParameter(target);
}

export function resetOnboarding(win) {
  const target = getWindow(win);
  try {
    target?.localStorage?.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {}
}
