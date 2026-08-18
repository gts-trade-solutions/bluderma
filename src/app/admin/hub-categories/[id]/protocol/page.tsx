import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { saveProtocol } from "@/lib/actions/admin/catalogue";
import EntityForm from "@/components/admin/EntityForm";
import { Card, PageHeader, TextArea, TextField } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "Treatment protocol" };
}

/** Json columns come back untyped; render them as one line per entry. */
const asLines = (v: unknown): string =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string").join("\n") : "";

const optionLines = (v: unknown): string => {
  if (!Array.isArray(v)) return "";
  return v
    .map((o) => {
      const r = (o ?? {}) as Record<string, unknown>;
      const parts = [String(r.name ?? ""), String(r.detail ?? "")];
      if (r.popular === true) parts.push("popular");
      return parts.join(" | ");
    })
    .join("\n");
};

const faqLines = (v: unknown): string => {
  if (!Array.isArray(v)) return "";
  return v
    .map((f) => {
      const r = (f ?? {}) as Record<string, unknown>;
      return `${String(r.q ?? "")} | ${String(r.a ?? "")}`;
    })
    .join("\n");
};

/**
 * The clinical protocol for a category — what every treatment page under it
 * renders. Repeating groups are one per line with `|` between the parts,
 * which an editor can actually use; the action parses them back.
 */
export default async function ProtocolPage({
  params,
}: {
  params: { id: string };
}) {
  const category = await prisma.hubCategory.findUnique({
    where: { id: params.id },
    include: { protocol: true, _count: { select: { treatments: true } } },
  });
  if (!category) notFound();

  const p = category.protocol;

  const action = async (formData: FormData) => {
    "use server";
    return saveProtocol(formData);
  };

  return (
    <>
      <PageHeader
        title={`${category.name} — protocol`}
        description={`Rendered on all ${category._count.treatments} treatment page(s) in this category.`}
      />

      <EntityForm
        action={action}
        cancelHref="/admin/hub-categories"
        redirectTo="/admin/hub-categories"
        submitLabel="Save protocol"
      >
        <input type="hidden" name="categoryId" value={category.id} />

        <Card title="What it is">
          <div className="space-y-5">
            <TextArea
              label="Summary"
              name="summary"
              rows={3}
              required
              defaultValue={p?.summary ?? ""}
            />
            <TextArea
              label="How it works"
              name="howItWorks"
              rows={3}
              required
              defaultValue={p?.howItWorks ?? ""}
            />
            <TextArea
              label="Recommended if"
              name="recommendedFor"
              rows={3}
              defaultValue={asLines(p?.recommendedFor)}
              hint="One statement per line. Three reads best."
            />
          </div>
        </Card>

        <Card
          title="Options"
          description="One per line: Name | what differs | popular"
        >
          <TextArea
            label="Options"
            name="options"
            rows={4}
            defaultValue={optionLines(p?.options)}
            hint="Add the word 'popular' as a third part to flag one. Never a price."
          />
        </Card>

        <Card title="The facts">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Duration" name="duration" required defaultValue={p?.duration ?? ""} />
            <TextField label="Anaesthesia" name="anaesthesia" required defaultValue={p?.anaesthesia ?? ""} />
            <TextField label="Sessions" name="sessions" required defaultValue={p?.sessions ?? ""} />
            <TextField label="Downtime" name="downtime" required defaultValue={p?.downtime ?? ""} />
          </div>
          <div className="mt-5 space-y-5">
            <TextArea label="Results" name="results" rows={2} required defaultValue={p?.results ?? ""} />
            <TextArea
              label="Areas treated"
              name="areas"
              rows={3}
              defaultValue={asLines(p?.areas)}
              hint="One per line."
            />
          </div>
        </Card>

        <Card title="Included and not included" description="One per line.">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextArea label="What's included" name="includes" rows={4} defaultValue={asLines(p?.includes)} />
            <TextArea label="What's not included" name="excludes" rows={4} defaultValue={asLines(p?.excludes)} />
          </div>
        </Card>

        <Card
          title="Safety"
          description="One per line. This is the section clients are most likely to read closely."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <TextArea label="Precautions" name="precautions" rows={4} defaultValue={asLines(p?.precautions)} />
            <TextArea label="Possible side effects" name="sideEffects" rows={4} defaultValue={asLines(p?.sideEffects)} />
            <TextArea label="Not suitable if" name="notSuitable" rows={4} defaultValue={asLines(p?.notSuitable)} />
            <TextArea label="Aftercare" name="aftercare" rows={4} defaultValue={asLines(p?.aftercare)} />
          </div>
        </Card>

        <Card title="FAQs" description="One per line: Question | Answer">
          <TextArea label="FAQs" name="faqs" rows={5} defaultValue={faqLines(p?.faqs)} />
        </Card>
      </EntityForm>
    </>
  );
}
