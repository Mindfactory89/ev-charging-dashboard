import { useI18n } from "../../i18n/I18nProvider.jsx";
import MonthlyChart from "../../ui/MonthlyChart.jsx";

export default function MonthlyPanel({ activeMonths, monthlyCsvUrl, monthlySorted, onDownloadMonthlyCsv, year }) {
  const { t } = useI18n();

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">{t("monthlyPanel.kicker")}</div>
            <div className="sectionTitle sectionTitleSpaced">{t("monthlyPanel.title", { year })}</div>
          </div>

          <button
            type="button"
            className="pill pillWarm"
            onClick={onDownloadMonthlyCsv}
            style={{ cursor: monthlyCsvUrl ? "pointer" : "not-allowed" }}
            aria-label={t("monthlyPanel.downloadLabel")}
            title={t("monthlyPanel.downloadTitle")}
            disabled={!monthlyCsvUrl}
          >
            {t("monthlyPanel.downloadButton")}
          </button>
        </div>

        <div className="chartPanel monthlyPanelChartPanel">
          {activeMonths.length ? (
            <MonthlyChart months={monthlySorted} />
          ) : (
            <div className="emptyStateCard">{t("monthlyPanel.empty", { year })}</div>
          )}
        </div>
      </div>
    </section>
  );
}
