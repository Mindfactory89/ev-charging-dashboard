import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import {
  THEME_PREFERENCES,
  readThemePreference,
  setThemePreference,
} from "./theme.js";

export default function ThemeControl() {
  const { t } = useI18n();
  const [preference, setPreference] = useState(() => readThemePreference());

  function selectTheme(nextPreference) {
    setThemePreference(nextPreference);
    setPreference(nextPreference);
  }

  return (
    <div className="chipRow themeControl">
      {THEME_PREFERENCES.map((option) => (
        <button
          key={option}
          type="button"
          className={preference === option ? "chip" : "chip ghost"}
          onClick={() => selectTheme(option)}
          aria-label={`${t("theme.label")} ${t(`theme.options.${option}`)}`}
          aria-pressed={preference === option}
        >
          {t(`theme.options.${option}`)}
        </button>
      ))}
    </div>
  );
}
