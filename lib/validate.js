// Returns the trimmed string if `value` is present and non-empty, otherwise
// null. Use this to validate a required field BEFORE coercing it: writing
// `field = String(field).trim()` turns a missing field into the literal string
// "undefined" (which is truthy), so a later `if (!field)` guard fails to catch
// it. cleanRequired() returns null for missing/empty input, so the guard works.
export function cleanRequired(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}
