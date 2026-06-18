import dbConnect from "./dbConnect";
import RateLimitEntry from "./models/rateLimitEntry";

// Checks whether `key` has hit the limit WITHOUT recording anything. Pair with
// recordFailedAttempt() so only FAILED attempts count — legitimate logins (which
// succeed) never consume the budget. This matters because many real users share
// one venue IP; counting successes would lock out the whole venue.
export async function isRateLimited(key, maxAttempts = 10, windowMs = 15 * 60 * 1000) {
  await dbConnect();

  const windowStart = new Date(Date.now() - windowMs);

  // Prune expired entries, then count what remains in the window.
  await RateLimitEntry.deleteMany({ key, createdAt: { $lt: windowStart } });
  const count = await RateLimitEntry.countDocuments({ key, createdAt: { $gte: windowStart } });

  if (count >= maxAttempts) {
    return {
      allowed: false,
      message: "Too many attempts, please try again later.",
    };
  }

  return { allowed: true };
}

// Records one FAILED attempt against `key`. Call this ONLY on a failed login,
// so successful logins don't count toward the limit. Fire-and-forget.
export async function recordFailedAttempt(key) {
  try {
    await dbConnect();
    await RateLimitEntry.create({ key });
  } catch (err) {
    console.error("Failed to record rate-limit attempt:", err.message);
  }
}
