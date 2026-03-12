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
        <span className={`chartTooltipSwatch ${mode === "preis" ? "sky" : mode === "vorgaenge" ? "mint" : mode === "kosten" ? "frost" : "copper"}`} />
        <span className="chartTooltipName">{title}</span>
        <span className="chartTooltipValue">{valueLabel(mode, value)}</span>
      </div>
    </div>
  );
}

export default function MonthlyChart({ months, onMonthSelect }) {
  const { t } = useI18n();
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

  const strokeByMode = {
    energy: "rgba(205,132,64,0.95)",
    cost: "rgba(196,212,255,0.86)",
    sessions: "rgba(120,210,160,0.92)",
    price: "rgba(120,190,255,0.95)",
  };

  const fillByMode = {
    energy: "url(#monthlyEnergyFill)",
    cost: "url(#monthlyCostFill)",
    sessions: "url(#monthlyCountFill)",
    price: "url(#monthlyPriceFill)",
  };

  const ToggleItem = ({ id, label, tip }) => (
    <div className="toggleItem">
      <button
        type="button"
        className={mode === id ? "toggleBtn active" : "toggleBtn"}
        onClick={() => setMode(id)}
      >
        {label}
      </button>

      <Tooltip content={tip} placement="top">
        <button
          type="button"
          className="ttTrigger"
          aria-label={t("monthlyChart.modeInfo", { label })}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          i
        </button>
      </Tooltip>
    </div>
  );

  return (
    <div className="card glassStrong monthlyChartCard">
      <div className="sectionHeader">
        <div>
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

        <div className="toggle monthlyChartToggle" aria-label={t("monthlyChart.modeAria")}>
          <ToggleItem id="energy" label={t("monthlyChart.modes.energy")} tip={tips.energy} />
          <ToggleItem id="cost" label={t("monthlyChart.modes.cost")} tip={tips.cost} />
          <ToggleItem id="price" label={t("monthlyChart.modes.price")} tip={tips.price} />
          <ToggleItem id="sessions" label={t("monthlyChart.modes.sessions")} tip={tips.sessions} />
        </div>
      </div>

      <div className="chartWrap compact monthlyChartShell">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 24, right: 22, left: 14, bottom: 4 }}
            onClick={(state) => onMonthSelect?.(state?.activePayload?.[0]?.payload?.month)}
          >
            <defs>
              <linearGradient id="monthlyEnergyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(205,132,64,0.30)" />
                <stop offset="100%" stopColor="rgba(205,132,64,0.00)" />
              </linearGradient>
              <linearGradient id="monthlyCostFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(196,212,255,0.26)" />
                <stop offset="100%" stopColor="rgba(196,212,255,0.00)" />
              </linearGradient>
              <linearGradient id="monthlyCountFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(120,210,160,0.28)" />
                <stop offset="100%" stopColor="rgba(120,210,160,0.00)" />
              </linearGradient>
              <linearGradient id="monthlyPriceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(120,190,255,0.28)" />
                <stop offset="100%" stopColor="rgba(120,190,255,0.00)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 10" stroke="rgba(255,255,255,0.045)" vertical={false} />
            <XAxis
              dataKey="name"
              height={40}
              tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickMargin={16}
            />
            <YAxis
              width={60}
              tick={{ fill: "rgba(255,255,255,0.40)", fontSize: 10.5 }}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tickFormatter={(value) =>
                mode === "price" ? num(value, 2) : String(value)
              }
            />

            <RTooltip
              cursor={{ stroke: "rgba(255,255,255,0.10)", strokeWidth: 1, strokeDasharray: "4 6" }}
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
                  activeDot={{ r: 4.4, fill: strokeByMode.energy, stroke: "rgba(255,255,255,0.78)", strokeWidth: 1.2 }}
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
                  activeDot={{ r: 4.4, fill: strokeByMode.cost, stroke: "rgba(20,20,28,0.9)", strokeWidth: 1.2 }}
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
                  activeDot={{ r: 4.4, fill: strokeByMode.price, stroke: "rgba(20,20,28,0.9)", strokeWidth: 1.2 }}
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
                  activeDot={{ r: 4.4, fill: strokeByMode.sessions, stroke: "rgba(20,20,28,0.9)", strokeWidth: 1.2 }}
                />
              </>
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
