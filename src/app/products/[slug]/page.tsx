import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import RoleAwareNavbar from "@/components/RoleAwareNavbar";
import Footer from "@/components/Footer";
import EnquiryButton from "@/components/EnquiryButton";
import ProductGallery from "@/components/ProductGallery";
import { getAllProductSlugs, getProduct } from "@/lib/queries/products";
import { buildDoctorMenu, buildPatientMenu } from "@/lib/queries/nav";

export async function generateStaticParams() {
  const slugs = await getAllProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

/** Products are admin-editable, so re-render every 5 minutes. */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) return { title: "Product not found" };
  return {
    title: `${product.name}${product.brand ? ` by ${product.brand}` : ""}`,
    description: product.seoDescription ?? undefined,
  };
}

export default async function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = await getProduct(params.slug);
  if (!product) notFound();

  const [doctorMenu] = await Promise.all([buildDoctorMenu()]);
  const patientMenu = buildPatientMenu();

  const factRows = [
    product.brand && { label: "Brand", value: product.brand },
    { label: "Category", value: product.category },
    product.origin && { label: "Origin", value: product.origin },
    product.variants.length > 0 && {
      label: "Options",
      value: product.variants.join(" · "),
    },
  ].filter(Boolean) as { label: string; value: string }[];

  const hasDetail =
    product.description ||
    product.howItWorks ||
    product.features.length > 0 ||
    product.benefits.length > 0 ||
    product.indications.length > 0;

  return (
    <>
      <RoleAwareNavbar doctorMenu={doctorMenu} patientMenu={patientMenu} />

      <main className="theme-light bg-[var(--surface)]">
        <div className="container-page py-8">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <Link href="/patient/explore" className="hover:text-brand-700">
              Products
            </Link>
            <span>/</span>
            <span className="text-ink-soft">{product.category}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-2">
            {/* Gallery */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <ProductGallery images={product.images} name={product.name} />
            </div>

            {/* Summary + enquiry */}
            <div>
              {product.brand && (
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
                  {product.brand}
                </p>
              )}
              <h1 className="mt-1 text-3xl font-bold text-ink sm:text-4xl">
                {product.name}
              </h1>
              {product.tagline && (
                <p className="mt-3 text-lg text-ink-soft">{product.tagline}</p>
              )}

              <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200">
                {factRows.map((f) => (
                  <div key={f.label} className="bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
                      {f.label}
                    </p>
                    <p className="mt-1 text-sm font-medium text-ink">{f.value}</p>
                  </div>
                ))}
              </div>

              {product.variants.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-semibold text-ink">
                    Available options
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.variants.map((v) => (
                      <span
                        key={v}
                        className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 ring-1 ring-inset ring-brand-100"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Enquiry-to-order. No price anywhere — deliberate. */}
              <div className="mt-8 rounded-2xl bg-white p-6 shadow-card ring-1 ring-black/[0.04]">
                <p className="text-sm text-ink-muted">
                  Interested in ordering{" "}
                  <span className="font-semibold text-ink">{product.name}</span>?
                  Send an enquiry and our team will follow up with availability
                  and pricing.
                </p>
                <div className="mt-4">
                  <EnquiryButton
                    treatmentName={product.category}
                    productName={product.name}
                    full
                  />
                </div>
              </div>

              {product.treatments.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-semibold text-ink">Used in</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.treatments.map((t) => (
                      <Link
                        key={t.slug}
                        href={`/treatments/${t.slug}`}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-ink-soft transition hover:border-brand-300 hover:text-brand-700"
                      >
                        {t.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detail sections */}
        <div className="container-page pb-16">
          {hasDetail ? (
            <div className="grid gap-10 lg:grid-cols-3">
              <div className="space-y-8 lg:col-span-2">
                {product.description && (
                  <Section title="Overview">
                    <p className="leading-relaxed text-ink-soft">
                      {product.description}
                    </p>
                  </Section>
                )}
                {product.howItWorks && (
                  <Section title="How it works">
                    <p className="leading-relaxed text-ink-soft">
                      {product.howItWorks}
                    </p>
                  </Section>
                )}
                {product.indications.length > 0 && (
                  <Section title="Indications">
                    <BulletList items={product.indications} />
                  </Section>
                )}
              </div>

              <div className="space-y-6">
                {product.features.length > 0 && (
                  <Card title="Key features">
                    <BulletList items={product.features} />
                  </Card>
                )}
                {product.benefits.length > 0 && (
                  <Card title="Benefits">
                    <BulletList items={product.benefits} />
                  </Card>
                )}
                {product.composition && (
                  <Card title="Composition">
                    <p className="text-sm leading-relaxed text-ink-soft">
                      {product.composition}
                    </p>
                  </Card>
                )}
                {product.usageNotes && (
                  <Card title="Usage & handling">
                    <p className="text-sm leading-relaxed text-ink-soft">
                      {product.usageNotes}
                    </p>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            // Pre-enrichment: mapping and basics are in, detail is being added.
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="text-sm text-ink-muted">
                Full product details are being added. In the meantime, send an
                enquiry above and we&apos;ll share everything you need.
              </p>
            </div>
          )}

          <p className="mt-10 rounded-2xl bg-white p-5 text-xs leading-relaxed text-ink-muted shadow-soft ring-1 ring-black/[0.04]">
            For medical professionals. Product information is for reference and
            does not replace the manufacturer&apos;s instructions for use.
            Availability and regulatory status vary by region.
          </p>
        </div>
      </main>

      <Footer />
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="section-eyebrow">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm text-ink-soft">
          <svg
            viewBox="0 0 20 20"
            className="mt-0.5 h-4 w-4 shrink-0 text-teal-500"
            fill="currentColor"
          >
            <path d="M8.2 13.3 5 10.1l1.2-1.2 2 2 5-5L14.4 7l-6.2 6.3Z" />
          </svg>
          {item}
        </li>
      ))}
    </ul>
  );
}
