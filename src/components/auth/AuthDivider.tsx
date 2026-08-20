/**
 * The "— or —" rule between the email/password form and the Google button.
 * A tiny shared component so the three auth surfaces (login, register, doctor
 * sign-up) render it identically.
 */
export default function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
      <span className="h-px flex-1 bg-slate-300/40" />
      {label}
      <span className="h-px flex-1 bg-slate-300/40" />
    </div>
  );
}
