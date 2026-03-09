import React from "react";
import { createSession } from "./api.js";
import { deriveMobilityForSession } from "./sessionIntelligence.js";

function pad2(n){ return String(n).padStart(2,"0"); }

function hhmmToSeconds(hhmm){
  // akzeptiert "0:30", "00:30", "01:43"
  const s = String(hhmm || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if(!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if(!Number.isFinite(hh) || !Number.isFinite(mm) || mm>59) return null;
  return hh*3600 + mm*60;
}

const CONNECTOR_OPTIONS = ["CCS - DC", "CCS AC", "Wallbox AC"];

export default function AddSessionCard({ onCreated, demo = false, sessions = [] }) {
  const [date, setDate] = React.useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  });

  const [connector, setConnector] = React.useState("CCS - DC");
  const [socStart, setSocStart] = React.useState(14);
  const [socEnd, setSocEnd] = React.useState(80);
  const [energyKwh, setEnergyKwh] = React.useState("0.0");
  const [pricePerKwh, setPricePerKwh] = React.useState("0.59");
  const [durationHHMM, setDurationHHMM] = React.useState("00:30");
  const [odometerKm, setOdometerKm] = React.useState("");
  const [note, setNote] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  const socOptions = Array.from({ length: 101 }, (_, i) => i);
  const parsedEnergy = Number(String(energyKwh).replace(",", "."));
  const parsedPrice = Number(String(pricePerKwh).replace(",", "."));
  const parsedDuration = hhmmToSeconds(durationHHMM);
  const parsedOdometer = odometerKm === "" ? null : Number(odometerKm);
  const previewCost = Number.isFinite(parsedEnergy) && Number.isFinite(parsedPrice) ? parsedEnergy * parsedPrice : null;
  const previewPower =
    Number.isFinite(parsedEnergy) && Number.isFinite(parsedDuration) && parsedDuration > 0
      ? parsedEnergy / (parsedDuration / 3600)
      : null;
  const previewSocDelta = Math.max(0, Number(socEnd) - Number(socStart));
  const mobilityPreview = React.useMemo(() => {
    if (!Number.isFinite(parsedOdometer)) return null;
    return deriveMobilityForSession(sessions, {
      id: "__add-preview__",
      date,
      energy_kwh: parsedEnergy,
      total_cost: previewCost,
      duration_seconds: parsedDuration,
      price_per_kwh: parsedPrice,
      soc_start: Number(socStart),
      soc_end: Number(socEnd),
      odo_end_km: parsedOdometer,
    });
  }, [date, parsedDuration, parsedEnergy, parsedOdometer, parsedPrice, previewCost, sessions, socEnd, socStart]);
  const latestKnownOdometer = mobilityPreview?.previousOdometerKm ?? null;
  const previewDistanceKm = mobilityPreview?.distanceKm ?? null;
  const previewCostPer100Km =
    Number.isFinite(previewCost) && Number.isFinite(previewDistanceKm) && previewDistanceKm > 0
      ? (previewCost / previewDistanceKm) * 100
      : null;

  async function submit(e){
    e.preventDefault();
    setMsg(null);

    const energy = Number(String(energyKwh).replace(",", "."));
    const price = Number(String(pricePerKwh).replace(",", "."));
    const dur = hhmmToSeconds(durationHHMM);
    const odometer = odometerKm === "" ? null : Number(odometerKm);

    if(!date) return setMsg("Bitte Datum auswählen.");
    if(!Number.isFinite(energy) || energy <= 0) return setMsg("Energie (kWh) muss > 0 sein.");
    if(!Number.isFinite(price) || price <= 0) return setMsg("Kosten pro kWh muss > 0 sein.");
    if(dur == null || dur <= 0) return setMsg("Dauer bitte als HH:MM eingeben (z.B. 00:30 oder 01:43).");
    if(odometer != null && (!Number.isFinite(odometer) || odometer < 0)) return setMsg("Kilometerstand muss eine positive Ganzzahl sein.");
    if(odometer != null && mobilityPreview?.previousOdometerKm != null && odometer < mobilityPreview.previousOdometerKm) {
      return setMsg(`Kilometerstand darf nicht kleiner als ${mobilityPreview.previousOdometerKm} km sein.`);
    }
    if(odometer != null && mobilityPreview?.nextOdometerKm != null && odometer > mobilityPreview.nextOdometerKm) {
      return setMsg(`Kilometerstand darf nicht größer als ${mobilityPreview.nextOdometerKm} km sein.`);
    }
    if(Number(socStart) < 0 || Number(socStart) > 100) return setMsg("SoC Start muss 0–100 sein.");
    if(Number(socEnd) < 0 || Number(socEnd) > 100) return setMsg("SoC Ende muss 0–100 sein.");
    if(Number(socEnd) < Number(socStart)) return setMsg("SoC Ende darf nicht kleiner als SoC Start sein.");

    setBusy(true);
    try{
      await createSession({
        date,
        connector,
        soc_start: Number(socStart),
        soc_end: Number(socEnd),
        energy_kwh: energy,
        price_per_kwh: price,
        duration_seconds: dur,
        odometer_km: odometer != null ? Math.round(odometer) : null,
        note: note || null,
      });
      setMsg("Ladevorgang gespeichert.");
      setNote("");
      onCreated?.();
    }catch(err){
      setMsg(`Fehler: ${String(err?.message || err)}`);
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="card glassStrong formCard">
      <div className="sectionHeader">
        <div>
          <div className="sectionKicker">Eingabe</div>
          <div className="sectionTitle">Ladevorgang hinzufügen</div>
        </div>
        <div className="pill ghostPill">{demo ? "Manuell • Nur Demo" : "Manuell • Sofort in DB"}</div>
      </div>

      <div className="formPreviewGrid">
        <div className="formPreviewCard warm">
          <div className="formPreviewLabel">Gesamtkosten</div>
          <div className="formPreviewValue">
            {Number.isFinite(previewCost)
              ? previewCost.toLocaleString("de-DE", { style: "currency", currency: "EUR" })
              : "–"}
          </div>
          <div className="formPreviewSub">aus Energie × Preis</div>
        </div>

        <div className="formPreviewCard">
          <div className="formPreviewLabel">SoC-Hub</div>
          <div className="formPreviewValue">{Number.isFinite(previewSocDelta) ? `${previewSocDelta} %` : "–"}</div>
          <div className="formPreviewSub">{socStart} → {socEnd}</div>
        </div>

        <div className="formPreviewCard">
          <div className="formPreviewLabel">Ø Ladeleistung</div>
          <div className="formPreviewValue">
            {Number.isFinite(previewPower) ? `${previewPower.toLocaleString("de-DE", { maximumFractionDigits: 1 })} kW` : "–"}
          </div>
          <div className="formPreviewSub">aus kWh und Dauer</div>
        </div>

        <div className="formPreviewCard cool">
          <div className="formPreviewLabel">Mobilität</div>
          <div className="formPreviewValue">{previewCostPer100Km != null ? `${previewCostPer100Km.toLocaleString("de-DE", { maximumFractionDigits: 2 })} €/100 km` : connector || "–"}</div>
          <div className="formPreviewSub">
            {previewDistanceKm != null
              ? `${previewDistanceKm} km seit letzter Session`
              : latestKnownOdometer != null
                ? `vorher ${latestKnownOdometer} km`
                : date || "Kein Datum"}
          </div>
        </div>
      </div>

      <form className="formGrid" onSubmit={submit}>
        <label className="field fieldBig">
          <span>Datum</span>
          <input className="input" type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
        </label>

        <label className="field">
          <span>Anschluss</span>
          <select className="input" value={connector} onChange={(e)=>setConnector(e.target.value)}>
            {CONNECTOR_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>SoC Start</span>
          <select className="input" value={socStart} onChange={(e)=>setSocStart(e.target.value)}>
            {socOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>

        <label className="field">
          <span>SoC Ende</span>
          <select className="input" value={socEnd} onChange={(e)=>setSocEnd(e.target.value)}>
            {socOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>

        <label className="field">
          <span>Energie (kWh)</span>
          <input className="input" value={energyKwh} onChange={(e)=>setEnergyKwh(e.target.value)} placeholder="68.675" />
        </label>

        <label className="field">
          <span>Kosten pro kWh (€)</span>
          <input className="input" value={pricePerKwh} onChange={(e)=>setPricePerKwh(e.target.value)} placeholder="0.59" />
        </label>

        <label className="field">
          <span>Dauer (HH:MM)</span>
          <input className="input" value={durationHHMM} onChange={(e)=>setDurationHHMM(e.target.value)} placeholder="00:30" />
        </label>

        <label className="field">
          <span>Aktueller Kilometerstand nach der Ladung</span>
          <input className="input" type="number" min="0" value={odometerKm} onChange={(e)=>setOdometerKm(e.target.value)} placeholder="18390" />
        </label>

        <label className="field fieldWide">
          <span>Notiz (optional)</span>
          <textarea
            className="input inputArea"
            value={note}
            onChange={(e)=>setNote(e.target.value)}
            placeholder="z.B. Wetter, spontane Zwischenladung, Staupause, Urlaubstrip…"
          />
        </label>

        <div className="field fieldWide formActionRow">
          <div className="formHint">
            {demo
              ? "Wird nur lokal in der Demo gehalten. Der aktuelle KM-Stand wird als neuer Endstand gespeichert; die Distanz ergibt sich aus der Differenz zum vorherigen Eintrag."
              : "Wird direkt in PostgreSQL gespeichert. Der aktuelle KM-Stand wird als neuer Endstand gespeichert; die Distanz ergibt sich aus der Differenz zum vorherigen Eintrag."}
            {latestKnownOdometer != null ? ` Letzter bekannter Kilometerstand: ${latestKnownOdometer} km.` : " Der erste eingetragene KM-Stand dient nur als Referenz und erzeugt noch keine Fahrdistanz."}
          </div>
          <button className="btnPrimary" type="submit" disabled={busy}>
            {busy ? "Speichern…" : "Speichern"}
          </button>
          {msg ? <div className="formMsg">{msg}</div> : null}
        </div>
      </form>
    </div>
  );
}
