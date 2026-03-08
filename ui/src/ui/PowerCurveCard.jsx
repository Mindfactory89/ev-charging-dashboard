import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";
import Tooltip from "./Tooltip.jsx";

function num(n, digits = 1) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "–";
  return value.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const power = payload.find((item) => item.dataKey === "power")?.value;
  const count = payload.find((item) => item.dataKey === "count")?.value;
  const price = payload.find((item) => item.dataKey === "price")?.value;
  const coverage = payload.find((item) => item.dataKey === "coverage")?.value;

  return (
    <div className="chartTooltip">
      <div className="chartTooltipLabel">{label}</div>
      <div className="chartTooltipRow">
        <span className="chartTooltipSwatch copper" />
        <span className="chartTooltipName">Ø Leistung</span>
        <span className="chartTooltipValue">{num(power, 1)} kW</span>
      </div>
      <div className="chartTooltipRow">
        <span className="chartTooltipSwatch mint" />
        <span className="chartTooltipName">Sessions</span>
        <span className="chartTooltipValue">{num(count, 0)}</span>
      </div>
      <div className="chartTooltipRow">
        <span className="chartTooltipSwatch sky" />
        <span className="chartTooltipName">Ø Preis</span>
        <span className="chartTooltipValue">{price != null ? `${num(price, 3)} €/kWh` : "–"}</span>
      </div>
      <div className="chartTooltipRow">
        <span className="chartTooltipSwatch frost" />
        <span className="chartTooltipName">Abdeckung</span>
        <span className="chartTooltipValue">{coverage != null ? `${num(coverage, 0)}%` : "–"}</span>
      </div>
    </div>
  );
}

export default function PowerCurveCard({ analysis, year = 2026 }) {
  const data = React.useMemo(() => {
    const buckets = Array.isArray(analysis?.bands) && analysis.bands.length ? [...analysis.bands] : Array.isArray(analysis?.windows) ? [...analysis.windows] : [];
    return buckets
      .filter((bucket) => Number(bucket?.count || 0) > 0)
      .sort((left, right) => {
        if (Number(left.start || 0) !== Number(right.start || 0)) {
          return Number(left.start || 0) - Number(right.start || 0);
        }
        return Number(left.end || 0) - Number(right.end || 0);
      })
      .map((bucket) => ({
        label: bucket.label,
        power: Number(bucket.avg_power_kw || 0),
        count: Number(bucket.count || 0),
        coverage: Number(bucket.coverage_pct || bucket.share_pct || 0),
        price: bucket.avg_price_per_kwh != null ? Number(bucket.avg_price_per_kwh) : null,
      }));
  }, [analysis]);

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">Leistung</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">Ladeleistungskurve nach SoC-Bereich ({year})</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content="Zeigt in feinen 10%-SoC-Bändern, wo deine Sessions im Schnitt am schnellsten laden und in welchen Bereichen Preisniveau und Leistung spürbar kippen."
              >
                <button className="ttTrigger" type="button" aria-label="Erklärung: Ladeleistungskurve">
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {data.length ? `${num(data.length, 0)} SoC-Bänder aktiv` : "Keine SoC-Daten"}
          </div>
        </div>

        <div className="chartPanel premiumCurvePanel">
          {data.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={data} margin={{ top: 16, right: 18, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="powerCurveFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(205,132,64,0.26)" />
                    <stop offset="100%" stopColor="rgba(205,132,64,0.00)" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.055)" vertical={false} strokeDasharray="2 8" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "rgba(255,255,255,0.48)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={12}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: "rgba(255,255,255,0.46)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "rgba(255,255,255,0.34)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                />

                <RTooltip
                  cursor={{ stroke: "rgba(255,255,255,0.10)", strokeWidth: 1, strokeDasharray: "4 6" }}
                  content={<ChartTooltip />}
                />

                <Bar yAxisId="right" dataKey="count" fill="rgba(132,218,174,0.28)" radius={[10, 10, 0, 0]} />
                <Area yAxisId="left" type="monotone" dataKey="power" stroke="none" fill="url(#powerCurveFill)" isAnimationActive={false} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="power"
                  stroke="rgba(205,132,64,0.92)"
                  strokeWidth={2.8}
                  dot={false}
                  activeDot={{ r: 5, fill: "rgba(205,132,64,1)", stroke: "rgba(255,255,255,0.82)", strokeWidth: 1.5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="emptyStateCard">Keine Ladeleistungskurve für {year} vorhanden.</div>
          )}
        </div>
      </div>
    </section>
  );
}
