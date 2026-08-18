import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Shared section header for the client hub — eyebrow, title, optional link. */
export default function SectionHead({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="section-eyebrow">{eyebrow}</p>}
        <h2 className="display-sm mt-1.5 text-2xl text-ink sm:text-[1.75rem]">
          {title}
        </h2>
        {sub && (
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
            {sub}
          </p>
        )}
      </div>
      {action && (
        <Link
          href={action.href}
          className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand-200 hover:text-brand-100 sm:inline-flex"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
