import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { euro, num } from "../app/formatters.js";
import Tooltip from "./Tooltip.jsx";
import { getDashboardBundle } from "./api.js";
import { monthLabel } from "./monthLabels.js";

function deltaMeta(current, previous, digits = 1, suffix = "") {
  const left = Number(current);
  const right = Number(previous);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return { value: "–", tone: "neutral" };

  const diff = left - right;
  const pct = right !== 0 ? (diff / right) * 100 : null;
  const prefix = diff > 0 ? "+" : "";

  return {
    value: `${prefix}${num(diff, digits)}${suffix}${pct != null ? ` • ${prefix}${num(pct, 0)}%` : ""}`,
    tone: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
  };
}

function metricValue(month, mode) {
  if (!month) return 0;
  if (mode === "energy") return Number(month.energy_kwh || 0);
  if (mode === "cost") return Number(month.cost || 0);
  if (mode === "price") return Number(month.price_per_kwh || 0);
  return Number(month.count || 0);
}

function hasMetricValue(month, mode) {
  if (!month) return false;
  if (mode === "price") {
    const price = Number(month.price_per_kwh);
    return Number(month.count || 0) > 0 && Number.isFinite(price) && price > 0;
  }
  return Number(month.count || 0) > 0;
}

function metricLabel(mode, value) {
  if (mode === "energy") return `${num(value, 1)} kWh`;
  if (mode === "cost") return euro(value);
  if (mode === "price") return `${num(value, 3)} €/kWh`;
  return num(value, 0);
}

function metricTitle(mode, t) {
  if (mode === "energy") return t("yearComparison.metricTitles.energy");
  if (mode === "cost") return t("yearComparison.metricTitles.cost");
  if (mode === "price") return t("yearComparison.metricTitles.price");
  return t("yearComparison.metricTitles.sessions");
}

function latestActiveMonthNumber(months) {
  if (!Array.isArray(months)) return null;
  const latest = [...months].reverse().find((month) => Number(month?.count || 0) > 0);
  return latest ? Number(latest.month) : null;
}

async function loadYearBundle(year) {
  return getDashboardBundle(year);
}

function CompareTooltip({ active, payload, label, leftYear, rightYear, mode, t }) {
  if (!active || !payload?.length) return null;
  const left = payload.find((item) => item.dataKey === "leftValue")?.value;
  const right = payload.find((item) => item.dataKey === "rightValue")?.value;
  const leftDelta = Number(left) - Number(right);

  return (
    <div className="chartTooltip">
      <div className="chartTooltipLabel">{label}</div>
      <div className="chartTooltipRow">
        <span className="chartTooltipSwatch copper" />
        <span className="chartTooltipName">{leftYear}</span>
        <span className="chartTooltipValue">{metricLabel(mode, left)}</span>
      </div>
      <div className="chartTooltipRow">
        <span className="chartTooltipSwatch sky" />
        <span className="chartTooltipName">{rightYear}</span>
        <span className="chartTooltipValue">{metricLabel(mode, right)}</span>
      </div>
      <div className="chartTooltipRow">
        <span className="chartTooltipSwatch mint" />
        <span className="chartTooltipName">{t("yearComparison.tooltips.delta")}</span>
        <span className="chartTooltipValue">
          {Number.isFinite(leftDelta)
            ? `${leftDelta > 0 ? "+" : ""}${metricLabel(mode, leftDelta)}`
            : "–"}
        </span>
      </div>
    </div>
  );
}

function FocusTooltip({ active, payload, mode, leftLabel, rightLabel, t }) {
  if (!active || !payload?.length) return null;
  const left = payload.find((item) => item.dataKey === "leftValue")?.value;
  const right = payload.find((item) => item.dataKey === "rightValue")?.value;
  const leftDelta = Number(left) - Number(right);

  return (
    <div className="chartTooltip">
      <div className="chartTooltipLabel">{t("yearComparison.selectedMonthComparison")}</div>
      <div className="chartTooltipRow">
        <span className="chartTooltipSwatch copper" />
        <span className="chartTooltipName">{leftLabel}</span>
        <span className="chartTooltipValue">{metricLabel(mode, left)}</span>
      </div>
      <div className="chartTooltipRow">
        <span className="chartTooltipSwatch sky" />
        <span className="chartTooltipName">{rightLabel}</span>
        <span className="chartTooltipValue">{metricLabel(mode, right)}</span>
      </div>
      <div className="chartTooltipRow">
        <span className="chartTooltipSwatch mint" />
        <span className="chartTooltipName">{t("yearComparison.tooltips.delta")}</span>
        <span className="chartTooltipValue">
          {Number.isFinite(leftDelta)
            ? `${leftDelta > 0 ? "+" : ""}${metricLabel(mode, leftDelta)}`
            : "–"}
        </span>
      </div>
    </div>
  );
}

function ComparisonMetricCard({ label, value, subline, tone = "neutral", emphasis = "compact" }) {
  return (
    <article className={`comparisonMetricCard ${tone} ${emphasis}`}>
      <div className="comparisonMetricLabel">{label}</div>
      <div className="comparisonMetricValue">{value}</div>
      <div className="comparisonMetricSub">{subline}</div>
    </article>
  );
}

export default function YearComparisonPanel({ availableYears = [], initialLeftYear = 2026, initialRightYear = 2027 }) {
  const { locale, t } = useI18n();
  const [leftYear, setLeftYear] = React.useState(initialLeftYear);
  const [rightYear, setRightYear] = React.useState(initialRightYear);
  const [leftMonth, setLeftMonth] = React.useState(null);
  const [rightMonth, setRightMonth] = React.useState(null);
  const [chartScope, setChartScope] = React.useState("year");
  const [mode, setMode] = React.useState("cost");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [bundle, setBundle] = React.useState({ left: null, right: null });
  const previousYearsRef = React.useRef({ leftYear: initialLeftYear, rightYear: initialRightYear });

  const monthOptions = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index + 1,
        label: monthLabel(index + 1),
      })),
    [locale]
  );

  React.useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const [left, right] = await Promise.all([loadYearBundle(leftYear), loadYearBundle(rightYear)]);
        if (!active) return;
        setBundle({ left, right });
      } catch (err) {
        if (!active) return;
        setError(String(err?.message || err));
      } finally {
        if (active) setLoading(false);
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [leftYear, rightYear]);

  React.useEffect(() => {
    const nextLeftMonth = latestActiveMonthNumber(bundle.left?.monthly?.months) || 1;
    const nextRightMonth = latestActiveMonthNumber(bundle.right?.monthly?.months) || nextLeftMonth || 1;
    const leftYearChanged = previousYearsRef.current.leftYear !== leftYear;
    const rightYearChanged = previousYearsRef.current.rightYear !== rightYear;

    setLeftMonth((current) => (current == null || leftYearChanged ? nextLeftMonth : current));
    setRightMonth((current) => (current == null || rightYearChanged ? nextRightMonth : current));

    previousYearsRef.current = { leftYear, rightYear };
  }, [bundle.left?.monthly?.months, bundle.right?.monthly?.months, leftYear, rightYear]);

  const leftStats = bundle.left?.stats || null;
  const rightStats = bundle.right?.stats || null;
  const leftEfficiency = bundle.left?.efficiency || null;
  const rightEfficiency = bundle.right?.efficiency || null;
  const hasValues = Number(leftStats?.count || 0) > 0 || Number(rightStats?.count || 0) > 0;
  const leftMonths = Array.isArray(bundle.left?.monthly?.months) ? bundle.left.monthly.months : [];
  const rightMonths = Array.isArray(bundle.right?.monthly?.months) ? bundle.right.monthly.months : [];

  const yearChartData = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const monthNumber = index + 1;
        const leftMonthRow = leftMonths.find((month) => Number(month?.month) === monthNumber) || null;
        const rightMonthRow = rightMonths.find((month) => Number(month?.month) === monthNumber) || null;
        const leftValue = metricValue(leftMonthRow, mode);
        const rightValue = metricValue(rightMonthRow, mode);

        return {
          label: monthLabel(monthNumber),
          leftValue,
          rightValue,
          spreadValue: leftValue - rightValue,
        };
      }),
    [leftMonths, locale, mode, rightMonths]
  );

  const latestSpread = React.useMemo(() => {
    const active = [...yearChartData].reverse().find((row) => Number(row.leftValue || 0) > 0 || Number(row.rightValue || 0) > 0);
    return active || null;
  }, [yearChartData]);

  const selectedMonthComparison = React.useMemo(() => {
    const safeLeftMonth = Number(leftMonth) || 1;
    const safeRightMonth = Number(rightMonth) || 1;
    const leftMonthRow = leftMonths.find((month) => Number(month?.month) === safeLeftMonth) || null;
    const rightMonthRow = rightMonths.find((month) => Number(month?.month) === safeRightMonth) || null;
    const leftHasValue = hasMetricValue(leftMonthRow, mode);
    const rightHasValue = hasMetricValue(rightMonthRow, mode);
    const leftValue = metricValue(leftMonthRow, mode);
    const rightValue = metricValue(rightMonthRow, mode);

    return {
      leftMonth: safeLeftMonth,
      rightMonth: safeRightMonth,
      leftMonthRow,
      rightMonthRow,
      leftHasValue,
      rightHasValue,
      hasAnyValue: leftHasValue || rightHasValue,
      leftValue,
      rightValue,
      spreadValue: leftValue - rightValue,
      label: `${monthLabel(safeLeftMonth)} ${leftYear} vs. ${monthLabel(safeRightMonth)} ${rightYear}`,
    };
  }, [leftMonth, leftMonths, leftYear, locale, mode, rightMonth, rightMonths, rightYear]);

  const selectedMonthChartData = React.useMemo(
    () => [
      {
        label: t("yearComparison.selection"),
        leftValue: selectedMonthComparison.leftHasValue ? selectedMonthComparison.leftValue : 0,
        rightValue: selectedMonthComparison.rightHasValue ? selectedMonthComparison.rightValue : 0,
      },
    ],
    [selectedMonthComparison, t]
  );

  const leftSelectionLabel = `${monthLabel(selectedMonthComparison.leftMonth)} ${leftYear}`;
  const rightSelectionLabel = `${monthLabel(selectedMonthComparison.rightMonth)} ${rightYear}`;
  const selectedMetricTitle = metricTitle(mode, t);

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel comparisonPanel">
        <div className="panelHeader comparisonPanelHeader">
          <div>
            <div className="sectionKicker">{t("yearComparison.kicker")}</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">{t("yearComparison.title")}</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content={t("yearComparison.tooltipContent")}
              >
                <button className="ttTrigger" type="button" aria-label={t("yearComparison.tooltipLabel")}>
                  i
                </button>
              </Tooltip>
            </div>
            <div className="comparisonPanelLead">{t("yearComparison.lead")}</div>
          </div>

          <div className="pill ghostPill panelMetaPill comparisonScopePill">
            {chartScope === "month" ? t("yearComparison.scope.monthActive") : t("yearComparison.scope.yearActive")} • {selectedMetricTitle}
          </div>
        </div>

        {error ? <div className="errorBox">{error}</div> : null}

        <div className="comparisonControlDeck">
          <article className="comparisonYearCard left">
            <div className="comparisonYearCardHeader">
              <div>
                <div className="comparisonYearEyebrow">{t("yearComparison.roles.primaryYear")}</div>
                <div className="comparisonYearValue">{leftYear}</div>
              </div>
              <div className="comparisonYearBadge">{t("yearComparison.roles.left")}</div>
            </div>

            <div className="comparisonSelectGrid">
              <label className="field comparisonSelectField">
                <span>{t("yearComparison.fields.year")}</span>
                <select className="input" value={leftYear} onChange={(event) => setLeftYear(Number(event.target.value))}>
                  {availableYears.map((year) => (
                    <option key={`left-${year}`} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field comparisonSelectField">
                <span>{t("yearComparison.fields.month")}</span>
                <select
                  className="input"
                  value={leftMonth ?? ""}
                  onChange={(event) => {
                    setLeftMonth(Number(event.target.value));
                    setChartScope("month");
                  }}
                >
                  <option value="" disabled>
                    {t("yearComparison.fields.selectMonth")}
                  </option>
                  {monthOptions.map((month) => (
                    <option key={`left-month-${month.value}`} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </article>

          <article className="comparisonBridgeCard">
            <div className="comparisonBridgeLabel">{t("yearComparison.roles.activePairing")}</div>
            <div className="comparisonBridgeValue">
              {leftYear} <span>vs.</span> {rightYear}
            </div>
            <div className="comparisonBridgeSub">{selectedMonthComparison.label}</div>
            <div className="comparisonBridgeMeta">
              <span>{chartScope === "month" ? t("yearComparison.scope.month") : t("yearComparison.scope.year")}</span>
              <span>{selectedMetricTitle}</span>
            </div>
          </article>

          <article className="comparisonYearCard right">
            <div className="comparisonYearCardHeader">
              <div>
                <div className="comparisonYearEyebrow">{t("yearComparison.roles.referenceYear")}</div>
                <div className="comparisonYearValue">{rightYear}</div>
              </div>
              <div className="comparisonYearBadge">{t("yearComparison.roles.right")}</div>
            </div>

            <div className="comparisonSelectGrid">
              <label className="field comparisonSelectField">
                <span>{t("yearComparison.fields.year")}</span>
                <select className="input" value={rightYear} onChange={(event) => setRightYear(Number(event.target.value))}>
                  {availableYears.map((year) => (
                    <option key={`right-${year}`} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field comparisonSelectField">
                <span>{t("yearComparison.fields.month")}</span>
                <select
                  className="input"
                  value={rightMonth ?? ""}
                  onChange={(event) => {
                    setRightMonth(Number(event.target.value));
                    setChartScope("month");
                  }}
                >
                  <option value="" disabled>
                    {t("yearComparison.fields.selectMonth")}
                  </option>
                  {monthOptions.map((month) => (
                    <option key={`right-month-${month.value}`} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </article>
        </div>

        <div className="comparisonMetricBoard">
          {loading ? (
            <div className="emptyStateCard">{t("yearComparison.loading")}</div>
          ) : !hasValues ? (
            <div className="emptyStateCard">{t("yearComparison.empty")}</div>
          ) : (
            <>
              <ComparisonMetricCard
                label={t("yearComparison.metricCards.cost")}
                value={euro(leftStats?.total_cost)}
                subline={t("yearComparison.versusYear", {
                  year: rightYear,
                  value: deltaMeta(leftStats?.total_cost, rightStats?.total_cost, 2).value,
                })}
                tone="warm"
                emphasis="hero"
              />

              <ComparisonMetricCard
                label={t("yearComparison.metricCards.energy")}
                value={leftStats?.total_energy_kwh != null ? `${num(leftStats.total_energy_kwh, 1)} kWh` : "–"}
                subline={t("yearComparison.versusYear", {
                  year: rightYear,
                  value: deltaMeta(leftStats?.total_energy_kwh, rightStats?.total_energy_kwh, 1, " kWh").value,
                })}
                tone="frost"
                emphasis="hero"
              />

              <ComparisonMetricCard
                label={t("yearComparison.metricCards.sessions")}
                value={leftStats?.count != null ? num(leftStats.count, 0) : "–"}
                subline={t("yearComparison.versusYear", {
                  year: rightYear,
                  value: deltaMeta(leftStats?.count, rightStats?.count, 0).value,
                })}
              />

              <ComparisonMetricCard
                label={t("yearComparison.metricCards.medianPrice")}
                value={leftStats?.medians?.price_per_kwh != null ? `${num(leftStats.medians.price_per_kwh, 3)} €/kWh` : "–"}
                subline={t("yearComparison.versusYear", {
                  year: rightYear,
                  value: deltaMeta(leftStats?.medians?.price_per_kwh, rightStats?.medians?.price_per_kwh, 3, " €/kWh").value,
                })}
                tone="mint"
              />

              <ComparisonMetricCard
                label={t("yearComparison.metricCards.efficiency")}
                value={leftEfficiency?.overall_score != null ? `${num(leftEfficiency.overall_score, 1)}/100` : "–"}
                subline={t("yearComparison.versusYear", {
                  year: rightYear,
                  value: deltaMeta(leftEfficiency?.overall_score, rightEfficiency?.overall_score, 1, " pt").value,
                })}
                tone="danger"
              />
            </>
          )}
        </div>

        {!loading && hasValues ? (
          <>
            <div className="comparisonToolbar">
              <div>
                <div className="comparisonChartTitle">
                  {chartScope === "month" ? t("yearComparison.selectedMonthComparison") : t("yearComparison.yearlyComparison")}
                </div>
                <div className="comparisonChartSub">
                  {t("yearComparison.activeMode")}: <b>{selectedMetricTitle}</b> • {t("yearComparison.activeSelection")}:{" "}
                  <b>{selectedMonthComparison.label}</b>
                </div>
              </div>

              <div className="comparisonToolbarControls">
                <div className="toggle" aria-label={t("yearComparison.scopeAria")}>
                  <button type="button" className={chartScope === "year" ? "toggleBtn active" : "toggleBtn"} onClick={() => setChartScope("year")}>
                    {t("yearComparison.toggles.year")}
                  </button>
                  <button type="button" className={chartScope === "month" ? "toggleBtn active" : "toggleBtn"} onClick={() => setChartScope("month")}>
                    {t("yearComparison.toggles.month")}
                  </button>
                </div>

                <div className="toggle" aria-label={t("yearComparison.modeAria")}>
                  <button type="button" className={mode === "cost" ? "toggleBtn active" : "toggleBtn"} onClick={() => setMode("cost")}>
                    {t("yearComparison.toggles.cost")}
                  </button>
                  <button type="button" className={mode === "energy" ? "toggleBtn active" : "toggleBtn"} onClick={() => setMode("energy")}>
                    {t("yearComparison.toggles.energy")}
                  </button>
                  <button type="button" className={mode === "price" ? "toggleBtn active" : "toggleBtn"} onClick={() => setMode("price")}>
                    {t("yearComparison.toggles.price")}
                  </button>
                  <button type="button" className={mode === "sessions" ? "toggleBtn active" : "toggleBtn"} onClick={() => setMode("sessions")}>
                    {t("yearComparison.toggles.sessions")}
                  </button>
                </div>
              </div>
            </div>

            <div className="comparisonChartShell">
              <div className="comparisonLegendRow" aria-hidden="true">
                <div className="comparisonLegendPill left">
                  <span className="comparisonLegendDot" />
                  <span>{leftYear}</span>
                </div>
                <div className="comparisonLegendPill right">
                  <span className="comparisonLegendDot" />
                  <span>{rightYear}</span>
                </div>
                <div className="comparisonLegendMeta">{selectedMetricTitle}</div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                {chartScope === "month" ? (
                  <BarChart data={selectedMonthChartData} margin={{ top: 22, right: 20, left: 12, bottom: 4 }} barCategoryGap={42}>
                    <CartesianGrid stroke="rgba(255,255,255,0.055)" vertical={false} strokeDasharray="2 8" />
                    <XAxis
                      dataKey="label"
                      height={38}
                      tick={{ fill: "rgba(255,255,255,0.48)", fontSize: 10.5 }}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={14}
                    />
                    <YAxis
                      width={58}
                      tick={{ fill: "rgba(255,255,255,0.46)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                    />
                    <RTooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      content={<FocusTooltip mode={mode} leftLabel={leftSelectionLabel} rightLabel={rightSelectionLabel} t={t} />}
                    />
                    <Bar yAxisId={undefined} dataKey="leftValue" name={leftSelectionLabel} fill="rgba(205,132,64,0.94)" radius={[12, 12, 4, 4]} maxBarSize={84} />
                    <Bar yAxisId={undefined} dataKey="rightValue" name={rightSelectionLabel} fill="rgba(126,192,255,0.94)" radius={[12, 12, 4, 4]} maxBarSize={84} />
                  </BarChart>
                ) : (
                  <ComposedChart data={yearChartData} margin={{ top: 22, right: 20, left: 12, bottom: 4 }}>
                    <defs>
                      <linearGradient id="comparisonLeftFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(205,132,64,0.22)" />
                        <stop offset="100%" stopColor="rgba(205,132,64,0.00)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.055)" vertical={false} strokeDasharray="2 8" />
                    <XAxis
                      dataKey="label"
                      height={38}
                      tick={{ fill: "rgba(255,255,255,0.48)", fontSize: 10.5 }}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={14}
                    />
                    <YAxis
                      width={58}
                      tick={{ fill: "rgba(255,255,255,0.46)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                    />

                    <RTooltip
                      cursor={{ stroke: "rgba(255,255,255,0.10)", strokeWidth: 1, strokeDasharray: "4 6" }}
                      content={<CompareTooltip leftYear={leftYear} rightYear={rightYear} mode={mode} t={t} />}
                    />

                    <Area type="monotone" dataKey="leftValue" fill="url(#comparisonLeftFill)" stroke="none" isAnimationActive={false} />
                    <Line
                      type="monotone"
                      dataKey="leftValue"
                      stroke="rgba(205,132,64,0.94)"
                      strokeWidth={2.45}
                      dot={false}
                      activeDot={{ r: 4.4, fill: "rgba(205,132,64,1)", stroke: "rgba(255,255,255,0.82)", strokeWidth: 1.2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rightValue"
                      stroke="rgba(126,192,255,0.94)"
                      strokeWidth={2.1}
                      dot={false}
                      strokeDasharray="5 6"
                      activeDot={{ r: 4.4, fill: "rgba(126,192,255,0.96)", stroke: "rgba(14,14,20,0.95)", strokeWidth: 1.2 }}
                    />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>

            <div className="comparisonSpreadRow">
              <div className="comparisonSpreadCard primary">
                <div className="comparisonSpreadLabel">{t("yearComparison.spread.selected")}</div>
                <div className="comparisonSpreadValue">
                  {selectedMonthComparison.hasAnyValue
                    ? `${selectedMonthComparison.spreadValue > 0 ? "+" : ""}${metricLabel(mode, selectedMonthComparison.spreadValue)}`
                    : "–"}
                </div>
                <div className="comparisonSpreadSub">
                  {selectedMonthComparison.hasAnyValue
                    ? `${selectedMonthComparison.leftHasValue ? metricLabel(mode, selectedMonthComparison.leftValue) : "–"} vs. ${
                        selectedMonthComparison.rightHasValue ? metricLabel(mode, selectedMonthComparison.rightValue) : "–"
                      } • ${selectedMonthComparison.label}`
                    : t("yearComparison.spread.noSelectedData")}
                </div>
              </div>
              <div className="comparisonSpreadCard subtle">
                <div className="comparisonSpreadLabel">{t("yearComparison.spread.latest")}</div>
                <div className="comparisonSpreadValue">
                  {latestSpread ? `${latestSpread.spreadValue > 0 ? "+" : ""}${metricLabel(mode, latestSpread.spreadValue)}` : "–"}
                </div>
                <div className="comparisonSpreadSub">
                  {latestSpread ? `${latestSpread.label} • ${leftYear} vs. ${rightYear}` : t("yearComparison.spread.noMonthlyValues")}
                </div>
              </div>
              <div className="comparisonSpreadCard subtle">
                <div className="comparisonSpreadLabel">{t("yearComparison.spread.efficiency")}</div>
                <div className="comparisonSpreadValue">
                  {leftEfficiency?.overall_score != null && rightEfficiency?.overall_score != null
                    ? deltaMeta(leftEfficiency.overall_score, rightEfficiency.overall_score, 1, " pt").value
                    : "–"}
                </div>
                <div className="comparisonSpreadSub">{t("yearComparison.spread.efficiencySub", { leftYear, rightYear })}</div>
              </div>
            </div>

            <div className="metricNarrative">
              <b>
                {t("yearComparison.narrative.base", {
                  year: leftYear,
                  cost: euro(leftStats?.total_cost),
                  price: leftStats?.medians?.price_per_kwh != null ? `${num(leftStats.medians.price_per_kwh, 3)} €/kWh` : "–",
                })}
              </b>{" "}
              {chartScope === "month"
                ? t("yearComparison.narrative.monthScope", { selection: selectedMonthComparison.label })
                : t("yearComparison.narrative.yearScope", { selection: selectedMonthComparison.label })}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
