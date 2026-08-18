export default function ReportLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white/[0.04] text-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-brand-600" />
      <p className="text-sm text-ink-muted">Generating your report…</p>
    </div>
  );
}
