import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { deleteProduct, setProductPublished } from "@/lib/actions/admin/products";
import { DeleteButton, EditLink, ToggleButton } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Products" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string; page?: string };
}) {
  const category = searchParams.category?.trim() || undefined;
  const q = searchParams.q?.trim() || undefined;
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);

  const where = {
    ...(category ? { category } : {}),
    ...(q
      ? { OR: [{ name: { contains: q } }, { brand: { contains: q } }] }
      : {}),
  };

  const [products, total, categories, enrichedCount] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { images: true, variants: true } },
        treatments: {
          where: { isPrimary: true },
          include: { treatment: { select: { name: true } } },
        },
      },
    }),
    prisma.product.count({ where }),
    prisma.product.groupBy({
      by: ["category"],
      _count: { _all: true },
      orderBy: { category: "asc" },
    }),
    prisma.product.count({ where: { enrichedAt: { not: null } } }),
  ]);

  const totalAll = await prisma.product.count();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (patch: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { category, q, page, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "" && !(k === "page" && v === 1)) {
        sp.set(k, String(v));
      }
    }
    const s = sp.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Products"
        description={`${totalAll} products · ${enrichedCount} enriched with full details.`}
        action={
          <Link href="/admin/products/new" className="btn-primary">
            New product
          </Link>
        }
      />

      {/* Category filter */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href={qs({ category: undefined, page: 1 })}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
            !category
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-slate-200 bg-white text-ink-soft hover:border-brand-300"
          }`}
        >
          All
          <span className="text-[11px] opacity-80">{totalAll}</span>
        </Link>
        {categories.map((c) => (
          <Link
            key={c.category}
            href={qs({ category: c.category, page: 1 })}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              category === c.category
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-200 bg-white text-ink-soft hover:border-brand-300"
            }`}
          >
            {c.category}
            <span className="text-[11px] opacity-80">{c._count._all}</span>
          </Link>
        ))}
      </div>

      {/* Search */}
      <form className="mb-5 flex gap-2" action="/admin/products">
        {category && <input type="hidden" name="category" value={category} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name or brand…"
          className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <button className="btn-ghost !px-4 !py-2 text-sm">Search</button>
      </form>

      {products.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Try a different category or search, or add a new product."
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th className="w-40">Primary treatment</Th>
                <Th className="w-24">Media</Th>
                <Th className="w-28">Details</Th>
                <Th className="w-24">Status</Th>
                <Th className="w-32 text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <Td>
                    <div className="font-semibold text-ink">{p.name}</div>
                    <div className="text-xs text-ink-muted">
                      {p.brand ? `${p.brand} · ` : ""}/{p.slug}
                    </div>
                  </Td>
                  <Td className="text-ink-soft">{p.category}</Td>
                  <Td className="text-xs text-ink-soft">
                    {p.treatments[0]?.treatment.name ?? "—"}
                  </Td>
                  <Td className="text-xs text-ink-muted">
                    {p._count.images} img · {p._count.variants} var
                  </Td>
                  <Td>
                    {p.enrichedAt ? (
                      <Pill tone="success">Enriched</Pill>
                    ) : (
                      <Pill tone="warn">Basic</Pill>
                    )}
                  </Td>
                  <Td>
                    <ToggleButton
                      active={p.isPublished}
                      action={async (next) => {
                        "use server";
                        return setProductPublished(p.id, next);
                      }}
                    />
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-3">
                      <a
                        href={`/products/${p.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-ink-muted hover:text-ink"
                      >
                        View
                      </a>
                      <EditLink href={`/admin/products/${p.id}`} />
                      <DeleteButton
                        confirmText={p.name}
                        action={async () => {
                          "use server";
                          return deleteProduct(p.id);
                        }}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          {pageCount > 1 && (
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-ink-muted">
                Page {page} of {pageCount} · {total} products
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={qs({ page: page - 1 })} className="btn-ghost !px-4 !py-2">
                    Previous
                  </Link>
                )}
                {page < pageCount && (
                  <Link href={qs({ page: page + 1 })} className="btn-ghost !px-4 !py-2">
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
