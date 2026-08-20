import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { buildPatientMenu } from "@/lib/queries/nav";
import { getAllHubPaths, getHubCategory } from "@/lib/queries/hubCatalogue";
import FeatureTreatment from "./FeatureTreatment";
import JsonLd from "@/components/JsonLd";
import { absolute, breadcrumbLd, procedureLd } from "@/lib/seo";

interface Params {
  params: { category: string; treatment: string };
}

export async function generateStaticParams() {
  return getAllHubPaths();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const category = await getHubCategory(params.category);
  const treatment = category?.treatments.find(
    (t) => t.slug === params.treatment
  );
  if (!treatment) return { title: "Treatment" };
  const path = `/patient/explore/${params.category}/${params.treatment}`;
  return {
    title: `${treatment.name}: ${category!.name}`,
    description: treatment.blurb,
    // Each treatment is reachable from the category browser and from a search
    // result; the canonical says which one is the page.
    alternates: { canonical: path },
    openGraph: {
      title: `${treatment.name} at BluDerma`,
      description: treatment.blurb,
      url: absolute(path),
      images: treatment.image ? [treatment.image] : undefined,
    },
  };
}

/**
 * Every treatment page. The client compared two candidate designs and chose
 * the plain professional one (FeatureTreatment), so it is simply the layout
 * now — the A/B routing map and the editorial candidate are gone.
 */
export default async function TreatmentPage({ params }: Params) {
  const category = await getHubCategory(params.category);
  const treatment = category?.treatments.find(
    (t) => t.slug === params.treatment
  );
  if (!category || !treatment) notFound();

  return (
    <>
      {/* The two entities a treatment page can honestly claim: what the
          procedure is, and where it sits in the catalogue. No price and no
          rating — the cards carry neither, and structured data must not say
          what the page does not. */}
      <JsonLd
        data={procedureLd({
          name: treatment.name,
          description: treatment.blurb,
          url: absolute(`/patient/explore/${category.slug}/${treatment.slug}`),
          category: category.name,
        })}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: "Treatments", path: "/patient/explore" },
          { name: category.name, path: `/patient/explore/${category.slug}` },
          {
            name: treatment.name,
            path: `/patient/explore/${category.slug}/${treatment.slug}`,
          },
        ])}
      />

      <Navbar role="patient" menu={buildPatientMenu()} />
      <FeatureTreatment category={category} treatment={treatment} />
      <Footer />
    </>
  );
}
