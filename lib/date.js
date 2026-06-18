// True if `date` falls on the current calendar day (local time of wherever this
// runs — the admin's browser in the UI, the server in CSV exports). Used for the
// "Logged In Today" column, which is driven by lastLoginAt rather than a sticky
// boolean that never reset.
export function isToday(date) {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  return d.toDateString() === new Date().toDateString();
}
