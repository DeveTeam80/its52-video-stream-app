export const identityNumberConstant = "identity number";
export const contactPersonConstant = "Contact Administrator (+91 9423024252)";
export const contactPersonNumberConstant = "(+91 9423024252)";
export const adminIdentityNumber = 30905919;
export const youtubeLink = "";

// Input length limits
export const MAX_IDENTITY_NUMBER_LENGTH = 20;
export const MAX_PASSWORD_LENGTH = 128;

// Session lifetime: 23 hours, used for both the JWT `expiresIn` and the
// auth-token cookie maxAge. Short enough that a stale single-session lock
// auto-expires within a day (so users can re-login without an admin reset),
// long enough to comfortably cover a single live event.
export const SESSION_LIFETIME_SECONDS = 23 * 60 * 60;
