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
import Tooltip from "./Tooltip.jsx";
import { ladeAuswertung, ladeEfficiencyScore, ladeMonatsauswertung } from "./api.js";
import { monthLabel } from "./monthLabels.js";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: monthLabel(index + 1),
}));

function num(n, digits = 1) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "–";
  return value.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function euro(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "–";
  return value.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

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

function metricTitle(mode) {
  if (mode === "energy") return "Energie";
  if (mode === "cost") return "Kosten";
  if (mode === "price") return "Preisniveau";
  return "Sessions";
}

function latestActiveMonthNumber(months) {
  if (!Array.isArray(months)) return null;
  const latest = [...months].reverse().find((month) => Number(month?.count || 0) > 0);
  return latest ? Number(latest.month) : null;
}

async function loadYearBundle(year) {
  const [stats, efficiency, monthly] = await Promise.all([
    ladeAuswertung(year),
    ladeEfficiencyScore(year),
    ladeMonatsauswertung(year),
  ]);
  return { stats, efficiency, monthly };
}

function CompareTooltip({ active, payload, label, leftYear, rightYear, mode }) {
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
        <span className="chartTooltipName">Delta</span>
        <span className="chartTooltipValue">
          {Number.isFinite(leftDelta)
            ? `${leftDelta > 0 ? "+" : ""}${metricLabel(mode, leftDelta)}`
            : "–"}
        </span>
      </div>
    </div>
  );
}

function FocusTooltip({ active, payload, mode, leftLabel, rightLabel }) {
  if (!active || !payload?.length) return null;
  const left = payload.find((item) => item.dataKey === "leftValue")?.value;
  const right = payload.find((item) => item.dataKey === "rightValue")?.value;
  const leftDelta = Number(left) - Number(right);

  return (
    <div className="chartTooltip">
      <div className="chartTooltipLabel">Selektierter Monatsvergleich</div>
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
        <span className="chartTooltipName">Delta</span>
        <span className="chartTooltipValue">
          {Number.isFinite(leftDelta)
            ? `${leftDelta > 0 ? "+" : ""}${metricLabel(mode, leftDelta)}`
            : "–"}
        </span>
      </div>
    </div>
  );
}

export default function YearComparisonPanel({ availableYears = [], initialLeftYear = 2026, initialRightYear = 2027 }) {
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

  const yearChartData = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const monthNumber = index + 1;
      const leftMonth = leftMonths.find((month) => Number(month?.month) === monthNumber) || null;
      const rightMonth = rightMonths.find((month) => Number(month?.month) === monthNumber) || null;
      const leftValue = metricValue(leftMonth, mode);
      const rightValue = metricValue(rightMonth, mode);

      return {
        label: monthLabel(monthNumber),
        leftValue,
        rightValue,
        spreadValue: leftValue - rightValue,
      };
    });
  }, [leftMonths, rightMonths, mode]);

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
  }, [leftMonth, rightMonth, leftMonths, rightMonths, leftYear, rightYear, mode]);

  const selectedMonthChartData = React.useMemo(() => {
    return [
      {
        label: "Auswahl",
        leftValue: selectedMonthComparison.leftHasValue ? selectedMonthComparison.leftValue : 0,
        rightValue: selectedMonthComparison.rightHasValue ? selectedMonthComparison.rightValue : 0,
      },
    ];
  }, [selectedMonthComparison]);

  const leftSelectionLabel = `${monthLabel(selectedMonthComparison.leftMonth)} ${leftYear}`;
  const rightSelectionLabel = `${monthLabel(selectedMonthComparison.rightMonth)} ${rightYear}`;

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel comparisonPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">Vergleich</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">Jahres- und Monatsvergleich</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content="Vergleicht zwei Jahre über KPIs und Monatsreihen. Zusätzlich lassen sich konkrete Monate links und rechts direkt gegeneinander stellen."
              >
                <button className="ttTrigger" type="button" aria-label="Erklärung: Jahres- und Monatsvergleich">
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="comparisonSelectors">
            <label className="field comparisonSelectField">
              <span>Links</span>
              <select className="input" value={leftYear} onChange={(event) => setLeftYear(Number(event.target.value))}>
                {availableYears.map((year) => (
                  <option key={`left-${year}`} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="field comparisonSelectField">
              <span>Monat links</span>
              <select
                className="input"
                value={leftMonth ?? ""}
                onChange={(event) => {
                  setLeftMonth(Number(event.target.value));
                  setChartScope("month");
                }}
              >
                <option value="" disabled>
                  Monat wählen
                </option>
                {MONTH_OPTIONS.map((month) => (
                  <option key={`left-month-${month.value}`} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field comparisonSelectField">
              <span>Rechts</span>
              <select className="input" value={rightYear} onChange={(event) => setRightYear(Number(event.target.value))}>
                {availableYears.map((year) => (
                  <option key={`right-${year}`} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="field comparisonSelectField">
              <span>Monat rechts</span>
              <select
                className="input"
                value={rightMonth ?? ""}
                onChange={(event) => {
                  setRightMonth(Number(event.target.value));
                  setChartScope("month");
                }}
              >
                <option value="" disabled>
                  Monat wählen
                </option>
                {MONTH_OPTIONS.map((month) => (
                  <option key={`right-month-${month.value}`} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error ? <div className="errorBox">{error}</div> : null}

        <div className="summaryGrid">
          {loading ? (
            <div className="emptyStateCard">Vergleich wird geladen…</div>
          ) : !hasValues ? (
            <div className="emptyStateCard">Für die gewählten Jahre sind noch keine Werte vorhanden.</div>
          ) : (
            <>
              <div className="summaryCard warm">
                <div className="summaryLabel">Kosten Delta</div>
                <div className="summaryValue">{euro(leftStats?.total_cost)}</div>
                <div className="summarySub">
                  vs. {rightYear}: {deltaMeta(leftStats?.total_cost, rightStats?.total_cost, 2).value}
                </div>
              </div>

              <div className="summaryCard frost">
                <div className="summaryLabel">Energie Delta</div>
                <div className="summaryValue">{leftStats?.total_energy_kwh != null ? `${num(leftStats.total_energy_kwh, 1)} kWh` : "–"}</div>
                <div className="summarySub">
                  vs. {rightYear}: {deltaMeta(leftStats?.total_energy_kwh, rightStats?.total_energy_kwh, 1, " kWh").value}
                </div>
              </div>

              <div className="summaryCard">
                <div className="summaryLabel">Sessions Delta</div>
                <div className="summaryValue">{leftStats?.count != null ? num(leftStats.count, 0) : "–"}</div>
                <div className="summarySub">
                  vs. {rightYear}: {deltaMeta(leftStats?.count, rightStats?.count, 0).value}
                </div>
              </div>

              <div className="summaryCard mint">
                <div className="summaryLabel">Medianpreis Delta</div>
                <div className="summaryValue">
                  {leftStats?.medians?.price_per_kwh != null ? `${num(leftStats.medians.price_per_kwh, 3)} €/kWh` : "–"}
                </div>
                <div className="summarySub">
                  vs. {rightYear}: {deltaMeta(leftStats?.medians?.price_per_kwh, rightStats?.medians?.price_per_kwh, 3, " €/kWh").value}
                </div>
              </div>

              <div className="summaryCard danger">
                <div className="summaryLabel">Effizienz Delta</div>
                <div className="summaryValue">
                  {leftEfficiency?.overall_score != null ? `${num(leftEfficiency.overall_score, 1)}/100` : "–"}
                </div>
                <div className="summarySub">
                  vs. {rightYear}: {deltaMeta(leftEfficiency?.overall_score, rightEfficiency?.overall_score, 1, " pt").value}
                </div>
              </div>
            </>
          )}
        </div>

        {!loading && hasValues ? (
          <>
            <div className="comparisonChartHeader">
              <div>
                <div className="comparisonChartTitle">{chartScope === "month" ? "Selektierter Monatsvergleich" : "Jahresvergleich nach Monaten"}</div>
                <div className="comparisonChartSub">
                  Aktiver Modus: <b>{metricTitle(mode)}</b> • Selektion: <b>{selectedMonthComparison.label}</b>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <div className="toggle" aria-label="Chartfokus">
                  <button type="button" className={chartScope === "year" ? "toggleBtn active" : "toggleBtn"} onClick={() => setChartScope("year")}>
                    Jahreschart
                  </button>
                  <button type="button" className={chartScope === "month" ? "toggleBtn active" : "toggleBtn"} onClick={() => setChartScope("month")}>
                    Monatsfokus
                  </button>
                </div>

                <div className="toggle" aria-label="Vergleichsmodus">
                  <button type="button" className={mode === "cost" ? "toggleBtn active" : "toggleBtn"} onClick={() => setMode("cost")}>
                  Kosten
                  </button>
                  <button type="button" className={mode === "energy" ? "toggleBtn active" : "toggleBtn"} onClick={() => setMode("energy")}>
                  Energie
                  </button>
                  <button type="button" className={mode === "price" ? "toggleBtn active" : "toggleBtn"} onClick={() => setMode("price")}>
                  €/kWh
                  </button>
                  <button type="button" className={mode === "sessions" ? "toggleBtn active" : "toggleBtn"} onClick={() => setMode("sessions")}>
                  Sessions
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
                <div className="comparisonLegendMeta">{metricTitle(mode)}</div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                {chartScope === "month" ? (
                  <BarChart data={selectedMonthChartData} margin={{ top: 16, right: 18, left: 0, bottom: 0 }} barCategoryGap={42}>
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
                      tick={{ fill: "rgba(255,255,255,0.46)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                    />
                    <RTooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      content={<FocusTooltip mode={mode} leftLabel={leftSelectionLabel} rightLabel={rightSelectionLabel} />}
                    />
                    <Bar dataKey="leftValue" name={leftSelectionLabel} fill="rgba(205,132,64,0.94)" radius={[12, 12, 4, 4]} maxBarSize={84} />
                    <Bar dataKey="rightValue" name={rightSelectionLabel} fill="rgba(126,192,255,0.94)" radius={[12, 12, 4, 4]} maxBarSize={84} />
                  </BarChart>
                ) : (
                  <ComposedChart data={yearChartData} margin={{ top: 16, right: 18, left: 0, bottom: 0 }}>
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
                      tick={{ fill: "rgba(255,255,255,0.46)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                    />

                    <RTooltip
                      cursor={{ stroke: "rgba(255,255,255,0.10)", strokeWidth: 1, strokeDasharray: "4 6" }}
                      content={<CompareTooltip leftYear={leftYear} rightYear={rightYear} mode={mode} />}
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
                <div className="comparisonSpreadLabel">Selektierter Monats-Spread</div>
                <div className="comparisonSpreadValue">
                  {selectedMonthComparison.hasAnyValue
                    ? `${selectedMonthComparison.spreadValue > 0 ? "+" : ""}${metricLabel(mode, selectedMonthComparison.spreadValue)}`
                    : "–"}
                </div>
                <div className="comparisonSpreadSub">
                  {selectedMonthComparison.hasAnyValue
                    ? `${selectedMonthComparison.leftHasValue ? metricLabel(mode, selectedMonthComparison.leftValue) : "–"} vs. ${selectedMonthComparison.rightHasValue ? metricLabel(mode, selectedMonthComparison.rightValue) : "–"} • ${selectedMonthComparison.label}`
                    : "Für die selektierten Monate liegen noch keine Werte vor."}
                </div>
              </div>
              <div className="comparisonSpreadCard subtle">
                <div className="comparisonSpreadLabel">Letzter aktiver Monats-Spread</div>
                <div className="comparisonSpreadValue">
                  {latestSpread
                    ? `${latestSpread.spreadValue > 0 ? "+" : ""}${metricLabel(mode, latestSpread.spreadValue)}`
                    : "–"}
                </div>
                <div className="comparisonSpreadSub">
                  {latestSpread ? `${latestSpread.label} • ${leftYear} vs. ${rightYear}` : "Noch keine Monatswerte"}
                </div>
              </div>
              <div className="comparisonSpreadCard subtle">
                <div className="comparisonSpreadLabel">Effizienzbild</div>
                <div className="comparisonSpreadValue">
                  {leftEfficiency?.overall_score != null && rightEfficiency?.overall_score != null
                    ? deltaMeta(leftEfficiency.overall_score, rightEfficiency.overall_score, 1, " pt").value
                    : "–"}
                </div>
                <div className="comparisonSpreadSub">{leftYear} gegen {rightYear} im Jahres-Score</div>
              </div>
            </div>

            <div className="metricNarrative">
              <b>{leftYear}</b> liegt bei den Gesamtkosten bei <b>{euro(leftStats?.total_cost)}</b> und beim Medianpreis bei{" "}
              <b>{leftStats?.medians?.price_per_kwh != null ? `${num(leftStats.medians.price_per_kwh, 3)} €/kWh` : "–"}</b>.
              {chartScope === "month"
                ? <> Der aktive Monatsfokus zeigt jetzt direkt <b>{selectedMonthComparison.label}</b> statt der kompletten Jahreskurve.</>
                : <> Der Jahreschart macht zusätzlich sichtbar, in welchen Monaten sich die Jahre wirklich voneinander trennen, während die Selektion <b>{selectedMonthComparison.label}</b> einen direkten Monats-zu-Monats-Vergleich liefert.</>}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
