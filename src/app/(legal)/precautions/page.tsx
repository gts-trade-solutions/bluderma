import type { Metadata } from "next";

import LegalDoc from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Precautions",
  description:
    "Important safety information to read before considering any dermatological or aesthetic treatment.",
};

export default function PrecautionsPage() {
  return (
    <LegalDoc
      title="Precautions"
      updated="25 July 2026"
      intro="Aesthetic and dermatological treatments are medical procedures. Please read this safety information carefully. It is general guidance only and does not replace advice from a qualified practitioner who has assessed you in person."
    >
      <h2>Before any treatment</h2>
      <ul>
        <li>
          Have a consultation with a licensed, appropriately trained
          practitioner. Only they can decide whether a treatment is suitable for
          you.
        </li>
        <li>
          Disclose your full medical history, allergies, current medications and
          supplements, previous aesthetic treatments, and whether you are
          pregnant or breastfeeding.
        </li>
        <li>
          Ask about the specific product to be used, its expected results,
          alternatives, downtime and risks — and make sure you understand them
          before giving consent.
        </li>
        <li>
          Confirm the product is genuine and stored correctly. Never accept
          treatment with an unlabelled, tampered or out-of-date product.
        </li>
      </ul>

      <h2>Who should take extra care or avoid treatment</h2>
      <p>
        Depending on the procedure, treatment may be unsuitable or need extra
        caution if any of the following apply. Your practitioner will assess
        your individual situation:
      </p>
      <ul>
        <li>Pregnancy or breastfeeding.</li>
        <li>
          Active skin infection, inflammation or breakout at the treatment site.
        </li>
        <li>
          A history of allergy to the product or its components (for example
          lidocaine, hyaluronic acid, or botulinum toxin).
        </li>
        <li>
          Bleeding disorders or use of blood-thinning medication.
        </li>
        <li>
          Certain autoimmune, neuromuscular or chronic conditions, or a
          compromised immune system.
        </li>
        <li>A tendency to keloid or hypertrophic scarring.</li>
      </ul>

      <h2>Injectable treatments</h2>
      <p>
        Injectables such as dermal fillers, botulinum toxin and skin boosters
        should only be administered by trained medical professionals using
        sterile technique. Ask your practitioner how complications are managed —
        for example, that hyaluronidase is available where hyaluronic-acid
        fillers are used.
      </p>

      <h2>Possible side effects</h2>
      <p>
        Common, usually temporary reactions include redness, swelling,
        tenderness, bruising or small bumps at the treatment site. These
        typically settle within days. Follow the aftercare instructions your
        practitioner provides.
      </p>

      <h2>When to seek urgent help</h2>
      <p>
        Contact your practitioner or seek immediate medical attention if you
        experience any of the following after a procedure:
      </p>
      <ul>
        <li>Severe or increasing pain, or skin that turns white, dusky or dark.</li>
        <li>
          Any change in vision, or pain around the eyes after a facial
          injectable.
        </li>
        <li>
          Signs of an allergic reaction — difficulty breathing, or swelling of
          the lips, tongue or throat (call emergency services).
        </li>
        <li>
          Signs of infection — spreading redness, warmth, pus or fever.
        </li>
      </ul>

      <h2>Important note</h2>
      <p>
        BluDerma provides reference information and connects clients with
        practitioners and products; it does not provide treatment or medical
        advice, and it is a reseller with no role in product manufacturing.
        Always rely on the judgement of your treating professional. If you think
        you are having a medical emergency, call your local emergency number
        immediately.
      </p>
    </LegalDoc>
  );
}
