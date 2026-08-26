import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center on-dark bg-brand-950 px-6 text-center text-white">
      <span className="text-2xl font-extrabold tracking-tight">
        Blu<span className="text-teal-300">Derma</span>
      </span>
      <h1 className="mt-6 text-5xl font-bold">404</h1>
      <p className="mt-3 max-w-md text-white/80">
        We couldn&apos;t find that page. The treatment or page you&apos;re looking
        for may have moved.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/patient/explore"
          className="btn bg-white text-brand-900 hover:bg-teal-50"
        >
          Back to the hub
        </Link>
        <Link href="/patient/skin-analyzer" className="btn-outline-white">
          Analyse my skin
        </Link>
      </div>
    </main>
  );
}
