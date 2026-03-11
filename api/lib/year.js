'use strict';

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

module.exports = {
  optionalYearFilter,
  yearRange,
};
