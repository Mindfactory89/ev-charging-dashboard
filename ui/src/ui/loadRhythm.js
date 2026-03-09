export const WEEKDAY_LABELS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export function parseSessionDate(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const utcDate = new Date(Date.UTC(year, month - 1, day));

    if (Number.isNaN(utcDate.getTime())) return null;

    return {
      year,
      month,
      day,
      weekday: utcDate.getUTCDay(),
      weekdayLabel: WEEKDAY_LABELS[utcDate.getUTCDay()] || null,
    };
  }

  const parsed = raw ? new Date(raw) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return null;

  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
    weekday: parsed.getUTCDay(),
    weekdayLabel: WEEKDAY_LABELS[parsed.getUTCDay()] || null,
  };
}

export function getWeekdayUsage(sessions = [], filters = {}) {
  const { year = null, month = null } = filters;
  const counts = new Map();
  let total = 0;

  (sessions || []).forEach((session) => {
    const parts = parseSessionDate(session?.date);
    if (!parts?.weekdayLabel) return;
    if (year != null && Number(parts.year) !== Number(year)) return;
    if (month != null && Number(parts.month) !== Number(month)) return;

    total += 1;
    counts.set(parts.weekdayLabel, (counts.get(parts.weekdayLabel) || 0) + 1);
  });

  const rows = WEEKDAY_LABELS
    .map((label, weekday) => ({
      weekday,
      label,
      count: counts.get(label) || 0,
      share: total > 0 ? ((counts.get(label) || 0) / total) * 100 : 0,
    }))
    .filter((row) => row.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.weekday - right.weekday;
    });

  return {
    total,
    rows,
    top: rows[0] || null,
  };
}
