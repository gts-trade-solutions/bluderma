import RoleAwareNavbar from "@/components/RoleAwareNavbar";
import Footer from "@/components/Footer";
import { buildMenu, buildPatientMenu } from "@/lib/queries/nav";

/** Site chrome (nav + footer) around the policy/legal pages. */
export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const doctorMenu = await buildMenu("/doctor");
  const patientMenu = buildPatientMenu();

  return (
    <>
      <RoleAwareNavbar doctorMenu={doctorMenu} patientMenu={patientMenu} />
      <main className="min-h-[60vh] bg-white">{children}</main>
      <Footer />
    </>
  );
}
