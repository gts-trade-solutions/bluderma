/**
 * Applies pending migrations, regenerates the client, and says plainly whether
 * the dev server now has to be restarted.
 *
 * `next dev` loads @prisma/client into memory once and caches it for the life
 * of the process, and it also holds the query-engine DLL open — so on Windows
 * `prisma generate` fails to replace the engine with EPERM while the server is
 * running. The combination is a trap: the migration succeeds, the schema is
 * correct, the code is correct, and every page that reads a new column throws
 *
 *     Invalid `prisma.appointment.findMany()` invocation
 *
 * from a server that is simply working off a client written before the column
 * existed. Nothing in the codebase can repair a module already cached in
 * another process; only a restart does.
 *
 *   npx tsx prisma/apply-migrations.ts
 */
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";

const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

function run(args: string[]): string {
  try {
    return execFileSync(NPX, args, { encoding: "utf8", stdio: "pipe" });
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    return `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
}

const before = clientWrittenAt();

console.log("Applying migrations…");
const deploy = run(["prisma", "migrate", "deploy"]);
console.log(
  deploy.includes("successfully applied")
    ? "  applied"
    : deploy.includes("No pending migrations")
      ? "  nothing pending"
      : `  ${deploy.trim().split("\n").slice(-3).join(" ")}`
);

console.log("Regenerating the client…");
const gen = run(["prisma", "generate"]);

// EPERM on the engine rename is expected while a dev server holds it open, and
// is harmless: the engine binary is versioned with the Prisma package, not with
// the schema, so the existing one is already the right build. What matters is
// whether the generated JavaScript was rewritten.
const enginedLocked = gen.includes("EPERM");
const after = clientWrittenAt();
const regenerated = after !== null && after !== before;

console.log(
  regenerated
    ? "  client regenerated"
    : "  client NOT rewritten — check the output above"
);
if (enginedLocked) {
  console.log(
    "  (the query engine could not be replaced because a dev server holds it —\n" +
      "   harmless, it is versioned with the package rather than the schema)"
  );
}

if (regenerated) {
  console.log(
    [
      "",
      "─".repeat(66),
      "  RESTART THE DEV SERVER.",
      "",
      "  A running `next dev` cached the old client at boot and will keep",
      "  throwing `Invalid prisma.<model>.<method>() invocation` on every",
      "  page that reads a new column until it is restarted.",
      "─".repeat(66),
    ].join("\n")
  );
}

function clientWrittenAt(): number | null {
  try {
    return statSync("node_modules/.prisma/client/index.js").mtimeMs;
  } catch {
    return null;
  }
}
