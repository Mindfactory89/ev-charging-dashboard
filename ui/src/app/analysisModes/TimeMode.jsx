import Charts from "../../ui/Charts.jsx";
import ForecastCard from "../../ui/ForecastCard.jsx";
import MonthlyReportCard from "../../ui/MonthlyReportCard.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import MonthlyPanel from "../panels/MonthlyPanel.jsx";
import PricePanel from "../panels/PricePanel.jsx";
import SeasonPanel from "../panels/SeasonPanel.jsx";

export default function TimeMode({
  monthlyCsvUrl,
  monthlySorted,
  onDownloadMonthlyCsv,
  onDownloadSeasonCsv,
  priceSummary,
  seasonRows,
  seasons,
  seasonsCsvUrl,
  sessions,
  year,
}) {
  const { t } = useI18n();

  return (
    <>
      <MonthlyReportCard months={monthlySorted} sessions={sessions} year={year} />
      <ForecastCard months={monthlySorted} year={year} />
      <SeasonPanel
        onDownloadSeasonCsv={onDownloadSeasonCsv}
        seasonRows={seasonRows}
        seasons={seasons}
        seasonsCsvUrl={seasonsCsvUrl}
        year={year}
      />
      <PricePanel priceSummary={priceSummary} year={year} />
      <MonthlyPanel
        activeMonths={monthlySorted.filter((month) => Number(month?.count || 0) > 0)}
        monthlyCsvUrl={monthlyCsvUrl}
        monthlySorted={monthlySorted}
        onDownloadMonthlyCsv={onDownloadMonthlyCsv}
        year={year}
      />
      <section className="row">
        {sessions.length ? (
          <Charts sessions={sessions} />
        ) : (
          <div className="card glassStrong">
            <div className="emptyStateCard">{t("timeMode.historyEmpty", { year })}</div>
          </div>
        )}
      </section>
    </>
  );
}
