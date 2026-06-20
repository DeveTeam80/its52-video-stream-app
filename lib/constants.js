export const identityNumberConstant = "identity number";
export const contactPersonConstant = "Contact Administrator (+91 9423024252)";
export const contactPersonNumberConstant = "(+91 9423024252)";
export const adminIdentityNumber = 30905919;
export const youtubeLink = "";

// Input length limits
export const MAX_IDENTITY_NUMBER_LENGTH = 20;
export const MAX_PASSWORD_LENGTH = 128;

// Viewer session lifetime: 5 hours, used for both the JWT `expiresIn` and the
// auth-token cookie maxAge. Comfortably covers a ~4h live event with margin,
// while keeping any stale single-session lock short-lived: a user whose browser
// is not recognised by device-id can re-login within 5h instead of being stuck.
export const SESSION_LIFETIME_SECONDS = 5 * 60 * 60;

// Admin / super-admin session lifetime: 20 days. Longer than a viewer's (they
// manage the app over time) but far shorter than the old 1 year, to limit
// exposure if an admin doesn't log out on a shared device.
export const ADMIN_SESSION_LIFETIME_SECONDS = 20 * 24 * 60 * 60;

// device-id cookie lifetime: ~400 days (the longest persistent-cookie age
// Chrome honours). This server-set httpOnly cookie identifies a returning
// browser so the same device can silently reclaim its session across network
// changes (home WiFi <-> mobile data) without tripping the single-session block.
// Being server-set, it is exempt from Apple/WebKit's ~7-day cap on
// script-writable storage, so it persists on iOS/Safari as well as Android/Windows.
export const DEVICE_ID_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
