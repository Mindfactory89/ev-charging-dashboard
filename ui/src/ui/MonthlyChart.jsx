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
import Tooltip from "./Tooltip.jsx";

const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function euro(n) {
  if (n == null || Number.isNaN(Number(n))) return "–";
  return Number(n).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function valueLabel(mode, value) {
  if (mode === "kosten") return euro(value);
  if (mode === "energie") return `${Number(value).toLocaleString("de-DE", { maximumFractionDigits: 1 })} kWh`;
  if (mode === "preis") return `${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} €/kWh`;
  return `${Number(value).toLocaleString("de-DE", { maximumFractionDigits: 0 })}`;
}

function PremiumTooltip({ active, payload, label, mode }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  const title =
    mode === "energie" ? "Energie" : mode === "kosten" ? "Kosten" : mode === "preis" ? "Preisniveau" : "Ladevorgänge";

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

export default function MonthlyChart({ months }) {
  const [mode, setMode] = React.useState("energie"); // energie | kosten | vorgaenge | preis

  const data = (months || []).map((m) => ({
    name: MONATE[(m.month || 1) - 1] || String(m.month),
    energie: Number(m.energy_kwh || 0),
    kosten: Number(m.cost || 0),
    vorgaenge: Number(m.count || 0),
    preis: Number(m.price_per_kwh || 0),
  }));

  const title =
    mode === "energie"
      ? "Energie im Jahresverlauf"
      : mode === "kosten"
      ? "Kosten im Jahresverlauf"
      : mode === "preis"
      ? "Preisentwicklung im Jahresverlauf"
      : "Ladevorgänge im Jahresverlauf";

  const tips = {
    energie:
      "Monatliche Summe der geladenen Energie (kWh). Ideal, um Ladebedarf, Saisonalität und Peaks im Jahr zu erkennen.",
    kosten:
      "Monatliche Summe deiner Ladekosten (€). Zeigt teure Monate, Tarif-/Standort-Effekte und Kosten-Spikes.",
    vorgaenge:
      "Anzahl der Ladevorgänge pro Monat. Hilft zu sehen, ob du eher viele kurze oder wenige lange Sessions hast.",
    preis:
      "Durchschnittlicher effektiver Preis pro kWh je Monat. Zeigt dir, wie sich dein reales Preisniveau über das Jahr entwickelt.",
  };

  const strokeByMode = {
    energie: "rgba(205,132,64,0.95)",
    kosten: "rgba(196,212,255,0.86)",
    vorgaenge: "rgba(120,210,160,0.92)",
    preis: "rgba(120,190,255,0.95)",
  };

  const fillByMode = {
    energie: "url(#monthlyEnergyFill)",
    kosten: "url(#monthlyCostFill)",
    vorgaenge: "url(#monthlyCountFill)",
    preis: "url(#monthlyPriceFill)",
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
          aria-label={`Info: ${label}`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          i
        </button>
      </Tooltip>
    </div>
  );

  return (
    <div className="card glassStrong">
      <div className="sectionHeader">
        <div>
          <div className="sectionKicker">Monate</div>

          <div className="ttTitleRow">
            <div className="sectionTitle">{title}</div>

            <Tooltip
              content="Monatliche Aggregation aller Sessions. Je nach Modus wird Energie (kWh), Kosten (€) oder Anzahl der Ladevorgänge dargestellt."
              placement="top"
            >
              <button className="ttTrigger" type="button" aria-label="Erklärung: Monatschart">
                i
              </button>
            </Tooltip>
          </div>
        </div>

        {/* ✅ Toggle rechts wie im Screenshot */}
        <div className="toggle" aria-label="Monatschart Modus">
          <ToggleItem id="energie" label="Energie" tip={tips.energie} />
          <ToggleItem id="kosten" label="Kosten" tip={tips.kosten} />
          <ToggleItem id="preis" label="€/kWh" tip={tips.preis} />
          <ToggleItem id="vorgaenge" label="Vorgänge" tip={tips.vorgaenge} />
        </div>
      </div>

      <div className="chartWrap compact">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
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
            <CartesianGrid strokeDasharray="2 8" stroke="rgba(255,255,255,0.055)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "rgba(255,255,255,0.48)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickMargin={12}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.46)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tickFormatter={(value) =>
                mode === "preis"
                  ? Number(value).toLocaleString("de-DE", { maximumFractionDigits: 2 })
                  : String(value)
              }
            />

            <RTooltip
              cursor={{ stroke: "rgba(255,255,255,0.10)", strokeWidth: 1, strokeDasharray: "4 6" }}
              content={<PremiumTooltip mode={mode} />}
            />

            {mode === "energie" ? (
              <>
                <Area type="monotone" dataKey="energie" stroke="none" fill={fillByMode.energie} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="energie"
                  stroke={strokeByMode.energie}
                  strokeWidth={2.6}
                  dot={false}
                  activeDot={{ r: 4.8, fill: strokeByMode.energie, stroke: "rgba(255,255,255,0.82)", strokeWidth: 1.4 }}
                />
              </>
            ) : null}
            {mode === "kosten" ? (
              <>
                <Area type="monotone" dataKey="kosten" stroke="none" fill={fillByMode.kosten} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="kosten"
                  stroke={strokeByMode.kosten}
                  strokeWidth={2.6}
                  dot={false}
                  activeDot={{ r: 4.8, fill: strokeByMode.kosten, stroke: "rgba(20,20,28,0.9)", strokeWidth: 1.4 }}
                />
              </>
            ) : null}
            {mode === "preis" ? (
              <>
                <Area type="monotone" dataKey="preis" stroke="none" fill={fillByMode.preis} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="preis"
                  stroke={strokeByMode.preis}
                  strokeWidth={2.6}
                  dot={false}
                  activeDot={{ r: 4.8, fill: strokeByMode.preis, stroke: "rgba(20,20,28,0.9)", strokeWidth: 1.4 }}
                />
              </>
            ) : null}
            {mode === "vorgaenge" ? (
              <>
                <Area type="monotone" dataKey="vorgaenge" stroke="none" fill={fillByMode.vorgaenge} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="vorgaenge"
                  stroke={strokeByMode.vorgaenge}
                  strokeWidth={2.6}
                  dot={false}
                  activeDot={{ r: 4.8, fill: strokeByMode.vorgaenge, stroke: "rgba(20,20,28,0.9)", strokeWidth: 1.4 }}
                />
              </>
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
