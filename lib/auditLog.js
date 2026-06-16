import dbConnect from "./dbConnect";
import AdminActionLog from "./models/adminActionLog";

/**
 * Records an admin action to the audit log. Fire-and-forget: a logging failure
 * must never break the underlying action, so errors are swallowed (logged to
 * the server console only) — same pattern as the login-attempt logger.
 *
 * @param {object} opts
 * @param {{identityNumber: string, superAdmin?: boolean}} opts.actor - the verifyToken() user
 * @param {string} opts.action - action code, e.g. "DELETE_USER"
 * @param {string|null} [opts.targetIts] - affected user's ITS (null for bulk)
 * @param {string|null} [opts.details] - extra context
 */
export async function logAdminAction({ actor, action, targetIts = null, details = null }) {
  try {
    await dbConnect();
    await AdminActionLog.create({
      actorIts: actor?.identityNumber,
      actorRole: actor?.superAdmin ? "superAdmin" : "admin",
      action,
      targetIts,
      details,
    });
  } catch (err) {
    console.error("Failed to log admin action:", err.message);
  }
}
