import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
} from "recharts";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { euro, num } from "../app/formatters.js";
import Tooltip from "./Tooltip.jsx";
import { monthLabel } from "./monthLabels.js";

function valueLabel(mode, value) {
  if (mode === "cost") return euro(value);
  if (mode === "energy") return `${num(value, 1)} kWh`;
  if (mode === "price") return `${num(value, 3)} €/kWh`;
  return `${num(value, 0)}`;
}

function PremiumTooltip({ active, payload, label, mode, t }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  const title = mode === "energy"
    ? t("monthlyChart.modes.energy")
    : mode === "cost"
      ? t("monthlyChart.modes.cost")
      : mode === "price"
        ? t("yearComparison.metricTitles.price")
        : t("monthlyChart.modes.sessions");

  return (
    <div className="chartTooltip">
      <div className="chartTooltipLabel">{label}</div>
      <div className="chartTooltipRow">
        <span className={`chartTooltipSwatch ${mode === "price" ? "sky" : mode === "sessions" ? "mint" : mode === "cost" ? "frost" : "copper"}`} />
        <span className="chartTooltipName">{title}</span>
        <span className="chartTooltipValue">{valueLabel(mode, value)}</span>
      </div>
    </div>
  );
}

export default function MonthlyChart({ months, onMonthSelect }) {
  const { t } = useI18n();
  const chartSummaryId = React.useId();
  const [mode, setMode] = React.useState("energy");

  const data = (months || []).map((m) => ({
    month: Number(m.month),
    name: monthLabel(m.month),
    energie: Number(m.energy_kwh || 0),
    kosten: Number(m.cost || 0),
    vorgaenge: Number(m.count || 0),
    preis: Number(m.price_per_kwh || 0),
  }));

  const title =
    mode === "energy"
      ? t("monthlyChart.title.energy")
      : mode === "cost"
        ? t("monthlyChart.title.cost")
        : mode === "price"
          ? t("monthlyChart.title.price")
          : t("monthlyChart.title.sessions");

  const tips = {
    energy: t("monthlyChart.tips.energy"),
    cost: t("monthlyChart.tips.cost"),
    sessions: t("monthlyChart.tips.sessions"),
    price: t("monthlyChart.tips.price"),
  };

  const dataKeyByMode = {
    energy: "energie",
    cost: "kosten",
    sessions: "vorgaenge",
    price: "preis",
  };
  const activeDataKey = dataKeyByMode[mode];
  const activeRows = activeDataKey ? data.filter((row) => Number(row[activeDataKey]) > 0) : [];
  const maxRow = activeRows.reduce(
    (best, row) => (Number(row[activeDataKey]) > Number(best?.[activeDataKey] || 0) ? row : best),
    null
  );
  const minRow = activeRows.reduce(
    (best, row) => (!best || Number(row[activeDataKey]) < Number(best[activeDataKey]) ? row : best),
    null
  );
  const averageValue = activeRows.length
    ? activeRows.reduce((sum, row) => sum + Number(row[activeDataKey] || 0), 0) / activeRows.length
    : null;
  const chartSummary = data.length && maxRow
    ? t("monthlyChart.chartSummary", {
        title,
        months: num(data.length, 0),
        value: valueLabel(mode, maxRow[activeDataKey]),
        month: maxRow.name,
      })
    : t("monthlyChart.chartEmptySummary", { title });

  const strokeByMode = {
    energy: "var(--chart-series-copper)",
    cost: "var(--chart-series-blue)",
    sessions: "var(--chart-series-mint)",
    price: "var(--chart-series-price)",
  };

  const fillByMode = {
    energy: "url(#monthlyEnergyFill)",
    cost: "url(#monthlyCostFill)",
    sessions: "url(#monthlyCountFill)",
    price: "url(#monthlyPriceFill)",
  };

  const ToggleItem = ({ id, label, tip }) => (
    <button
      type="button"
      className={mode === id ? "toggleBtn active" : "toggleBtn"}
      aria-pressed={mode === id}
      onClick={() => setMode(id)}
      title={tip}
    >
      {label}
    </button>
  );

  return (
    <div className="card glassStrong monthlyChartCard">
      <div className="sectionHeader monthlyChartHeader">
        <div className="monthlyChartIntro">
          <div className="sectionKicker">{t("monthlyChart.kicker")}</div>

          <div className="ttTitleRow">
            <div className="sectionTitle">{title}</div>

            <Tooltip
              content={t("monthlyChart.tooltipContent")}
              placement="top"
            >
              <button className="ttTrigger" type="button" aria-label={t("monthlyChart.tooltipLabel")}>
                i
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="toggle monthlyChartToggle" role="group" aria-label={t("monthlyChart.modeAria")}>
          <ToggleItem id="energy" label={t("monthlyChart.modes.energy")} tip={tips.energy} />
          <ToggleItem id="cost" label={t("monthlyChart.modes.cost")} tip={tips.cost} />
          <ToggleItem id="price" label={t("monthlyChart.modes.price")} tip={tips.price} />
          <ToggleItem id="sessions" label={t("monthlyChart.modes.sessions")} tip={tips.sessions} />
        </div>
      </div>

      <div className="monthlyChartInsightRail" role="list" aria-label={t("monthlyChart.quickFacts")}>
        <div className="monthlyChartInsight" role="listitem">
          <span>{t("monthlyChart.peak")}</span>
          <strong>{maxRow ? valueLabel(mode, maxRow[activeDataKey]) : "–"}</strong>
          <small>{maxRow?.name || t("common.noData")}</small>
        </div>
        <div className="monthlyChartInsight" role="listitem">
          <span>{t("monthlyChart.average")}</span>
          <strong>{averageValue != null ? valueLabel(mode, averageValue) : "–"}</strong>
          <small>{t("monthlyChart.activeMonths", { count: activeRows.length })}</small>
        </div>
        <div className="monthlyChartInsight" role="listitem">
          <span>{t("monthlyChart.low")}</span>
          <strong>{minRow ? valueLabel(mode, minRow[activeDataKey]) : "–"}</strong>
          <small>{minRow?.name || t("common.noData")}</small>
        </div>
      </div>

      <div className="chartWrap compact monthlyChartShell">
        <p id={chartSummaryId} className="srOnly">{chartSummary}</p>
        <ResponsiveContainer width="100%" height={300} initialDimension={{ width: 800, height: 300 }}>
          <AreaChart
            data={data}
            accessibilityLayer
            aria-describedby={chartSummaryId}
            margin={{ top: 24, right: 22, left: 14, bottom: 4 }}
            onClick={(state) => onMonthSelect?.(state?.activePayload?.[0]?.payload?.month)}
          >
            <defs>
              <linearGradient id="monthlyEnergyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-series-copper-fill-strong)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
              <linearGradient id="monthlyCostFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-series-blue-fill)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
              <linearGradient id="monthlyCountFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-series-mint-fill)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
              <linearGradient id="monthlyPriceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-series-price-fill)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 10" stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="name"
              height={40}
              tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickMargin={16}
            />
            <YAxis
              width={60}
              tick={{ fill: "var(--chart-axis)", fontSize: 10.5 }}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tickFormatter={(value) =>
                mode === "price" ? num(value, 2) : String(value)
              }
            />

            <RTooltip
              cursor={{ stroke: "var(--chart-cursor)", strokeWidth: 1, strokeDasharray: "4 6" }}
              content={<PremiumTooltip mode={mode} t={t} />}
            />

            {mode === "energy" ? (
              <>
                <Area type="monotone" dataKey="energie" stroke="none" fill={fillByMode.energy} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="energie"
                  stroke={strokeByMode.energy}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4.4, fill: strokeByMode.energy, stroke: "var(--chart-dot-stroke)", strokeWidth: 1.2 }}
                />
              </>
            ) : null}
            {mode === "cost" ? (
              <>
                <Area type="monotone" dataKey="kosten" stroke="none" fill={fillByMode.cost} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="kosten"
                  stroke={strokeByMode.cost}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4.4, fill: strokeByMode.cost, stroke: "var(--chart-dot-stroke-inverse)", strokeWidth: 1.2 }}
                />
              </>
            ) : null}
            {mode === "price" ? (
              <>
                <Area type="monotone" dataKey="preis" stroke="none" fill={fillByMode.price} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="preis"
                  stroke={strokeByMode.price}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4.4, fill: strokeByMode.price, stroke: "var(--chart-dot-stroke-inverse)", strokeWidth: 1.2 }}
                />
              </>
            ) : null}
            {mode === "sessions" ? (
              <>
                <Area type="monotone" dataKey="vorgaenge" stroke="none" fill={fillByMode.sessions} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="vorgaenge"
                  stroke={strokeByMode.sessions}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4.4, fill: strokeByMode.sessions, stroke: "var(--chart-dot-stroke-inverse)", strokeWidth: 1.2 }}
                />
              </>
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <details className="monthlyDataDisclosure">
        <summary>{t("monthlyChart.showTable")}</summary>
        <div className="monthlyDataTableWrap">
          <table className="monthlyDataTable">
            <caption className="srOnly">{title}</caption>
            <thead>
              <tr>
                <th scope="col">{t("monthlyChart.table.month")}</th>
                <th scope="col">{t("monthlyChart.table.value")}</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row) => (
                <tr key={`${mode}-${row.month}`}>
                  <th scope="row">{row.name}</th>
                  <td>{valueLabel(mode, row[activeDataKey])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
