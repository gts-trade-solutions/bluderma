import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { buildPatientMenu } from "@/lib/queries/nav";

/** Site chrome (nav + footer) around the policy/legal pages. */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar
        role="patient"
        menu={buildPatientMenu()}
      />
      <main className="min-h-[60vh] bg-white/[0.04]">{children}</main>
      <Footer />
    </>
  );
}
