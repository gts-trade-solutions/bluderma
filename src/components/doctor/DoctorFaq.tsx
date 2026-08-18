/**
 * The questions a clinician actually asks before listing.
 *
 * Including the awkward ones. A practitioner deciding whether to hand us their
 * diary wants to know what we take, what we can change, and what we cannot do
 * yet — and finding that out after signing up is how you lose someone for
 * good. Answers are deliberately specific; "contact us for details" is not an
 * answer.
 */
const FAQS = [
  {
    q: "What does it cost?",
    a: "Listing is free and we take no commission on your consultation fee. If a client pays you through BluDerma, the payment gateway's own charge applies to the transaction — that is Razorpay's fee, not ours, and it is the same rate you would pay taking the card yourself.",
  },
  {
    q: "Who decides my fee?",
    a: "You do, per location. The same practitioner charges differently at a flagship and a suburban branch, so the fee lives on each clinic rather than on you. Set one to zero and your profile says 'on enquiry' instead of showing a price.",
  },
  {
    q: "How long does approval take?",
    a: "Usually two working days. We check your registration number against your medical council's own register before you go live — that check is the whole reason the verified mark on your profile is worth anything. If something does not match we tell you exactly what and you resubmit; nothing you entered is lost.",
  },
  {
    q: "I work at more than one clinic. Will they clash?",
    a: "No. A booking at one location blocks that time at every other, because you can only be in one place. You also set the travel time between your clinics, and we block that either side — so you are never scheduled somewhere you cannot physically reach.",
  },
  {
    q: "Do I have to accept every booking?",
    a: "No. Turn on manual confirmation and each request waits for you, holding its slot, until you accept or decline. Leave it off and bookings confirm on the spot. You can change your mind at any time under My practice.",
  },
  {
    q: "What happens if I need to cancel on a client?",
    a: "You cancel from the calendar and give a reason, which the client is emailed word for word. They are never charged a fee for a clinic-side cancellation, and if they had already paid, it is flagged to our team for a refund.",
  },
  {
    q: "Can I take my patients' records with me if I leave?",
    a: "Prescriptions you issue belong to the client's record and stay with them. Your own profile and hours are yours to delete. We do not hold your client list hostage — ask and we will export what relates to your practice.",
  },
  {
    q: "Do you do video consultations?",
    a: "Yes. Tick it during onboarding, and you paste your own meeting link against each video appointment — we share it with the client and put it in their reminder. We do not run the video call ourselves, so use whatever platform you already trust.",
  },
];

export default function DoctorFaq() {
  return (
    <section className="scroll-mt-24 bg-white py-20" id="faq">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="section-eyebrow">Before you start</p>
          <h2 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
            The questions worth asking first
          </h2>
        </div>

        <div className="mt-10 max-w-3xl divide-y divide-slate-200 border-y border-slate-200">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <h3 className="font-bold text-ink">{f.q}</h3>
                <span
                  aria-hidden
                  className="shrink-0 text-xl leading-none text-slate-400 transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
