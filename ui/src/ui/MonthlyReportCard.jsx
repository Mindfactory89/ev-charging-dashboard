import React from "react";
import Tooltip from "./Tooltip.jsx";
import { monthLabel } from "./monthLabels.js";
import { getWeekdayUsage } from "./loadRhythm.js";

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

function monthMedians(sessions, month) {
  const values = (sessions || [])
    .filter((session) => {
      const date = new Date(session.date);
      return !Number.isNaN(date.getTime()) && date.getUTCMonth() + 1 === month;
    });

  const costValues = values.map((session) => Number(session.total_cost)).filter((value) => Number.isFinite(value));
  const priceValues = values
    .map((session) => {
      const energy = Number(session.energy_kwh);
      const cost = Number(session.total_cost);
      return Number.isFinite(energy) && energy > 0 && Number.isFinite(cost) ? cost / energy : null;
    })
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  function median(clean) {
    if (!clean.length) return null;
    const mid = Math.floor(clean.length / 2);
    if (clean.length % 2 === 1) return clean[mid];
    return (clean[mid - 1] + clean[mid]) / 2;
  }

  return {
    cost: median([...costValues].sort((left, right) => left - right)),
    price: median(priceValues),
  };
}

export default function MonthlyReportCard({ months, sessions = [], year = 2026 }) {
  const activeMonths = React.useMemo(
    () => (Array.isArray(months) ? months.filter((month) => Number(month?.count || 0) > 0) : []),
    [months]
  );

  const current = activeMonths[activeMonths.length - 1] || null;
  const previous = activeMonths.length > 1 ? activeMonths[activeMonths.length - 2] : null;
  const currentMedian = current ? monthMedians(sessions, current.month) : { cost: null, price: null };
  const currentWeekday = React.useMemo(
    () => (current ? getWeekdayUsage(sessions, { year, month: current.month }).top : null),
    [current, sessions, year]
  );
  const yearWeekday = React.useMemo(() => getWeekdayUsage(sessions, { year }).top, [sessions, year]);

  function delta(currentValue, previousValue, digits = 1, suffix = "") {
    const left = Number(currentValue);
    const right = Number(previousValue);
    if (!Number.isFinite(left) || !Number.isFinite(right) || right === 0) return "–";
    const diff = ((left - right) / right) * 100;
    return `${diff > 0 ? "+" : ""}${num(diff, digits)}%${suffix}`;
  }

  return (
    <section className="row">
      <div className="card glassStrong analysisPanel premiumEditorialReportCard">
        <div className="panelHeader">
          <div>
            <div className="sectionKicker">Bericht</div>
            <div className="ttTitleRow panelTitleRow">
              <div className="sectionTitle">Persönlicher Monatsbericht ({year})</div>
              <Tooltip
                placement="top"
                openDelayMs={120}
                closeDelayMs={220}
                content="Der Bericht fokussiert den zuletzt aktiven Monat und stellt ihn direkt dem vorherigen aktiven Monat gegenüber."
              >
                <button className="ttTrigger" type="button" aria-label="Erklärung: Persönlicher Monatsbericht">
                  i
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="pill ghostPill panelMetaPill">
            {current ? `${monthLabel(current.month)} im Fokus` : "Keine Monatsdaten"}
          </div>
        </div>

        <div className="summaryGrid premiumEditorialSummaryGrid">
          {current ? (
            <>
              <div className="summaryCard warm">
                <div className="summaryLabel">Monatskosten</div>
                <div className="summaryValue">{euro(current.cost)}</div>
                <div className="summarySub">
                  {previous ? `${delta(current.cost, previous.cost, 0)} vs. ${monthLabel(previous.month)}` : "Erster aktiver Monat"}
                </div>
              </div>

              <div className="summaryCard frost">
                <div className="summaryLabel">Monatsenergie</div>
                <div className="summaryValue">{`${num(current.energy_kwh, 1)} kWh`}</div>
                <div className="summarySub">
                  {previous ? `${delta(current.energy_kwh, previous.energy_kwh, 0)} vs. ${monthLabel(previous.month)}` : "Erster aktiver Monat"}
                </div>
              </div>

              <div className="summaryCard mint">
                <div className="summaryLabel">Median Kosten</div>
                <div className="summaryValue">{euro(currentMedian.cost)}</div>
                <div className="summarySub">Typische Sessionkosten im Fokusmonat</div>
              </div>

              <div className="summaryCard">
                <div className="summaryLabel">Median Preis</div>
                <div className="summaryValue">{currentMedian.price != null ? `${num(currentMedian.price, 3)} €/kWh` : "–"}</div>
                <div className="summarySub">Typisches Preisniveau im Fokusmonat</div>
              </div>

              <div className="summaryCard frost">
                <div className="summaryLabel">Top-Ladetag Monat</div>
                <div className="summaryValue">{currentWeekday?.label || "–"}</div>
                <div className="summarySub">
                  {currentWeekday ? `${num(currentWeekday.count, 0)} Sessions • ${num(currentWeekday.share, 0)} % Anteil` : "Noch kein klarer Rhythmus"}
                </div>
              </div>

              <div className="summaryCard mint">
                <div className="summaryLabel">Top-Ladetag Jahr</div>
                <div className="summaryValue">{yearWeekday?.label || "–"}</div>
                <div className="summarySub">
                  {yearWeekday ? `${num(yearWeekday.count, 0)} Sessions • wiederkehrendster Wochentag` : "Noch kein Jahresrhythmus"}
                </div>
              </div>
            </>
          ) : (
            <div className="emptyStateCard">Noch kein Monatsbericht für {year} vorhanden.</div>
          )}
        </div>

        {current ? (
          <div className="metricNarrative">
            <b>{monthLabel(current.month)}</b> war dein zuletzt aktiver Monat mit{" "}
            <b>{num(current.count, 0)} Sessions</b> und <b>{euro(current.cost)}</b> Gesamtkosten.{" "}
            {currentWeekday ? `${currentWeekday.label} war dabei dein prägendster Ladetag im Fokusmonat. ` : ""}
            {previous
              ? `Gegenüber ${monthLabel(previous.month)} hat sich vor allem die Kombination aus Kosten, Energiemenge und Preisniveau verändert.`
              : "Sobald ein zweiter aktiver Monat vorliegt, wird hier automatisch der direkte Vormonatsvergleich ergänzt."}
          </div>
        ) : null}
      </div>
    </section>
  );
}
