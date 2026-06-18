// Escapes a single CSV cell:
//  - neutralizes spreadsheet formula injection (values starting with = + - @,
//    tab, or CR get a leading apostrophe so Excel/Sheets treats them as text),
//  - quotes values containing a comma, quote, or newline and doubles any quotes.
export function csvCell(value) {
  let s = value === null || value === undefined ? "" : String(value);

  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }

  if (/[",\n\r]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }

  return s;
}

// Joins an array of cell values into one escaped CSV row.
export function csvRow(values) {
  return values.map(csvCell).join(",");
}
