/**
 * Isolated smoke test of the 3 mass-destructive endpoints, run against a
 * dedicated `qa_staging` schema with synthetic data — NEVER production.
 *
 * Driven by scripts/run-staging-smoke.sh, which sets:
 *   DATABASE_URL = Neon direct URL with &schema=qa_staging (for Prisma seed/verify)
 *   BASE_URL     = the staging app instance (e.g. http://localhost:3011)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = process.env.BASE_URL || "http://localhost:3011";

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; failures.push(`${name} ${detail}`); console.log(`  ❌ ${name} ${detail}`); }
}
async function api(method, path, { token, body } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json };
}

async function seed() {
  await prisma.loginAttempt.deleteMany({});
  await prisma.rateLimitEntry.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.admin.deleteMany({});
  await prisma.superAdmin.deleteMany({});
  await prisma.refreshSignal.deleteMany({});

  await prisma.superAdmin.create({ data: { identityNumber: "STG_SA1", password: "sapw" } });
  await prisma.admin.createMany({ data: [
    { identityNumber: "STG_A1", password: "apw1", activeStatus: true, token: "tA1" },
    { identityNumber: "STG_A2", password: "apw2", activeStatus: true, token: "tA2" },
  ]});
  await prisma.user.createMany({ data: [
    { identityNumber: "STG_U1", activeStatus: true, token: "tU1", loggedInToday: true },
    { identityNumber: "STG_U2", activeStatus: true, token: "tU2", loggedInToday: true },
    { identityNumber: "STG_U3", activeStatus: true, token: "tU3", loggedInToday: true },
    { identityNumber: "STG_U4", activeStatus: true, token: "tU4", loggedInToday: true },
    { identityNumber: "STG_U5", activeStatus: true, token: "tU5", loggedInToday: true },
    { identityNumber: "STG_A1", activeStatus: true, token: "tUA1", loggedInToday: true }, // overlaps an admin ITS
  ]});
}

async function main() {
  console.log(`Staging destructive smoke vs ${BASE} (schema qa_staging)\n`);
  await seed();

  // Super-admin login (creates a user row for STG_SA1 → must be preserved by all ops)
  const login = await api("POST", "/api/auth/adminLogin", { body: { identityNumber: "STG_SA1", password: "sapw" } });
  check("SA login → 200", login.status === 200, `(got ${login.status})`);
  const token = login.json?.token;

  const before = await prisma.refreshSignal.findUnique({ where: { id: 1 } });

  // ---- logoutAllUsers ----
  console.log("\n— logoutAllUsers");
  let r = await api("GET", "/api/auth/logoutAllUsers", { token });
  check("logoutAllUsers → 200", r.status === 200, `(got ${r.status})`);
  const activeUsers = await prisma.user.findMany({ where: { activeStatus: true } });
  check("only caller (STG_SA1) remains active", activeUsers.length === 1 && activeUsers[0].identityNumber === "STG_SA1",
    `(active: ${activeUsers.map((u) => u.identityNumber).join(",")})`);
  const activeAdmins = await prisma.admin.count({ where: { activeStatus: true } });
  check("all admins logged out (tokens cleared)", activeAdmins === 0, `(active admins: ${activeAdmins})`);
  const afterLogout = await prisma.refreshSignal.findUnique({ where: { id: 1 } });
  check("user refresh signal updated", !!afterLogout?.triggeredAt && afterLogout.triggeredAt !== before?.triggeredAt);
  r = await api("GET", "/api/auth/authCheck", { token });
  check("caller token still valid after logoutAllUsers", r.json?.authState === true);

  // ---- deleteAllUsers ----
  console.log("\n— deleteAllUsers");
  const usersBefore = await prisma.user.count();
  r = await api("DELETE", "/api/auth/deleteAllUsers", { token });
  check("deleteAllUsers → 200", r.status === 200, `(got ${r.status})`);
  check("deletedCount = 5 (U1..U5)", r.json?.deletedCount === 5, `(got ${r.json?.deletedCount}; before=${usersBefore})`);
  const remaining = await prisma.user.findMany({ select: { identityNumber: true } });
  const remSet = remaining.map((u) => u.identityNumber).sort();
  check("only admin/SA-overlapping user rows remain (STG_A1, STG_SA1)",
    remSet.length === 2 && remSet.includes("STG_A1") && remSet.includes("STG_SA1"), `(remaining: ${remSet.join(",")})`);

  // ---- deleteAllAdmins ----
  console.log("\n— deleteAllAdmins");
  r = await api("DELETE", "/api/auth/superAdmin/deleteAllAdmins", { token });
  check("deleteAllAdmins → 200", r.status === 200, `(got ${r.status})`);
  check("deletedCount = 2 (A1, A2)", r.json?.deletedCount === 2, `(got ${r.json?.deletedCount})`);
  const adminsLeft = await prisma.admin.count();
  check("0 admins remain", adminsLeft === 0, `(left: ${adminsLeft})`);
  const superLeft = await prisma.superAdmin.count();
  check("super admin preserved", superLeft === 1, `(left: ${superLeft})`);
  const afterAdminDel = await prisma.refreshSignal.findUnique({ where: { id: 1 } });
  check("admin refresh signal updated", !!afterAdminDel?.adminTriggeredAt);

  console.log(`\n================ STAGING RESULT: ${pass} passed, ${fail} failed ================`);
  if (failures.length) console.log("Failures:\n - " + failures.join("\n - "));
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("Staging smoke error:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
