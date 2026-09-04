import { redirect } from "next/navigation";

/**
 * Pre and post care moved inside Treatment programs.
 *
 * The two belong together — see PrePostCareSection — and this route stays
 * because it has been emailed and bookmarked. A redirect rather than a
 * deletion: a doctor following a six-month-old link should land on the thing
 * they were promised, not on a 404.
 */
export default function AftercarePage() {
  redirect("/doctor/portal/plans?tab=care");
}
