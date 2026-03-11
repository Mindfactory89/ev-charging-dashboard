import React from "react";
import { deleteSession, getSessionsCsvUrl, restoreSession, updateSession } from "./api.js";
import Tooltip from "./Tooltip.jsx";
import SessionDetailDrawer from "./SessionDetailDrawer.jsx";
import { deriveMobilityForSession, getSessionOdometerKm } from "./sessionIntelligence.js";
import { downloadFileFromUrl } from "../platform/download.js";
import { confirmAction, reloadCurrentPage, showAlert } from "../platform/runtime.js";
import { formatTags, parseTags } from "./sessionMetadata.js";
import { buildSessionMetadataOptions } from "./sessionMetadataOptions.js";

const DEFAULT_CONNECTORS = ["CCS - DC", "CCS AC", "Wallbox AC"];
const PROVIDER_LIST_ID = "history-session-provider-options";
const LOCATION_LIST_ID = "history-session-location-options";
const VEHICLE_LIST_ID = "history-session-vehicle-options";
const TAG_LIST_ID = "history-session-tag-options";

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
  const totalMinutes = Math.round(n / 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function monthNumber(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getMonth() + 1;
}
function hhmmToSeconds(hhmm) {
  const raw = String(hhmm || "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || mm > 59) return null;
  return hh * 3600 + mm * 60;
}

function parseDecimalInput(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

function parseIntegerInput(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return Number.NaN;
  return Number(raw);
}

function resolveDecimalInput(value, fallback = null) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  return parseDecimalInput(raw);
}

function resolveDurationInput(value, fallback = null) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  return hhmmToSeconds(raw);
}

function resolveBoundedIntegerInput(value, fallback = null) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed)) return Number.NaN;
  return parsed;
}

function effectivePricePerKwh(row) {
  const direct = Number(row?.price_per_kwh);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const energy = Number(row?.energy_kwh);
  const cost = Number(row?.total_cost);
  if (!Number.isFinite(energy) || energy <= 0 || !Number.isFinite(cost) || cost < 0) return null;
  return cost / energy;
}

function sessionScoreTone(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "neutral";
  if (value >= 80) return "success";
  if (value >= 65) return "warm";
  if (value >= 50) return "warn";
  return "danger";
}

function sessionScoreLabel(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "Kein Score";
  if (value >= 80) return "Top";
  if (value >= 65) return "Effizient";
  if (value >= 50) return "Solide";
  return "Auffällig";
}

function buildEditDraft(row) {
  const pricePerKwh = effectivePricePerKwh(row);
  const duration = secsToHHMM(row?.duration_seconds);
  const odometerKm = getSessionOdometerKm(row);
  return {
    date: row?.date ? new Date(row.date).toISOString().slice(0, 10) : "",
    provider: row?.provider || "",
    location: row?.location || "",
    vehicle: row?.vehicle || "",
    tags: row?.tags || "",
    connector: row?.connector || DEFAULT_CONNECTORS[0],
    soc_start: String(row?.soc_start ?? 10),
    soc_end: String(row?.soc_end ?? 80),
    energy_kwh: row?.energy_kwh != null ? String(row.energy_kwh) : "",
    price_per_kwh: pricePerKwh != null ? String(Number(pricePerKwh).toFixed(3)) : "",
    duration_hhmm: duration === "–" ? "" : duration,
    odometer_km: odometerKm != null ? String(odometerKm) : "",
    note: row?.note || "",
  };
}

function normalizeDraftForCompare(draft) {
  return {
    date: String(draft?.date || ""),
    provider: String(draft?.provider || "").trim(),
    location: String(draft?.location || "").trim(),
    vehicle: String(draft?.vehicle || "").trim(),
    tags: formatTags(draft?.tags || ""),
    connector: String(draft?.connector || DEFAULT_CONNECTORS[0]),
    soc_start: Number.parseInt(String(draft?.soc_start || ""), 10),
    soc_end: Number.parseInt(String(draft?.soc_end || ""), 10),
    energy_kwh: Number.isFinite(parseDecimalInput(draft?.energy_kwh)) ? Number(parseDecimalInput(draft?.energy_kwh).toFixed(3)) : null,
    price_per_kwh: Number.isFinite(parseDecimalInput(draft?.price_per_kwh)) ? Number(parseDecimalInput(draft?.price_per_kwh).toFixed(3)) : null,
    duration_seconds: hhmmToSeconds(draft?.duration_hhmm),
    odometer_km: parseIntegerInput(draft?.odometer_km),
    note: String(draft?.note || "").trim(),
  };
}

function draftHasChanges(row, draft) {
  if (!row || !draft) return false;
  const current = normalizeDraftForCompare(draft);
  const baseline = normalizeDraftForCompare(buildEditDraft(row));
  return JSON.stringify(current) !== JSON.stringify(baseline);
}

function buildDraftPreview(draft, sessions = [], sessionId = null, baseRow = null) {
  const fallbackPrice = effectivePricePerKwh(baseRow);
  const energy = resolveDecimalInput(draft?.energy_kwh, Number(baseRow?.energy_kwh));
  const price = resolveDecimalInput(draft?.price_per_kwh, fallbackPrice);
  const durationSeconds = resolveDurationInput(draft?.duration_hhmm, Number(baseRow?.duration_seconds));
  const socStart = resolveBoundedIntegerInput(draft?.soc_start, Number(baseRow?.soc_start));
  const socEnd = resolveBoundedIntegerInput(draft?.soc_end, Number(baseRow?.soc_end));
  const odometerKm = parseIntegerInput(draft?.odometer_km);
  const socDelta = Number.isInteger(socStart) && Number.isInteger(socEnd) ? socEnd - socStart : null;
  const totalCost = Number.isFinite(energy) && energy > 0 && Number.isFinite(price) && price > 0 ? energy * price : null;
  const avgPowerKw =
    Number.isFinite(energy) && energy > 0 && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? energy / (durationSeconds / 3600)
      : null;
  const odometerValid = odometerKm == null || Number.isInteger(odometerKm);
  const candidate = odometerValid
    ? deriveMobilityForSession(sessions, {
        id: sessionId || "__draft__",
        date: draft?.date || (baseRow?.date ? new Date(baseRow.date).toISOString().slice(0, 10) : new Date().toISOString()),
        energy_kwh: energy,
        total_cost: totalCost,
        duration_seconds: durationSeconds,
        price_per_kwh: price,
        soc_start: socStart,
        soc_end: socEnd,
        odo_end_km: odometerKm,
      })
    : null;
  const distanceKm = candidate?.distanceKm ?? null;
  const costPer100Km = candidate?.costPer100Km ?? null;
  const sequenceValid =
    odometerKm == null ||
    ((candidate?.previousOdometerKm == null || odometerKm >= candidate.previousOdometerKm) &&
      (candidate?.nextOdometerKm == null || odometerKm <= candidate.nextOdometerKm));
  const canSave =
    !!(draft?.date || baseRow?.date) &&
    Number.isFinite(energy) &&
    energy > 0 &&
    Number.isFinite(price) &&
    price > 0 &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0 &&
    Number.isInteger(socStart) &&
    socStart >= 0 &&
    socStart <= 100 &&
    Number.isInteger(socEnd) &&
    socEnd >= 0 &&
    socEnd <= 100 &&
    socEnd >= socStart &&
    odometerValid &&
    sequenceValid;

  return {
    totalCost,
    avgPowerKw,
    durationSeconds,
    odometerKm,
    previousOdometerKm: candidate?.previousOdometerKm ?? null,
    nextOdometerKm: candidate?.nextOdometerKm ?? null,
    distanceKm,
    costPer100Km,
    socDelta,
    energy,
    price,
    socStart,
    socEnd,
    canSave,
  };
}

export default function SessionsCard({
  filters = {},
  intelligence = null,
  onFiltersChange,
  sessions = [],
  year = 2026,
  onChanged,
  sessionScoresById = {},
  sessionOutliersById = {},
}) {
  const hasMany = sessions.length > 5;
  const sessionsCsvUrl = getSessionsCsvUrl(year);
  const [editingId, setEditingId] = React.useState(null);
  const [draft, setDraft] = React.useState(null);
  const [busyId, setBusyId] = React.useState(null);
  const [undoState, setUndoState] = React.useState(null);
  const [flashState, setFlashState] = React.useState(null);
  const [detailSessionId, setDetailSessionId] = React.useState(null);
  const latestDate = sessions.reduce((latest, row) => {
    const ts = row?.date ? new Date(row.date).getTime() : NaN;
    if (!Number.isFinite(ts)) return latest;
    if (!latest || ts > latest.ts) return { ts, label: datumDE(row.date) };
    return latest;
  }, null)?.label;

  const connectorOptions = React.useMemo(
    () => Array.from(new Set([...DEFAULT_CONNECTORS, ...sessions.map((session) => session.connector).filter(Boolean)])),
    [sessions]
  );
  const filterOptions = React.useMemo(
    () => buildSessionMetadataOptions({ sessions, intelligence }),
    [intelligence, sessions]
  );
  const filteredSessions = React.useMemo(
    () =>
      sessions.filter((session) => {
        if (filters?.month != null && monthNumber(session?.date) !== Number(filters.month)) return false;
        if (filters?.provider && String(session?.provider || "") !== String(filters.provider)) return false;
        if (filters?.location && String(session?.location || "") !== String(filters.location)) return false;
        if (filters?.vehicle && String(session?.vehicle || "") !== String(filters.vehicle)) return false;
        if (filters?.tag && !parseTags(session?.tags).some((tag) => tag.toLowerCase() === String(filters.tag).toLowerCase())) return false;
        return true;
      }),
    [filters, sessions]
  );
  const detailSession = React.useMemo(
    () => sessions.find((session) => String(session.id) === String(detailSessionId)) || null,
    [detailSessionId, sessions]
  );

  React.useEffect(() => {
    if (!undoState) return undefined;
    const timer = window.setTimeout(() => setUndoState(null), 8000);
    return () => window.clearTimeout(timer);
  }, [undoState]);

  React.useEffect(() => {
    if (!flashState) return undefined;
    const timer = window.setTimeout(() => setFlashState(null), 2400);
    return () => window.clearTimeout(timer);
  }, [flashState]);

  async function refreshData() {
    if (typeof onChanged === "function") await onChanged();
    else reloadCurrentPage();
  }

  function beginEdit(row) {
    setEditingId(row.id);
    setDraft(buildEditDraft(row));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function openDetails(row) {
    setDetailSessionId(row.id);
  }

  function closeDetails() {
    setDetailSessionId(null);
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...(current || {}), [field]: value }));
  }

  async function onDeleteRow(row) {
    const ok = await confirmAction(`Ladevorgang vom ${datumDE(row?.date)} wirklich löschen?`, {
      title: "Session löschen",
      confirmLabel: "Löschen",
      cancelLabel: "Abbrechen",
      tone: "danger",
    });
    if (!ok) return;

    try {
      setBusyId(`delete-${row.id}`);
      const result = await deleteSession(row.id);
      setUndoState({
        row: result?.deleted || row,
        label: datumDE(row?.date),
      });
      cancelEdit();
      await refreshData();
    } catch (e) {
      showAlert(String(e?.message || e));
    } finally {
      setBusyId(null);
    }
  }

  async function onUndoDelete() {
    if (!undoState?.row) return;

    try {
      setBusyId(`undo-${undoState.row.id}`);
      const restoredRow = undoState.row;
      await restoreSession(restoredRow);
      setUndoState(null);
      setFlashState({ id: restoredRow.id, tone: "restored" });
      await refreshData();
    } catch (e) {
      showAlert(String(e?.message || e));
    } finally {
      setBusyId(null);
    }
  }

  async function onSaveEdit(row) {
    const draftPreview = buildDraftPreview(draft, sessions, row.id, row);
    const energy = draftPreview.energy;
    const price = draftPreview.price;
    const durationSeconds = draftPreview.durationSeconds;
    const socStart = draftPreview.socStart;
    const socEnd = draftPreview.socEnd;
    const odometer = parseIntegerInput(draft?.odometer_km);
    const mobilityCandidate =
      odometer == null || Number.isNaN(odometer)
        ? null
        : deriveMobilityForSession(sessions, {
            ...row,
            id: row.id,
            date: draft?.date || new Date(row.date).toISOString().slice(0, 10),
            energy_kwh: energy,
            total_cost: Number.isFinite(energy) && energy > 0 && Number.isFinite(price) && price > 0 ? energy * price : row.total_cost,
            duration_seconds: durationSeconds,
            price_per_kwh: price,
            soc_start: socStart,
            soc_end: socEnd,
            odo_end_km: odometer,
          });

    if (!(draft?.date || row?.date)) return showAlert("Bitte Datum auswählen.");
    if (!Number.isFinite(energy) || energy <= 0) return showAlert("Energie (kWh) muss > 0 sein.");
    if (!Number.isFinite(price) || price <= 0) return showAlert("Preis pro kWh muss > 0 sein.");
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return showAlert("Dauer bitte als HH:MM angeben.");
    if (Number.isNaN(odometer)) return showAlert("Kilometerstand muss eine positive Ganzzahl sein.");
    if (mobilityCandidate?.previousOdometerKm != null && odometer != null && odometer < mobilityCandidate.previousOdometerKm) {
      return showAlert(`Kilometerstand muss mindestens ${mobilityCandidate.previousOdometerKm} km betragen, damit die Historie konsistent bleibt.`);
    }
    if (mobilityCandidate?.nextOdometerKm != null && odometer != null && odometer > mobilityCandidate.nextOdometerKm) {
      return showAlert(`Kilometerstand darf höchstens ${mobilityCandidate.nextOdometerKm} km betragen, damit spätere Sessions konsistent bleiben.`);
    }
    if (!Number.isInteger(socStart) || socStart < 0 || socStart > 100) return showAlert("SoC Start muss 0–100 sein.");
    if (!Number.isInteger(socEnd) || socEnd < 0 || socEnd > 100) return showAlert("SoC Ende muss 0–100 sein.");
    if (socEnd < socStart) return showAlert("SoC Ende darf nicht kleiner als SoC Start sein.");

    try {
      setBusyId(`save-${row.id}`);
      await updateSession(row.id, {
        date: draft?.date || new Date(row.date).toISOString().slice(0, 10),
        provider: draft?.provider || null,
        location: draft?.location || null,
        vehicle: draft?.vehicle || null,
        tags: formatTags(draft?.tags || ""),
        connector: draft?.connector || row.connector,
        soc_start: socStart,
        soc_end: socEnd,
        energy_kwh: energy,
        price_per_kwh: price,
        duration_seconds: durationSeconds,
        odometer_km: odometer,
        note: draft?.note || null,
      });
      setFlashState({ id: row.id, tone: "saved" });
      cancelEdit();
      await refreshData();
    } catch (e) {
      showAlert(String(e?.message || e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card glassStrong sessionsPanel">
      <div className="sectionHeader stickyHeader">
        <div>
          <div className="sectionKicker">Verlauf</div>
          <div className="sectionTitle">Letzte Ladevorgänge</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="pill"
            type="button"
            onClick={() => {
              if (!sessionsCsvUrl) return;
              downloadFileFromUrl(sessionsCsvUrl, {
                fileName: `charging-sessions-${year || "all"}.csv`,
                title: `Session Export ${year || "alle Jahre"}`,
              }).catch((error) => {
                showAlert(String(error?.message || error));
              });
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

      {undoState ? (
        <div className="sessionUndoToast" role="status" aria-live="polite">
          <div className="sessionUndoText">Session vom {undoState.label} gelöscht.</div>
          <button type="button" className="pill pillWarm" onClick={onUndoDelete} disabled={busyId === `undo-${undoState.row?.id}`}>
            {busyId === `undo-${undoState.row?.id}` ? "Stelle wieder her…" : "Rückgängig"}
          </button>
        </div>
      ) : null}

      <div className="formGrid" style={{ marginBottom: 16 }}>
        <label className="field">
          <span>Monat</span>
          <select className="input" value={filters?.month ?? ""} onChange={(event) => onFiltersChange?.((current) => ({ ...(current || {}), month: event.target.value ? Number(event.target.value) : null }))}>
            <option value="">Alle</option>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
              <option key={`month-${month}`} value={month}>
                {month}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Anbieter</span>
          <select className="input" value={filters?.provider || ""} onChange={(event) => onFiltersChange?.((current) => ({ ...(current || {}), provider: event.target.value }))}>
            <option value="">Alle</option>
            {filterOptions.providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Ort</span>
          <select className="input" value={filters?.location || ""} onChange={(event) => onFiltersChange?.((current) => ({ ...(current || {}), location: event.target.value }))}>
            <option value="">Alle</option>
            {filterOptions.locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Fahrzeug</span>
          <select className="input" value={filters?.vehicle || ""} onChange={(event) => onFiltersChange?.((current) => ({ ...(current || {}), vehicle: event.target.value }))}>
            <option value="">Alle</option>
            {filterOptions.vehicles.map((vehicle) => (
              <option key={vehicle} value={vehicle}>
                {vehicle}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Tag</span>
          <select className="input" value={filters?.tag || ""} onChange={(event) => onFiltersChange?.((current) => ({ ...(current || {}), tag: event.target.value }))}>
            <option value="">Alle</option>
            {filterOptions.tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
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
          {filteredSessions.length === 0 ? (
            <div className="emptyRow">
              {filters?.month || filters?.provider || filters?.location || filters?.vehicle || filters?.tag
                ? "Keine Sessions für die aktuellen Filter."
                : "Noch keine Ladevorgänge."}
            </div>
          ) : (
            filteredSessions.map((session) => {
              const pricePerKwh = effectivePricePerKwh(session);
              const score = sessionScoresById[String(session.id)] || null;
              const outlier = sessionOutliersById[String(session.id)] || null;
              const socDelta = Math.max(0, Number(session?.soc_end || 0) - Number(session?.soc_start || 0));
              const isEditing = editingId === session.id;
              const saveBusy = busyId === `save-${session.id}`;
              const deleteBusy = busyId === `delete-${session.id}`;
              const isFlashing = flashState?.id === session.id ? flashState.tone : null;
              const hasPendingChanges = isEditing ? draftHasChanges(session, draft) : false;
              const draftPreview = isEditing ? buildDraftPreview(draft, sessions, session.id, session) : null;
              const saveDisabled = saveBusy || !hasPendingChanges || !draftPreview?.canSave;

              return (
                <React.Fragment key={session.id}>
                  <div className={`tableRow ${isEditing ? "editing" : ""} ${isFlashing ? `flash-${isFlashing}` : ""}`}>
                    <div>
                      <div className="tablePrimary">{datumDE(session.date)}</div>
                      <div className="tableSecondary">
                        {[session.provider, session.location].filter(Boolean).join(" • ") || session.note || "Erfasste Session"}
                      </div>
                      <div className="sessionScoreStrip">
                        {score ? (
                          <Tooltip
                            placement="top"
                            openDelayMs={90}
                            closeDelayMs={180}
                            content={`Session Score ${num(score.score, 1)}/100 • Preis ${num(score.price_per_kwh, 3)} €/kWh • Leistung ${num(score.avg_power_kw, 1)} kW`}
                          >
                            <span className={`sessionScorePill ${sessionScoreTone(score.score)}`}>
                              {num(score.score, 1)}/100 · {sessionScoreLabel(score.score)}
                            </span>
                          </Tooltip>
                        ) : null}
                        {outlier?.flag_count ? <span className="sessionMetaHint">{num(outlier.flag_count, 0)} Hinweise</span> : null}
                        {session.vehicle ? <span className="sessionMetaHint">{session.vehicle}</span> : null}
                        {parseTags(session.tags).slice(0, 2).map((tag) => (
                          <span key={`${session.id}-${tag}`} className="sessionMetaHint">#{tag}</span>
                        ))}
                        {pricePerKwh != null ? (
                          <div className="tableMetaInline">
                            {euro(session.total_cost)} · {num(pricePerKwh, 3)} €/kWh
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <span className="tableBadge">{session.connector || "–"}</span>
                    </div>
                    <div>
                      <span className="tableSoc">
                        {session.soc_start} → {session.soc_end} %
                      </span>
                      <div className="sessionMiniMeta">{socDelta ? `${num(socDelta, 0)} %-Hub` : "–"}</div>
                    </div>
                    <div className="tableValueStrong">
                      {num(session.energy_kwh, 1)} kWh
                      <div className="sessionMiniMeta">{score?.avg_power_kw != null ? `${num(score.avg_power_kw, 1)} kW` : "Score folgt"}</div>
                    </div>
                    <div className="tableValueSoft">
                      {secsToHHMM(session.duration_seconds)}
                      <div className="sessionMiniMeta">{score?.breakdown?.speed_score != null ? `Tempo ${num(score.breakdown.speed_score, 0)}` : "–"}</div>
                    </div>

                    <div className="tableCostCell">
                      <div className="tableCostStack">
                        <span className="tableValueStrong">{euro(session.total_cost)}</span>
                        {pricePerKwh != null ? (
                          <Tooltip
                            placement="top"
                            openDelayMs={90}
                            closeDelayMs={180}
                            content={[
                              `Effektiver Preis: ${num(pricePerKwh, 3)} €/kWh`,
                              score?.breakdown?.price_score != null ? `Preis-Score ${num(score.breakdown.price_score, 0)}` : null,
                              session.provider || null,
                              session.location || null,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          >
                            <button
                              type="button"
                              className="tablePricePill"
                              aria-label={`Preisdetails: ${num(pricePerKwh, 3)} Euro pro Kilowattstunde`}
                            >
                              {num(pricePerKwh, 3)} €/kWh
                            </button>
                          </Tooltip>
                        ) : null}
                      </div>

                      <div className="rowActions">
                        <button
                          type="button"
                          className="rowDetailBtn"
                          onClick={() => openDetails(session)}
                          disabled={saveBusy || deleteBusy}
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          className="rowEditBtn"
                          onClick={() => (isEditing ? cancelEdit() : beginEdit(session))}
                          disabled={saveBusy || deleteBusy}
                        >
                          {isEditing ? "Abbrechen" : "Bearbeiten"}
                        </button>
                        <button
                          type="button"
                          className="rowDeleteBtn"
                          title="Ladevorgang löschen"
                          aria-label="Ladevorgang löschen"
                          onClick={() => onDeleteRow(session)}
                          disabled={deleteBusy || saveBusy}
                        >
                          {deleteBusy ? "Löscht…" : "Löschen"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className={`tableEditRow ${hasPendingChanges ? "isDirty" : "isPristine"}`}>
                      <div className="tableEditGrid">
                        <label className="field">
                          <span>Datum</span>
                          <input className="input" type="date" value={draft?.date || ""} onChange={(event) => updateDraft("date", event.target.value)} />
                        </label>

                        <label className="field">
                          <span>Anbieter</span>
                          <input
                            className="input"
                            list={filterOptions.providers.length ? PROVIDER_LIST_ID : undefined}
                            value={draft?.provider || ""}
                            onChange={(event) => updateDraft("provider", event.target.value)}
                          />
                        </label>

                        <label className="field">
                          <span>Ort</span>
                          <input
                            className="input"
                            list={filterOptions.locations.length ? LOCATION_LIST_ID : undefined}
                            value={draft?.location || ""}
                            onChange={(event) => updateDraft("location", event.target.value)}
                          />
                        </label>

                        <label className="field">
                          <span>Fahrzeug</span>
                          <input
                            className="input"
                            list={filterOptions.vehicles.length ? VEHICLE_LIST_ID : undefined}
                            value={draft?.vehicle || ""}
                            onChange={(event) => updateDraft("vehicle", event.target.value)}
                          />
                        </label>

                        <label className="field">
                          <span>Tags</span>
                          <input
                            className="input"
                            list={filterOptions.tags.length ? TAG_LIST_ID : undefined}
                            value={draft?.tags || ""}
                            onChange={(event) => updateDraft("tags", event.target.value)}
                          />
                        </label>

                        <label className="field">
                          <span>Anschluss</span>
                          <select className="input" value={draft?.connector || ""} onChange={(event) => updateDraft("connector", event.target.value)}>
                            {connectorOptions.map((connector) => (
                              <option key={`${session.id}-${connector}`} value={connector}>
                                {connector}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="field">
                          <span>SoC Start</span>
                          <input className="input" type="number" min="0" max="100" value={draft?.soc_start || ""} onChange={(event) => updateDraft("soc_start", event.target.value)} />
                        </label>

                        <label className="field">
                          <span>SoC Ende</span>
                          <input className="input" type="number" min="0" max="100" value={draft?.soc_end || ""} onChange={(event) => updateDraft("soc_end", event.target.value)} />
                        </label>

                        <label className="field">
                          <span>Energie</span>
                          <input className="input" value={draft?.energy_kwh || ""} onChange={(event) => updateDraft("energy_kwh", event.target.value)} />
                        </label>

                        <label className="field">
                          <span>€/kWh</span>
                          <input className="input" value={draft?.price_per_kwh || ""} onChange={(event) => updateDraft("price_per_kwh", event.target.value)} />
                        </label>

                        <label className="field">
                          <span>Dauer</span>
                          <input className="input" value={draft?.duration_hhmm || ""} onChange={(event) => updateDraft("duration_hhmm", event.target.value)} />
                        </label>

                        <label className="field">
                          <span>Kilometerstand</span>
                          <input className="input" type="number" min="0" value={draft?.odometer_km || ""} onChange={(event) => updateDraft("odometer_km", event.target.value)} />
                        </label>

                        <label className="field fieldWide">
                          <span>Notiz</span>
                          <input className="input" value={draft?.note || ""} onChange={(event) => updateDraft("note", event.target.value)} />
                        </label>
                      </div>

                      <div className="tableEditPreview">
                        <div className={`editStatusPill ${hasPendingChanges ? "dirty" : "pristine"} ${draftPreview?.canSave ? "ready" : "needsAttention"}`}>
                          {hasPendingChanges ? "Ungespeicherte Änderungen" : "Keine Änderung"}
                        </div>
                        <div className="editPreviewGrid">
                          <div className="editPreviewMetric">
                            <div className="editPreviewLabel">Live-Kosten</div>
                            <div className="editPreviewValue">{draftPreview?.totalCost != null ? euro(draftPreview.totalCost) : "–"}</div>
                          </div>
                          <div className="editPreviewMetric">
                            <div className="editPreviewLabel">Live-Ø</div>
                            <div className="editPreviewValue">{draftPreview?.avgPowerKw != null ? `${num(draftPreview.avgPowerKw, 1)} kW` : "–"}</div>
                          </div>
                          <div className="editPreviewMetric">
                            <div className="editPreviewLabel">SoC-Hub</div>
                            <div className="editPreviewValue">{draftPreview?.socDelta != null ? `${num(draftPreview.socDelta, 0)} %` : "–"}</div>
                          </div>
                          <div className="editPreviewMetric">
                            <div className="editPreviewLabel">Dauer</div>
                            <div className="editPreviewValue">{draftPreview?.durationSeconds ? secsToHHMM(draftPreview.durationSeconds) : "–"}</div>
                          </div>
                          <div className="editPreviewMetric">
                            <div className="editPreviewLabel">Distanz</div>
                            <div className="editPreviewValue">{draftPreview?.distanceKm != null ? `${num(draftPreview.distanceKm, 0)} km` : "–"}</div>
                          </div>
                          <div className="editPreviewMetric">
                            <div className="editPreviewLabel">€/100 km</div>
                            <div className="editPreviewValue">{draftPreview?.costPer100Km != null ? `${num(draftPreview.costPer100Km, 2)} €` : "–"}</div>
                          </div>
                        </div>
                      </div>

                      <div className="tableEditActions">
                        <div className="formHint">
                          {hasPendingChanges
                            ? draftPreview?.canSave
                              ? "Preview aktualisiert. Speichern zieht Score, Reports, Vergleich und Forecast sofort nach."
                              : draftPreview?.previousOdometerKm != null && draftPreview?.odometerKm != null && draftPreview.odometerKm < draftPreview.previousOdometerKm
                                ? `Kilometerstand muss mindestens ${draftPreview.previousOdometerKm} km betragen.`
                                : draftPreview?.nextOdometerKm != null && draftPreview?.odometerKm != null && draftPreview.odometerKm > draftPreview.nextOdometerKm
                                  ? `Kilometerstand darf höchstens ${draftPreview.nextOdometerKm} km betragen.`
                                : "Bitte Eingaben prüfen. Für das Speichern werden gültige Werte in allen Pflichtfeldern benötigt."
                            : "Noch keine Änderung an dieser Session."}
                        </div>
                        <button type="button" className="pill pillWarm" onClick={() => onSaveEdit(session)} disabled={saveDisabled}>
                          {saveBusy ? "Speichert…" : "Speichern"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>

      <SessionDetailDrawer
        session={detailSession}
        sessions={sessions}
        score={detailSession ? sessionScoresById[String(detailSession.id)] || null : null}
        outlier={detailSession ? sessionOutliersById[String(detailSession.id)] || null : null}
        onClose={closeDetails}
        onEdit={(row) => {
          closeDetails();
          beginEdit(row);
        }}
      />

      {filterOptions.providers.length ? (
        <datalist id={PROVIDER_LIST_ID}>
          {filterOptions.providers.map((value) => <option key={value} value={value} />)}
        </datalist>
      ) : null}
      {filterOptions.locations.length ? (
        <datalist id={LOCATION_LIST_ID}>
          {filterOptions.locations.map((value) => <option key={value} value={value} />)}
        </datalist>
      ) : null}
      {filterOptions.vehicles.length ? (
        <datalist id={VEHICLE_LIST_ID}>
          {filterOptions.vehicles.map((value) => <option key={value} value={value} />)}
        </datalist>
      ) : null}
      {filterOptions.tags.length ? (
        <datalist id={TAG_LIST_ID}>
          {filterOptions.tags.map((value) => <option key={value} value={value} />)}
        </datalist>
      ) : null}
    </div>
  );
}
