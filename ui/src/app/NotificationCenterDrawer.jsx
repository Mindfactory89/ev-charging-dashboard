import React from "react";
import { euro, num } from "./formatters.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { monthLabel } from "../ui/monthLabels.js";
import {
  dismissDashboardNotification,
  getVisibleDashboardNotifications,
  markDashboardNotificationsRead,
  resumeDashboardNotifications,
  snoozeDashboardNotifications,
  updateDashboardNotificationPreferences,
} from "../ui/dashboardNotifications.js";

function BellIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17h12l-1.4-2.1V10a4.6 4.6 0 0 0-9.2 0v4.9L6 17Z" /><path d="M10 20h4" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

function notificationParams(notification) {
  const metric = notification.metric || {};
  if (notification.kind === "goalBudget") return { actual: euro(metric.actual), target: euro(metric.target), delta: euro(metric.delta) };
  if (notification.kind === "goalPrice") return { actual: num(metric.actual, 3), target: num(metric.target, 3), delta: num(metric.delta, 3) };
  if (notification.kind === "goalEfficiency") return { actual: num(metric.actual, 1), target: num(metric.target, 1), delta: num(metric.delta, 1) };
  if (notification.kind === "dataQuality") return { count: num(metric.count, 0), score: num(metric.score, 0) };
  if (notification.kind === "providerSaving") return { provider: notification.context?.provider, delta: num(metric.delta, 3), price: num(metric.target, 3) };
  return {
    month: monthLabel(metric.month),
    cost: euro(metric.cost),
    energy: num(metric.energy, 1),
    price: num(metric.price, 3),
    count: num(metric.count, 0),
  };
}

export default function NotificationCenterDrawer({
  notifications = [],
  onClose,
  onNavigate,
  onStateChange,
  open,
  state,
  year,
}) {
  const { t } = useI18n();
  const panelRef = React.useRef(null);
  const visible = getVisibleDashboardNotifications(notifications, state);
  const unread = visible.filter((notification) => !state?.read?.includes(notification.id));
  const snoozed = state?.snoozedUntil && new Date(state.snoozedUntil).getTime() > Date.now();

  React.useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => panelRef.current?.focus?.(), 40);

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
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
  }, [onClose, open]);

  if (!open) return null;

  function updateState(next) {
    onStateChange?.(next);
  }

  function openNotification(notification) {
    updateState(markDashboardNotificationsRead(state, notification.id));
    onNavigate?.(notification.destination);
    onClose?.();
  }

  function markAllRead() {
    updateState(markDashboardNotificationsRead(state, visible.map((notification) => notification.id)));
  }

  return (
    <div className="notificationOverlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <aside className="notificationDrawer" role="dialog" aria-modal="true" aria-labelledby="notification-title" ref={panelRef} tabIndex={-1}>
        <header className="notificationDrawerHeader">
          <div className="notificationDrawerIdentity">
            <span className="notificationDrawerGlyph"><BellIcon /></span>
            <div>
              <div className="sectionKicker">{t("notifications.kicker")}</div>
              <h2 id="notification-title">{t("notifications.title")}</h2>
              <p>{t("notifications.text", { year })}</p>
            </div>
          </div>
          <button type="button" className="notificationClose" onClick={onClose} aria-label={t("notifications.close")}><CloseIcon /></button>
        </header>

        <div className="notificationDrawerBody">
          <section className="notificationSummary" aria-label={t("notifications.summary.ariaLabel")}>
            <div><strong>{visible.length}</strong><span>{t("notifications.summary.active")}</span></div>
            <div><strong>{unread.length}</strong><span>{t("notifications.summary.unread")}</span></div>
            <div><strong>{state?.dismissed?.length || 0}</strong><span>{t("notifications.summary.dismissed")}</span></div>
          </section>

          <div className="notificationActionsBar">
            {unread.length ? <button type="button" className="btnSecondary" onClick={markAllRead}>{t("notifications.markAllRead")}</button> : null}
            {snoozed ? (
              <button type="button" className="btnSecondary" onClick={() => updateState(resumeDashboardNotifications(state))}>{t("notifications.resume")}</button>
            ) : (
              <button type="button" className="pill ghostPill" onClick={() => updateState(snoozeDashboardNotifications(state, 7))}>{t("notifications.snooze")}</button>
            )}
          </div>

          {snoozed ? (
            <div className="notificationSnoozed" role="status">
              <BellIcon />
              <div><strong>{t("notifications.snoozed.title")}</strong><span>{t("notifications.snoozed.text", { date: new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(state.snoozedUntil)) })}</span></div>
            </div>
          ) : visible.length ? (
            <section className="notificationList" aria-labelledby="notification-list-title">
              <div className="notificationSectionHeading">
                <div><div className="sectionKicker">{t("notifications.list.kicker")}</div><h3 id="notification-list-title">{t("notifications.list.title")}</h3></div>
              </div>
              {visible.map((notification) => {
                const params = notificationParams(notification);
                const isUnread = !state?.read?.includes(notification.id);
                return (
                  <article key={notification.id} className={`notificationItem ${notification.tone} ${isUnread ? "unread" : ""}`}>
                    <span className="notificationItemIcon"><BellIcon /></span>
                    <div className="notificationItemCopy">
                      <div className="notificationItemMeta">
                        <span>{t(`notifications.categories.${notification.category}`)}</span>
                        {isUnread ? <span>{t("notifications.new")}</span> : null}
                      </div>
                      <h4>{t(`notifications.items.${notification.kind}.title`, params)}</h4>
                      <p>{t(`notifications.items.${notification.kind}.text`, params)}</p>
                      <button type="button" className="notificationOpen" onClick={() => openNotification(notification)}>{t(`notifications.items.${notification.kind}.action`, params)} <span aria-hidden="true">→</span></button>
                    </div>
                    <button type="button" className="notificationDismiss" onClick={() => updateState(dismissDashboardNotification(state, notification.id))} aria-label={t("notifications.dismiss", { title: t(`notifications.items.${notification.kind}.title`, params) })}><CloseIcon /></button>
                  </article>
                );
              })}
            </section>
          ) : (
            <div className="notificationEmpty"><span className="notificationDrawerGlyph"><BellIcon /></span><div><h3>{t("notifications.empty.title")}</h3><p>{t("notifications.empty.text")}</p></div></div>
          )}

          <section className="notificationPreferences" aria-labelledby="notification-preferences-title">
            <div className="notificationSectionHeading">
              <div><div className="sectionKicker">{t("notifications.preferences.kicker")}</div><h3 id="notification-preferences-title">{t("notifications.preferences.title")}</h3><p>{t("notifications.preferences.text")}</p></div>
            </div>
            <div className="notificationPreferenceGrid">
              {Object.keys(state?.preferences || {}).map((key) => (
                <label key={key} className="notificationPreference">
                  <span><strong>{t(`notifications.preferences.items.${key}.title`)}</strong><small>{t(`notifications.preferences.items.${key}.text`)}</small></span>
                  <input type="checkbox" checked={state.preferences[key] !== false} onChange={(event) => updateState(updateDashboardNotificationPreferences(state, { [key]: event.target.checked }))} />
                </label>
              ))}
            </div>
            <div className="notificationTelegramHint">
              <strong>{t("notifications.telegram.title")}</strong>
              <p>{t("notifications.telegram.text")}</p>
              <code>/summary</code>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
