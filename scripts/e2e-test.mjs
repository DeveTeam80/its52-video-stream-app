/**
 * End-to-end smoke test against a running server (default http://localhost:3010).
 * Reads a real super-admin credential from Postgres, then exercises the full flow.
 *   node scripts/e2e-test.mjs
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

let pass = 0;
let fail = 0;
function check(name, cond, detail = "") {
  if (cond) {
    console.log(`  ✅ ${name}`);
    pass++;
  } else {
    console.log(`  ❌ ${name} ${detail}`);
    fail++;
  }
}

async function main() {
  const sa = await prisma.superAdmin.findFirst({ orderBy: { createdAt: "asc" } });
  if (!sa) throw new Error("No super admin in DB to test with.");
  console.log(`Testing against ${BASE} as super admin ITS ${sa.identityNumber}\n`);

  // 1. Wrong password → 401
  let r = await fetch(`${BASE}/api/auth/adminLogin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identityNumber: sa.identityNumber, password: "definitely-wrong" }),
  });
  check("adminLogin wrong password → 401", r.status === 401, `(got ${r.status})`);

  // 2. Correct password → 200 + token + superAdmin
  r = await fetch(`${BASE}/api/auth/adminLogin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identityNumber: sa.identityNumber, password: sa.password }),
  });
  let body = await r.json();
  check("adminLogin correct password → 200", r.status === 200, `(got ${r.status})`);
  check("response has token", !!body.token);
  check("response superAdmin: true", body.superAdmin === true);
  const token = body.token;
  const auth = { Authorization: `Bearer ${token}` };

  // 3. authCheck → superAdmin + admin true
  r = await fetch(`${BASE}/api/auth/authCheck`, { headers: auth });
  body = await r.json();
  check("authCheck authState true", body.authState === true);
  check("authCheck superAdmin true", body.superAdmin === true);
  check("authCheck admin true", body.admin === true);

  // 4. allUser (super admin can access) → array
  r = await fetch(`${BASE}/api/auth/allUser`, { headers: auth });
  body = await r.json();
  check("allUser returns array", Array.isArray(body.allUsers), `(got ${typeof body.allUsers})`);
  console.log(`     users in DB: ${body.allUsers?.length}`);

  // 5. listAdmins / listSuperAdmins
  r = await fetch(`${BASE}/api/auth/superAdmin/listAdmins`, { headers: auth });
  body = await r.json();
  check("listAdmins returns array", Array.isArray(body.admins));
  console.log(`     admins in DB: ${body.admins?.length}`);

  r = await fetch(`${BASE}/api/auth/superAdmin/listSuperAdmins`, { headers: auth });
  body = await r.json();
  check("listSuperAdmins returns array", Array.isArray(body.superAdmins));
  check("listSuperAdmins hides password field", body.superAdmins?.every((s) => s.password === undefined));

  // 6. Video link set → get → remove → fallback null
  r = await fetch(`${BASE}/api/auth/updateVideoLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({ link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
  });
  check("updateVideoLink → 200", r.status === 200, `(got ${r.status})`);

  r = await fetch(`${BASE}/api/auth/videoId`, { headers: auth });
  body = await r.json();
  check("videoId returns the set id", body.videoId === "dQw4w9WgXcQ", `(got ${body.videoId})`);

  r = await fetch(`${BASE}/api/auth/removeVideoLink`, { method: "DELETE", headers: auth });
  check("removeVideoLink → 200", r.status === 200, `(got ${r.status})`);

  r = await fetch(`${BASE}/api/auth/videoId`, { headers: auth });
  body = await r.json();
  check("videoId null after removal (fallback)", body.videoId === null, `(got ${body.videoId})`);

  // 7. Unauthorized access is rejected
  r = await fetch(`${BASE}/api/auth/allUser`);
  check("allUser without token → 401", r.status === 401, `(got ${r.status})`);

  r = await fetch(`${BASE}/api/auth/superAdmin/listAdmins`, {
    headers: { Authorization: "Bearer invalid.token.here" },
  });
  check("listAdmins with bad token → 403", r.status === 403, `(got ${r.status})`);

  // 8. Stale-token check: logout, then the same token must be rejected
  r = await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: auth });
  check("logout → 200", r.status === 200, `(got ${r.status})`);

  r = await fetch(`${BASE}/api/auth/authCheck`, { headers: auth });
  body = await r.json();
  check("authCheck after logout → authState false (stale token rejected)", body.authState === false);

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("E2E run error:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
