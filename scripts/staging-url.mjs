/** Prints a Neon URL from .env with &schema=qa_staging appended.
 *  Usage: node scripts/staging-url.mjs <pooled|direct> */
import { readFileSync } from "node:fs";

const which = process.argv[2];
const env = {};
for (const l of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0 && !l.trim().startsWith("#")) {
    env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
const base = which === "pooled" ? env.DATABASE_URL : env.DIRECT_URL;
if (!base) { process.stderr.write(`Missing ${which} URL in .env\n`); process.exit(1); }
process.stdout.write(base + "&schema=qa_staging");
