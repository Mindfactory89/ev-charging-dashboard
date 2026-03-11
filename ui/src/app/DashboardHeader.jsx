import { YEARS } from "./constants.js";
import { datumDE, num } from "./formatters.js";

export default function DashboardHeader({
  dashboardTitle,
  demo,
  latestSession,
  loading,
  sessionsCount,
  year,
  onSelectYear,
}) {
  return (
    <header className="topBar topBarPremium">
      <div className="topLeft premiumTopCopy">
        <div className="kicker">Cupra Charging Intelligence</div>
        <h1 className="title">{dashboardTitle}</h1>
        <div className="sub">Ein ruhiges Charging-Cockpit mit Fokus auf Verlauf, Preisniveau und Ladequalität.</div>

        {demo ? (
          <div className="demoBanner" role="status" aria-live="polite">
            <div className="demoBannerLeft">
              <span className="demoPill">DEMO</span>
              <span className="demoText">Demo-Daten aktiv – keine Speicherung, keine API/DB</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="premiumTopControls">
        <div className="filters premiumYearRail">
          <div className="chipLabel">Jahr</div>
          <div className="chipRow">
            {YEARS.map((itemYear) => (
              <button
                key={itemYear}
                type="button"
                className={year === itemYear ? "chip" : "chip ghost"}
                onClick={() => onSelectYear(itemYear)}
              >
                {itemYear}
              </button>
            ))}
          </div>
        </div>

        <div className="premiumHeaderMeta">
          <div className="pill ghostPill">{loading ? "Synchronisiert…" : `${num(sessionsCount, 0)} Sessions`}</div>
          <div className="pill ghostPill">
            {latestSession?.date ? `Zuletzt ${datumDE(latestSession.date)}` : `Jahr ${year}`}
          </div>
        </div>
      </div>
    </header>
  );
}
