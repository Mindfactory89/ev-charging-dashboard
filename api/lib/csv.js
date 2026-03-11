'use strict';

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[;"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCSV(rows, headers) {
  const separator = ';';
  const headerLine = headers.join(separator);
  const body = rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(separator))
    .join('\n');
  return `${headerLine}\n${body}\n`;
}

module.exports = {
  toCSV,
};
