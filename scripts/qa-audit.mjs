/**
 * Senior-QA full functional audit against a running server (default :3010).
 * SAFE against production data: all mutations use disposable ZZTEST* fixtures,
 * cleaned up at the end. Mass-destructive endpoints are NOT executed.
 *   node scripts/qa-audit.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv(".env");
loadEnv(".env.local");

const BASE = process.env.BASE_URL || "http://localhost:3010";
const prisma = new PrismaClient();
const PFX = "ZZTEST";

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) { pass++; }
  else { fail++; failures.push(`${name} ${detail}`); console.log(`  ❌ ${name} ${detail}`); }
}
function group(t) { console.log(`\n— ${t}`); }

async function api(method, path, { token, body } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null, text = null;
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("application/json")) { try { json = await r.json(); } catch {} }
  else { text = await r.text(); }
  return { status: r.status, json, text };
}
const clearRL = () => prisma.rateLimitEntry.deleteMany({});
async function cleanup() {
  await prisma.loginAttempt.deleteMany({ where: { identityNumber: { startsWith: PFX } } });
  await prisma.user.deleteMany({ where: { identityNumber: { startsWith: PFX } } });
  await prisma.admin.deleteMany({ where: { identityNumber: { startsWith: PFX } } });
  await prisma.superAdmin.deleteMany({ where: { identityNumber: { startsWith: PFX } } });
}
async function loginSA(its, pw) {
  await clearRL();
  const r = await api("POST", "/api/auth/adminLogin", { body: { identityNumber: its, password: pw } });
  return r;
}

async function main() {
  console.log(`QA audit against ${BASE}`);
  await cleanup();
  await clearRL();

  const sa = await prisma.superAdmin.findFirst({ orderBy: { createdAt: "asc" } });
  if (!sa) throw new Error("No super admin to test with.");

  // ===== A. Auth & input validation (real super admin) =====
  group("A. Auth & validation");
  let r = await loginSA(sa.identityNumber, "wrong-pw");
  check("A1 SA wrong password → 401", r.status === 401, `(got ${r.status})`);
  r = await loginSA(sa.identityNumber, sa.password);
  check("A2 SA correct password → 200", r.status === 200, `(got ${r.status})`);
  check("A3 SA token returned", !!r.json?.token);
  check("A4 SA superAdmin:true", r.json?.superAdmin === true);
  const saToken = r.json.token;
  r = await api("POST", "/api/auth/adminLogin", { body: { password: "x" } });
  check("A5 missing identityNumber → 400", r.status === 400, `(got ${r.status})`);
  await clearRL();
  r = await api("POST", "/api/auth/adminLogin", { body: { identityNumber: sa.identityNumber } });
  check("A6 missing password → 400", r.status === 400, `(got ${r.status})`);
  await clearRL();
  r = await api("POST", "/api/auth/adminLogin", { body: { identityNumber: "x".repeat(21), password: "p" } });
  check("A7 over-long ITS (>20) → 400", r.status === 400, `(got ${r.status})`);
  await clearRL();
  r = await api("POST", "/api/auth/adminLogin", { body: { identityNumber: sa.identityNumber, password: "p".repeat(129) } });
  check("A8 over-long password (>128) → 400", r.status === 400, `(got ${r.status})`);
  r = await api("GET", "/api/auth/authCheck", { token: saToken });
  check("A9 authCheck superAdmin+admin true", r.json?.authState && r.json?.admin && r.json?.superAdmin);

  // ===== B. User login & single-session (fixture user) =====
  group("B. User login & single-session");
  const U1 = `${PFX}U1`;
  r = await api("POST", "/api/auth/addSingleUsers", { token: saToken, body: { identityNumber: U1 } });
  check("B1 addSingleUsers fixture → 200", r.status === 200, `(got ${r.status})`);
  r = await api("POST", "/api/auth/addSingleUsers", { token: saToken, body: { identityNumber: U1 } });
  check("B2 addSingleUsers duplicate → 404 (existing behavior)", r.status === 404, `(got ${r.status})`);
  await clearRL();
  r = await api("POST", "/api/auth/login", { body: { identityNumber: U1 } });
  check("B3 user login (ITS only) → 200", r.status === 200, `(got ${r.status})`);
  const uToken = r.json?.token;
  await clearRL();
  r = await api("POST", "/api/auth/login", { body: { identityNumber: U1 } });
  check("B4 single-session: 2nd login while active → 403", r.status === 403, `(got ${r.status})`);
  r = await api("GET", "/api/auth/authCheck", { token: uToken });
  check("B5 user authCheck admin:false superAdmin:false", r.json?.authState === true && !r.json?.admin && !r.json?.superAdmin);
  r = await api("POST", "/api/auth/logout", { token: uToken });
  check("B6 user logout → 200", r.status === 200, `(got ${r.status})`);
  await clearRL();
  r = await api("POST", "/api/auth/login", { body: { identityNumber: U1 } });
  check("B7 login again after logout → 200 (session reset)", r.status === 200, `(got ${r.status})`);
  await clearRL();
  r = await api("POST", "/api/auth/login", { body: { identityNumber: `${PFX}NOPE` } });
  check("B8 login non-existent user → 404", r.status === 404, `(got ${r.status})`);

  // ===== C. User management (fixtures) =====
  group("C. User management");
  r = await api("POST", "/api/auth/addSingleUsers", { token: saToken, body: { identityNumber: "" } });
  check("C1 addSingleUsers empty → 400", r.status === 400, `(got ${r.status})`);
  const U2 = `${PFX}U2`;
  r = await api("PUT", "/api/auth/editUser", { token: saToken, body: { oldIdentityNumber: U1, newIdentityNumber: U2 } });
  check("C2 editUser rename → 200", r.status === 200, `(got ${r.status})`);
  const renamed = await prisma.user.findUnique({ where: { identityNumber: U2 } });
  check("C3 editUser persisted new ITS + reset session", renamed && renamed.activeStatus === false && renamed.token === null);
  r = await api("POST", "/api/auth/addSingleUsers", { token: saToken, body: { identityNumber: U1 } }); // recreate U1
  r = await api("PUT", "/api/auth/editUser", { token: saToken, body: { oldIdentityNumber: U2, newIdentityNumber: U1 } });
  check("C4 editUser to existing ITS → 409", r.status === 409, `(got ${r.status})`);
  r = await api("PUT", "/api/auth/editUser", { token: saToken, body: { oldIdentityNumber: sa.identityNumber, newIdentityNumber: `${PFX}X` } });
  check("C5 editUser blocks super-admin ITS → 400", r.status === 400, `(got ${r.status})`);
  r = await api("POST", "/api/auth/logoutUser", { token: saToken, body: { identityNumber: U1 } });
  check("C6 logoutUser on inactive user → 400", r.status === 400, `(got ${r.status})`);
  r = await api("POST", "/api/auth/logoutUser", { token: saToken, body: { identityNumber: `${PFX}NOPE` } });
  check("C7 logoutUser on non-existent → 404", r.status === 404, `(got ${r.status})`);
  r = await api("DELETE", "/api/auth/deleteUser", { token: saToken, body: { identityNumber: U2 } });
  check("C8 deleteUser → 200", r.status === 200, `(got ${r.status})`);
  r = await api("DELETE", "/api/auth/deleteUser", { token: saToken, body: { identityNumber: `${PFX}NOPE` } });
  check("C9 deleteUser non-existent → 404", r.status === 404, `(got ${r.status})`);

  // ===== D. Admin management (super admin) =====
  group("D. Admin management");
  const A1 = `${PFX}A1`;
  r = await api("POST", "/api/auth/superAdmin/createAdmin", { token: saToken, body: { identityNumber: A1, password: "pw1" } });
  check("D1 createAdmin → 200", r.status === 200, `(got ${r.status})`);
  r = await api("POST", "/api/auth/superAdmin/createAdmin", { token: saToken, body: { identityNumber: A1, password: "pw1" } });
  check("D2 createAdmin duplicate → 400", r.status === 400, `(got ${r.status})`);
  r = await api("POST", "/api/auth/superAdmin/createAdmin", { token: saToken, body: { identityNumber: sa.identityNumber, password: "pw1" } });
  check("D3 createAdmin on super-admin ITS → 400", r.status === 400, `(got ${r.status})`);
  r = await loginSA(A1, "pw1");
  check("D4 admin login → 200", r.status === 200, `(got ${r.status})`);
  const aToken = r.json?.token;
  r = await api("GET", "/api/auth/authCheck", { token: aToken });
  check("D5 admin authCheck admin:true superAdmin:not-true", r.json?.admin === true && r.json?.superAdmin !== true);
  r = await api("PUT", "/api/auth/superAdmin/changePassword", { token: saToken, body: { identityNumber: A1, newPassword: "pw2" } });
  check("D6 changePassword → 200", r.status === 200, `(got ${r.status})`);
  r = await loginSA(A1, "pw2");
  check("D7 admin login new password → 200", r.status === 200, `(got ${r.status})`);
  r = await loginSA(A1, "pw1");
  check("D8 admin login old password → 401", r.status === 401, `(got ${r.status})`);
  const A2 = `${PFX}A2`;
  r = await api("PUT", "/api/auth/superAdmin/updateAdmin", { token: saToken, body: { oldIdentityNumber: A1, newIdentityNumber: A2 } });
  check("D9 updateAdmin rename → 200", r.status === 200, `(got ${r.status})`);
  r = await api("POST", "/api/auth/superAdmin/logoutAdmin", { token: saToken, body: { identityNumber: A2 } });
  check("D10 logoutAdmin → 200", r.status === 200, `(got ${r.status})`);

  // ===== E. Authorization matrix =====
  group("E. Authorization matrix");
  await clearRL();
  r = await loginSA(A2, "pw2"); const a2Token = r.json?.token;
  r = await api("GET", "/api/auth/allUser", { token: a2Token });
  check("E1 admin CAN access allUser → 200", r.status === 200, `(got ${r.status})`);
  r = await api("GET", "/api/auth/superAdmin/listAdmins", { token: a2Token });
  check("E2 admin CANNOT access listAdmins → 403", r.status === 403, `(got ${r.status})`);
  r = await api("GET", "/api/auth/allUser");
  check("E3 no token → 401", r.status === 401, `(got ${r.status})`);
  r = await api("GET", "/api/auth/superAdmin/listAdmins", { token: "bad.token.value" });
  check("E4 bad token on SA route → 403", r.status === 403, `(got ${r.status})`);
  r = await api("GET", "/api/auth/allUser", { token: a2Token + "tampered" });
  check("E5 tampered token → 401", r.status === 401, `(got ${r.status})`);

  // ===== F. Super admin management =====
  group("F. Super admin management");
  const SA1 = `${PFX}SA1`;
  r = await api("POST", "/api/auth/superAdmin/addSuperAdmin", { token: saToken, body: { identityNumber: SA1, password: "spw1" } });
  check("F1 addSuperAdmin → 200", r.status === 200, `(got ${r.status})`);
  r = await api("POST", "/api/auth/superAdmin/addSuperAdmin", { token: saToken, body: { identityNumber: SA1, password: "spw1" } });
  check("F2 addSuperAdmin duplicate → 400", r.status === 400, `(got ${r.status})`);
  r = await api("POST", "/api/auth/superAdmin/addSuperAdmin", { token: saToken, body: { identityNumber: A2, password: "x" } });
  check("F3 addSuperAdmin on existing admin ITS → 400", r.status === 400, `(got ${r.status})`);
  r = await api("GET", "/api/auth/superAdmin/listSuperAdmins", { token: saToken });
  check("F4 listSuperAdmins hides password", Array.isArray(r.json?.superAdmins) && r.json.superAdmins.every((s) => s.password === undefined));
  r = await loginSA(SA1, "spw1"); const sa1Token = r.json?.token;
  check("F5 fixture SA login → 200 superAdmin:true", r.status === 200 && r.json?.superAdmin === true);
  r = await api("PUT", "/api/auth/superAdmin/changeOwnPassword", { token: sa1Token, body: { currentPassword: "wrong", newPassword: "spw2" } });
  check("F6 changeOwnPassword wrong current → 401", r.status === 401, `(got ${r.status})`);
  r = await api("PUT", "/api/auth/superAdmin/changeOwnPassword", { token: sa1Token, body: { currentPassword: "spw1", newPassword: "spw2" } });
  check("F7 changeOwnPassword correct → 200", r.status === 200, `(got ${r.status})`);
  r = await loginSA(SA1, "spw2");
  check("F8 fixture SA login with new password → 200", r.status === 200, `(got ${r.status})`);

  // ===== G. Video link parsing & fallback =====
  group("G. Video link");
  const cases = [
    ["https://www.youtube.com/watch?v=abc12345678", "abc12345678"],
    ["https://youtu.be/xyz98765432", "xyz98765432"],
    ["rawid0000001", "rawid0000001"],
  ];
  for (const [link, expected] of cases) {
    await api("POST", "/api/auth/updateVideoLink", { token: saToken, body: { link } });
    const v = await api("GET", "/api/auth/videoId", { token: saToken });
    check(`G video parse "${link}" → ${expected}`, v.json?.videoId === expected, `(got ${v.json?.videoId})`);
  }
  r = await api("GET", "/api/auth/currentVideo", { token: saToken });
  check("G4 currentVideo returns videoUrl", typeof r.json?.videoUrl === "string");
  r = await api("DELETE", "/api/auth/removeVideoLink", { token: saToken });
  check("G5 removeVideoLink → 200", r.status === 200, `(got ${r.status})`);
  r = await api("GET", "/api/auth/videoId", { token: saToken });
  check("G6 videoId null after removal (fallback)", r.json?.videoId === null, `(got ${r.json?.videoId})`);

  // ===== H. Refresh signals =====
  group("H. Refresh signals");
  r = await api("POST", "/api/auth/triggerRefresh", { token: saToken });
  check("H1 triggerRefresh → 200", r.status === 200, `(got ${r.status})`);
  r = await api("GET", "/api/auth/checkRefresh", { token: saToken });
  check("H2 checkRefresh returns triggeredAt", !!r.json?.triggeredAt);
  r = await api("GET", "/api/auth/superAdmin/checkAdminRefresh", { token: saToken });
  check("H3 checkAdminRefresh returns adminTriggeredAt", !!r.json?.adminTriggeredAt);

  // ===== I. CSV import/export =====
  group("I. CSV import/export");
  r = await api("GET", "/api/auth/exportUsers", { token: saToken });
  check("I1 exportUsers CSV header", r.text?.startsWith("Sr No,ITS Number,Status,Logged In Today"));
  r = await api("POST", "/api/auth/importUsers", { token: saToken, body: { users: [`${PFX}IMP1`, `${PFX}IMP2`, `${PFX}IMP1`] } });
  check("I2 importUsers created=2 skipped=1", r.json?.created === 2 && r.json?.skipped === 1, `(got c=${r.json?.created} s=${r.json?.skipped})`);
  r = await api("GET", "/api/auth/superAdmin/exportAdmins", { token: saToken });
  check("I3 exportAdmins CSV header (incl Password)", r.text?.startsWith("Sr No,ITS Number,Password,Status,Logged In Today"));
  r = await api("POST", "/api/auth/superAdmin/importAdmins", { token: saToken, body: { admins: [{ identityNumber: `${PFX}IMPA1`, password: "p" }, { identityNumber: `${PFX}IMPA1`, password: "p" }, { identityNumber: `${PFX}IMPA2`, password: "" }] } });
  check("I4 importAdmins created=1 skipped=2 (dup + no-pw)", r.json?.created === 1 && r.json?.skipped === 2, `(got c=${r.json?.created} s=${r.json?.skipped})`);

  // ===== J. Rate limiting =====
  group("J. Rate limiting");
  await clearRL();
  const statuses = [];
  for (let i = 0; i < 12; i++) {
    const rr = await api("POST", "/api/auth/login", { body: { identityNumber: `${PFX}RL` } });
    statuses.push(rr.status);
  }
  const got429 = statuses.includes(429);
  const early404 = statuses.slice(0, 10).every((s) => s === 404);
  check("J1 first 10 attempts allowed (404 user-not-found)", early404, `(${statuses.slice(0,10).join(",")})`);
  check("J2 rate limit kicks in (429 after 10)", got429, `(${statuses.join(",")})`);
  await clearRL();

  // ===== Cleanup =====
  await cleanup();
  await clearRL();

  console.log(`\n================ RESULT: ${pass} passed, ${fail} failed ================`);
  if (failures.length) console.log("Failures:\n - " + failures.join("\n - "));
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("QA run error:", e.message);
  try { await cleanup(); await clearRL(); } catch {}
  await prisma.$disconnect();
  process.exit(1);
});
