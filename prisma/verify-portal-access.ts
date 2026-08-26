/**
 * Access + wayfinding for the doctor portal.
 *
 * Covers the dead end a client hits when they click a practitioner link with
 * the wrong account signed in: they used to be bounced to a bare "no
 * permission — contact your administrator" with no way forward, which is how
 * "can't access the portal" ends up looking like a broken portal.
 */
import { readFileSync } from "node:fs";
import { buildDoctorMenu } from "../src/lib/queries/nav";
import { internalPath, postLoginPath } from "../src/lib/roles";

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean) {
  if (ok) pass++;
  else fails.push(name);
}
const read = (p: string) => readFileSync(p, "utf8");

// ── The nav entry that started this ────────────────────────────────────────
const guest = buildDoctorMenu();
const doc = buildDoctorMenu({ hasPortal: true });
const entry = (m: ReturnType<typeof buildDoctorMenu>) =>
  m.find((i) => /portal/i.test(i.label))!;

check("guest gets the marketing anchor", entry(guest).href === "/doctor#portal");
check("guest label does not imply ownership", entry(guest).label === "The portal");
check("doctor gets the real portal", entry(doc).href === "/doctor/portal");
check("doctor label implies ownership", entry(doc).label === "Your portal");
check("menus are otherwise identical", guest.length === doc.length);

// ── The attempted path survives the bounce ─────────────────────────────────
const mw = read("src/middleware.ts");
check("middleware forwards the path", /searchParams\.set\("from", pathname\)/.test(mw));
const sess = read("src/lib/session.ts");
check("requireRole forwards it too", /forbidden\?from=\$\{encodeURIComponent/.test(sess));

// ── The refusal page ───────────────────────────────────────────────────────
const fb = read("src/app/forbidden/page.tsx");
check("names the refused account", /You are signed in as/.test(fb));
check("names what the area needs", /needs \$\{area\.needs\}|area\.needs/.test(fb));
check("offers an account switch", /SwitchAccount/.test(fb));
// Comments stripped first — the doc block explains the line that was removed,
// and matching that would make this assertion pass for the wrong reason.
const fbCode = fb.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
check("drops the administrator line", !/contact your administrator/i.test(fbCode));
check("offers listing to a refused client", /List your practice/.test(fb));
check("reuses the shared sanitizer", /internalPath/.test(fb));

// The sanitizer is the security-relevant part, and it is now the SAME function
// the login flow uses — a callbackUrl open redirect and a ?from= open redirect
// are the same bug, so they get one implementation and one test.
for (const bad of [
  "//evil.com",
  "/\\evil.com",
  "/\\\\evil.com",
  "https://evil.com",
  "evil",
  "",
  null,
  undefined,
]) {
  check(`rejects ${JSON.stringify(bad)}`, internalPath(bad) === null);
}
check("postLoginPath drops //evil.com", !postLoginPath("//evil.com", "PATIENT").startsWith("//"));
check("postLoginPath still honours a real path",
  postLoginPath("/patient/appointments", "PATIENT") === "/patient/appointments");
check("accepts a real path", internalPath("/doctor/portal") === "/doctor/portal");

// ── The shell the user reported as unchanged ───────────────────────────────
const layout = read("src/app/doctor/portal/layout.tsx");
const rail = read("src/components/doctor/PortalRail.tsx");
check("portal renders the rail", /<PortalRail/.test(layout));
// The rail is fixed, so the content beside it needs a matching inset or it
// sits underneath. That inset used to be `lg:pl-64` on the wrapper and is now
// `.portal-shell`, which does the same 16rem and animates it when the rail
// collapses. Checking the CSS as well as the class means a shell that exists
// in name only still fails.
check("canvas clears the rail", /portal-shell/.test(layout));
const shellCss = read("src/app/globals.css");
check(
  "the shell actually insets by the rail's width",
  /\.portal-shell\s*\{[^}]*padding-left:\s*16rem/s.test(shellCss)
);
check(
  "and follows the rail when it collapses",
  /\[data-rail="collapsed"\]\s*\.portal-shell\s*\{[^}]*padding-left:\s*4\.5rem/s.test(shellCss)
);
check("rail is the dark surface", /bg-\[#0b1220\]/.test(rail));
check("no admin console chrome left", !/@\/components\/admin\/ui/.test(layout));
check("unapproved doctors still get in", /pending &&/.test(layout));

/* -- How a practitioner gets to their own portal -------------------------
   The route changed on purpose, so it is worth stating what it now is:

     - the brand mark goes to the CLIENT home, for everybody, because a doctor
       is also a person who wants to look at the site they are listed on;
     - the avatar carries the portal's real sections, which is where somebody
       looks for their own records;
     - the navbar and footer no longer carry a portal link, because both were
       aiming a returning practitioner at a page selling them the thing they
       had already signed up for.

   None of that is safe to leave unasserted: removing the last route to a
   surface is a one-line change that nothing else would notice. */
const navSrc = read("src/components/Navbar.tsx");
const menuSrc = read("src/lib/queries/nav.ts");
const footerSrc = read("src/components/Footer.tsx");
const accountSrc = read("src/components/AccountMenu.tsx");

check("the brand mark goes to the client home for every role", navSrc.includes('href="/"'));
check(
  "and never to the doctor marketing page",
  !navSrc.includes('role === "doctor" ? "/doctor"')
);
check(
  "the client bar carries no cross-audience doctor link",
  !menuSrc.includes("free, no commission")
);
check("the footer carries no portal link", !footerSrc.includes("FooterSignIn"));
check("but the pitch is still reachable from every page", footerSrc.includes('href="/doctor"'));
check(
  "the avatar is the way in, and lists real sections",
  ["/doctor/portal", "/doctor/portal/calendar", "/doctor/portal/practice"].every((h) =>
    accountSrc.includes(h)
  )
);
check(
  "and signing in as a doctor still lands on the portal",
  read("src/lib/roles.ts").includes('if (role === "DOCTOR") return "/doctor/portal"')
);

// The appearance control does not appear on surfaces it cannot change.
const fab = read("src/components/ThemeFab.tsx");
check(
  "the theme control is hidden on the console it cannot theme",
  ["/admin", "/doctor/portal", "/doctor/join"].every((x) => fab.includes(`"${x}"`))
);
check(
  "and floats clear of the assistant launcher",
  fab.includes("left-5") && !fab.includes("right-5")
);

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log(`  FAIL  ${f}`));
  process.exit(1);
}
