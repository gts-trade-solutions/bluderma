import type { Metadata } from "next";

import LegalDoc from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Client Rights",
  description:
    "The rights and responsibilities of clients who use BluDerma to explore treatments and book consultations.",
};

export default function ClientRightsPage() {
  return (
    <LegalDoc
      title="Client Rights"
      updated="25 July 2026"
      intro="We want every client to feel informed, respected and in control. These are the rights you can expect when you use BluDerma, and the responsibilities that help us serve you well."
    >
      <h2>Your rights</h2>

      <h3>Respectful, fair treatment</h3>
      <p>
        You have the right to be treated with dignity and courtesy, without
        discrimination on the basis of age, gender, ethnicity, religion,
        disability or background.
      </p>

      <h3>Clear, honest information</h3>
      <p>
        You have the right to plain-language information about treatments —
        what they involve, what they can and cannot do, typical recovery, and
        known risks and side effects — so you can make an informed choice. Our
        content is educational and does not replace an in-person assessment.
      </p>

      <h3>Privacy and confidentiality</h3>
      <p>
        You have the right to have your personal and health-related information
        handled confidentially and used only as described in our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h3>Informed choice and consent</h3>
      <p>
        You have the right to ask questions, take your time, seek a second
        opinion, and give or withhold consent before any procedure. No one
        should pressure you into a treatment.
      </p>

      <h3>A qualified professional</h3>
      <p>
        You have the right to be assessed and treated by an appropriately
        qualified, licensed practitioner, and to know who is responsible for
        your care.
      </p>

      <h3>Access to your data</h3>
      <p>
        You have the right to view, correct or delete the personal information
        held in your BluDerma account. See the{" "}
        <a href="/privacy">Privacy Policy</a> for how to make a request.
      </p>

      <h3>Raise a concern</h3>
      <p>
        You have the right to raise a concern or complaint and to have it taken
        seriously. Email us at info@bluderma.kr and we will respond.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>
          Provide accurate information, and disclose your relevant medical
          history, allergies, medications and pregnancy or breastfeeding status
          to your treating practitioner.
        </li>
        <li>
          Ask questions if anything is unclear, and follow the pre- and
          post-treatment guidance you are given.
        </li>
        <li>
          Understand that information on BluDerma is a reference only and does
          not replace a personal consultation. Please read our{" "}
          <a href="/precautions">Precautions</a>.
        </li>
        <li>Keep your account details accurate and your login secure.</li>
      </ul>
    </LegalDoc>
  );
}
