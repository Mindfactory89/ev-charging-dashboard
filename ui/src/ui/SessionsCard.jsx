import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { euro, num, datumDE } from "../app/formatters.js";
import { monthLabel } from "./monthLabels.js";
import { deleteSession, getSessionsCsvUrl, restoreSession, updateSession } from "./api.js";
import Tooltip from "./Tooltip.jsx";
import SessionDetailDrawer from "./SessionDetailDrawer.jsx";
import SessionEditDrawer from "./SessionEditDrawer.jsx";
import { downloadFileFromUrl } from "../platform/download.js";
import { confirmAction, reloadCurrentPage, showAlert } from "../platform/runtime.js";
import { parseTags } from "./sessionMetadata.js";
import { buildSessionMetadataOptions } from "./sessionMetadataOptions.js";
import { CONNECTOR_OPTIONS as SHARED_CONNECTOR_OPTIONS } from "../app/constants.js";
import {
  buildSessionEditDraft,
  effectivePricePerKwh,
  sessionEditHasChanges,
  sessionEditPayload,
  validateSessionEditDraft,
} from "./sessionEditForm.js";

const DEFAULT_CONNECTORS = SHARED_CONNECTOR_OPTIONS;
const PROVIDER_LIST_ID = "history-session-provider-options";
const LOCATION_LIST_ID = "history-session-location-options";
const VEHICLE_LIST_ID = "history-session-vehicle-options";
const TAG_LIST_ID = "history-session-tag-options";
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
function sessionScoreTone(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "neutral";
  if (value >= 80) return "success";
  if (value >= 65) return "warm";
  if (value >= 50) return "warn";
  return "danger";
}

function sessionScoreLabel(score, t) {
  const value = Number(score);
  if (!Number.isFinite(value)) return t("sessionsCard.scoreLabels.none");
  if (value >= 80) return t("sessionsCard.scoreLabels.top");
  if (value >= 65) return t("sessionsCard.scoreLabels.efficient");
  if (value >= 50) return t("sessionsCard.scoreLabels.solid");
  return t("sessionsCard.scoreLabels.notable");
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
  const { t } = useI18n();
  const hasMany = sessions.length > 5;
  const sessionsCsvUrl = getSessionsCsvUrl(year);
  const [editingId, setEditingId] = React.useState(null);
  const [draft, setDraft] = React.useState(null);
  const [busyId, setBusyId] = React.useState(null);
  const [undoState, setUndoState] = React.useState(null);
  const [flashState, setFlashState] = React.useState(null);
  const [detailSessionId, setDetailSessionId] = React.useState(null);
  const [visibleCount, setVisibleCount] = React.useState(12);
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
  const visibleSessions = React.useMemo(
    () => filteredSessions.slice(0, visibleCount),
    [filteredSessions, visibleCount]
  );

  React.useEffect(() => {
    setVisibleCount(12);
  }, [filters?.location, filters?.month, filters?.provider, filters?.tag, filters?.vehicle, sessions.length]);

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
    setDraft(buildSessionEditDraft(row));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function requestCloseEdit() {
    const editingSession = sessions.find((row) => String(row.id) === String(editingId));
    if (editingSession && sessionEditHasChanges(editingSession, draft)) {
      const discard = await confirmAction(t("sessionsCard.edit.discardMessage"), {
        title: t("sessionsCard.edit.discardTitle"),
        confirmLabel: t("sessionsCard.edit.discardConfirm"),
        cancelLabel: t("sessionsCard.edit.discardCancel"),
      });
      if (!discard) return;
    }
    cancelEdit();
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
    const ok = await confirmAction(t("sessionsCard.deleteConfirm.message", { date: datumDE(row?.date) }), {
      title: t("sessionsCard.deleteConfirm.title"),
      confirmLabel: t("sessionsCard.deleteConfirm.confirm"),
      cancelLabel: t("sessionsCard.deleteConfirm.cancel"),
      tone: "danger",
    });
    if (!ok) return false;

    try {
      setBusyId(`delete-${row.id}`);
      const result = await deleteSession(row.id);
      setUndoState({
        row: result?.deleted || row,
        label: datumDE(row?.date),
      });
      if (String(detailSessionId) === String(row.id)) closeDetails();
      cancelEdit();
      await refreshData();
      return true;
    } catch (e) {
      showAlert(String(e?.message || e));
      return false;
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
    const validation = validateSessionEditDraft(draft, sessions, row);
    if (!validation.valid) {
      const firstError = validation.errors[Object.keys(validation.errors)[0]];
      return showAlert(t(`sessionsCard.validation.${firstError.key}`, firstError.params));
    }

    try {
      setBusyId(`save-${row.id}`);
      await updateSession(row.id, sessionEditPayload(draft, validation.preview));
      setFlashState({ id: row.id, tone: "saved" });
      cancelEdit();
      await refreshData();
      showAlert(t("sessionsCard.edit.savedMessage"), {
        title: t("sessionsCard.edit.savedTitle"),
        tone: "success",
      });
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
          <div className="sectionKicker">{t("sessionsCard.kicker")}</div>
          <div className="sectionTitle">{t("sessionsCard.title")}</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="pill"
            type="button"
            onClick={() => {
              if (!sessionsCsvUrl) return;
              downloadFileFromUrl(sessionsCsvUrl, {
                fileName: `charging-sessions-${year || "all"}.csv`,
                title: t("sessionsCard.export.title"),
              }).catch((error) => {
                showAlert(String(error?.message || error));
              });
            }}
            title={t("sessionsCard.export.title")}
            disabled={!sessionsCsvUrl}
          >
            {t("sessionsCard.export.label")}
          </button>
          {latestDate ? <div className="pill ghostPill">{t("sessionsCard.export.latest", { date: latestDate })}</div> : null}
          <div className="pill ghostPill">{t("sessionsCard.export.total", { count: num(sessions.length, 0) })}</div>
        </div>
      </div>

      {undoState ? (
        <div className="sessionUndoToast" role="status" aria-live="polite">
          <div className="sessionUndoText">{t("sessionsCard.export.deleted", { date: undoState.label })}</div>
          <button type="button" className="pill pillWarm" onClick={onUndoDelete} disabled={busyId === `undo-${undoState.row?.id}`}>
            {busyId === `undo-${undoState.row?.id}` ? t("sessionsCard.export.restoring") : t("sessionsCard.export.undo")}
          </button>
        </div>
      ) : null}

      <div className="formGrid" style={{ marginBottom: 16 }}>
        <label className="field">
          <span>{t("sessionsCard.filters.month")}</span>
          <select className="input" value={filters?.month ?? ""} onChange={(event) => onFiltersChange?.((current) => ({ ...(current || {}), month: event.target.value ? Number(event.target.value) : null }))}>
            <option value="">{t("common.all")}</option>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
              <option key={`month-${month}`} value={month}>
                {monthLabel(month)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{t("sessionsCard.filters.provider")}</span>
          <select className="input" value={filters?.provider || ""} onChange={(event) => onFiltersChange?.((current) => ({ ...(current || {}), provider: event.target.value }))}>
            <option value="">{t("common.all")}</option>
            {filterOptions.providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{t("sessionsCard.filters.location")}</span>
          <select className="input" value={filters?.location || ""} onChange={(event) => onFiltersChange?.((current) => ({ ...(current || {}), location: event.target.value }))}>
            <option value="">{t("common.all")}</option>
            {filterOptions.locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{t("sessionsCard.filters.vehicle")}</span>
          <select className="input" value={filters?.vehicle || ""} onChange={(event) => onFiltersChange?.((current) => ({ ...(current || {}), vehicle: event.target.value }))}>
            <option value="">{t("common.all")}</option>
            {filterOptions.vehicles.map((vehicle) => (
              <option key={vehicle} value={vehicle}>
                {vehicle}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{t("sessionsCard.filters.tag")}</span>
          <select className="input" value={filters?.tag || ""} onChange={(event) => onFiltersChange?.((current) => ({ ...(current || {}), tag: event.target.value }))}>
            <option value="">{t("common.all")}</option>
            {filterOptions.tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="tableWrap" role="table" aria-label={t("sessionsCard.table.ariaLabel")} aria-rowcount={filteredSessions.length + 1}>
        <div className="tableHead" role="row">
          <div role="columnheader">{t("sessionsCard.table.date")}</div>
          <div role="columnheader">{t("sessionsCard.table.connector")}</div>
          <div role="columnheader">{t("sessionsCard.table.soc")}</div>
          <div role="columnheader">{t("sessionsCard.table.energy")}</div>
          <div role="columnheader">{t("sessionsCard.table.duration")}</div>
          <div role="columnheader">{t("sessionsCard.table.cost")}</div>
        </div>

        <div className={`tableBody ${hasMany ? "tableBodyScroll" : ""}`} role="rowgroup">
          {filteredSessions.length === 0 ? (
            <div className="emptyRow" role="row"><span role="cell">
              {filters?.month || filters?.provider || filters?.location || filters?.vehicle || filters?.tag
                ? t("sessionsCard.table.emptyFiltered")
                : t("sessionsCard.table.emptyInitial")}
            </span></div>
          ) : (
            visibleSessions.map((session, index) => {
              const pricePerKwh = effectivePricePerKwh(session);
              const score = sessionScoresById[String(session.id)] || null;
              const outlier = sessionOutliersById[String(session.id)] || null;
              const socDelta = Math.max(0, Number(session?.soc_end || 0) - Number(session?.soc_start || 0));
              const isEditing = editingId === session.id;
              const saveBusy = busyId === `save-${session.id}`;
              const deleteBusy = busyId === `delete-${session.id}`;
              const isFlashing = flashState?.id === session.id ? flashState.tone : null;

              return (
                <React.Fragment key={session.id}>
                  <div className={`tableRow ${isEditing ? "editing" : ""} ${isFlashing ? `flash-${isFlashing}` : ""}`} role="row" aria-rowindex={index + 2}>
                    <div className="tableCell tableCellLead" data-label={t("sessionsCard.table.date")} role="cell">
                      <div className="tablePrimary">{datumDE(session.date)}</div>
                      <div className="tableSecondary">
                        {[session.provider, session.location].filter(Boolean).join(" • ") || session.note || t("sessionsCard.table.recordedSession")}
                      </div>
                      <div className="sessionScoreStrip">
                        {score ? (
                          <Tooltip
                            placement="top"
                            openDelayMs={90}
                            closeDelayMs={180}
                            content={t("sessionsCard.scoreLabels.tooltip", {
                              score: num(score.score, 1),
                              price: num(score.price_per_kwh, 3),
                              power: num(score.avg_power_kw, 1),
                            })}
                          >
                            <span className={`sessionScorePill ${sessionScoreTone(score.score)}`}>
                              {num(score.score, 1)}/100 · {sessionScoreLabel(score.score, t)}
                            </span>
                          </Tooltip>
                        ) : null}
                        {outlier?.flag_count ? <span className="sessionMetaHint">{t("sessionsCard.table.hints", { count: num(outlier.flag_count, 0) })}</span> : null}
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
                    <div className="tableCell" data-label={t("sessionsCard.table.connector")} role="cell">
                      <span className="tableBadge">{session.connector || "–"}</span>
                    </div>
                    <div className="tableCell" data-label={t("sessionsCard.table.soc")} role="cell">
                      <span className="tableSoc">
                        {session.soc_start} → {session.soc_end} %
                      </span>
                      <div className="sessionMiniMeta">{socDelta ? t("sessionsCard.table.socDelta", { value: num(socDelta, 0) }) : "–"}</div>
                    </div>
                    <div className="tableCell tableValueStrong" data-label={t("sessionsCard.table.energy")} role="cell">
                      <span>{num(session.energy_kwh, 1)} kWh</span>
                      <div className="sessionMiniMeta">{score?.avg_power_kw != null ? `${num(score.avg_power_kw, 1)} kW` : t("sessionsCard.table.scorePending")}</div>
                    </div>
                    <div className="tableCell tableValueSoft" data-label={t("sessionsCard.table.duration")} role="cell">
                      <span>{secsToHHMM(session.duration_seconds)}</span>
                      <div className="sessionMiniMeta">{score?.breakdown?.speed_score != null ? t("sessionsCard.table.speed", { value: num(score.breakdown.speed_score, 0) }) : "–"}</div>
                    </div>

                    <div className="tableCell tableCostCell" data-label={t("sessionsCard.table.cost")} role="cell">
                      <div className="tableCostStack">
                        <span className="tableValueStrong">{euro(session.total_cost)}</span>
                        {pricePerKwh != null ? (
                          <Tooltip
                            placement="top"
                            openDelayMs={90}
                            closeDelayMs={180}
                            content={[
                              `${t("common.pricePerKwh")}: ${num(pricePerKwh, 3)} €/kWh`,
                              score?.breakdown?.price_score != null ? `${t("sessionDetail.quality.priceScore")} ${num(score.breakdown.price_score, 0)}` : null,
                              session.provider || null,
                              session.location || null,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          >
                            <button
                              type="button"
                              className="tablePricePill"
                              aria-label={t("sessionsCard.table.priceDetails", { value: num(pricePerKwh, 3) })}
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
                          {t("sessionsCard.buttons.details")}
                        </button>
                        <button
                          type="button"
                          className="rowEditBtn"
                          onClick={() => (isEditing ? requestCloseEdit() : beginEdit(session))}
                          disabled={saveBusy || deleteBusy}
                          aria-haspopup="dialog"
                          aria-expanded={isEditing}
                        >
                          {isEditing ? t("sessionsCard.buttons.cancel") : t("sessionsCard.buttons.edit")}
                        </button>
                        <button
                          type="button"
                          className="rowDeleteBtn"
                          title={t("sessionsCard.buttons.delete")}
                          aria-label={t("sessionsCard.buttons.delete")}
                          onClick={() => onDeleteRow(session)}
                          disabled={deleteBusy || saveBusy}
                        >
                          {deleteBusy ? t("sessionsCard.buttons.deleting") : t("sessionsCard.buttons.delete")}
                        </button>
                      </div>
                    </div>
                  </div>

                </React.Fragment>
              );
            })
          )}
        </div>
      </div>

      {visibleCount < filteredSessions.length ? (
        <div className="sessionPagination" role="status">
          <span>{t("sessionsCard.pagination.status", { visible: visibleSessions.length, total: filteredSessions.length })}</span>
          <button type="button" className="pill ghostPill" onClick={() => setVisibleCount((count) => count + 12)}>
            {t("sessionsCard.pagination.more")}
          </button>
        </div>
      ) : null}

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
        onDelete={onDeleteRow}
        deleteBusy={detailSession ? busyId === `delete-${detailSession.id}` : false}
      />

      <SessionEditDrawer
        session={sessions.find((row) => String(row.id) === String(editingId)) || null}
        sessions={sessions}
        draft={draft}
        connectorOptions={connectorOptions}
        filterOptions={filterOptions}
        busy={editingId != null && busyId === `save-${editingId}`}
        onDraftChange={updateDraft}
        onRequestClose={requestCloseEdit}
        onSave={() => {
          const row = sessions.find((entry) => String(entry.id) === String(editingId));
          if (row) onSaveEdit(row);
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
