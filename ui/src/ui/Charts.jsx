import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
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

function kwh(n) {
  return `${num(n, 1)} kWh`;
}

function PremiumTooltip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null;

  const energy = payload.find((item) => item.dataKey === "energie")?.value;
  const cost = payload.find((item) => item.dataKey === "kosten")?.value;

  return (
    <div className="chartTooltip">
      <div className="chartTooltipLabel">{label}</div>
      <div className="chartTooltipRow">
        <span className="chartTooltipSwatch copper" />
        <span className="chartTooltipName">{t("charts.tooltipEnergy")}</span>
        <span className="chartTooltipValue">{kwh(energy)}</span>
      </div>
      <div className="chartTooltipRow">
        <span className="chartTooltipSwatch frost" />
        <span className="chartTooltipName">{t("charts.tooltipCost")}</span>
        <span className="chartTooltipValue">{euro(cost)}</span>
      </div>
    </div>
  );
}

export default function Charts({ sessions = [] }) {
  const { formatDate, t } = useI18n();
  const data = React.useMemo(() => {
    const sorted = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
    return sorted.map((s) => ({
      datum: formatDate(s.date, { day: "2-digit", month: "2-digit" }),
      energie: Number(s.energy_kwh || 0),
      kosten: Number(s.total_cost || 0),
    }));
  }, [formatDate, sessions]);

  const summary = React.useMemo(() => {
    const totalEnergy = data.reduce((sum, row) => sum + Number(row.energie || 0), 0);
    const totalCost = data.reduce((sum, row) => sum + Number(row.kosten || 0), 0);
    return {
      count: data.length,
      totalEnergy,
      totalCost,
    };
  }, [data]);

  return (
    <div className="card glassStrong">
      <div className="sectionHeader">
        <div>
          <div className="sectionKicker">{t("charts.kicker")}</div>

          <Tooltip
            placement="top"
            content={t("charts.tooltipContent")}
          >
            <span className="sectionTitle cupraActionTitle" tabIndex={0}>
              {t("charts.title")}
            </span>
          </Tooltip>
        </div>

        <div className="chartLegendRow">
          <span className="chartLegendItem">
            <span className="chartLegendDot copper" />
            {kwh(summary.totalEnergy)}
          </span>
          <span className="chartLegendItem">
            <span className="chartLegendDot frost" />
            {euro(summary.totalCost)}
          </span>
          <span className="chartLegendItem muted">
            {t("charts.sessionsMeta", { count: num(summary.count, 0) })}
          </span>
        </div>
      </div>

      <div className="chartWrap">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 20, right: 20, left: 12, bottom: 2 }}>
            <defs>
              <linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(205,132,64,0.34)" />
                <stop offset="55%" stopColor="rgba(205,132,64,0.10)" />
                <stop offset="100%" stopColor="rgba(205,132,64,0.00)" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.055)" vertical={false} strokeDasharray="2 8" />
            <XAxis
              dataKey="datum"
              tick={{ fill: "rgba(255,255,255,0.48)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickMargin={12}
            />
            <YAxis
              yAxisId="left"
              width={56}
              tick={{ fill: "rgba(255,255,255,0.46)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              width={56}
              tick={{ fill: "rgba(255,255,255,0.46)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
            />

            <RTooltip
              cursor={{ stroke: "rgba(255,255,255,0.10)", strokeWidth: 1, strokeDasharray: "4 6" }}
              content={<PremiumTooltip t={t} />}
            />

            <Area
              yAxisId="left"
              type="monotone"
              dataKey="energie"
              fill="url(#energyFill)"
              stroke="none"
              isAnimationActive={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="energie"
              stroke="rgba(205,132,64,0.90)"
              strokeWidth={2.8}
              dot={false}
              activeDot={{ r: 5, fill: "rgba(205,132,64,1)", stroke: "rgba(255,255,255,0.82)", strokeWidth: 1.5 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="kosten"
              stroke="rgba(196,212,255,0.82)"
              strokeWidth={2.1}
              dot={false}
              opacity={0.92}
              activeDot={{ r: 4.5, fill: "rgba(196,212,255,0.94)", stroke: "rgba(14,14,20,0.95)", strokeWidth: 1.2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
