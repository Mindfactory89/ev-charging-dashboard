import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { euro, num } from "../app/formatters.js";
import { createSession } from "./api.js";
import { deriveMobilityForSession } from "./sessionIntelligence.js";
import { formatTags } from "./sessionMetadata.js";
import { buildSessionMetadataOptions } from "./sessionMetadataOptions.js";
import { CONNECTOR_OPTIONS, DEFAULT_VEHICLE } from "../app/constants.js";

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

const PROVIDER_LIST_ID = "add-session-provider-options";
const LOCATION_LIST_ID = "add-session-location-options";
const VEHICLE_LIST_ID = "add-session-vehicle-options";
const TAG_LIST_ID = "add-session-tag-options";

export default function AddSessionCard({ onCreated, demo = false, intelligence = null, sessions = [] }) {
  const { t } = useI18n();
  const [date, setDate] = React.useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  });

  const [connector, setConnector] = React.useState(CONNECTOR_OPTIONS[0] || "CCS - DC");
  const [socStart, setSocStart] = React.useState(14);
  const [socEnd, setSocEnd] = React.useState(80);
  const [energyKwh, setEnergyKwh] = React.useState("0.0");
  const [pricePerKwh, setPricePerKwh] = React.useState("0.59");
  const [durationHHMM, setDurationHHMM] = React.useState("00:30");
  const [odometerKm, setOdometerKm] = React.useState("");
  const [provider, setProvider] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [vehicle, setVehicle] = React.useState(DEFAULT_VEHICLE);
  const [tags, setTags] = React.useState("");
  const [note, setNote] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const metadataOptions = React.useMemo(
    () => buildSessionMetadataOptions({ sessions, intelligence }),
    [intelligence, sessions]
  );

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

    if(!date) return setMsg(t("addSession.validation.date"));
    if(!Number.isFinite(energy) || energy <= 0) return setMsg(t("addSession.validation.energy"));
    if(!Number.isFinite(price) || price <= 0) return setMsg(t("addSession.validation.price"));
    if(dur == null || dur <= 0) return setMsg(t("addSession.validation.duration"));
    if(odometer != null && (!Number.isFinite(odometer) || odometer < 0)) return setMsg(t("addSession.validation.odometer"));
    if(odometer != null && mobilityPreview?.previousOdometerKm != null && odometer < mobilityPreview.previousOdometerKm) {
      return setMsg(t("addSession.validation.odometerMin", { value: num(mobilityPreview.previousOdometerKm, 0) }));
    }
    if(odometer != null && mobilityPreview?.nextOdometerKm != null && odometer > mobilityPreview.nextOdometerKm) {
      return setMsg(t("addSession.validation.odometerMax", { value: num(mobilityPreview.nextOdometerKm, 0) }));
    }
    if(Number(socStart) < 0 || Number(socStart) > 100) return setMsg(t("addSession.validation.socStart"));
    if(Number(socEnd) < 0 || Number(socEnd) > 100) return setMsg(t("addSession.validation.socEnd"));
    if(Number(socEnd) < Number(socStart)) return setMsg(t("addSession.validation.socOrder"));

    setBusy(true);
    try{
      await createSession({
        date,
        provider,
        location,
        vehicle,
        tags: formatTags(tags),
        connector,
        soc_start: Number(socStart),
        soc_end: Number(socEnd),
        energy_kwh: energy,
        price_per_kwh: price,
        duration_seconds: dur,
        odometer_km: odometer != null ? Math.round(odometer) : null,
        note: note || null,
      });
      setMsg(t("addSession.messages.saved"));
      setNote("");
      onCreated?.();
    }catch(err){
      setMsg(t("addSession.messages.error", { error: String(err?.message || err) }));
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="card glassStrong formCard">
      <div className="sectionHeader">
        <div>
          <div className="sectionKicker">{t("addSession.kicker")}</div>
          <div className="sectionTitle">{t("addSession.title")}</div>
        </div>
        <div className="pill ghostPill">{demo ? t("addSession.metaDemo") : t("addSession.metaLive")}</div>
      </div>

      <div className="formPreviewGrid">
        <div className="formPreviewCard warm">
          <div className="formPreviewLabel">{t("addSession.preview.totalCost")}</div>
          <div className="formPreviewValue">
            {Number.isFinite(previewCost) ? euro(previewCost) : "–"}
          </div>
          <div className="formPreviewSub">{t("addSession.preview.totalCostSub")}</div>
        </div>

        <div className="formPreviewCard">
          <div className="formPreviewLabel">{t("addSession.preview.socDelta")}</div>
          <div className="formPreviewValue">{Number.isFinite(previewSocDelta) ? `${previewSocDelta} %` : "–"}</div>
          <div className="formPreviewSub">{socStart} → {socEnd}</div>
        </div>

        <div className="formPreviewCard">
          <div className="formPreviewLabel">{t("addSession.preview.avgPower")}</div>
          <div className="formPreviewValue">
            {Number.isFinite(previewPower) ? `${num(previewPower, 1)} kW` : "–"}
          </div>
          <div className="formPreviewSub">{t("addSession.preview.avgPowerSub")}</div>
        </div>

        <div className="formPreviewCard cool">
          <div className="formPreviewLabel">{t("addSession.preview.mobility")}</div>
          <div className="formPreviewValue">{previewCostPer100Km != null ? `${num(previewCostPer100Km, 2)} €/100 km` : connector || "–"}</div>
          <div className="formPreviewSub">
            {previewDistanceKm != null
              ? t("addSession.preview.distanceSub", { distance: num(previewDistanceKm, 0) })
              : latestKnownOdometer != null
                ? t("addSession.preview.previousOdometerSub", { value: num(latestKnownOdometer, 0) })
                : date || t("addSession.preview.noDateSub")}
          </div>
        </div>
      </div>

      <form className="formGrid" onSubmit={submit}>
        <label className="field fieldBig">
          <span>{t("addSession.fields.date")}</span>
          <input className="input" type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
        </label>

        <label className="field">
          <span>{t("addSession.fields.provider")}</span>
          <input
            className="input"
            list={metadataOptions.providers.length ? PROVIDER_LIST_ID : undefined}
            value={provider}
            onChange={(e)=>setProvider(e.target.value)}
            placeholder={t("addSession.placeholders.provider")}
          />
        </label>

        <label className="field">
          <span>{t("addSession.fields.location")}</span>
          <input
            className="input"
            list={metadataOptions.locations.length ? LOCATION_LIST_ID : undefined}
            value={location}
            onChange={(e)=>setLocation(e.target.value)}
            placeholder={t("addSession.placeholders.location")}
          />
        </label>

        <label className="field">
          <span>{t("addSession.fields.vehicle")}</span>
          <input
            className="input"
            list={metadataOptions.vehicles.length ? VEHICLE_LIST_ID : undefined}
            value={vehicle}
            onChange={(e)=>setVehicle(e.target.value)}
            placeholder={t("addSession.placeholders.vehicle")}
          />
        </label>

        <label className="field">
          <span>{t("addSession.fields.tags")}</span>
          <input
            className="input"
            list={metadataOptions.tags.length ? TAG_LIST_ID : undefined}
            value={tags}
            onChange={(e)=>setTags(e.target.value)}
            placeholder={t("addSession.placeholders.tags")}
          />
        </label>

        <label className="field">
          <span>{t("addSession.fields.connector")}</span>
          <select className="input" value={connector} onChange={(e)=>setConnector(e.target.value)}>
            {CONNECTOR_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{t("addSession.fields.socStart")}</span>
          <select className="input" value={socStart} onChange={(e)=>setSocStart(e.target.value)}>
            {socOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>

        <label className="field">
          <span>{t("addSession.fields.socEnd")}</span>
          <select className="input" value={socEnd} onChange={(e)=>setSocEnd(e.target.value)}>
            {socOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>

        <label className="field">
          <span>{t("addSession.fields.energy")}</span>
          <input className="input" value={energyKwh} onChange={(e)=>setEnergyKwh(e.target.value)} placeholder={t("addSession.placeholders.energy")} />
        </label>

        <label className="field">
          <span>{t("addSession.fields.pricePerKwh")}</span>
          <input className="input" value={pricePerKwh} onChange={(e)=>setPricePerKwh(e.target.value)} placeholder={t("addSession.placeholders.pricePerKwh")} />
        </label>

        <label className="field">
          <span>{t("addSession.fields.duration")}</span>
          <input className="input" value={durationHHMM} onChange={(e)=>setDurationHHMM(e.target.value)} placeholder={t("addSession.placeholders.duration")} />
        </label>

        <label className="field">
          <span>{t("addSession.fields.odometer")}</span>
          <input className="input" type="number" min="0" value={odometerKm} onChange={(e)=>setOdometerKm(e.target.value)} placeholder={t("addSession.placeholders.odometer")} />
        </label>

        <label className="field fieldWide">
          <span>{t("addSession.fields.note")}</span>
          <textarea
            className="input inputArea"
            value={note}
            onChange={(e)=>setNote(e.target.value)}
            placeholder={t("addSession.placeholders.note")}
          />
        </label>

        <div className="field fieldWide formActionRow">
          <div className="formHint">
            {demo
              ? t("addSession.hint.demo")
              : t("addSession.hint.live")}
            {" "}
            {latestKnownOdometer != null
              ? t("addSession.hint.latestOdometer", { value: num(latestKnownOdometer, 0) })
              : t("addSession.hint.firstOdometer")}
          </div>
          <button className="btnPrimary" type="submit" disabled={busy}>
            {busy ? t("addSession.saveBusy") : t("common.save")}
          </button>
          {msg ? <div className="formMsg">{msg}</div> : null}
        </div>
      </form>

      {metadataOptions.providers.length ? (
        <datalist id={PROVIDER_LIST_ID}>
          {metadataOptions.providers.map((value) => <option key={value} value={value} />)}
        </datalist>
      ) : null}
      {metadataOptions.locations.length ? (
        <datalist id={LOCATION_LIST_ID}>
          {metadataOptions.locations.map((value) => <option key={value} value={value} />)}
        </datalist>
      ) : null}
      {metadataOptions.vehicles.length ? (
        <datalist id={VEHICLE_LIST_ID}>
          {metadataOptions.vehicles.map((value) => <option key={value} value={value} />)}
        </datalist>
      ) : null}
      {metadataOptions.tags.length ? (
        <datalist id={TAG_LIST_ID}>
          {metadataOptions.tags.map((value) => <option key={value} value={value} />)}
        </datalist>
      ) : null}
    </div>
  );
}
