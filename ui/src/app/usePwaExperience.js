import { useCallback, useEffect, useRef, useState } from "react";
import {
  activateWaitingServiceWorker,
  isStandalonePwa,
  readPwaRuntimeState,
  registerMobilityServiceWorker,
  requestPwaInstall,
} from "../platform/pwa.js";

export function usePwaExperience() {
  const initialState = readPwaRuntimeState();
  const [state, setState] = useState({
    ...initialState,
    installAvailable: false,
    updateAvailable: false,
  });
  const installPromptRef = useRef(null);
  const registrationRef = useRef(null);
  const reloadOnControllerChangeRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return undefined;

    function syncConnection() {
      setState((current) => ({ ...current, online: navigator.onLine !== false }));
    }

    function onBeforeInstallPrompt(event) {
      event.preventDefault();
      installPromptRef.current = event;
      setState((current) => ({ ...current, installAvailable: !current.installed }));
    }

    function onInstalled() {
      installPromptRef.current = null;
      setState((current) => ({ ...current, installed: true, installAvailable: false }));
    }

    function onControllerChange() {
      if (reloadOnControllerChangeRef.current) window.location.reload();
    }

    window.addEventListener("online", syncConnection);
    window.addEventListener("offline", syncConnection);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    navigator.serviceWorker?.addEventListener?.("controllerchange", onControllerChange);

    const shouldRegister = Boolean(import.meta.env?.PROD && window.isSecureContext && navigator.serviceWorker);
    if (shouldRegister) {
      registerMobilityServiceWorker().then((registration) => {
        if (!registration) return;
        registrationRef.current = registration;
        if (registration.waiting) {
          setState((current) => ({ ...current, updateAvailable: true }));
        }

        registration.addEventListener?.("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener?.("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setState((current) => ({ ...current, updateAvailable: true }));
            }
          });
        });
      }).catch(() => {
        setState((current) => ({ ...current, supported: false }));
      });
    }

    return () => {
      window.removeEventListener("online", syncConnection);
      window.removeEventListener("offline", syncConnection);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      navigator.serviceWorker?.removeEventListener?.("controllerchange", onControllerChange);
    };
  }, []);

  const install = useCallback(async () => {
    const result = await requestPwaInstall(installPromptRef.current);
    if (result.accepted || result.outcome !== "unavailable") {
      installPromptRef.current = null;
      setState((current) => ({
        ...current,
        installed: result.accepted || isStandalonePwa(),
        installAvailable: false,
      }));
    }
    return result;
  }, []);

  const applyUpdate = useCallback(() => {
    reloadOnControllerChangeRef.current = true;
    const activated = activateWaitingServiceWorker(registrationRef.current);
    if (!activated) window.location.reload();
  }, []);

  return { ...state, install, applyUpdate };
}
