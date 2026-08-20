import BrandLogo from "@/components/BrandLogo";

/**
 * Split layout for every auth screen: branded panel on the left (decorative,
 * hidden on small screens), form column on the right.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen">
      {/* Brand panel */}
      <aside className="relative hidden w-[42%] shrink-0 overflow-hidden bg-brand-950 lg:block">
        <div
          className="absolute inset-0 animate-ken-burns bg-cover bg-center opacity-40"
          style={{
            backgroundImage: "url(/images/korean/hero-banner-v2.png)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950/90 via-brand-900/80 to-teal-900/70" />

        <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white">
          <BrandLogo href="/" tone="light" size={52} />

          <div>
            <h2 className="max-w-sm text-balance text-3xl font-bold leading-tight">
              Dermatology &amp; aesthetic care, made clear
            </h2>
            <p className="mt-4 max-w-sm text-sm text-white/75">
              A trusted reference for skin treatments — built for both the
              doctors who deliver them and the clients who receive them.
            </p>
          </div>

          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} BluDerma
          </p>
        </div>
      </aside>

      {/* Form column */}
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-[var(--surface)] px-5 py-12 sm:px-10">
        <div className="w-full max-w-md animate-fade-in">
          <BrandLogo href="/" tone="light" size={44} className="mb-8 lg:hidden" />

          {children}
        </div>
      </div>
    </main>
  );
}
