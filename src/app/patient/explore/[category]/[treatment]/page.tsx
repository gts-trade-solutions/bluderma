import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { buildPatientMenu } from "@/lib/queries/nav";
import { getAllHubPaths, getHubCategory } from "@/lib/queries/hubCatalogue";
import FeatureTreatment from "./FeatureTreatment";

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
  return {
    title: `${treatment.name} — ${category!.name}`,
    description: treatment.blurb,
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
      <Navbar role="patient" menu={buildPatientMenu()} />
      <FeatureTreatment category={category} treatment={treatment} />
      <Footer />
    </>
  );
}
