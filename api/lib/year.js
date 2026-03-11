'use strict';

const DEFAULT_VISIBLE_YEARS = [2026, 2027, 2028];

function yearRange(year) {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return {
    from: new Date(`${y}-01-01T00:00:00.000Z`),
    to: new Date(`${y + 1}-01-01T00:00:00.000Z`),
  };
}

function optionalYearFilter(year) {
  if (year == null || year === '') return { year: null, range: null, error: null };

  const range = yearRange(year);
  if (!range) {
    return { year: null, range: null, error: 'Bitte year=YYYY angeben (z.B. 2026).' };
  }

  return { year: Number(year), range, error: null };
}

function buildSelectableYears(years = [], fallbackYear = null) {
  const merged = new Set(DEFAULT_VISIBLE_YEARS);

  for (const year of years || []) {
    const numeric = Number(year);
    if (Number.isInteger(numeric)) merged.add(numeric);
  }

  if (fallbackYear != null) {
    const numericFallback = Number(fallbackYear);
    if (Number.isInteger(numericFallback)) merged.add(numericFallback);
  }

  return Array.from(merged).sort((left, right) => left - right);
}

module.exports = {
  buildSelectableYears,
  DEFAULT_VISIBLE_YEARS,
  optionalYearFilter,
  yearRange,
};
