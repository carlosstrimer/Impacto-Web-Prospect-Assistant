// FILE: modules/csv-parser.js
export function detectDelimiter(text) {
  const delimiters = [',', ';', '\t', '|'];
  const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  let inQuotes = false;
  let lines = 0;
  const sample = text.slice(0, 8000);
  for (let i = 0; i < sample.length && lines < 6; i++) {
    const ch = sample[i];
    if (ch === '"') {
      if (inQuotes && sample[i + 1] === '"') { i++; continue; }
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === '\n') lines++;
      else if (ch in counts) counts[ch]++;
    }
  }
  let best = ',';
  let bestCount = 0;
  for (const d of delimiters) {
    if (counts[d] > bestCount) { bestCount = counts[d]; best = d; }
  }
  return best;
}

export function parseCSV(text, delimiter = ',') {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;
  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === delimiter) { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}