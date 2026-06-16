import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient across hot-reloads (dev) and serverless
// invocation reuse (prod) to avoid exhausting the database connection pool.
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
