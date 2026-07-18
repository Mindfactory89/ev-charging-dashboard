import { num } from "../app/formatters.js";
import AppIcon from "../design-system/icons.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { priceForChargingProfile } from "../config/chargingProfiles.js";

export default function ChargingProfileCard({ onOpen, profile }) {
  const { t } = useI18n();
  if (!profile) return null;
  const price = priceForChargingProfile(profile);
  return (
    <section className="chargingProfileCard" aria-labelledby="active-charging-profile-title">
      <span className="chargingProfileCardIcon"><AppIcon name={profile.energySource === "grid" ? "bolt" : "solar"} /></span>
      <div className="chargingProfileCardCopy">
        <div className="sectionKicker">{t("chargingProfiles.card.kicker")}</div>
        <h3 id="active-charging-profile-title">{profile.name}</h3>
        <p>{t("chargingProfiles.card.summary", { context: t(`chargingProfiles.context.${profile.context}`), energy: t(`chargingProfiles.energy.${profile.energySource}`) })}</p>
      </div>
      <dl className="chargingProfileCardFacts">
        <div><dt>{t("chargingProfiles.card.price")}</dt><dd>{price != null ? `${num(price, 3)} €/kWh` : "–"}</dd></div>
        <div><dt>{t("chargingProfiles.card.window")}</dt><dd>{profile.windowStart}–{profile.windowEnd}</dd></div>
        <div><dt>{t("chargingProfiles.card.pv")}</dt><dd>{profile.energySource === "grid" ? t("chargingProfiles.card.grid") : `${num(profile.pvShare, 0)} %`}</dd></div>
      </dl>
      <button type="button" className="pill ghostPill" onClick={onOpen}>{t("chargingProfiles.card.action")}</button>
    </section>
  );
}
