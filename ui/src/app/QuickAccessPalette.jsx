import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { datumDE, euro, num } from "./formatters.js";
import { buildQuickAccessResults } from "../ui/quickAccess.js";

function ResultIcon({ type, id }) {
  if (type === "session") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" />
        <path d="m13 12-2 3h3l-2 3" />
      </svg>
    );
  }

  if (id === "add") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
  if (id === "notifications") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17h12l-1.4-2.1V10a4.6 4.6 0 0 0-9.2 0v4.9L6 17ZM10 20h4" /></svg>;
  if (id === "goals") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="m14 10 5-5" /></svg>;
  if (id === "data") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 20h14" /></svg>;
  if (id === "vehicles") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 15 1.5-5h11l1.5 5M4 15h16v4H4v-4Z" /><circle cx="7" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></svg>;
  if (id === "analysis") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2" /></svg>;
  if (id === "history") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2M5 5a9 9 0 1 1-2 7M3 5v5h5" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></svg>;
}

export default function QuickAccessPalette({ actions = [], onClose, onSelectSession, open = false, sessions = [], year }) {
  const { t } = useI18n();
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const panelRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const listId = React.useId();
  const results = React.useMemo(
    () => buildQuickAccessResults({ actions, sessions, query }),
    [actions, query, sessions]
  );
  const flatResults = React.useMemo(() => [...results.actions, ...results.sessions], [results]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus?.(), 30);

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(panelRef.current?.querySelectorAll?.('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, [onClose, open]);

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open) return null;

  function selectResult(result) {
    if (!result) return;
    onClose?.();
    window.requestAnimationFrame(() => {
      if (result.resultType === "session") onSelectSession?.(result.session);
      else result.run?.();
    });
  }

  function onInputKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => flatResults.length ? (current + 1) % flatResults.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => flatResults.length ? (current - 1 + flatResults.length) % flatResults.length : 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectResult(flatResults[activeIndex]);
    }
  }

  function renderAction(result, index) {
    const selected = index === activeIndex;
    return (
      <button
        key={result.resultId}
        id={`${listId}-${index}`}
        type="button"
        tabIndex={-1}
        className={selected ? "quickAccessResult active" : "quickAccessResult"}
        role="option"
        aria-selected={selected}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => selectResult(result)}
      >
        <span className="quickAccessResultIcon"><ResultIcon id={result.id} type="action" /></span>
        <span className="quickAccessResultCopy"><strong>{result.label}</strong><small>{result.description}</small></span>
        {result.shortcut ? <kbd>{result.shortcut}</kbd> : <span className="quickAccessArrow" aria-hidden="true">→</span>}
      </button>
    );
  }

  function renderSession(result, offset) {
    const index = offset;
    const session = result.session;
    const selected = index === activeIndex;
    const title = session?.provider || session?.location || session?.connector || t("quickAccess.sessionFallback");
    const context = [session?.location, session?.vehicle].filter(Boolean).join(" • ") || t("quickAccess.sessionContextFallback");
    return (
      <button
        key={result.resultId}
        id={`${listId}-${index}`}
        type="button"
        tabIndex={-1}
        className={selected ? "quickAccessResult active" : "quickAccessResult"}
        role="option"
        aria-selected={selected}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => selectResult(result)}
      >
        <span className="quickAccessResultIcon session"><ResultIcon type="session" /></span>
        <span className="quickAccessResultCopy"><strong>{title}</strong><small>{datumDE(session?.date)} • {context}</small></span>
        <span className="quickAccessSessionMetric">{num(session?.energy_kwh, 1)} kWh<small>{euro(session?.total_cost)}</small></span>
      </button>
    );
  }

  return (
    <div className="quickAccessOverlay" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section
        className="quickAccessPalette"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-access-title"
      >
        <header className="quickAccessHeader">
          <div>
            <div className="sectionKicker">{t("quickAccess.eyebrow")}</div>
            <h2 id="quick-access-title">{t("quickAccess.title")}</h2>
          </div>
          <button type="button" className="quickAccessClose" onClick={onClose} aria-label={t("quickAccess.close")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <div className="quickAccessSearch">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded="true"
            aria-activedescendant={flatResults[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={t("quickAccess.placeholder")}
            aria-label={t("quickAccess.searchLabel")}
          />
          <kbd>ESC</kbd>
        </div>

        <div className="quickAccessResults" id={listId} role="listbox" aria-label={t("quickAccess.resultsLabel")}>
          {results.actions.length ? (
            <section className="quickAccessGroup" aria-labelledby="quick-access-actions">
              <h3 id="quick-access-actions">{query ? t("quickAccess.matches") : t("quickAccess.actions")}</h3>
              {results.actions.map(renderAction)}
            </section>
          ) : null}
          {results.sessions.length ? (
            <section className="quickAccessGroup" aria-labelledby="quick-access-sessions">
              <h3 id="quick-access-sessions">{query ? t("quickAccess.sessionsFound") : t("quickAccess.recentSessions", { year })}</h3>
              {results.sessions.map((result, index) => renderSession(result, results.actions.length + index))}
            </section>
          ) : null}
          {!results.total ? (
            <div className="quickAccessEmpty">
              <strong>{t("quickAccess.emptyTitle")}</strong>
              <span>{t("quickAccess.emptyText")}</span>
            </div>
          ) : null}
        </div>

        <footer className="quickAccessFooter">
          <span><kbd>↑</kbd><kbd>↓</kbd> {t("quickAccess.navigateHint")}</span>
          <span><kbd>↵</kbd> {t("quickAccess.openHint")}</span>
          <span>{t("quickAccess.scope", { year })}</span>
        </footer>
      </section>
    </div>
  );
}
