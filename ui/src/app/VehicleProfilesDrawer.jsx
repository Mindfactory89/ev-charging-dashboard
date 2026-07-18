import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { confirmAction } from "../platform/runtime.js";
import { validateVehicleProfileDraft } from "../config/vehicleProfilePreferences.js";
import {
  processVehicleImageFile,
  VEHICLE_IMAGE_ACCEPT,
} from "../ui/vehicleImage.js";

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 15.5 6.5 10h11l2.5 5.5" />
      <path d="M3 15.5h18v3H3z" />
      <circle cx="7" cy="18.5" r="1.5" />
      <circle cx="17" cy="18.5" r="1.5" />
    </svg>
  );
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

function emptyDraft() {
  return {
    id: "",
    catalogId: "",
    name: "",
    manufacturer: "",
    model: "",
    variant: "",
    modelYear: "",
    bodyType: "other",
    batteryKwh: "60",
    consumptionKwhPer100Km: "17.2",
    chargingPowerKw: "150",
    imageDataUrl: "",
  };
}

function draftFromProfile(profile) {
  return {
    id: profile?.id || "",
    catalogId: profile?.catalogId || "",
    name: profile?.name || "",
    manufacturer: profile?.manufacturer || "",
    model: profile?.model || "",
    variant: profile?.variant || "",
    modelYear: profile?.modelYear != null ? String(profile.modelYear) : "",
    bodyType: profile?.bodyType || "other",
    batteryKwh: profile?.batteryKwh != null ? String(profile.batteryKwh) : "",
    consumptionKwhPer100Km: profile?.consumptionKwhPer100Km != null ? String(profile.consumptionKwhPer100Km) : "",
    chargingPowerKw: profile?.chargingPowerKw != null ? String(profile.chargingPowerKw) : "",
    imageDataUrl: profile?.imageSource === "user" ? profile.imageSrc : "",
  };
}

export default function VehicleProfilesDrawer({
  activeProfileId,
  demo = false,
  onClose,
  onDelete,
  onSave,
  onSelect,
  open,
  profiles = [],
}) {
  const { t } = useI18n();
  const panelRef = React.useRef(null);
  const imageInputRef = React.useRef(null);
  const imageInputId = React.useId();
  const [draft, setDraft] = React.useState(null);
  const [initialDraft, setInitialDraft] = React.useState(null);
  const [errors, setErrors] = React.useState({});
  const [message, setMessage] = React.useState("");
  const [imageBusy, setImageBusy] = React.useState(false);
  const [imageError, setImageError] = React.useState("");
  const [catalogQuery, setCatalogQuery] = React.useState("");

  const builtInProfiles = profiles.filter((profile) => !profile.isCustom);
  const customProfiles = profiles.filter((profile) => profile.isCustom);
  const visibleCatalogProfiles = React.useMemo(() => {
    const terms = catalogQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return builtInProfiles;
    return builtInProfiles.filter((profile) => {
      const haystack = [profile.manufacturer, profile.model, profile.variant, profile.name, profile.bodyType]
        .filter(Boolean).join(" ").toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [builtInProfiles, catalogQuery]);
  const dirty = Boolean(draft && JSON.stringify(draft) !== JSON.stringify(initialDraft));
  const dirtyRef = React.useRef(dirty);
  dirtyRef.current = dirty;

  React.useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => panelRef.current?.focus?.(), 40);

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  async function canDiscardDraft() {
    if (!dirtyRef.current) return true;
    return confirmAction(t("vehicleProfiles.discard.message"), {
      title: t("vehicleProfiles.discard.title"),
      confirmLabel: t("vehicleProfiles.discard.confirm"),
      cancelLabel: t("common.cancel"),
    });
  }

  async function requestClose() {
    if (!await canDiscardDraft()) return;
    setDraft(null);
    setInitialDraft(null);
    setErrors({});
    setMessage("");
    setImageError("");
    onClose?.();
  }

  async function beginCreate() {
    if (!await canDiscardDraft()) return;
    const next = emptyDraft();
    setDraft(next);
    setInitialDraft(next);
    setErrors({});
    setMessage("");
    setImageError("");
  }

  async function beginEdit(profile) {
    if (!await canDiscardDraft()) return;
    const next = draftFromProfile(profile);
    setDraft(next);
    setInitialDraft(next);
    setErrors({});
    setMessage("");
    setImageError("");
  }

  async function beginFromCatalog(profile) {
    if (!await canDiscardDraft()) return;
    const next = {
      ...draftFromProfile(profile),
      id: "",
      catalogId: profile.id,
      imageDataUrl: "",
    };
    setDraft(next);
    setInitialDraft(next);
    setErrors({});
    setMessage("");
    setImageError("");
  }

  async function cancelDraft() {
    if (!await canDiscardDraft()) return;
    setDraft(null);
    setInitialDraft(null);
    setErrors({});
    setMessage("");
    setImageError("");
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...(current || emptyDraft()), [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage("");
  }

  async function chooseVehicleImage(event) {
    if (demo) return;
    const file = event.target.files?.[0];
    if (!file) return;
    setImageBusy(true);
    setImageError("");
    setMessage("");
    try {
      const imageDataUrl = await processVehicleImageFile(file);
      updateDraft("imageDataUrl", imageDataUrl);
    } catch (error) {
      const code = ["type", "size", "decode", "output"].includes(error?.message) ? error.message : "decode";
      setImageError(t(`vehicleProfiles.validation.image${code[0].toUpperCase()}${code.slice(1)}`));
    } finally {
      setImageBusy(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function removeVehicleImage() {
    updateDraft("imageDataUrl", "");
    setImageError("");
  }

  function saveDraft(event) {
    event.preventDefault();
    const validation = validateVehicleProfileDraft(draft || {});
    if (!validation.valid) {
      setErrors(validation.errors);
      setMessage(t("vehicleProfiles.form.review"));
      const firstField = Object.keys(validation.errors)[0];
      panelRef.current?.querySelector?.(`[name="${firstField}"]`)?.focus?.();
      return;
    }
    const saved = onSave?.(draft);
    if (!saved) return;
    if (draft.imageDataUrl && saved.imageSource !== "user") {
      setImageError(t("vehicleProfiles.validation.imageStorage"));
      return;
    }
    const next = draftFromProfile(saved);
    setDraft(next);
    setInitialDraft(next);
    setErrors({});
    setMessage(t("vehicleProfiles.form.saved", { name: saved.name }));
  }

  async function deleteProfile(profile) {
    const confirmed = await confirmAction(t("vehicleProfiles.delete.message", { name: profile.name }), {
      title: t("vehicleProfiles.delete.title"),
      confirmLabel: t("vehicleProfiles.delete.confirm"),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!confirmed) return;
    onDelete?.(profile.id);
    if (draft?.id === profile.id) {
      setDraft(null);
      setInitialDraft(null);
    }
    setMessage(t("vehicleProfiles.delete.deleted"));
  }

  function ProfileCard({ profile }) {
    const active = profile.id === activeProfileId;
    return (
      <article className={`vehicleProfileCard ${active ? "active" : ""}`}>
        <button
          type="button"
          className="vehicleProfileSelect"
          onClick={() => onSelect?.(profile.id)}
          aria-pressed={active}
        >
          <span className={`vehicleProfileCardIcon ${profile.imageSrc ? "hasImage" : ""}`.trim()}>
            {profile.imageSrc ? <img src={profile.imageSrc} alt="" /> : <ProfileIcon />}
          </span>
          <span className="vehicleProfileCardCopy">
            <strong>{profile.name}</strong>
            <small>
              {profile.batteryKwh != null ? `${profile.batteryKwh} kWh` : t("vehicleProfiles.card.batteryOpen")}
              {" · "}
              {profile.consumptionKwhPer100Km != null ? `${profile.consumptionKwhPer100Km} kWh/100 km` : t("vehicleProfiles.card.consumptionOpen")}
            </small>
          </span>
          <span className="vehicleProfileCardState">{active ? t("vehicleProfiles.card.active") : t("vehicleProfiles.card.use")}</span>
        </button>
        {profile.isCustom ? (
          <div className="vehicleProfileCardActions">
            <button type="button" onClick={() => beginEdit(profile)}>{t("common.edit")}</button>
            <button type="button" className="danger" onClick={() => deleteProfile(profile)}>{t("common.delete")}</button>
          </div>
        ) : profile.id !== "generic-ev" ? (
          <div className="vehicleProfileCardActions">
            <button type="button" onClick={() => beginFromCatalog(profile)}>{t("vehicleProfiles.card.customize")}</button>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <div className="vehicleProfilesOverlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) requestClose();
    }}>
      <aside
        className="vehicleProfilesDrawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-profiles-title"
        aria-describedby="vehicle-profiles-description"
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="vehicleProfilesHeader">
          <div className="vehicleProfilesIdentity">
            <span className="vehicleProfilesGlyph"><ProfileIcon /></span>
            <div>
              <div className="sectionKicker">{t("vehicleProfiles.kicker")}</div>
              <h2 id="vehicle-profiles-title">{t("vehicleProfiles.title")}</h2>
              <p id="vehicle-profiles-description">{t("vehicleProfiles.text")}</p>
            </div>
          </div>
          <button type="button" className="vehicleProfilesClose" onClick={requestClose} aria-label={t("vehicleProfiles.close")}>
            <CloseIcon />
          </button>
        </header>

        <div className="vehicleProfilesContent">
          <section aria-labelledby="vehicle-built-in-title">
            <div className="vehicleProfilesSectionHeading">
              <div><span>{t("vehicleProfiles.builtIn.kicker")}</span><h3 id="vehicle-built-in-title">{t("vehicleProfiles.builtIn.title")}</h3></div>
              <small>{t("vehicleProfiles.builtIn.text")}</small>
            </div>
            <label className="vehicleCatalogSearch">
              <span className="srOnly">{t("vehicleProfiles.catalog.searchLabel")}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
              <input
                type="search"
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder={t("vehicleProfiles.catalog.searchPlaceholder")}
              />
              {catalogQuery ? <button type="button" onClick={() => setCatalogQuery("")} aria-label={t("vehicleProfiles.catalog.clear")}>×</button> : null}
            </label>
            <div className="vehicleProfileGrid">
              {visibleCatalogProfiles.map((profile) => <ProfileCard key={profile.id} profile={profile} />)}
            </div>
            {!visibleCatalogProfiles.length ? (
              <div className="vehicleProfilesEmpty vehicleCatalogEmpty">
                <strong>{t("vehicleProfiles.catalog.emptyTitle")}</strong>
                <span>{t("vehicleProfiles.catalog.emptyText")}</span>
                <button type="button" className="pill" onClick={beginCreate}>{t("vehicleProfiles.custom.add")}</button>
              </div>
            ) : null}
          </section>

          <section className="vehicleCustomProfiles" aria-labelledby="vehicle-custom-title">
            <div className="vehicleProfilesSectionHeading">
              <div><span>{t("vehicleProfiles.custom.kicker")}</span><h3 id="vehicle-custom-title">{t("vehicleProfiles.custom.title")}</h3></div>
              <button type="button" className="pill" onClick={beginCreate}>{t("vehicleProfiles.custom.add")}</button>
            </div>
            {customProfiles.length ? (
              <div className="vehicleProfileGrid">
                {customProfiles.map((profile) => <ProfileCard key={profile.id} profile={profile} />)}
              </div>
            ) : (
              <div className="vehicleProfilesEmpty"><strong>{t("vehicleProfiles.custom.emptyTitle")}</strong><span>{t("vehicleProfiles.custom.emptyText")}</span></div>
            )}
          </section>

          {draft ? (
            <form className="vehicleProfileForm" onSubmit={saveDraft} noValidate>
              <div className="vehicleProfileFormHeader">
                <div><span>{t("vehicleProfiles.form.kicker")}</span><h3>{draft.id ? t("vehicleProfiles.form.editTitle") : t("vehicleProfiles.form.createTitle")}</h3></div>
                <button type="button" className="pill ghostPill" onClick={cancelDraft}>{t("common.cancel")}</button>
              </div>
              <div className="vehicleProfileFormGrid">
                <label className={`field ${errors.name ? "hasError" : ""}`}>
                  <span>{t("vehicleProfiles.form.name")}</span>
                  <input name="name" className="input" value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder={t("vehicleProfiles.form.namePlaceholder")} aria-invalid={errors.name ? "true" : "false"} />
                  {errors.name ? <small className="vehicleProfileError" role="alert">{t("vehicleProfiles.validation.name")}</small> : null}
                </label>
                <label className="field">
                  <span>{t("vehicleProfiles.form.manufacturer")}</span>
                  <input name="manufacturer" className="input" value={draft.manufacturer} onChange={(event) => updateDraft("manufacturer", event.target.value)} placeholder={t("vehicleProfiles.form.manufacturerPlaceholder")} />
                </label>
                <label className="field">
                  <span>{t("vehicleProfiles.form.model")}</span>
                  <input name="model" className="input" value={draft.model} onChange={(event) => updateDraft("model", event.target.value)} placeholder={t("vehicleProfiles.form.modelPlaceholder")} />
                </label>
                <label className="field">
                  <span>{t("vehicleProfiles.form.variant")}</span>
                  <input name="variant" className="input" value={draft.variant} onChange={(event) => updateDraft("variant", event.target.value)} placeholder={t("vehicleProfiles.form.variantPlaceholder")} />
                </label>
                <label className="field">
                  <span>{t("vehicleProfiles.form.modelYear")}</span>
                  <input name="modelYear" className="input" type="number" inputMode="numeric" min="2010" max="2100" value={draft.modelYear} onChange={(event) => updateDraft("modelYear", event.target.value)} placeholder={t("vehicleProfiles.form.modelYearPlaceholder")} />
                </label>
                <label className={`field ${errors.batteryKwh ? "hasError" : ""}`}>
                  <span>{t("vehicleProfiles.form.battery")}</span>
                  <input name="batteryKwh" className="input" type="number" inputMode="decimal" min="10" max="300" step="0.1" value={draft.batteryKwh} onChange={(event) => updateDraft("batteryKwh", event.target.value)} aria-invalid={errors.batteryKwh ? "true" : "false"} />
                  {errors.batteryKwh ? <small className="vehicleProfileError" role="alert">{t("vehicleProfiles.validation.battery")}</small> : <small>{t("vehicleProfiles.form.batteryHelp")}</small>}
                </label>
                <label className={`field ${errors.consumptionKwhPer100Km ? "hasError" : ""}`}>
                  <span>{t("vehicleProfiles.form.consumption")}</span>
                  <input name="consumptionKwhPer100Km" className="input" type="number" inputMode="decimal" min="5" max="60" step="0.1" value={draft.consumptionKwhPer100Km} onChange={(event) => updateDraft("consumptionKwhPer100Km", event.target.value)} aria-invalid={errors.consumptionKwhPer100Km ? "true" : "false"} />
                  {errors.consumptionKwhPer100Km ? <small className="vehicleProfileError" role="alert">{t("vehicleProfiles.validation.consumption")}</small> : <small>{t("vehicleProfiles.form.consumptionHelp")}</small>}
                </label>
                <label className={`field ${errors.chargingPowerKw ? "hasError" : ""}`}>
                  <span>{t("vehicleProfiles.form.power")}</span>
                  <input name="chargingPowerKw" className="input" type="number" inputMode="decimal" min="1" max="1000" step="1" value={draft.chargingPowerKw} onChange={(event) => updateDraft("chargingPowerKw", event.target.value)} aria-invalid={errors.chargingPowerKw ? "true" : "false"} />
                  {errors.chargingPowerKw ? <small className="vehicleProfileError" role="alert">{t("vehicleProfiles.validation.power")}</small> : <small>{t("vehicleProfiles.form.powerHelp")}</small>}
                </label>
              </div>
              <section className={`vehicleImageEditor ${imageError ? "hasError" : ""} ${demo ? "isLocked" : ""}`.trim()} aria-labelledby={`${imageInputId}-title`}>
                <div className="vehicleImagePreview">
                  {draft.imageDataUrl ? (
                    <img src={draft.imageDataUrl} alt={t("vehicleProfiles.form.imagePreviewAlt", { name: draft.name || t("hero.vehicle") })} />
                  ) : (
                    <div className="vehicleImagePlaceholder" aria-hidden="true"><ProfileIcon /></div>
                  )}
                </div>
                <div className="vehicleImageCopy">
                  <strong id={`${imageInputId}-title`}>{t("vehicleProfiles.form.imageTitle")}</strong>
                  <p>{t("vehicleProfiles.form.imageText")}</p>
                  {demo ? (
                    <div className="vehicleImageDemoLock" role="note">
                      <span aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg></span>
                      <div><strong>{t("vehicleProfiles.form.imageDemoTitle")}</strong><p>{t("vehicleProfiles.form.imageDemoText")}</p></div>
                    </div>
                  ) : <div className="vehicleImageActions">
                    <input
                      ref={imageInputRef}
                      id={imageInputId}
                      className="vehicleImageInput"
                      type="file"
                      accept={VEHICLE_IMAGE_ACCEPT}
                      onChange={chooseVehicleImage}
                      disabled={imageBusy}
                      aria-describedby={`${imageInputId}-help${imageError ? ` ${imageInputId}-error` : ""}`}
                    />
                    <label className="vehicleImageChoose" htmlFor={imageInputId} aria-disabled={imageBusy ? "true" : undefined}>
                      {imageBusy
                        ? t("vehicleProfiles.form.imageProcessing")
                        : draft.imageDataUrl
                          ? t("vehicleProfiles.form.imageReplace")
                          : t("vehicleProfiles.form.imageChoose")}
                    </label>
                    {draft.imageDataUrl ? (
                      <button type="button" className="vehicleImageRemove" onClick={removeVehicleImage} disabled={imageBusy}>
                        {t("vehicleProfiles.form.imageRemove")}
                      </button>
                    ) : null}
                  </div>}
                  <small id={`${imageInputId}-help`}>{demo ? t("vehicleProfiles.form.imageDemoHint") : t("vehicleProfiles.form.imagePrivacy")}</small>
                  {imageError ? <small id={`${imageInputId}-error`} className="vehicleProfileError" role="alert">{imageError}</small> : null}
                </div>
              </section>
              {message ? <div className="vehicleProfileMessage" role="status">{message}</div> : null}
              <div className="vehicleProfileFormActions">
                <span>{t("vehicleProfiles.form.localHint")}</span>
                <button type="submit" className="btnPrimary" disabled={imageBusy}>{draft.id ? t("vehicleProfiles.form.update") : t("vehicleProfiles.form.save")}</button>
              </div>
            </form>
          ) : message ? <div className="vehicleProfileMessage standalone" role="status">{message}</div> : null}
        </div>
      </aside>
    </div>
  );
}
