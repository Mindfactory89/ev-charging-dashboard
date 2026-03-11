import React from "react";
import { createPlatformImage } from "../platform/runtime.js";

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

  return null;
}

export default function VehicleHero({ profile, latestDateLabel, year }) {
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
          <div className="sectionKicker">{profile?.sectionKicker || "Fahrzeugprofil"}</div>
          <div className="heroTitle">{profile?.name || "Fahrzeug"}</div>

          {Array.isArray(profile?.specs) && profile.specs.length ? (
            <div className="heroChips" aria-label="Fahrzeug-Spezifikationen">
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
            {latestDateLabel ? `Letzter Ladevorgang: ${latestDateLabel}` : `Keine Daten für ${year}`}
          </div>
        </div>
      </div>

      <div className="heroImg heroImgHybrid">
        <div className="heroCupraSlash" aria-hidden="true" />
        <div className="heroGlow heroGlowCupra" aria-hidden="true" />

        {hasImage ? (
          <img
            src={profile.imageSrc}
            alt={profile?.imageAlt || profile?.name || "Fahrzeug"}
            style={{ display: heroStatus === "ready" ? "block" : "none" }}
          />
        ) : null}

        {heroStatus === "error" || heroStatus === "missing" ? (
          <div className="heroFallback">
            {profile?.fallbackLabel || "Hero-Bild"}
            <br />
            <span>{profile?.fallbackHint || `Datei: ${profile?.imageSrc || "kein Asset konfiguriert"}`}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
