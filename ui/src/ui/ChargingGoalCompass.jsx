import { euro, num } from "../app/formatters.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import AppIcon from "../design-system/icons.jsx";
import ExplainabilityDisclosure from "./ExplainabilityDisclosure.jsx";
import { buildGoalExplanation } from "./explainability.js";

function GoalIcon({ kind }) {
  return <AppIcon name={kind === "budget" ? "budget" : kind === "price" ? "tag" : "efficiency"} />;
}

function formatValue(item) {
  if (!item.available) return "–";
  if (item.key === "budget") return euro(item.actual);
  if (item.key === "price") return `${num(item.actual, 3)} €/kWh`;
  return `${num(item.actual, 1)}/100`;
}

function formatTarget(item) {
  if (item.key === "budget") return euro(item.target);
  if (item.key === "price") return `${num(item.target, 3)} €/kWh`;
  return `${num(item.target, 1)}/100`;
}

function statusCopy(item, t) {
  if (!item.available) return t("chargingGoals.status.noData");
  const value = Math.abs(item.delta);
  if (item.key === "budget") {
    return item.met
      ? t("chargingGoals.status.budgetRemaining", { value: euro(value) })
      : t("chargingGoals.status.budgetExceeded", { value: euro(value) });
  }
  if (item.key === "price") {
    return item.met
      ? t("chargingGoals.status.priceBelow", { value: `${num(value, 3)} €/kWh` })
      : t("chargingGoals.status.priceAbove", { value: `${num(value, 3)} €/kWh` });
  }
  return item.met
    ? t("chargingGoals.status.efficiencyAbove", { value: num(value, 1) })
    : t("chargingGoals.status.efficiencyBelow", { value: num(value, 1) });
}

export default function ChargingGoalCompass({ goals, items = [], onOpen, sessions = [], year }) {
  const { t } = useI18n();
  const availableItems = items.filter((item) => item.available);
  const metCount = availableItems.filter((item) => item.met).length;

  if (!goals || !items.length) {
    return (
      <section className="chargingGoalCompass chargingGoalEmpty" aria-labelledby="charging-goal-title">
        <span className="chargingGoalCompassIcon"><AppIcon name="compass" /></span>
        <div className="chargingGoalEmptyCopy">
          <div className="sectionKicker">{t("chargingGoals.kicker")}</div>
          <h3 id="charging-goal-title">{t("chargingGoals.empty.title")}</h3>
          <p>{t("chargingGoals.empty.text")}</p>
        </div>
        <button type="button" className="btnPrimary" onClick={onOpen}>{t("chargingGoals.empty.action")}</button>
      </section>
    );
  }

  return (
    <section className="chargingGoalCompass" aria-labelledby="charging-goal-title">
      <header className="chargingGoalHeader">
        <div className="chargingGoalHeading">
          <span className="chargingGoalCompassIcon"><AppIcon name="compass" /></span>
          <div>
            <div className="sectionKicker">{t("chargingGoals.kicker")}</div>
            <h3 id="charging-goal-title">{t("chargingGoals.title")}</h3>
            <p>{t("chargingGoals.text", { year })}</p>
          </div>
        </div>
        <div className="chargingGoalHeaderActions">
          <span className="pill ghostPill">{availableItems.length
            ? t("chargingGoals.summary", { met: metCount, total: availableItems.length })
            : t("chargingGoals.status.noData")}</span>
          <button type="button" className="pill ghostPill" onClick={onOpen}>{t("common.edit")}</button>
        </div>
      </header>

      <div className="chargingGoalGrid">
        {items.map((item) => {
          const tone = !item.available ? "neutral" : item.met ? "positive" : "negative";
          const status = statusCopy(item, t);
          return (
            <article key={item.key} className={`chargingGoalCard ${tone}`}>
              <div className="chargingGoalCardHeader">
                <span className="chargingGoalMetricIcon"><GoalIcon kind={item.key} /></span>
                <div>
                  <span>{t(`chargingGoals.items.${item.key}.label`)}</span>
                  <strong>{t(`chargingGoals.items.${item.key}.title`)}</strong>
                </div>
                <span className={`chargingGoalStatus ${tone}`}>{item.met == null
                  ? t("chargingGoals.status.open")
                  : item.met
                    ? t("chargingGoals.status.met")
                    : t("chargingGoals.status.missed")}</span>
              </div>
              <div className="chargingGoalValue">{formatValue(item)}</div>
              <div className="chargingGoalTarget">{t("chargingGoals.target", { value: formatTarget(item) })}</div>
              <div
                className="chargingGoalProgress"
                role="progressbar"
                aria-label={`${t(`chargingGoals.items.${item.key}.title`)}: ${status}`}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={Math.round(item.progress)}
              >
                <span style={{ transform: `scaleX(${item.progress / 100})` }} />
              </div>
              <p>{status}</p>
              <ExplainabilityDisclosure explanation={buildGoalExplanation(item, { sessions })} />
            </article>
          );
        })}
      </div>
    </section>
  );
}
