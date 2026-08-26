"use client";

import { useEffect, useState } from "react";

/**
 * The lines of a prescription, picked off the doctor's own dispensary.
 *
 * ── What this replaces ───────────────────────────────────────────────────
 * A title and a free-text note. "Tretinoin 0.025% nightly", typed from memory,
 * every time, by a doctor who already keeps a list of exactly what they
 * dispense. Three things came of that. The same medicine was spelled four ways
 * across four prescriptions, so nothing could be counted or reordered. The
 * strength and form had to be retyped even where the practice's own record
 * held them. And the patient, holding a prescription for something their
 * doctor stocks, had no way to buy it from them — the refill went to whoever
 * was nearest.
 *
 * ── Typing is still a first-class path ───────────────────────────────────
 * Most of what a dermatologist writes is not something they stock, and a
 * picker that only offers the shelf would be a picker doctors work around.
 * A line with no medicine behind it saves exactly as well; it simply has no
 * link, and PrescriptionItem.medicineId is nullable for that reason.
 *
 * ── The name is copied, not referenced ───────────────────────────────────
 * Same rule as AftercareSheet: this is an instruction a patient acts on for a
 * fortnight, and renaming or repricing the dispensary later must never change
 * what they were told to take. The server snapshots name, strength and form at
 * the moment of issue.
 */

interface Medicine {
  id: string;
  name: string;
  brand: string | null;
  form: string | null;
  strength: string | null;
  stock: number | null;
  lowStockAt: number | null;
  prescriptionOnly: boolean;
}

export interface Line {
  key: string;
  medicineId: string;
  name: string;
  strength: string;
  form: string;
  dose: string;
  duration: string;
}

const blank = (key: string): Line => ({
  key,
  medicineId: "",
  name: "",
  strength: "",
  form: "",
  dose: "",
  duration: "",
});

const field =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export default function PrescriptionLines() {
  const [lines, setLines] = useState<Line[]>([blank("l0")]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [seq, setSeq] = useState(1);

  // Loaded once, when the panel appears. A failure is silent on purpose:
  // it costs the picker, and the doctor can still type every line.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/doctor/medicines", { cache: "no-store" });
        const data = await res.json();
        if (alive && res.ok && data?.ok) setMedicines(data.medicines as Medicine[]);
      } catch {
        /* the form works without it */
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const set = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function pick(key: string, medicineId: string) {
    const m = medicines.find((x) => x.id === medicineId);
    if (!m) {
      // Back to "type it myself". The name is left alone rather than cleared:
      // a doctor who picked the wrong row and is now correcting it should not
      // lose what they had.
      set(key, { medicineId: "" });
      return;
    }
    set(key, {
      medicineId: m.id,
      name: m.name,
      strength: m.strength ?? "",
      form: m.form ?? "",
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-800">What to take</p>

      <ul className="space-y-2">
        {lines.map((l, i) => {
          const linked = medicines.find((m) => m.id === l.medicineId);
          const out = linked?.stock === 0;
          const low =
            linked &&
            linked.stock !== null &&
            linked.lowStockAt !== null &&
            linked.stock <= linked.lowStockAt;

          return (
            <li key={l.key} className="rounded-xl border border-slate-200 p-2.5">
              {/* What is submitted. Parallel arrays, one input per column, so
                  a plain form post carries them without JSON in a hidden
                  field — which stops matching the form it came from the first
                  time either changes. */}
              <input type="hidden" name="itemMedicineId" value={l.medicineId} />
              <input type="hidden" name="itemName" value={l.name} />
              <input type="hidden" name="itemStrength" value={l.strength} />
              <input type="hidden" name="itemForm" value={l.form} />
              <input type="hidden" name="itemDose" value={l.dose} />
              <input type="hidden" name="itemDuration" value={l.duration} />

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                {medicines.length > 0 ? (
                  <select
                    value={l.medicineId}
                    onChange={(e) => pick(l.key, e.target.value)}
                    aria-label="Pick from your dispensary"
                    className={field}
                  >
                    <option value="">Type it myself…</option>
                    {medicines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.strength ? ` ${m.strength}` : ""}
                        {m.stock !== null ? ` — ${m.stock} in stock` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-slate-500">
                    {loaded
                      ? "Nothing in your dispensary yet. Type each line, or add your list under Prescriptions."
                      : "Loading your list…"}
                  </p>
                )}

                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                    aria-label={`Remove line ${i + 1}`}
                    className="justify-self-start rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  value={l.name}
                  onChange={(e) => set(l.key, { name: e.target.value, medicineId: "" })}
                  placeholder="Medicine"
                  className={field}
                />
                <input
                  value={l.strength}
                  onChange={(e) => set(l.key, { strength: e.target.value })}
                  placeholder="Strength — 0.025%"
                  className={field}
                />
                <input
                  value={l.dose}
                  onChange={(e) => set(l.key, { dose: e.target.value })}
                  placeholder="How to take it — thin layer at night"
                  className={field}
                />
                <input
                  value={l.duration}
                  onChange={(e) => set(l.key, { duration: e.target.value })}
                  placeholder="For how long — 12 weeks"
                  className={field}
                />
              </div>

              {/* Said here rather than after the fact. A doctor prescribing
                  something they have run out of should find out while they
                  can still say so to the patient in front of them. */}
              {out && (
                <p className="mt-1.5 text-[11px] font-semibold text-rose-600">
                  You have none of this left. The patient can still be
                  prescribed it — they just cannot order it from you today.
                </p>
              )}
              {!out && low && (
                <p className="mt-1.5 text-[11px] font-semibold text-amber-700">
                  Running low — {linked!.stock} left.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => {
          setLines((ls) => [...ls, blank(`l${seq}`)]);
          setSeq((n) => n + 1);
        }}
        className="text-xs font-bold text-brand-700 transition hover:underline"
      >
        + Add another medicine
      </button>
    </div>
  );
}
