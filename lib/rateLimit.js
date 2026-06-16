import prisma from "./prisma";

export async function checkRateLimit(key, maxAttempts = 10, windowMs = 15 * 60 * 1000) {
  const windowStart = new Date(Date.now() - windowMs);

  // Clean up expired entries (no TTL index in Postgres — prune at query time)
  await prisma.rateLimitEntry.deleteMany({
    where: { key, createdAt: { lt: windowStart } },
  });

  const count = await prisma.rateLimitEntry.count({
    where: { key, createdAt: { gte: windowStart } },
  });

  if (count >= maxAttempts) {
    return {
      allowed: false,
      message: "Too many requests, please try again later.",
    };
  }

  // Log this attempt
  await prisma.rateLimitEntry.create({ data: { key } });

  return { allowed: true };
}
