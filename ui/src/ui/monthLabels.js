export const MONTH_LABELS_LONG = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

export function monthLabel(monthNumber) {
  return MONTH_LABELS_LONG[(Number(monthNumber) || 1) - 1] || String(monthNumber);
}
