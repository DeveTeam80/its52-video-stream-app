import dbConnect from "./dbConnect";
import RateLimitEntry from "./models/rateLimitEntry";

export async function checkRateLimit(key, maxAttempts = 10, windowMs = 15 * 60 * 1000) {
  await dbConnect();

  const windowStart = new Date(Date.now() - windowMs);

  // Clean up expired entries and count current ones
  await RateLimitEntry.deleteMany({ key, createdAt: { $lt: windowStart } });

  const count = await RateLimitEntry.countDocuments({ key, createdAt: { $gte: windowStart } });

  if (count >= maxAttempts) {
    return {
      allowed: false,
      message: "Too many requests, please try again later.",
    };
  }

  // Log this attempt
  await RateLimitEntry.create({ key });

  return { allowed: true };
}
