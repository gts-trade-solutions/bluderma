/**
 * A portable dump of the local database.
 *
 * Written for one job: hand the whole local dataset — catalogue, clinics,
 * demo practice, demo client — to a production server in a single file.
 *
 * ── READ THIS BEFORE YOU IMPORT IT ───────────────────────────────────────
 * The dump carries `DROP TABLE IF EXISTS` before every `CREATE`, which is
 * what makes it reproducible and also what makes it destructive: importing it
 * REPLACES every table it contains. Anything a real user did on production —
 * accounts, bookings, payments — is gone, not merged. That is the correct
 * behaviour for seeding a fresh environment and the wrong behaviour for a
 * live one, so the script prints the warning rather than burying it.
 *
 * It also contains password hashes and every client record in the local
 * database. Treat the file as a credential: it is gitignored, and it should
 * not travel over anything you would not send a password over.
 *
 * Credentials come from DATABASE_URL, so this never has its own copy of them.
 *
 *   npx tsx prisma/dump-db.ts              → backups/bluderma-<stamp>.sql
 *   npx tsx prisma/dump-db.ts --schema-only
 *   npx tsx prisma/dump-db.ts --out path/to/file.sql
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Reads DATABASE_URL out of .env.
 *
 * Every other script here gets it for free because `new PrismaClient()` loads
 * .env as a side effect. This one has no reason to construct a Prisma client
 * — it shells out to mysqldump — and pulling the whole engine in just to
 * populate one environment variable would be an odd dependency to explain.
 * dotenv is not in package.json, so the six lines are cheaper than the
 * install.
 */
function envValue(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (!m || m[1] !== key) continue;
      // Strip one layer of matching quotes, and anything after an unquoted #.
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      } else {
        v = v.split("#")[0].trim();
      }
      if (v) return v;
    }
  }
  return undefined;
}

/** Where mysqldump usually lives when it is not on PATH. */
const KNOWN_PATHS = [
  "C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe",
  "C:/Program Files/MySQL/MySQL Server 8.4/bin/mysqldump.exe",
  "C:/xampp/mysql/bin/mysqldump.exe",
  "/usr/bin/mysqldump",
  "/usr/local/bin/mysqldump",
  "/opt/homebrew/bin/mysqldump",
];

interface Conn {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

/**
 * DATABASE_URL → connection parts.
 *
 * The password is percent-encoded in the URL (ours contains an `@`, which is
 * the delimiter), so it has to be decoded before it reaches mysqldump — a
 * literal `%40` as a password fails with an authentication error that says
 * nothing about encoding.
 */
function parseUrl(raw: string): Conn {
  const u = new URL(raw);
  if (!/^mysql:?$/.test(u.protocol.replace(":", "") + ":")) {
    // Only MySQL is supported: this shells out to mysqldump.
    if (!u.protocol.startsWith("mysql")) {
      throw new Error(`DATABASE_URL is not MySQL (${u.protocol}).`);
    }
  }
  return {
    host: u.hostname || "localhost",
    port: u.port || "3306",
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
  };
}

function findMysqldump(): string {
  // On PATH is the happy case.
  const probe = spawnSync(process.platform === "win32" ? "where" : "which", [
    "mysqldump",
  ]);
  if (probe.status === 0) {
    const first = probe.stdout.toString().split(/\r?\n/).find(Boolean);
    if (first && existsSync(first.trim())) return first.trim();
  }
  for (const p of KNOWN_PATHS) if (existsSync(p)) return p;
  throw new Error(
    "mysqldump not found. Add MySQL's bin directory to PATH, or edit KNOWN_PATHS in this file."
  );
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(
    d.getHours()
  )}${p(d.getMinutes())}`;
}

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function main(): void {
  const url = envValue("DATABASE_URL");
  if (!url) {
    console.error("DATABASE_URL not found in the environment, .env.local or .env.");
    process.exit(1);
  }

  const conn = parseUrl(url);
  const bin = findMysqldump();

  const argv = process.argv.slice(2);
  const schemaOnly = argv.includes("--schema-only");
  const outFlag = argv.indexOf("--out");
  const out =
    outFlag > -1 && argv[outFlag + 1]
      ? resolve(argv[outFlag + 1])
      : resolve(
          join("backups", `${conn.database}-${stamp()}${schemaOnly ? "-schema" : ""}.sql`)
        );

  mkdirSync(dirname(out), { recursive: true });

  const args = [
    `--host=${conn.host}`,
    `--port=${conn.port}`,
    `--user=${conn.user}`,
    // --single-transaction takes a consistent snapshot without locking the
    // tables, so a dev server reading the database mid-dump is fine.
    "--single-transaction",
    "--quick",
    "--default-character-set=utf8mb4",
    // Off by default in mysqldump 8 anyway, but stated so a future version
    // change cannot quietly start writing DEFINER clauses a production user
    // is not allowed to create.
    "--routines=FALSE",
    "--events=FALSE",
    "--triggers=FALSE",
    // Tablespace info needs PROCESS privilege, which an app user rarely has.
    "--no-tablespaces",
    "--add-drop-table",
    "--result-file=" + out,
  ];
  if (schemaOnly) args.push("--no-data");
  args.push(conn.database);

  console.log(`Dumping ${conn.database} from ${conn.host}:${conn.port} …`);

  try {
    // The password goes through the environment, never argv — an argument is
    // visible to every other process on the machine via the process list.
    execFileSync(bin, args, {
      stdio: ["ignore", "inherit", "inherit"],
      env: { ...process.env, MYSQL_PWD: conn.password },
    });
  } catch (e) {
    console.error(`\nmysqldump failed: ${(e as Error).message}`);
    process.exit(1);
  }

  const size = statSync(out).size;
  console.log(`\nWrote ${out}`);
  console.log(`      ${human(size)}${schemaOnly ? " (schema only)" : ""}\n`);

  console.log("To load it on the server:\n");
  console.log(`  mysql -h HOST -u USER -p ${conn.database} < ${out.split(/[\\/]/).pop()}\n`);
  console.log(
    "  THIS REPLACES the database. Every table in the file is dropped and\n" +
      "  recreated, so anything a real user did on that server is gone rather\n" +
      "  than merged. Take a dump of the target first if it holds anything.\n"
  );
  console.log(
    "  The file contains password hashes and every client record in this\n" +
      "  database. It is gitignored. Treat it as a credential.\n"
  );
}

main();
