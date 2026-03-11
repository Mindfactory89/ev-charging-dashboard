import React from "react";
import { createSession } from "./api.js";
import { buildImportPreview } from "./sessionImport.js";

export default function ImportSessionsCard({ onImported, sessions = [] }) {
  const [fileName, setFileName] = React.useState("");
  const [preview, setPreview] = React.useState(null);
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function onFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setFileName(file.name);
    setPreview(buildImportPreview(text, sessions));
    setMessage("");
  }

  async function runImport() {
    const rows = (preview?.rows || []).filter((row) => row.ready);
    if (!rows.length) {
      setMessage("Keine importierbaren Zeilen im Preview.");
      return;
    }

    setBusy(true);
    setMessage("");
    let imported = 0;

    try {
      for (const row of rows) {
        await createSession(row.payload);
        imported += 1;
      }
      setMessage(`${imported} Sessions importiert.`);
      await onImported?.();
    } catch (error) {
      setMessage(`Import abgebrochen nach ${imported} Zeilen: ${String(error?.message || error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card glassStrong formCard">
      <div className="sectionHeader">
        <div>
          <div className="sectionKicker">Import</div>
          <div className="sectionTitle">CSV mit Preview und Dedupe</div>
        </div>
        <div className="pill ghostPill">{fileName || "Noch keine Datei"}</div>
      </div>

      <div className="formGrid">
        <label className="field fieldWide">
          <span>CSV-Datei</span>
          <input className="input" type="file" accept=".csv,text/csv" onChange={onFileSelected} />
        </label>
      </div>

      {preview ? (
        <>
          <div className="summaryGrid">
            <div className="summaryCard warm">
              <div className="summaryLabel">Gesamt</div>
              <div className="summaryValue">{preview.summary.total}</div>
              <div className="summarySub">erkannte CSV-Zeilen</div>
            </div>
            <div className="summaryCard mint">
              <div className="summaryLabel">Importierbar</div>
              <div className="summaryValue">{preview.summary.ready}</div>
              <div className="summarySub">bereit für Create</div>
            </div>
            <div className="summaryCard frost">
              <div className="summaryLabel">Duplikate</div>
              <div className="summaryValue">{preview.summary.duplicates}</div>
              <div className="summarySub">bereits vorhanden oder doppelt in CSV</div>
            </div>
            <div className="summaryCard">
              <div className="summaryLabel">Ungültig</div>
              <div className="summaryValue">{preview.summary.invalid}</div>
              <div className="summarySub">Pflichtfelder fehlen</div>
            </div>
          </div>

          <div className="tableWrap" style={{ marginTop: 16 }}>
            <div className="tableHead">
              <div>Zeile</div>
              <div>Datum</div>
              <div>Anbieter</div>
              <div>Ort / Fahrzeug</div>
              <div>Energie</div>
              <div>Status</div>
            </div>

            <div className="tableBody tableBodyScroll">
              {preview.rows.slice(0, 12).map((row) => (
                <div key={`preview-${row.index}`} className="tableRow">
                  <div className="tablePrimary">#{row.index}</div>
                  <div>{row.payload.date || "–"}</div>
                  <div>{row.payload.provider || "–"}</div>
                  <div>
                    <div className="tablePrimary">{row.payload.location || "–"}</div>
                    <div className="tableSecondary">{row.payload.vehicle || "–"}</div>
                  </div>
                  <div>{row.payload.energy_kwh != null ? `${row.payload.energy_kwh} kWh` : "–"}</div>
                  <div>
                    {row.ready
                      ? "Bereit"
                      : row.duplicateExisting
                        ? "Duplikat im Verlauf"
                        : row.duplicateImport
                          ? "Duplikat in CSV"
                          : `Fehlt: ${row.missing.join(", ")}`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="tableEditActions" style={{ marginTop: 16 }}>
            <div className="formHint">
              Auto-Mapping nutzt übliche Felder wie `date`, `provider`, `location`, `vehicle`, `tags`, `connector`,
              `soc_start`, `soc_end`, `energy_kwh`, `price_per_kwh`, `total_cost`, `duration` und `odometer_km`.
            </div>
            <button type="button" className="pill pillWarm" onClick={runImport} disabled={busy || preview.summary.ready === 0}>
              {busy ? "Import läuft…" : `${preview.summary.ready} Sessions importieren`}
            </button>
          </div>
        </>
      ) : null}

      {message ? <div className="formMsg">{message}</div> : null}
    </div>
  );
}
