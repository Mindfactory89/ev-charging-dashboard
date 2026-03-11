import MonthlyChart from "../../ui/MonthlyChart.jsx";

export default function MonthlyPanel({ activeMonths, monthlyCsvUrl, monthlySorted, onDownloadMonthlyCsv, year }) {
  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">Monate</div>
            <div className="sectionTitle sectionTitleSpaced">Monatsauswertung ({year})</div>
          </div>

          <button
            type="button"
            className="pill pillWarm"
            onClick={onDownloadMonthlyCsv}
            style={{ cursor: monthlyCsvUrl ? "pointer" : "not-allowed" }}
            aria-label="Monthly CSV herunterladen"
            title="Monthly CSV herunterladen"
            disabled={!monthlyCsvUrl}
          >
            Monthly CSV ↓
          </button>
        </div>

        <div className="chartPanel">
          {activeMonths.length ? (
            <MonthlyChart months={monthlySorted} />
          ) : (
            <div className="emptyStateCard">Keine Monatswerte für {year} vorhanden.</div>
          )}
        </div>
      </div>
    </section>
  );
}
