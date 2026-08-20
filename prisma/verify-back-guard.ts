/**
 * A headless exercise of the back-button guard's state machine.
 *
 * There is no browser automation in this project, and the bug being guarded
 * against — a dialog that would not close midway through — was a history
 * bookkeeping error, not a rendering one. So the bookkeeping is modelled here
 * and driven through the sequences that broke it.
 *
 * The rules being proved:
 *   1. Exactly one sentinel is on the stack while a guard is active.
 *   2. Closing by ✕ removes that sentinel and nothing else.
 *   3. Back inside a wizard steps back and re-arms, without growing the stack.
 *   4. Back at the first step closes, and does NOT then pop a second entry.
 *   5. A second guard opening on top never lets the first pop the wrong entry.
 *
 *   npx tsx prisma/verify-back-guard.ts
 */

interface Entry {
  label: string;
  state: Record<string, unknown>;
}

/** The bits of window.history the guard actually touches. */
class FakeHistory {
  entries: Entry[] = [{ label: "page", state: {} }];
  index = 0;
  private listeners: (() => void)[] = [];

  get state() {
    return this.entries[this.index].state;
  }

  pushState(state: Record<string, unknown>) {
    // A push truncates anything ahead, like a real browser.
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push({ label: "guard", state });
    this.index += 1;
  }

  /**
   * Travels back and QUEUES the pop.
   *
   * The browser fires popstate asynchronously. Modelling it synchronously hid
   * a real bug: a back() called from a cleanup landed before the listener was
   * re-attached in this model, but after it in a browser — so React's
   * StrictMode remount caught the overlay's own teardown and closed it.
   */
  back() {
    if (this.index === 0) throw new Error("left the site");
    this.index -= 1;
    this.pending += 1;
  }

  /** Deliver any queued pops, as the event loop would. */
  flush() {
    while (this.pending > 0) {
      this.pending -= 1;
      for (const l of [...this.listeners]) l();
    }
  }

  private pending = 0;

  onPop(fn: () => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  get depth() {
    return this.index;
  }
}

/**
 * The hook's logic, lifted out of React. `render()` stands in for the effect
 * with no dependency array that re-arms after a pop.
 */
class Guard {
  private token: string | null = null;
  private off: (() => void) | null = null;
  private seq = 0;
  /** Set while a back() this guard called is still in flight. */
  private selfPop = false;

  constructor(
    private history: FakeHistory,
    private onBack: () => void,
    private active: () => boolean,
    private name = "guard"
  ) {}

  private ours() {
    return Boolean(this.token) && this.history.state.bdGuard === this.token;
  }

  /** Effects run: attach the listener, then arm if needed. */
  render() {
    if (this.active() && !this.off) {
      this.off = this.history.onPop(() => {
        // A pop we caused ourselves is not the user pressing Back.
        if (this.selfPop) {
          this.selfPop = false;
          return;
        }
        this.token = null;
        this.onBack();
      });
    }
    if (this.active() && !this.token) {
      const id = `${this.name}-${++this.seq}`;
      this.history.pushState({ ...this.history.state, bdGuard: id });
      this.token = id;
    }
    if (!this.active() && this.off) this.teardown();
  }

  /** Cleanup order: listener first, then disarm. */
  teardown() {
    this.off?.();
    this.off = null;
    if (this.ours()) {
      this.token = null;
      this.selfPop = true;
      this.history.back();
    } else {
      this.token = null;
    }
  }
}

const fails: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) fails.push(label);
}

// ── 1. The exact sequence that broke: open, step forward, click ✕ ───────
console.log("\n1. Open → step to 3 → close with the ✕");
{
  const h = new FakeHistory();
  const st = { step: 0, open: true };

  const g = new Guard(
    h,
    () => {
      if (st.step > 0) st.step -= 1;
      else st.open = false;
    },
    () => st.open,
    "intake"
  );

  g.render();
  check("one sentinel after opening", h.depth === 1, `depth ${h.depth}`);

  // Stepping forward must NOT grow the stack — the guard keeps one sentinel.
  for (const next of [1, 2, 3]) {
    st.step = next;
    g.render();
  }
  check(
    "stepping to 3 does not stack entries",
    h.depth === 1,
    `depth ${h.depth}`
  );

  // The ✕.
  st.open = false;
  g.teardown();
  check("closing returns to the page", h.depth === 0, `depth ${h.depth}`);
  check("and the guard is gone", h.state.bdGuard === undefined);
}

// ── 2. Back walks the wizard, then closes ───────────────────────────────
console.log("\n2. Back steps back, and only closes at the first step");
{
  const h = new FakeHistory();
  const st = { step: 3, open: true };
  const g = new Guard(
    h,
    () => {
      if (st.step > 0) st.step -= 1;
      else st.open = false;
    },
    () => st.open,
    "intake"
  );
  g.render();

  h.back();
  h.flush(); // the browser delivers popstate
  g.render();
  check("back from 3 lands on 2", st.step === 2, `step ${st.step}`);
  check("still open", st.open);
  check("stack has not grown", h.depth === 1, `depth ${h.depth}`);

  h.back();
  h.flush(); // the browser delivers popstate
  g.render();
  h.back();
  h.flush(); // the browser delivers popstate
  g.render();
  check("back twice more lands on 0", st.step === 0, `step ${st.step}`);
  check("still open at step 0", st.open);

  h.back();
  h.flush(); // the browser delivers popstate
  g.render();
  check("back at step 0 closes", !st.open);
  check(
    "and does not pop a second time — the page survives",
    h.depth === 0,
    `depth ${h.depth}`
  );
}

// ── 3. Two overlays at once must not pop each other's entry ─────────────
console.log("\n3. A second overlay opening on top");
{
  const h = new FakeHistory();
  const st = { a: true, b: false };

  const a = new Guard(h, () => (st.a = false), () => st.a, "booking");
  a.render();
  const depthAfterA = h.depth;

  st.b = true;
  const b = new Guard(h, () => (st.b = false), () => st.b, "intake");
  b.render();
  check("both sentinels present", h.depth === depthAfterA + 1, `depth ${h.depth}`);

  // Close the UNDERLYING one first — its token is not on top.
  st.a = false;
  a.teardown();
  check(
    "closing the buried overlay pops nothing",
    h.depth === depthAfterA + 1,
    `depth ${h.depth}`
  );
  check("the user is still on the page", h.depth > 0);

  // Now the top one closes cleanly.
  st.b = false;
  b.teardown();
  check("closing the top overlay pops its own entry", h.depth === depthAfterA);
}

// ── 4. Reopening after a close ──────────────────────────────────────────
console.log("\n4. Close and reopen");
{
  const h = new FakeHistory();
  const st = { open: true };
  const g = new Guard(h, () => (st.open = false), () => st.open, "enquiry");

  for (let i = 0; i < 3; i++) {
    st.open = true;
    g.render();
    st.open = false;
    g.teardown();
  }
  check(
    "three open/close cycles leave no residue",
    h.depth === 0,
    `depth ${h.depth}`
  );
}

/* ------------------------------------------------------------------------
   5. React StrictMode: effects run twice in development
   ---------------------------------------------------------------------- */
// The bug this covers: opening an appointment made the drawer flash and close
// instantly. StrictMode mounts, tears down and re-mounts every effect, so the
// guard armed, disarmed (calling back()) and re-armed within a tick. popstate
// is asynchronous, so that self-inflicted pop landed AFTER the listener was
// back in place, and was read as the user pressing Back.
console.log("\n5. StrictMode double-invokes the effects");
{
  const h = new FakeHistory();
  let open = true;
  const g = new Guard(
    h,
    () => {
      open = false;
    },
    () => open,
    "strict"
  );

  // Mount, tear down, mount again: exactly what StrictMode does.
  g.render();
  g.teardown();
  g.render();
  h.flush(); // the queued pop from the teardown finally lands

  check("the overlay survives the double-invoke", open);
  check("exactly one sentinel remains", h.depth === 1, `depth ${h.depth}`);

  // And a genuine Back still closes it afterwards.
  h.back();
  h.flush();
  check("a real Back still closes it", !open);
  check("and the user is left on the page", h.depth === 0, `depth ${h.depth}`);
}

if (fails.length) {
  console.log(`\n${fails.length} FAILED:`);
  for (const f of fails) console.log("  -", f);
  process.exitCode = 1;
} else {
  console.log("\nAll back-guard rules hold.");
}
