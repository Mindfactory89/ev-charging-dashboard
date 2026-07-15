import { useEffect, useRef, useState } from "react";
import ThemeControl from "../design-system/ThemeControl.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function FeatureIcon({ kind }) {
  if (kind === "analysis") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />
      </svg>
    );
  }
  if (kind === "history") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 4h10M7 8h10M6 3v18m12-18v18M8 13h3m2 0h3M8 17h3m2 0h3" />
      </svg>
    );
  }
  if (kind === "privacy") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3 5 6v5c0 4.7 2.8 8.2 7 10 4.2-1.8 7-5.3 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }
  if (kind === "add") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

function WelcomeVisual() {
  return (
    <div className="onboardingVisual" aria-hidden="true">
      <div className="onboardingVisualBrand">e</div>
      <div className="onboardingVisualChart">
        <span style={{ height: "42%" }} />
        <span style={{ height: "68%" }} />
        <span style={{ height: "52%" }} />
        <span style={{ height: "84%" }} />
        <span style={{ height: "64%" }} />
      </div>
      <div className="onboardingVisualMetric">
        <small>2026</small>
        <strong>604,03 €</strong>
        <span>1.259,7 kWh</span>
      </div>
    </div>
  );
}

export default function OnboardingFlow({
  activeScreen,
  onAdd,
  onComplete,
  onDismiss,
  open,
  screenOptions,
}) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [selectedScreen, setSelectedScreen] = useState(activeScreen || "overview");
  const dialogRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSelectedScreen(activeScreen || "overview");
  }, [activeScreen, open]);

  useEffect(() => {
    if (!open) return undefined;
    const previousActive = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        ) || []
      ).filter((element) => element.getClientRects().length > 0);
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

    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => titleRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActive?.focus?.();
    };
  }, [onDismiss, open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => titleRef.current?.focus());
  }, [open, step]);

  if (!open) return null;

  const steps = [
    t("onboarding.steps.welcome"),
    t("onboarding.steps.personalize"),
    t("onboarding.steps.start"),
  ];

  return (
    <div className="onboardingOverlay">
      <section
        ref={dialogRef}
        className="onboardingDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
      >
        <header className="onboardingHeader">
          <div>
            <div className="onboardingEyebrow">{t("onboarding.eyebrow")}</div>
            <div className="onboardingStepCount">{t("onboarding.stepCount", { current: step + 1, total: steps.length })}</div>
          </div>
          <button type="button" className="onboardingClose" onClick={onDismiss} aria-label={t("onboarding.close")}>
            <CloseIcon />
          </button>
        </header>

        <ol className="onboardingProgress" aria-label={t("onboarding.progressLabel")}>
          {steps.map((label, index) => (
            <li key={label} className={index <= step ? "active" : ""} aria-current={index === step ? "step" : undefined}>
              <span>{index + 1}</span>
              <small>{label}</small>
            </li>
          ))}
        </ol>

        <div className="onboardingBody">
          {step === 0 ? (
            <div className="onboardingStep onboardingWelcomeStep">
              <WelcomeVisual />
              <div className="onboardingCopy">
                <div className="onboardingEyebrow">{t("onboarding.welcome.kicker")}</div>
                <h2 id="onboarding-title" ref={titleRef} tabIndex={-1}>{t("onboarding.welcome.title")}</h2>
                <p id="onboarding-description">{t("onboarding.welcome.text")}</p>
                <div className="onboardingFeatureList">
                  {["overview", "analysis", "history"].map((key) => (
                    <div key={key} className="onboardingFeature">
                      <span className="onboardingIcon"><FeatureIcon kind={key} /></span>
                      <span>
                        <strong>{t(`onboarding.welcome.features.${key}.title`)}</strong>
                        <small>{t(`onboarding.welcome.features.${key}.text`)}</small>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="onboardingStep onboardingPreferenceStep">
              <div className="onboardingCopy">
                <div className="onboardingEyebrow">{t("onboarding.personalize.kicker")}</div>
                <h2 id="onboarding-title" ref={titleRef} tabIndex={-1}>{t("onboarding.personalize.title")}</h2>
                <p id="onboarding-description">{t("onboarding.personalize.text")}</p>
              </div>

              <div className="onboardingPreferenceGrid">
                <section className="onboardingPreferenceCard" aria-labelledby="onboarding-theme-title">
                  <div>
                    <h3 id="onboarding-theme-title">{t("onboarding.personalize.themeTitle")}</h3>
                    <p>{t("onboarding.personalize.themeText")}</p>
                  </div>
                  <ThemeControl />
                </section>

                <section className="onboardingPreferenceCard" aria-labelledby="onboarding-start-title">
                  <div>
                    <h3 id="onboarding-start-title">{t("onboarding.personalize.startTitle")}</h3>
                    <p>{t("onboarding.personalize.startText")}</p>
                  </div>
                  <div className="onboardingScreenChoices">
                    {screenOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={selectedScreen === option.id ? "active" : ""}
                        onClick={() => setSelectedScreen(option.id)}
                        aria-pressed={selectedScreen === option.id}
                      >
                        <span className="onboardingIcon"><FeatureIcon kind={option.id === "verlauf" ? "history" : option.id} /></span>
                        <span>
                          <strong>{option.label}</strong>
                          <small>{option.shortMeta}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="onboardingStep onboardingStartStep">
              <div className="onboardingCopy">
                <div className="onboardingEyebrow">{t("onboarding.start.kicker")}</div>
                <h2 id="onboarding-title" ref={titleRef} tabIndex={-1}>{t("onboarding.start.title")}</h2>
                <p id="onboarding-description">{t("onboarding.start.text")}</p>
              </div>

              <div className="onboardingStartGrid">
                <article className="onboardingStartCard">
                  <span className="onboardingIcon"><FeatureIcon kind="privacy" /></span>
                  <div>
                    <h3>{t("onboarding.start.privacyTitle")}</h3>
                    <p>{t("onboarding.start.privacyText")}</p>
                  </div>
                </article>
                <button type="button" className="onboardingStartCard actionable" onClick={onAdd}>
                  <span className="onboardingIcon"><FeatureIcon kind="add" /></span>
                  <span>
                    <strong>{t("onboarding.start.addTitle")}</strong>
                    <small>{t("onboarding.start.addText")}</small>
                  </span>
                  <span className="onboardingArrow" aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="onboardingFooter">
          <button type="button" className="onboardingSkip" onClick={onDismiss}>{t("onboarding.skip")}</button>
          <div className="onboardingFooterActions">
            {step > 0 ? (
              <button type="button" className="onboardingSecondary" onClick={() => setStep((value) => value - 1)}>
                {t("onboarding.back")}
              </button>
            ) : null}
            {step < steps.length - 1 ? (
              <button type="button" className="onboardingPrimary" onClick={() => setStep((value) => value + 1)}>
                {t("onboarding.next")}
              </button>
            ) : (
              <button type="button" className="onboardingPrimary" onClick={() => onComplete(selectedScreen)}>
                {t("onboarding.finish")}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
