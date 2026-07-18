import { euro, num } from "../app/formatters.js";
import AppIcon from "../design-system/icons.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";

export default function ExplainabilityDisclosure({ explanation }) {
  const { t } = useI18n();
  if (!explanation) return null;

  return (
    <details className="explainabilityDisclosure">
      <summary>
        <AppIcon name="info" size={18} />
        <span>{t("explainability.trigger")}</span>
      </summary>
      <div className="explainabilityBody">
        <dl>
          <div>
            <dt>{t("explainability.basisLabel")}</dt>
            <dd>{t(`explainability.basis.${explanation.basis}`, { count: num(explanation.sampleSize, 0) })}</dd>
          </div>
          <div>
            <dt>{t("explainability.confidenceLabel")}</dt>
            <dd><span className={`explainabilityConfidence ${explanation.confidence}`}>{t(`explainability.confidence.${explanation.confidence}`)}</span></dd>
          </div>
          <div>
            <dt>{t("explainability.potentialLabel")}</dt>
            <dd>{explanation.savingsEur != null
              ? t("explainability.potentialValue", { value: euro(explanation.savingsEur) })
              : t("explainability.potentialContext")}</dd>
          </div>
        </dl>
        <p>{t("explainability.caveat")}</p>
      </div>
    </details>
  );
}
