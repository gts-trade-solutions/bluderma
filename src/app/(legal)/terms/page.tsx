import Link from "next/link";
import type { Metadata } from "next";

import LegalDoc from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms that govern your use of the BluDerma dermatology and aesthetic treatment reference platform.",
};

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Use"
      updated="25 July 2026"
      intro="These terms govern your access to and use of BluDerma. By using the platform you agree to them. Please read them carefully."
    >
      <h2>1. About BluDerma</h2>
      <p>
        BluDerma (&ldquo;BluDerma&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is
        a dermatology and aesthetic treatment reference and product-enquiry
        platform operated by MadenKorea. It helps medical professionals and
        clients explore treatments, indications and matched product solutions,
        and to raise enquiries or book consultations. We are a reseller of
        Korean aesthetic and skincare products and are not involved in their
        formulation or manufacturing.
      </p>

      <h2>2. Not medical advice</h2>
      <p>
        All content on BluDerma, including treatment descriptions, mechanisms,
        protocols, indications and product information. Is provided for general
        information and professional reference only. It is <strong>not</strong>{" "}
        medical advice, diagnosis or treatment, and it does not create a
        doctor&ndash;patient relationship. Decisions about any treatment must be
        made in person with a qualified, licensed practitioner who has assessed
        the individual. See our{" "}
        <Link href="/precautions">Precautions</Link> page before considering any
        procedure.
      </p>

      <h2>3. Eligibility</h2>
      <p>
        You must be at least 18 years old to create an account or submit an
        enquiry. Clinical reference material, pricing and ordering features are
        intended for verified medical professionals and businesses. By using
        these features you confirm you are authorised to do so in your
        jurisdiction.
      </p>

      <h2>4. Accounts</h2>
      <ul>
        <li>
          Provide accurate, current information when you register and keep it up
          to date.
        </li>
        <li>
          You are responsible for keeping your password confidential and for all
          activity under your account.
        </li>
        <li>
          Doctor accounts may be granted clinical access. We may verify,
          suspend, downgrade or remove any account, for example where
          eligibility cannot be confirmed or these terms are breached.
        </li>
        <li>Tell us promptly at info@bluderma.kr if you suspect unauthorised use.</li>
      </ul>

      <h2>5. Enquiries, pricing and orders</h2>
      <p>
        BluDerma is an enquiry-to-order platform. Product prices are shared only
        with verified professionals through direct enquiry and are not published
        on the public site. Submitting an enquiry or booking a consultation does
        not by itself create a binding contract of sale; any order is subject to
        stock, eligibility, applicable regulations and a separate confirmation.
        As a reseller we pass on manufacturer information in good faith but do
        not warrant product suitability for any particular use.
      </p>

      <h2>6. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          use the platform for any unlawful purpose or in breach of medical,
          advertising or import/export regulations that apply to you;
        </li>
        <li>
          misrepresent your identity, credentials or authority to purchase
          professional products;
        </li>
        <li>
          scrape, copy, resell or redistribute our content, pricing or imagery
          without written permission;
        </li>
        <li>
          attempt to disrupt, probe or gain unauthorised access to the platform
          or its data.
        </li>
      </ul>

      <h2>7. Intellectual property</h2>
      <p>
        The BluDerma name, logo, site design, written content and compiled
        catalogue are owned by us or our licensors and are protected by
        intellectual-property laws. Product names, packaging and trademarks
        belong to their respective manufacturers. You receive a limited,
        revocable, non-transferable licence to use the platform for its intended
        purpose only.
      </p>

      <h2>8. Third-party content and links</h2>
      <p>
        The platform may reference third-party products, manufacturers or
        websites. We do not control and are not responsible for third-party
        content, and a reference is not an endorsement.
      </p>

      <h2>9. Disclaimers and limitation of liability</h2>
      <p>
        The platform and its content are provided &ldquo;as is&rdquo; without
        warranties of any kind, to the fullest extent permitted by law. We do
        not warrant that the content is complete, current or error-free, or that
        any treatment or product will achieve a particular result. To the extent
        permitted by law, BluDerma and MadenKorea are not liable for any
        indirect, incidental or consequential loss, or for decisions made in
        reliance on the platform. Nothing in these terms limits liability that
        cannot lawfully be limited.
      </p>

      <h2>10. Indemnity</h2>
      <p>
        You agree to indemnify BluDerma and MadenKorea against claims and costs
        arising from your misuse of the platform, your breach of these terms, or
        your breach of laws or regulations that apply to your practice or
        business.
      </p>

      <h2>11. Changes</h2>
      <p>
        We may update these terms from time to time. We will revise the
        &ldquo;last updated&rdquo; date above, and continued use after a change
        means you accept the revised terms.
      </p>

      <h2>12. Governing law and contact</h2>
      <p>
        These terms are governed by the laws applicable to the operator&rsquo;s
        place of business, without regard to conflict-of-law rules. Questions
        about these terms can be sent to info@bluderma.kr.
      </p>
    </LegalDoc>
  );
}
