import React from "react";
import {
  RUNTIME_CONFIRM_EVENT,
  RUNTIME_TOAST_EVENT,
  RUNTIME_UI_READY_KEY,
  getWindow,
} from "../platform/runtime.js";

const DEFAULT_TOAST_DURATION_MS = 4200;

function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeToast(detail = {}) {
  const message = String(detail?.message || "").trim();
  if (!message) return null;

  return {
    id: String(detail?.id || nextId("runtime-toast")),
    message,
    title: String(detail?.title || "").trim(),
    tone: String(detail?.tone || "neutral").trim() || "neutral",
    durationMs: Number(detail?.durationMs) > 0 ? Number(detail.durationMs) : DEFAULT_TOAST_DURATION_MS,
  };
}

function normalizeConfirm(detail = {}) {
  const message = String(detail?.message || "").trim();
  if (!message || typeof detail?.resolve !== "function") return null;

  return {
    id: String(detail?.id || nextId("runtime-confirm")),
    title: String(detail?.title || "").trim() || "Aktion bestätigen",
    message,
    tone: String(detail?.tone || "neutral").trim() || "neutral",
    confirmLabel: String(detail?.confirmLabel || "").trim() || "Bestätigen",
    cancelLabel: String(detail?.cancelLabel || "").trim() || "Abbrechen",
    resolve: detail.resolve,
  };
}

export default function RuntimeFeedbackHost() {
  const [toasts, setToasts] = React.useState([]);
  const [confirmQueue, setConfirmQueue] = React.useState([]);
  const currentConfirm = confirmQueue[0] || null;
  const primaryButtonRef = React.useRef(null);

  const dismissToast = React.useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const settleConfirm = React.useCallback((accepted) => {
    setConfirmQueue((current) => {
      if (!current.length) return current;
      const [active, ...rest] = current;
      try {
        active.resolve(Boolean(accepted));
      } catch {
        // Ignore consumer errors while settling the dialog.
      }
      return rest;
    });
  }, []);

  React.useEffect(() => {
    const win = getWindow();
    if (!win) return undefined;
    win[RUNTIME_UI_READY_KEY] = true;

    function onToast(event) {
      const toast = normalizeToast(event?.detail);
      if (!toast) return;
      setToasts((current) => [...current.filter((entry) => entry.id !== toast.id), toast].slice(-4));
    }

    function onConfirm(event) {
      const dialog = normalizeConfirm(event?.detail);
      if (!dialog) return;
      setConfirmQueue((current) => [...current, dialog]);
    }

    win.addEventListener(RUNTIME_TOAST_EVENT, onToast);
    win.addEventListener(RUNTIME_CONFIRM_EVENT, onConfirm);
    return () => {
      win[RUNTIME_UI_READY_KEY] = false;
      win.removeEventListener(RUNTIME_TOAST_EVENT, onToast);
      win.removeEventListener(RUNTIME_CONFIRM_EVENT, onConfirm);
    };
  }, []);

  React.useEffect(() => {
    if (!toasts.length) return undefined;
    const timers = toasts.map((toast) => window.setTimeout(() => dismissToast(toast.id), toast.durationMs));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [dismissToast, toasts]);

  React.useEffect(() => {
    if (!currentConfirm || typeof document === "undefined") return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => primaryButtonRef.current?.focus?.(), 30);

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        settleConfirm(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [currentConfirm, settleConfirm]);

  return (
    <>
      <div className="runtimeToastStack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`runtimeToast runtimeToast-${toast.tone}`}>
            <div className="runtimeToastCopy">
              {toast.title ? <div className="runtimeToastTitle">{toast.title}</div> : null}
              <div className="runtimeToastMessage">{toast.message}</div>
            </div>
            <button type="button" className="runtimeToastClose" onClick={() => dismissToast(toast.id)} aria-label="Hinweis schließen">
              Schließen
            </button>
          </div>
        ))}
      </div>

      {currentConfirm ? (
        <div className="runtimeDialogOverlay" role="presentation" onClick={() => settleConfirm(false)}>
          <aside
            className={`runtimeDialog runtimeDialog-${currentConfirm.tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`runtime-dialog-title-${currentConfirm.id}`}
            aria-describedby={`runtime-dialog-message-${currentConfirm.id}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="runtimeDialogHeader">
              <div className="sectionKicker">Bestätigung</div>
              <div className="runtimeDialogTitle" id={`runtime-dialog-title-${currentConfirm.id}`}>
                {currentConfirm.title}
              </div>
            </div>

            <div className="runtimeDialogMessage" id={`runtime-dialog-message-${currentConfirm.id}`}>
              {currentConfirm.message}
            </div>

            <div className="runtimeDialogActions">
              <button type="button" className="pill ghostPill" onClick={() => settleConfirm(false)}>
                {currentConfirm.cancelLabel}
              </button>
              <button
                type="button"
                className="pill pillWarm"
                onClick={() => settleConfirm(true)}
                ref={primaryButtonRef}
              >
                {currentConfirm.confirmLabel}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
