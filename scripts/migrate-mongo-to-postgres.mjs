/**
 * One-time ETL: copy data from MongoDB → PostgreSQL (Prisma).
 *
 * Run with both env files loaded (Node 20.6+ / 22 supports --env-file):
 *   node --env-file=.env --env-file=.env.local scripts/migrate-mongo-to-postgres.mjs
 *
 * Requires:
 *   - MONGO_URI   (from .env.local) — source database
 *   - DATABASE_URL (from .env)       — target Postgres (Prisma reads it)
 *
 * Safe to re-run: inserts use skipDuplicates / upsert. Cross-table ITS overlap
 * (an ITS in both `users` and `super_admins`) is expected and preserved.
 */
import { readFileSync, existsSync } from "node:fs";
import { MongoClient } from "mongodb";
import { PrismaClient } from "@prisma/client";

// Robust .env loader (Node's --env-file mishandles some special-char values).
function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(".env");
loadEnv(".env.local");

const prisma = new PrismaClient();

// Mongoose default collection names (lowercased + pluralized model names).
const COLLECTIONS = {
  users: "users",
  admins: "admins",
  superAdmins: "superadmins",
  loginAttempts: "loginattempts",
  youtube: "youtubes",
  refreshSignal: "refreshsignals",
};

function assertUnique(label, docs) {
  const seen = new Set();
  const dupes = [];
  for (const d of docs) {
    const its = String(d.identityNumber ?? "").trim();
    if (seen.has(its)) dupes.push(its);
    seen.add(its);
  }
  if (dupes.length) {
    throw new Error(
      `Duplicate identityNumber values found in ${label}: ${[...new Set(dupes)].join(", ")}. ` +
        `Resolve these in MongoDB before importing (the UNIQUE constraint will reject them).`
    );
  }
}

function ts(doc) {
  return {
    createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
  };
}

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI is not set (load .env.local).");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (load .env).");

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(); // database from the connection string
  console.log("Connected to MongoDB:", db.databaseName);

  // --- Read source collections ---
  const users = await db.collection(COLLECTIONS.users).find({}).toArray();
  const admins = await db.collection(COLLECTIONS.admins).find({}).toArray();
  const superAdmins = await db.collection(COLLECTIONS.superAdmins).find({}).toArray();
  const loginAttempts = await db.collection(COLLECTIONS.loginAttempts).find({}).toArray();
  const youtubeDocs = await db.collection(COLLECTIONS.youtube).find({}).toArray();
  const refreshDocs = await db.collection(COLLECTIONS.refreshSignal).find({}).toArray();

  console.log(
    `Source counts → users: ${users.length}, admins: ${admins.length}, ` +
      `superAdmins: ${superAdmins.length}, loginAttempts: ${loginAttempts.length}, ` +
      `youtube: ${youtubeDocs.length}, refreshSignal: ${refreshDocs.length}`
  );

  // --- Sanity check: per-table ITS uniqueness ---
  assertUnique("users", users);
  assertUnique("admins", admins);
  assertUnique("super_admins", superAdmins);
  console.log("Uniqueness check passed (no duplicate ITS within any collection).");

  // --- Users ---
  if (users.length) {
    await prisma.user.createMany({
      data: users.map((u) => ({
        identityNumber: String(u.identityNumber).trim(),
        activeStatus: !!u.activeStatus,
        loggedInToday: !!u.loggedInToday,
        token: u.token ?? null,
        ...ts(u),
      })),
      skipDuplicates: true,
    });
  }

  // --- Admins ---
  if (admins.length) {
    await prisma.admin.createMany({
      data: admins.map((a) => ({
        identityNumber: String(a.identityNumber).trim(),
        activeStatus: !!a.activeStatus,
        loggedInToday: !!a.loggedInToday,
        token: a.token ?? null,
        password: a.password ?? null,
        ...ts(a),
      })),
      skipDuplicates: true,
    });
  }

  // --- Super admins ---
  if (superAdmins.length) {
    await prisma.superAdmin.createMany({
      data: superAdmins.map((sa) => ({
        identityNumber: String(sa.identityNumber).trim(),
        password: String(sa.password ?? ""),
        createdBy: sa.createdBy ?? null,
        ...ts(sa),
      })),
      skipDuplicates: true,
    });
  }

  // --- Login attempts (audit trail) ---
  if (loginAttempts.length) {
    await prisma.loginAttempt.createMany({
      data: loginAttempts.map((la) => ({
        identityNumber: String(la.identityNumber).trim(),
        ipAddress: String(la.ipAddress ?? "unknown"),
        success: !!la.success,
        reason: la.reason ?? null,
        ...ts(la),
      })),
    });
  }

  // --- Singleton: Youtube (only if a video is set) ---
  if (youtubeDocs.length && youtubeDocs[0]?.videoId) {
    const y = youtubeDocs[0];
    await prisma.youtube.upsert({
      where: { id: 1 },
      update: { videoId: String(y.videoId) },
      create: { id: 1, videoId: String(y.videoId), ...ts(y) },
    });
  }

  // --- Singleton: RefreshSignal ---
  if (refreshDocs.length) {
    const r = refreshDocs[0];
    await prisma.refreshSignal.upsert({
      where: { id: 1 },
      update: {
        triggeredAt: r.triggeredAt ? new Date(r.triggeredAt) : null,
        adminTriggeredAt: r.adminTriggeredAt ? new Date(r.adminTriggeredAt) : null,
      },
      create: {
        id: 1,
        triggeredAt: r.triggeredAt ? new Date(r.triggeredAt) : null,
        adminTriggeredAt: r.adminTriggeredAt ? new Date(r.adminTriggeredAt) : null,
      },
    });
  }

  // --- Verify target counts ---
  const [pgUsers, pgAdmins, pgSuper, pgLogins] = await Promise.all([
    prisma.user.count(),
    prisma.admin.count(),
    prisma.superAdmin.count(),
    prisma.loginAttempt.count(),
  ]);

  console.log(
    `Target counts → users: ${pgUsers}, admins: ${pgAdmins}, ` +
      `superAdmins: ${pgSuper}, loginAttempts: ${pgLogins}`
  );

  const mismatches = [];
  if (pgUsers !== users.length) mismatches.push("users");
  if (pgAdmins !== admins.length) mismatches.push("admins");
  if (pgSuper !== superAdmins.length) mismatches.push("super_admins");
  if (mismatches.length) {
    console.warn(
      `⚠️  Count mismatch in: ${mismatches.join(", ")} ` +
        `(possible pre-existing rows from a prior run, or skipped duplicates).`
    );
  } else {
    console.log("✅ Row counts match source. Migration complete.");
  }

  await client.close();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("❌ Migration failed:", err.message);
  await prisma.$disconnect();
  process.exit(1);
});
