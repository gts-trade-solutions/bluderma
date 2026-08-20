import type { Metadata } from "next";

import LegalDoc from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How BluDerma collects, uses, shares and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="25 July 2026"
      intro="This policy explains what personal information BluDerma collects, why we collect it, how we use and protect it, and the choices you have."
    >
      <h2>1. Who we are</h2>
      <p>
        BluDerma is operated by MadenKorea, which acts as the data controller
        for personal information processed through the platform. For any privacy
        request, contact us at info@bluderma.kr.
      </p>

      <h2>2. Information we collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address, phone
          number and the account type you choose (doctor or client).
        </li>
        <li>
          <strong>Authentication:</strong> a password, which is stored only as a
          salted hash. We never store it in plain text.
        </li>
        <li>
          <strong>Consultations and enquiries:</strong> the treatment,
          appointment or product details you submit, and any message you send.
        </li>
        <li>
          <strong>Skin-analysis inputs:</strong> answers and results you choose
          to save to your profile.
        </li>
      </ul>
      <h3>Information we collect automatically</h3>
      <ul>
        <li>
          Basic technical and usage data (such as device, browser and pages
          viewed) and strictly necessary cookies used to keep you signed in and
          to secure the service.
        </li>
      </ul>

      <h2>3. How we use your information</h2>
      <ul>
        <li>To create and manage your account and authenticate you.</li>
        <li>
          To process consultations, appointments and product enquiries, and to
          contact you about them.
        </li>
        <li>To save and show your skin-analysis history if you choose to.</li>
        <li>
          To secure the platform, prevent abuse and comply with legal
          obligations.
        </li>
      </ul>
      <p>
        We do not sell your personal information, and we do not use your
        clinical or profile data for advertising.
      </p>

      <h2>4. Legal bases</h2>
      <p>
        Where such laws apply, we rely on: performance of a contract (to provide
        the service you request), your consent (for example, saving optional
        profile data), our legitimate interests (to secure and improve the
        platform), and compliance with legal obligations.
      </p>

      <h2>5. How we share information</h2>
      <ul>
        <li>
          <strong>With practitioners:</strong> when you book a consultation, the
          relevant details are shared with the doctor or clinic you booked so
          they can prepare and contact you.
        </li>
        <li>
          <strong>Service providers:</strong> vetted providers that host and run
          the platform on our behalf, for example cloud hosting and object
          storage, database hosting and transactional email delivery. They may
          process data only on our instructions.
        </li>
        <li>
          <strong>Legal reasons:</strong> where required by law, or to protect
          the rights, safety and security of users and the platform.
        </li>
      </ul>

      <h2>6. Cookies</h2>
      <p>
        We use strictly necessary cookies to keep you signed in and to protect
        the service. We do not use them to build advertising profiles. You can
        control cookies in your browser, but disabling essential cookies may
        stop parts of the platform from working.
      </p>

      <h2>7. Data retention</h2>
      <p>
        We keep personal information for as long as your account is active and as
        needed to provide the service, then for any additional period required
        to meet legal, accounting or security obligations. You can ask us to
        delete your account, and we will do so unless we are required to retain
        certain records.
      </p>

      <h2>8. How we protect your information</h2>
      <p>
        We use technical and organisational measures including encryption in
        transit (HTTPS), hashed passwords, access controls and role-based
        permissions, and audit logging of administrative actions. No system is
        perfectly secure, but we work to protect your data and to respond
        promptly to any incident.
      </p>

      <h2>9. Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct,
        update or delete your personal information, to object to or restrict
        certain processing, to withdraw consent, and to request a copy of your
        data. To exercise any of these, email info@bluderma.kr. You may also have
        the right to complain to your local data-protection authority.
      </p>

      <h2>10. Children</h2>
      <p>
        BluDerma is not intended for anyone under 18, and we do not knowingly
        collect information from children. If you believe a child has provided us
        information, contact us and we will remove it.
      </p>

      <h2>11. International transfers</h2>
      <p>
        Our providers may process data in countries other than yours. Where we
        transfer data across borders, we take steps to ensure it remains
        protected in line with this policy and applicable law.
      </p>

      <h2>12. Changes and contact</h2>
      <p>
        We may update this policy and will revise the &ldquo;last updated&rdquo;
        date above. For any question or request, contact info@bluderma.kr.
      </p>
    </LegalDoc>
  );
}
