import React from "react";
import { deleteSession, getSessionsCsvUrl } from "./api.js";

function euro(n) {
  if (n == null || Number.isNaN(Number(n))) return "–";
  return Number(n).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
function num(n, d = 1) {
  if (n == null || Number.isNaN(Number(n))) return "–";
  return Number(n).toLocaleString("de-DE", { maximumFractionDigits: d });
}
function datumDE(d) {
  try {
    return new Date(d).toLocaleDateString("de-DE");
  } catch {
    return "–";
  }
}
function secsToHHMM(s) {
  const n = Number(s || 0);
  if (!Number.isFinite(n) || n <= 0) return "–";
  const hh = Math.floor(n / 3600);
  const mm = Math.round((n % 3600) / 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function SessionsCard({ sessions = [], year = 2026, onDeleted }) {
  const hasMany = sessions.length > 5;
  const sessionsCsvUrl = getSessionsCsvUrl(year);
  const latestDate = sessions.reduce((latest, row) => {
    const ts = row?.date ? new Date(row.date).getTime() : NaN;
    if (!Number.isFinite(ts)) return latest;
    if (!latest || ts > latest.ts) return { ts, label: datumDE(row.date) };
    return latest;
  }, null)?.label;

  async function onDeleteRow(row) {
    const ok = window.confirm(`Ladevorgang vom ${datumDE(row?.date)} wirklich löschen?`);
    if (!ok) return;

    try {
      await deleteSession(row.id);
      // Refresh bevorzugt über Callback, sonst Hard-Reload
      if (typeof onDeleted === "function") onDeleted();
      else window.location.reload();
    } catch (e) {
      alert(String(e?.message || e));
    }
  }

  return (
    <div className="card glassStrong">
      <div className="sectionHeader stickyHeader">
        <div>
          <div className="sectionKicker">Verlauf</div>
          <div className="sectionTitle">Letzte Ladevorgänge</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className="pill"
            type="button"
            onClick={() => {
              if (!sessionsCsvUrl) return;
              window.open(sessionsCsvUrl, "_blank", "noopener,noreferrer");
            }}
            title="CSV exportieren"
            disabled={!sessionsCsvUrl}
          >
            CSV Export
          </button>
          {latestDate ? <div className="pill ghostPill">Zuletzt: {latestDate}</div> : null}
          <div className="pill ghostPill">{sessions.length} gesamt</div>
        </div>
      </div>

      <div className="tableWrap">
        <div className="tableHead">
          <div>Datum</div>
          <div>Anschluss</div>
          <div>SoC</div>
          <div>Energie</div>
          <div>Dauer</div>
          <div>Kosten</div>
        </div>

        <div className={`tableBody ${hasMany ? "tableBodyScroll" : ""}`}>
          {sessions.length === 0 ? (
            <div className="emptyRow">Noch keine Ladevorgänge.</div>
          ) : (
            sessions.map((s) => (
              <div className="tableRow" key={s.id}>
                <div>
                  <div className="tablePrimary">{datumDE(s.date)}</div>
                  <div className="tableSecondary">{s.note || "Erfasste Session"}</div>
                </div>
                <div>
                  <span className="tableBadge">{s.connector || "–"}</span>
                </div>
                <div>
                  <span className="tableSoc">
                    {s.soc_start} → {s.soc_end} %
                  </span>
                </div>
                <div className="tableValueStrong">{num(s.energy_kwh, 1)} kWh</div>
                <div className="tableValueSoft">{secsToHHMM(s.duration_seconds)}</div>

                <div className="tableCostCell">
                  <span className="tableValueStrong">{euro(s.total_cost)}</span>
                  <button
                    type="button"
                    className="rowDeleteBtn"
                    title="Ladevorgang löschen"
                    aria-label="Ladevorgang löschen"
                    onClick={() => onDeleteRow(s)}
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
