'use strict';

function normalizeOptionalText(value) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text ? text : null;
}

function normalizeTagsInput(value) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n;]/)
      : [];

  const tags = rawValues
    .map((entry) => normalizeOptionalText(entry))
    .filter(Boolean)
    .map((entry) => entry.replace(/^#/, ''))
    .filter(Boolean);

  const deduped = [];
  const seen = new Set();

  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(tag);
  }

  return deduped.length ? deduped.join(', ') : null;
}

function parseTags(value) {
  const normalized = normalizeTagsInput(value);
  return normalized ? normalized.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
}

module.exports = {
  normalizeOptionalText,
  normalizeTagsInput,
  parseTags,
};
