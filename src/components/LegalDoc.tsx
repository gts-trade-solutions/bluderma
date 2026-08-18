import { ReactNode } from "react";

/**
 * Shared shell for the legal / policy pages. Styles nested h2/h3/p/ul/a via
 * arbitrary variants so each page can be written as plain semantic markup.
 */
export default function LegalDoc({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <article className="container-page max-w-3xl py-14 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
        BluDerma
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-sm text-ink-muted">Last updated {updated}</p>

      {intro && (
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">{intro}</p>
      )}

      <div
        className="mt-8 text-[15px] leading-relaxed text-ink-soft
          [&_h2]:mt-10 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink
          [&_h3]:mt-6 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-ink
          [&_p]:mt-3
          [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5
          [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5
          [&_strong]:font-semibold [&_strong]:text-ink
          [&_a]:font-medium [&_a]:text-brand-300 [&_a:hover]:text-brand-200"
      >
        {children}
      </div>

      <p className="mt-12 border-t border-white/10 pt-6 text-sm text-ink-muted">
        Questions about this page? Email{" "}
        <a
          href="mailto:info@bluderma.kr"
          className="font-medium text-brand-300 hover:text-brand-200"
        >
          info@bluderma.kr
        </a>
        .
      </p>
    </article>
  );
}
