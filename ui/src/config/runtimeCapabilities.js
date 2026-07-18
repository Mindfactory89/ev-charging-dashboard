import { isDemoMode } from "../ui/apiRuntime.js";

export function getRuntimeCapabilities(demo = isDemoMode) {
  const demoMode = Boolean(demo);
  return Object.freeze({
    demo: demoMode,
    canUploadVehicleImage: !demoMode,
    canInstallRelease: !demoMode,
    canPersistServerProfiles: !demoMode,
  });
}
