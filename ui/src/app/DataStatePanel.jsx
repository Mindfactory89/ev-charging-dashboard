function StateIcon({ kind }) {
  if (kind === "loading") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 8 8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8v5m0 3.5v.1M10.3 4.8 3.5 17a2 2 0 0 0 1.8 3h13.4a2 2 0 0 0 1.8-3L13.7 4.8a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

export default function DataStatePanel({ actionLabel, details, kind = "error", message, onAction, title }) {
  const isLoading = kind === "loading";

  return (
    <section
      className={`dataStatePanel ${kind}`}
      role={isLoading ? "status" : "alert"}
      aria-live={isLoading ? "polite" : "assertive"}
    >
      <span className="dataStateIcon"><StateIcon kind={kind} /></span>
      <div className="dataStateCopy">
        <strong>{title}</strong>
        <p>{message}</p>
        {details ? (
          <details>
            <summary>{details.label}</summary>
            <pre>{details.content}</pre>
          </details>
        ) : null}
      </div>
      {onAction && actionLabel ? (
        <button type="button" className="pill pillWarm" onClick={onAction} disabled={isLoading}>
          {actionLabel}
        </button>
      ) : null}
      {isLoading ? <span className="dataStatePulse" aria-hidden="true" /> : null}
    </section>
  );
}
