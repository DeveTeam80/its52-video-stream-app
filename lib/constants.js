export const identityNumberConstant = "identity number";
export const contactPersonConstant = "Contact Administrator (+91 9423024252)";
export const contactPersonNumberConstant = "(+91 9423024252)";
export const adminIdentityNumber = 30905919;
export const youtubeLink = "";

// Input length limits
export const MAX_IDENTITY_NUMBER_LENGTH = 20;
export const MAX_PASSWORD_LENGTH = 128;

// Viewer session lifetime: 20 hours, used for both the JWT `expiresIn` and the
// auth-token cookie maxAge. Short enough that a stale single-session lock
// auto-expires within a day (so users can re-login without an admin reset),
// long enough to comfortably cover a single live event.
export const SESSION_LIFETIME_SECONDS = 20 * 60 * 60;

// Admin / super-admin session lifetime: 20 days. Longer than a viewer's (they
// manage the app over time) but far shorter than the old 1 year, to limit
// exposure if an admin doesn't log out on a shared device.
export const ADMIN_SESSION_LIFETIME_SECONDS = 20 * 24 * 60 * 60;
