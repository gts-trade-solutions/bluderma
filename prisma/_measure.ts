/**
 * Measures a page at a phone width and names whatever is too wide.
 *
 * Written because three rounds of reading the markup could not settle where
 * /patient/profile was overflowing, and a screenshot cannot tell you WHICH
 * element is doing it. Chrome is already on this machine and Node 21 has a
 * global WebSocket, so DevTools can be driven directly with no new dependency.
 *
 *   npx tsx prisma/_measure.ts <path> [width]
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { encode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";

const PATH_ = process.argv[2] ?? "/patient/profile";
const WIDTH = Number(process.argv[3] ?? 390);
const ORIGIN = "http://localhost:3112";
const PORT = 9223;

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
].find((p) => existsSync(p));

function env(key: string): string {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#\r]*)"?/i);
      if (m && m[1] === key) return m[2].trim();
    }
  }
  return "";
}

/** One CDP round trip. */
function rpc(ws: WebSocket, id: number, method: string, params: unknown = {}) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      const msg = JSON.parse(String(e.data));
      if (msg.id !== id) return;
      ws.removeEventListener("message", onMsg);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => reject(new Error(`${method} timed out`)), 30_000);
  });
}

const MEASURE = `(() => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    // Only what actually sticks out, and only by enough to matter.
    if (r.right > vw + 1 || r.left < -1) {
      const over = Math.round(Math.max(r.right - vw, 0) + Math.max(-r.left, 0));
      if (over < 2) continue;
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute("class") || "").slice(0, 110),
        left: Math.round(r.left),
        right: Math.round(r.right),
        over,
      });
    }
  }
  // The outermost offenders explain the inner ones.
  out.sort((a, b) => b.over - a.over);
  return JSON.stringify({
    viewport: vw,
    scrollWidth: de.scrollWidth,
    overflow: de.scrollWidth - vw,
    offenders: out.slice(0, 14),
  });
})()`;

async function main() {
  if (!CHROME) throw new Error("Chrome not found");

  const prisma = new PrismaClient({ log: ["error"] });
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "demo.client@bluderma.local" },
    select: { id: true, email: true, name: true, role: true },
  });
  await prisma.$disconnect();

  const token = await encode({
    token: { id: user.id, role: user.role, email: user.email, name: user.name },
    secret: env("NEXTAUTH_SECRET"),
  });

  const profile = mkdtempSync(join(tmpdir(), "bd-cdp-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "about:blank",
    ],
    { stdio: "ignore", detached: false }
  );

  try {
    // Wait for the debugging endpoint.
    let target: { webSocketDebuggerUrl: string } | undefined;
    for (let i = 0; i < 40 && !target; i++) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, {
          method: "PUT",
        });
        target = await res.json();
      } catch {
        /* not up yet */
      }
    }
    if (!target?.webSocketDebuggerUrl) throw new Error("no CDP target");

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r, j) => {
      ws.addEventListener("open", () => r(null));
      ws.addEventListener("error", j);
    });

    let id = 0;
    await rpc(ws, ++id, "Network.enable");
    await rpc(ws, ++id, "Page.enable");
    await rpc(ws, ++id, "Network.setCookie", {
      name: "next-auth.session-token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });
    await rpc(ws, ++id, "Emulation.setDeviceMetricsOverride", {
      width: WIDTH,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    const url = ORIGIN + (PATH_.startsWith("/") ? PATH_ : "/" + PATH_);
    console.log("navigating to", JSON.stringify(url));
    await rpc(ws, ++id, "Page.navigate", { url });
    await new Promise((r) => setTimeout(r, 4500));

    const res = (await rpc(ws, ++id, "Runtime.evaluate", {
      expression: MEASURE,
      returnByValue: true,
    })) as { result?: { value?: string } };

    const data = JSON.parse(res.result?.value ?? "{}");
    console.log(`\n${PATH_} at ${WIDTH}px`);
    console.log(`  viewport     ${data.viewport}`);
    console.log(`  scrollWidth  ${data.scrollWidth}`);
    console.log(
      `  overflow     ${data.overflow}px  ${data.overflow > 0 ? "<<< PAGE SCROLLS SIDEWAYS" : "(none)"}\n`
    );
    for (const o of data.offenders ?? []) {
      console.log(`  +${String(o.over).padStart(4)}px  <${o.tag}>  [${o.left}..${o.right}]`);
      console.log(`           ${o.cls}`);
    }
    ws.close();
  } finally {
    chrome.kill();
    try {
      execFileSync("cmd", ["/c", "rmdir", "/s", "/q", profile], { stdio: "ignore" });
    } catch {
      /* best effort */
    }
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exitCode = 1;
});
