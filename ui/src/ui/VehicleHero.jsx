import React from "react";
import { createPlatformImage } from "../platform/runtime.js";
import { useI18n } from "../i18n/I18nProvider.jsx";

function SpecIcon({ kind }) {
  if (kind === "trim") {
    return (
      <svg className="chipIcon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 7l-8-4-8 4v10l8 4 8-4V7z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 3v18" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      </svg>
    );
  }

  if (kind === "power") {
    return (
      <svg className="chipIcon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 2L3 14h7l-1 8 12-14h-7l-1-6z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === "horsepower") {
    return (
      <svg className="chipIcon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 16a6 6 0 1 1 12 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 10l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 16h8" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      </svg>
    );
  }

  if (kind === "battery") {
    return (
      <svg className="chipIcon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 8.5h16v7H3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M19 10h2v4h-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M6 12h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
      </svg>
    );
  }

  if (kind === "consumption") {
    return (
      <svg className="chipIcon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 15.5a8 8 0 1 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="m12 12 4-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7 18h10" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      </svg>
    );
  }

  return null;
}

export default function VehicleHero({ profile, latestDateLabel, year }) {
  const { t } = useI18n();
  const [heroStatus, setHeroStatus] = React.useState("idle");
  const hasImage = Boolean(profile?.imageSrc);

  React.useEffect(() => {
    if (!hasImage) {
      setHeroStatus("missing");
      return undefined;
    }

    let active = true;
    const img = createPlatformImage();

    if (!img) {
      setHeroStatus("error");
      return undefined;
    }

    setHeroStatus("loading");

    img.onload = () => {
      if (active) setHeroStatus("ready");
    };

    img.onerror = () => {
      if (active) setHeroStatus("error");
    };

    img.src = profile.imageSrc;

    return () => {
      active = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [hasImage, profile?.imageSrc]);

  return (
    <div className="card glassStrong heroCard">
      <div className="heroHeader heroHeaderHybrid">
        <div className="heroLeft">
          <div className="sectionKicker">{t("hero.vehicleProfile")}</div>
          <h3 className="heroTitle">{profile?.name || t("hero.vehicle")}</h3>

          {Array.isArray(profile?.specs) && profile.specs.length ? (
            <div className="heroChips" aria-label={t("hero.vehicleSpecs")}>
              {profile.specs.map((spec) => (
                <span key={spec.id || spec.label} className={`chipSpec chipText ${spec.accent ? "accent" : ""}`.trim()}>
                  <SpecIcon kind={spec.icon} />
                  {spec.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="heroRight heroPillStack heroMetaRail">
          <div className="pill heroStatusPill">
            {latestDateLabel
              ? t("hero.latestSession", { date: latestDateLabel })
              : t("hero.noDataForYear", { year })}
          </div>
        </div>
      </div>

      <div className="heroImg heroImgHybrid">
        <div className="heroBrandAccent" aria-hidden="true" />
        <div className="heroGlow heroGlowBrand" aria-hidden="true" />

        {hasImage ? (
          <img
            className={profile?.imageSource === "user" ? "heroUserImage" : undefined}
            src={profile.imageSrc}
            alt={profile?.imageAlt || profile?.name || t("hero.vehicle")}
            style={{ display: heroStatus === "ready" ? "block" : "none" }}
          />
        ) : null}

        {heroStatus === "error" || heroStatus === "missing" ? (
          <div className="heroFallback heroProfileVisual">
            <svg viewBox="0 0 320 130" aria-hidden="true">
              <path d="M42 86c15-28 38-45 74-52h74c31 6 53 23 72 52" />
              <path d="M25 86h270v23H25z" />
              <circle cx="84" cy="108" r="20" />
              <circle cx="238" cy="108" r="20" />
              <path d="M118 35 93 84h122l-28-49" />
            </svg>
            <strong>{profile?.fallbackLabel || t("hero.imageFallback")}</strong>
            <span>{profile?.fallbackHint || t("hero.assetMissing")}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
