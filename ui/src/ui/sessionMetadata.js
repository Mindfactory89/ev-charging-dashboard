export function normalizeSessionText(value) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text ? text : null;
}

export function normalizeTagsInput(value) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n;]/)
      : [];

  const seen = new Set();
  const tags = [];

  for (const entry of rawValues) {
    const normalized = normalizeSessionText(entry)?.replace(/^#/, "") || null;
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(normalized);
  }

  return tags;
}

export function formatTags(value) {
  return normalizeTagsInput(value).join(", ");
}

export function parseTags(value) {
  return normalizeTagsInput(value);
}
