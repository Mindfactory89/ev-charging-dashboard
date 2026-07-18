import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import AppIcon from "../design-system/icons.jsx";

function draftFromProfile(profile) {
  return profile ? { ...profile } : {
    id: "",
    name: "",
    context: "home",
    energySource: "grid",
    tariffType: "fixed",
    basePrice: 0.32,
    peakPrice: 0.42,
    offPeakPrice: 0.25,
    offPeakStart: "22:00",
    offPeakEnd: "06:00",
    windowStart: "22:00",
    windowEnd: "06:00",
    pvShare: 0,
    provider: "",
  };
}

export default function ChargingProfilesDrawer({ activeProfileId, onClose, onDelete, onSave, onSelect, open, profiles = [] }) {
  const { t } = useI18n();
  const panelRef = React.useRef(null);
  const [draft, setDraft] = React.useState(() => draftFromProfile(null));
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDraft(draftFromProfile(profiles.find((profile) => profile.id === activeProfileId) || profiles[0] || null));
    setEditing(!profiles.length);
  }, [activeProfileId, open]);

  React.useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => panelRef.current?.focus?.(), 40);
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function select(profile) {
    onSelect?.(profile.id);
    setDraft(draftFromProfile(profile));
    setEditing(false);
  }

  function submit(event) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const saved = onSave?.(draft);
    if (!saved) return;
    setDraft(draftFromProfile(saved));
    setEditing(false);
  }

  return (
    <div className="chargingGoalsOverlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <aside className="chargingGoalsDrawer chargingProfilesDrawer" role="dialog" aria-modal="true" aria-labelledby="charging-profiles-title" tabIndex={-1} ref={panelRef}>
        <header className="chargingGoalsDrawerHeader">
          <div className="chargingGoalsDrawerIdentity">
            <span className="chargingGoalsDrawerGlyph"><AppIcon name="bolt" /></span>
            <div>
              <div className="sectionKicker">{t("chargingProfiles.kicker")}</div>
              <h2 id="charging-profiles-title">{t("chargingProfiles.title")}</h2>
              <p>{t("chargingProfiles.text")}</p>
            </div>
          </div>
          <button type="button" className="chargingGoalsClose" onClick={onClose} aria-label={t("common.close")}><AppIcon name="close" /></button>
        </header>

        <div className="chargingProfilesContent">
          <section className="chargingProfileList" aria-label={t("chargingProfiles.listLabel")}>
            {profiles.map((profile) => (
              <button type="button" key={profile.id} className={`chargingProfileOption ${profile.id === activeProfileId ? "active" : ""}`} onClick={() => select(profile)}>
                <span className="chargingProfileOptionIcon"><AppIcon name={profile.energySource === "grid" ? "bolt" : "solar"} /></span>
                <span><strong>{profile.name}</strong><small>{t(`chargingProfiles.context.${profile.context}`)} · {t(`chargingProfiles.energy.${profile.energySource}`)}</small></span>
                {profile.id === activeProfileId ? <span className="chargingProfileActive">{t("chargingProfiles.active")}</span> : null}
              </button>
            ))}
            <button type="button" className="chargingProfileAdd" onClick={() => { setDraft(draftFromProfile(null)); setEditing(true); }}>
              <AppIcon name="add" /> {t("chargingProfiles.add")}
            </button>
          </section>

          <form className="chargingProfileForm" onSubmit={submit}>
            <div className="chargingProfileFormHeader">
              <div><div className="sectionKicker">{t("chargingProfiles.form.kicker")}</div><h3>{draft.id ? t("chargingProfiles.form.edit") : t("chargingProfiles.form.new")}</h3></div>
              {!editing ? <button type="button" className="pill ghostPill" onClick={() => setEditing(true)}>{t("common.edit")}</button> : null}
            </div>

            <div className="chargingProfileFieldGrid">
              <label><span>{t("chargingProfiles.form.name")}</span><input className="input" required maxLength="48" value={draft.name} disabled={!editing} onChange={(event) => update("name", event.target.value)} /></label>
              <label><span>{t("chargingProfiles.form.context")}</span><select className="input" value={draft.context} disabled={!editing} onChange={(event) => update("context", event.target.value)}><option value="home">{t("chargingProfiles.context.home")}</option><option value="public">{t("chargingProfiles.context.public")}</option></select></label>
              <label><span>{t("chargingProfiles.form.energy")}</span><select className="input" value={draft.energySource} disabled={!editing} onChange={(event) => update("energySource", event.target.value)}><option value="grid">{t("chargingProfiles.energy.grid")}</option><option value="pv">{t("chargingProfiles.energy.pv")}</option><option value="mixed">{t("chargingProfiles.energy.mixed")}</option></select></label>
              <label><span>{t("chargingProfiles.form.tariff")}</span><select className="input" value={draft.tariffType} disabled={!editing} onChange={(event) => update("tariffType", event.target.value)}><option value="fixed">{t("chargingProfiles.tariff.fixed")}</option><option value="timeOfUse">{t("chargingProfiles.tariff.timeOfUse")}</option></select></label>
              <label><span>{t("chargingProfiles.form.provider")}</span><input className="input" value={draft.provider} disabled={!editing} onChange={(event) => update("provider", event.target.value)} /></label>
              <label><span>{t("chargingProfiles.form.basePrice")}</span><input className="input" type="number" min="0" max="5" step="0.001" value={draft.basePrice} disabled={!editing} onChange={(event) => update("basePrice", event.target.value)} /></label>
            </div>

            {draft.tariffType === "timeOfUse" ? <fieldset className="chargingProfileFieldset" disabled={!editing}><legend>{t("chargingProfiles.form.timePrices")}</legend><div className="chargingProfileFieldGrid"><label><span>{t("chargingProfiles.form.offPeakPrice")}</span><input className="input" type="number" min="0" max="5" step="0.001" value={draft.offPeakPrice} onChange={(event) => update("offPeakPrice", event.target.value)} /></label><label><span>{t("chargingProfiles.form.peakPrice")}</span><input className="input" type="number" min="0" max="5" step="0.001" value={draft.peakPrice} onChange={(event) => update("peakPrice", event.target.value)} /></label><label><span>{t("chargingProfiles.form.offPeakStart")}</span><input className="input" type="time" value={draft.offPeakStart} onChange={(event) => update("offPeakStart", event.target.value)} /></label><label><span>{t("chargingProfiles.form.offPeakEnd")}</span><input className="input" type="time" value={draft.offPeakEnd} onChange={(event) => update("offPeakEnd", event.target.value)} /></label></div></fieldset> : null}

            <fieldset className="chargingProfileFieldset" disabled={!editing}><legend>{t("chargingProfiles.form.window")}</legend><div className="chargingProfileFieldGrid"><label><span>{t("chargingProfiles.form.windowStart")}</span><input className="input" type="time" value={draft.windowStart} onChange={(event) => update("windowStart", event.target.value)} /></label><label><span>{t("chargingProfiles.form.windowEnd")}</span><input className="input" type="time" value={draft.windowEnd} onChange={(event) => update("windowEnd", event.target.value)} /></label>{draft.energySource !== "grid" ? <label><span>{t("chargingProfiles.form.pvShare")}</span><input className="input" type="number" min="0" max="100" step="5" value={draft.pvShare} onChange={(event) => update("pvShare", event.target.value)} /></label> : null}</div></fieldset>

            <footer className="chargingProfileActions">
              {draft.id && profiles.length > 1 ? <button type="button" className="chargingGoalsReset" onClick={() => { onDelete?.(draft.id); setEditing(false); }}>{t("common.delete")}</button> : <span />}
              {editing ? <div><button type="button" className="pill ghostPill" onClick={() => { setDraft(draftFromProfile(profiles.find((profile) => profile.id === activeProfileId) || null)); setEditing(false); }}>{t("common.cancel")}</button><button type="submit" className="btnPrimary">{t("chargingProfiles.form.save")}</button></div> : null}
            </footer>
          </form>
        </div>
      </aside>
    </div>
  );
}
