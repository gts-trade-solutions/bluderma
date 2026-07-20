export default function PatientHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <section className="bg-gradient-to-br from-rose-500 to-violet-600 text-white">
      <div className="mx-auto max-w-5xl px-4 py-14 sm:py-16">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
          {eyebrow}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-xl text-white/85">{subtitle}</p>
      </div>
    </section>
  );
}
