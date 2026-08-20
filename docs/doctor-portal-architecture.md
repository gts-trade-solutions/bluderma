===============================================================================
DOCTOR PORTAL + WHITE COLLAR  -  ARCHITECTURE
===============================================================================
Rev A  |  18 Aug 2026  |  Status: approved, in build

Covers requirements D-1..D-10 from docs/requirements-brief.txt plus the
multi-clinic calendar and the White Collar patient subscription.


-------------------------------------------------------------------------------
0.  DECISIONS TAKEN  (confirmed with the product owner)
-------------------------------------------------------------------------------
DEC-1  ENTRY UX -- no gate. `/` stays the patient marketplace and renders
       immediately. A slim dismissible strip offers "Are you a clinician?".
       Chosen over a modal gate because requirement A-1/A-2 (AI search
       discoverability) needs crawlable, non-JS-gated content, and because
       patients are the overwhelming majority of traffic.

DEC-2  DOCTOR SIGNUP -- account first, presented as one continuous flow.
       Step 0 of the wizard is name/email/password and creates the login plus
       a DRAFT doctor profile. Every later step autosaves server-side.
       Chosen because clinic photos need an authenticated upload endpoint, and
       a long form with images has to survive a closed tab.

DEC-3  SUBSCRIPTION BILLING -- one-time Razorpay order per term, not the
       Subscriptions API. Reuses settlePayment()'s purpose branch exactly and
       needs no dashboard Plan setup. Renewal is a reminder email plus a Renew
       button. Subscription.razorpaySubscriptionId is reserved now so true
       auto-debit can be added later without a data migration.
       >>> LIMITATION TO STATE PLAINLY: there is no auto-debit in this phase.

DEC-4  IMPORTED CLINICS -- the 17 real Chennai businesses currently stored as
       Doctor rows are deleted, not migrated. Replaced with clearly fictional
       demo clinics and demo doctors.
       Rationale: they are businesses, not practitioners, and inventing
       ratings/fees for real named companies misrepresents them. Invented
       clinics can carry demo numbers honestly.

DEC-5  THE EXISTING DOCTOR UI IS REPLACED, not extended.
       - The old two-tab portal (Appointments / My profile) is gone, along
         with AppointmentActions.tsx and PrescribeForm.tsx. Prescribing and
         outcome-marking moved into the appointment drawer.
       - /doctor was a CLINICAL TREATMENT REFERENCE — a searchable catalogue
         of protocols and orderable solutions. Removed entirely, along with
         HeroVideo.tsx, SolutionTiles.tsx and TreatmentBrowser.tsx, and the
         database-backed mega-menu buildMenu() that fed it. A practitioner
         landing on /doctor is deciding whether to list with us, not looking
         up how a laser works; the catalogue belongs on the client side where
         the people browsing it are.
       - /doctor is now: recruitment hero, why-list-with-us, portal preview,
         four-step explainer (D-6), practitioner FAQ, closing CTA.
       - /treatments/[slug] and /products/[slug] still exist and are reachable
         from admin preview links, but are no longer part of any doctor
         journey. They now render buildDoctorMenu().

DEC-6  WHITE COLLAR IS NOT A MENU ITEM. A membership is sold once and then
       lived with, so it appears as a section on the client home page
       (components/home/WhiteCollarBanner.tsx) and on the client's own
       profile — not in the navigation. The banner renders nothing when no
       plan is active, so switching memberships off removes the pitch rather
       than leaving an empty band.


-------------------------------------------------------------------------------
1.  THE CENTRAL PROBLEM: THERE IS NO CLINIC
-------------------------------------------------------------------------------
Today `Doctor.clinic` and `Doctor.location` are two free-text strings.
Everything the owner asked for that we cannot do follows from that:

  - a doctor cannot hold hours at three clinics
  - a patient cannot search "nearest clinic"
  - the calendar cannot colour-code or de-clash by location
  - a clinic cannot have an exterior photo, an interior photo or facilities

So Clinic becomes a real entity, and availability gains a clinic dimension.

  Clinic            id, slug, name, addressLine1/2, area, city, state,
                    pincode, lat?, lng?, phone?, email?, colorKey,
                    isActive, sortOrder
  ClinicPhoto       clinicId, url, kind EXTERIOR|INTERIOR|ROOM, sortOrder
  ClinicFacility    clinicId, name          (parking, lift, pharmacy, lab)
  DoctorClinic      doctorId, clinicId, feeInr, isPrimary, sortOrder, isActive
                    @@id([doctorId, clinicId])

  DoctorAvailability  += clinicId
                      @@unique([doctorId, clinicId, dayOfWeek, startTime])
  Appointment         += clinicId (nullable; backfilled to the primary clinic)
  Doctor              += travelBufferMin Int @default(0)

Doctor.clinic / Doctor.location survive as denormalised display strings kept
in sync with the primary clinic. Too much UI reads them to rip out safely now.

MULTIPLE WINDOWS PER DAY ALREADY WORK. The existing unique key includes
startTime, so a 09:00-13:00 and a 17:00-20:00 row coexist. Only the clinic
column was missing. Indian morning/evening sessions therefore need no new
model, just the extra dimension.


-------------------------------------------------------------------------------
2.  HOW THE MULTI-CLINIC CLASH IS ACTUALLY PREVENTED
-------------------------------------------------------------------------------
This is the part the owner was right to worry about, and it is solved at the
source rather than in the calendar UI.

2.1  slotLock stays DOCTOR-scoped -- "<doctorId>@<ISO>" -- and that is exactly
     correct. One body cannot be in two clinics at once, so a lock keyed on
     the doctor already makes a 10:30 booking at Clinic A block 10:30 at
     Clinic B. The unique index does the work; no new mechanism needed.
     If the lock were clinic-scoped, the same doctor could be double-booked
     across clinics. Do not change it.

2.2  TRAVEL TIME is the gap the lock does not close. Finishing at Clinic A at
     13:00 and starting at Clinic B at 13:00 is physically impossible.
     Doctor.travelBufferMin (default 0 = today's behaviour) is applied inside
     getSlotsForDoctor(): load the day's appointments across ALL clinics, and
     mark a slot unavailable when an appointment at a DIFFERENT clinic falls
     within [slot - buffer - duration, slot + duration + buffer].

2.3  OVERLAPPING AVAILABILITY at two clinics is allowed to exist (a doctor may
     genuinely be listed at both and decide later), but the calendar renders
     it as a warning band, and 2.1/2.2 stop it being bookable twice.


-------------------------------------------------------------------------------
3.  DOCTOR APPROVAL
-------------------------------------------------------------------------------
One Doctor row carrying a status, NOT a separate application table.

  enum DoctorStatus { DRAFT PENDING APPROVED REJECTED SUSPENDED }
  Doctor += status, submittedAt?, reviewedAt?, reviewedById?, rejectionReason?
  Doctor += regCouncil?, regNumber?, regYear?, licenceDocUrl?

Chosen because there is no field duplication, no materialisation transaction
on approval, the doctor edits ONE profile before and after approval, and
resubmission after rejection is a status change rather than a data copy.

THE COST IS LEAKAGE, and it is the single biggest risk in this build. A
pending or rejected applicant must never appear on the public site. Mitigation
is one exported predicate used by every public read:

  src/lib/queries/doctors.ts
    export const PUBLIC_DOCTOR_WHERE = {
      status: DoctorStatus.APPROVED,
      isActive: true,
    } as const;

Every one of these call sites must use it (audited during Phase 1):
  getDoctors(), getDoctor(slug)          src/lib/queries/doctors.ts
  bookAppointment()                      src/lib/actions/booking.ts
  getSlotsForDoctor()                    src/lib/queries/availability.ts
  the slots API route                    src/app/api/doctors/[slug]/slots/
  the doctors API route                  src/app/api/doctors/
  DoctorRecommendations feed             src/lib/queries/*

NOTE: getDoctor(slug) has NO isActive filter today. That is a pre-existing
hole, and it becomes a real one the moment unapproved doctors exist.


-------------------------------------------------------------------------------
4.  DOCTOR CONFIRMATION OF APPOINTMENTS
-------------------------------------------------------------------------------
AppointmentStatus.PENDING already means "payment pending", and `status` is
written from seven places. Overloading it would mean auditing all seven. So
approval is an orthogonal column instead:

  enum ApprovalState { AUTO AWAITING_DOCTOR ACCEPTED DECLINED }
  Appointment += approvalState @default(AUTO), approvedAt?, declineReason?
  Doctor      += requiresApproval Boolean @default(false)

  requiresApproval OFF  ->  AUTO, behaviour identical to today
  requiresApproval ON   ->  booking lands AWAITING_DOCTOR
                            THE SLOT IS STILL LOCKED so nobody else takes it
                            patient sees "Awaiting confirmation"
                            doctor sees a "Needs your confirmation" tray

Default AUTO means every existing doctor and every existing appointment is
unaffected.


-------------------------------------------------------------------------------
5.  DOCTOR-INITIATED RESCHEDULE AND CANCEL
-------------------------------------------------------------------------------
  enum ActorKind { PATIENT DOCTOR ADMIN SYSTEM }
  Appointment += rescheduledBy?, cancelledBy?, meetingUrl?

Rules:
  - A doctor reschedule is NOT subject to the patient's reschedule limit or
    min-hours window. Those settings protect the clinic from the patient, not
    the other way round.
  - The patient is ALWAYS emailed. This is the owner's explicit requirement.
  - No cancellation fee is ever charged to the patient on a doctor cancel.
  - A PAID appointment cancelled by the doctor is flagged in /admin/payments
    as "Refund due - doctor cancelled". It is NOT auto-refunded; money moving
    without a human decision is the wrong default.
  - rescheduledFromId finally gets written (declared since the initial schema,
    never populated).
  - meetingUrl satisfies D-10 ("create a meeting link and share it to the
    patient"). It rides along in the confirmation and reminder emails.


-------------------------------------------------------------------------------
6.  WHITE COLLAR
-------------------------------------------------------------------------------
  SubscriptionPlan  slug, name, interval MONTHLY|ANNUAL, priceInr,
                    discountPercent, scanCredits, priorityBooking,
                    waiveCancellationFee, perks Json, isActive, sortOrder
  Subscription      userId, planId, status ACTIVE|EXPIRED|CANCELLED,
                    startedAt, currentPeriodEnd, autoRenew, cancelledAt?,
                    razorpaySubscriptionId?
  PaymentPurpose   += SUBSCRIPTION
  Payment          += subscriptionId?
  Appointment      += subscriptionId?, discountInr @default(0),
                      isPriority @default(false)

Benefits, and what each one actually costs to build:

  B-1  DISCOUNT AT LISTED CLINICS
       plan.discountPercent applied to feeAtBooking inside bookAppointment().
       discountInr + subscriptionId are stored on the Appointment so the
       ledger and the Razorpay charge agree.
       >>> This is NEW code. DiscountGrant exists but nothing in the codebase
       redeems it programmatically -- it is a manual admin ledger row only.
       We are writing the redemption engine, not reusing one.

  B-2  PRIORITY APPOINTMENTS
       Appointment.isPriority set at booking from the active subscription.
       (a) a doctor rescheduling or cancelling a priority booking hits a
           confirmation gate and must give a reason;
       (b) a per-doctor priority hold -- N slots per day reserved for members
           until 24h out -- enforced inside getSlotsForDoctor().

  B-3  FREE SKIN SCANS
       plan.scanCredits granted per period on settle, via the existing
       grant(userId, "granted") in src/lib/integrations/skinEntitlement.ts.
       Cheapest benefit to build; the machinery already exists.

  B-4  BADGE THE DOCTOR SEES
       getDoctorAppointments() joins the patient's active subscription.
       Today that select pulls nothing from the patient's user record, so the
       join is new.

  B-5  WAIVED CANCELLATION FEE
       evaluateCancellation() takes a `member: boolean` and returns "free"
       where a non-member would pay. Clean, because policy.ts is pure with no
       data access.

  B-6  PRIORITY RECEPTION LINE -- copy only, no code. Uses the existing
       booking.reception_phone setting.

OUT OF SCOPE, deliberately, and the owner should know:
  - auto-debit renewal (DEC-3)
  - doctor payouts, settlement ledger, GST/PAN capture. The platform collects
    consultation fees into its own Razorpay account today and has no payout
    model. That is a finance project, not a portal feature.


-------------------------------------------------------------------------------
7.  THE CALENDAR
-------------------------------------------------------------------------------
Hand-built. No calendar library.

Reasons: the repo has zero date or calendar dependencies; FullCalendar and
react-big-calendar both do timezone conversion, which would fight the
CLINIC_UTC_OFFSET_MINUTES contract in src/lib/queries/availability.ts ("clinic
wall-clock is anchored to UTC; there is no timezone conversion anywhere"); and
the actual geometry is small -- a month is 42 cells, a day column is
absolutely-positioned blocks at minute offsets.

  /doctor/portal/calendar?view=month|week|day&date=YYYY-MM-DD&clinic=<slug>

Server component fetches the range; a client component owns view switching and
the detail drawer. Per-clinic colour comes from Clinic.colorKey so it is
stable and editable rather than hashed. A clinic filter row toggles locations.
Travel-buffer violations and overlaps render as a warning band.


-------------------------------------------------------------------------------
8.  ONBOARDING FIELD SET
-------------------------------------------------------------------------------
Asked for by the owner:
  name, qualification, doctor photo, clinic location, experience,
  hospital/clinic name, timings, before/after images (optional),
  clinic exterior photo, clinic interior photo

Added, because a medical marketplace is not credible without them:
  - REGISTRATION COUNCIL + REGISTRATION NUMBER + YEAR + licence document.
    This is what makes the existing `verified` badge mean something.
  - mobile + email (mobile OTP deferred)
  - specialty / sub-specialty, and the concerns treated (-> DoctorConcern)
  - services offered (-> DoctorService)
  - languages spoken (-> DoctorLanguage)
  - consultation modes: in-clinic / video / home visit (-> DoctorMode).
    NOTE: ConsultMode.HOME exists in the enum and is accepted by the booking
    action, but no code path has ever written it to DoctorMode. Fixing that
    is part of this work.
  - consultation fee PER CLINIC (different branches charge differently)
  - about / bio
  - full clinic address incl. pincode, plus lat/lng for "near me"
  - clinic facilities
  - per-clinic weekly timings with multiple windows per day
  - slot duration per clinic
  - travel buffer between clinics
  - alternate contact

Explicitly NOT collected: bank details, GST, PAN. See section 6.


-------------------------------------------------------------------------------
9.  BUILD STATUS   -  18 Aug 2026
-------------------------------------------------------------------------------
DONE
P1  Schema + migration 20260818090000_doctor_portal_clinics_subscriptions.
    PUBLIC_DOCTOR_WHERE in src/lib/queries/doctorAccess.ts, applied to all six
    public read sites.
P2  30 imported businesses deleted; 9 fictional clinics, 12 doctor-clinic
    links and 41 weekly windows seeded (prisma/seed-clinics.ts).
    prisma/import-clinics.ts disarmed so it cannot undo that.
P3  Per-clinic slots + travel buffer + priority hold in
    queries/availability.ts. Member pricing, clinic selection and approval
    state in actions/booking.ts. SUBSCRIPTION branch in payments/settle.ts.
P4  /doctor/join, seven steps, server-saved per step.
P5  New portal: Today, Calendar (month/week/day), Requests, My practice,
    Profile. Old two-tab portal and its AppointmentActions/PrescribeForm
    components deleted; prescribing and outcome-marking folded into the
    appointment drawer.
P6  /admin/doctor-applications with approve / send-back / pause.
P7  /patient/membership purchase flow, badge on the client profile and in the
    doctor portal, doctor-change emails in lib/doctor/notify.ts.
P8  Doctor homepage hero + practo-style steps (D-6); dismissible clinician
    strip on the client home.

NOT BUILT  -  deliberately, and worth deciding on
  - Admin CRUD for Clinic and SubscriptionPlan. Both are seeded and editable
    by a developer; neither has an admin screen yet. Clinics are currently
    only created through doctor onboarding.
  - Renewal reminder cron. Subscription.renewalNoticeSentAt exists and is
    reset on settle, but nothing sends the notice. Needs a route beside
    api/cron/reminders using the same CRON_SECRET pattern.
  - Auto-debit renewal (DEC-3).
  - Doctor payouts / GST / PAN (section 6).
  - Geocoding. Clinic.lat/lng exist and the demo data is populated, but no
    address is geocoded on save, so "clinics near me" cannot sort by distance
    for a real clinic yet.

VERIFICATION
  npx tsx prisma/verify-slot-rules.ts      travel buffer + double-booking
  npx tsx prisma/verify-doctor-portal.ts   leakage, approval, member pricing
  Both run against the live database and restore what they change.


-------------------------------------------------------------------------------
10.  BACKWARD-COMPATIBILITY RISKS
-------------------------------------------------------------------------------
R-1  Unapproved doctors leaking to the public site. Mitigated by section 3;
     must be verified by actually querying each public surface.
R-2  Existing appointments have no clinicId. Nullable column + backfill to the
     doctor's primary clinic. Every read must tolerate null.
R-3  Existing doctors default to status APPROVED and requiresApproval false,
     so nothing they have today changes.
R-4  deleteDoctor() refuses when appointmentCount > 0. The imported-clinic
     purge (DEC-4) has to clear their appointments first or use a dedicated
     script rather than the admin action.
R-5  The slot loop is `t <= end`, so a slot is generated AT endTime. Existing
     off-by-one; do not "fix" it silently while adding clinics, or every
     doctor's last slot of the day disappears.

===============================================================================
END
===============================================================================

===============================================================================
APPENDIX  -  FABRICATED-DATA PURGE, 19 Aug 2026
===============================================================================
A full audit of client-facing fake data, and what was done about each.

REMOVED  -  invented medical data
  simulateAnalysis() in the intake questionnaire built a complete skin
  analysis — overall score, skin type, twelve metric scores — by hashing the
  visitor's typed NAME, labelled it "Pulled from your last scan", and served
  it to anyone, signed in or not. Those invented concerns were then fed into
  doctor matching and submitted to the clinic.
  -> /api/skin/my-latest returns the real analysis, or says honestly that the
     visitor is not signed in, or that they have never scanned.

REMOVED  -  invented availability
  slotsForDoctor() / nextAvailable() were a seeded LCG. A hash of the doctor's
  slug decided which half-hours were "free". Rendered on doctor cards as
  "Free today", on the intake result and the analyzer as "Next free 10:30" —
  against real practitioners, immediately before a real booking. Doctors with
  no calendar showed times; doctors who were free showed "Fully booked".
  -> /api/doctors/availability, batched, from the real calendar. Three honest
     states: checking, nothing free this week, or actual times.

REMOVED  -  invented testimonials
  INTAKE_REVIEWS (3 invented clients) and an inline array on the analyzer
  landing (3 more), both under "Real people, real proof" / "What clients say"
  with a hardcoded five-star rating attributed to "clients across our clinics".
  -> /api/reviews/published, real Review rows an admin published. Renders
     NOTHING when there are none. There is deliberately no fallback.

REMOVED  -  invented urgency
  Deal cards showed "724 enquired" and a red "Today" countdown on a hardcoded
  string that never expired — and the empty-database fallback shipped those
  as live offers, so a fresh deploy advertised discounts nobody created.
  -> Enquiry counts gone. Deals come only from the CMS; empty means the rails
     hide themselves.

REMOVED  -  invented clinics
  clinicsNear() returned six invented addresses with invented distances and
  opening hours, and fell back to Chennai for any unmatched city. A client
  could have set out for a building that does not exist.
  -> /api/clinics, real Clinic rows. No distance is shown, because no address
     is geocoded yet and a figure we cannot compute must not be printed.

REMOVED  -  invented before/after clients
  Each case carried a quote attributed to invented initials and an age. The
  disclaimer covered the photographs, not the person.

REMOVED  -  false disclaimers over real data
  /patient/profile told clients their genuine appointments, prescriptions and
  payments were "sample records". The booking confirmation said "no
  appointment has been created" after creating one and taking payment.

FIXED  -  a real money bug
  bookAppointment accepted a clinicId and resolved a per-clinic fee, but
  NEITHER booking form sent one. Every booking silently landed at the primary
  clinic and was charged the primary clinic's price. Both forms now show a
  clinic picker, scope the slot list to it, and send it.
  Proof: prisma/verify-booking-clinic.ts

FIXED  -  browser Back
  Overlays opened from useState with no history entry, so Back left the page
  instead of closing them — losing a part-filled questionnaire. The doctor
  calendar pushed a history entry on every arrow press, so Back appeared dead.
  -> hooks/useBackToClose.ts: Back closes an overlay, and walks back through
     the questionnaire a step at a time. The calendar uses replace().
  -> /patient was a page that called redirect("/"), which trapped Back in a
     bounce. Now a config-level permanent redirect.

WIRED  -  a dead endpoint
  /api/skin/purchase was complete, correct and had no caller. A client who
  used their free scan could only ask an admin and wait — while the price was
  already being fetched by /api/skin/status and thrown away.

DELETED  -  dead components still carrying fabrications
  components/skin/SkinAnalyzer.tsx (fake testimonials, "10,000+ scans"),
  components/RoleModal.tsx.

STILL OUTSTANDING
  - .env has no RAZORPAY_KEY_ID / KEY_SECRET / WEBHOOK_SECRET, so no payment
    is ever taken; and no CRON_SECRET, so appointment reminders never send.
  - Anonymous intake responses are stored with userId null and never linked
    if that person later registers.
  - Clinic.lat/lng exist but nothing geocodes an address, so "near me" cannot
    sort by distance.

===============================================================================
APPENDIX B  -  BOOKING BECOMES A PAGE, 19 Aug 2026
===============================================================================

THE MODAL THAT WOULD NOT CLOSE
  Reported: "in all modal can't able to close in between."

  Cause, and it was mine. The back-button fix shipped two history managers on
  one stack: IntakeModal pushed an entry when it opened, and IntakeFlow pushed
  one per step. Clicking ✕ ran the shell's cleanup, which popped whatever was
  on top — a STEP entry, not the dialog's — leaving orphans behind that made
  Back appear dead for the rest of the session.

  Fixed by making it one owner. hooks/useBackToClose.ts now exposes a single
  useBackGuard: while active it keeps exactly ONE sentinel on the stack, and
  the component that has both a "close" and a "previous step" decides between
  them in one handler. IntakeModal deliberately has no guard at all.

  Two further hardening changes, because a dialog that will not close is worth
  over-fixing:
    - Every history call is conditional on our own token still being on top.
      If anything else navigated, we do nothing rather than risk popping a
      real page entry and throwing the user off the site.
    - The ✕ moved from inside the questionnaire's clipped column to the modal
      shell, at z-[120], where nothing a step renders can cover it.
    - The scroll lock is its own effect keyed on `open` alone. Bundled with a
      key handler and keyed on an unstable onClose, it was thrashing on every
      parent render, and a lost race left the page frozen after the dialog
      closed — which reads as "it will not close".

  Proof: prisma/verify-back-guard.ts models the history stack and drives the
  exact sequences that broke, including open → step 3 → ✕.

BOOKING IS NOW A PAGE
  /patient/book/[slug], modelled on /doctor/join.

  The dialog asked for a clinic, a day, a slot, a mode, a name, a phone and a
  payment confirmation inside a panel bounded to the viewport with its own
  internal scrollbar. On a phone the confirm button sat below a fold inside a
  fold.

  The page is one question per screen, with the step AND the selections in the
  URL. Three things fall out of that:
    - Browser Back walks the flow natively. No history interception at all.
    - A part-finished booking survives the sign-in round trip, which was the
      one place a client lost their work.
    - The clinic step is skipped entirely for a single-clinic doctor, so the
      flow is 4 screens instead of 5.
  Personal details (name, phone, notes) stay in component state — they have no
  business in a URL.

  DELETED: components/skin/BookingModal.tsx and components/hub/ConsultBooking.tsx,
  plus the inline booking panels in DoctorDirectory, IntakeResult and
  ConsultationStep. Every entry point now links to the page.

  This matters beyond tidiness: there were TWO booking implementations, and
  that is exactly how the clinic-id regression went unnoticed — one was updated
  to send the chosen clinic and the other silently was not, so half the
  bookings landed at the wrong branch at the wrong price. One flow now.

===============================================================================
APPENDIX C  -  THE QUESTIONNAIRE BECOMES A PAGE, 19 Aug 2026
===============================================================================
Reported: "why still there is form is in popup modal".

Appendix B converted the BOOKING flow to a page. The form in the screenshot
was the consultation questionnaire, which was still a dialog. It is now a page
too, and the dialog is gone rather than deprecated.

WHAT CHANGED
  - components/hub/IntakeModal.tsx    DELETED.
  - KnowYouCta's five variants (banner, advice, nav, rail, button) are now
    plain <Link>s to /patient/know-you. They need no client JavaScript, work
    on middle-click and long-press, and get Back for free.
  - IntakeFlow lost its `variant` prop entirely. That took roughly 4,400
    characters of machinery with it, all of which existed only because a
    dialog clips its own overflow:
      * the fixed-height flex column and its min-h-0 chain
      * the ResizeObserver + measure() that drove edge fades
      * the "Scroll for more ↓" pill
      * the two-variant progress band and action bar
      * the history guard needed to make Back close the dialog
    On a page the document scrolls, `sticky` pins, and Back is a real
    navigation. None of it was needed.
  - The question column widened from 27rem to max-w-xl and the type scaled up.
    A dialog column is narrow because a dialog is narrow; on a page it just
    reads as a dialog that lost its backdrop.

THE TELL, IN HINDSIGHT
  KnowYouCta used to offer "Open as a full page" beside the button that opened
  the dialog. Offering the page as the escape hatch was an admission that the
  dialog was the worse option for a seven-step form with photo uploads.

WHAT IS STILL A DIALOG, DELIBERATELY
  - components/RoleChooser.tsx — the first-visit "client or clinician?" ask.
    Two buttons, no form.
  - components/doctor/AppointmentDrawer.tsx — a detail panel in the doctor
    calendar. Opening it must not lose the week behind it.
  - components/EnquiryModal.tsx — a six-field contact form on the treatment
    and product reference pages. Short, and making it a page would cost the
    reader their place on a long article. Left as-is.

ORPHANS REMOVED IN THE SAME PASS
  components/TreatmentImages.tsx, components/hub/HubHero.tsx,
  components/patient/ProfileView.tsx, components/skin/ProfileSkinSection.tsx,
  data/nav.ts — none had an importer. data/treatments.ts looks orphaned to a
  sweep but is read by prisma/seed.ts, and now says so at the top.

  Dead components are not merely untidy: two live booking implementations are
  exactly how the clinic-fee regression went unnoticed.

===============================================================================
APPENDIX D  -  AUTH, ROLE AND THEME AUDIT, 19 Aug 2026
===============================================================================

THE ROOT CAUSE OF "YOU ARE SIGNED IN AS A CLIENT"
  RegisterForm hardcoded `accountType: "patient"`. EVERY account created
  through /register was a client, including clinicians who had arrived from
  the practitioner side — who then met that message on /doctor/join with no
  button that did anything about it.

  Fixed in four places, because one was not enough:
   - RegisterForm reads `?as=doctor` and sends the right accountType.
   - LoginForm's "create an account" link appends `&as=doctor` when the
     callbackUrl points at the doctor side. Without this the fix above was
     unreachable: nothing in the codebase linked to /register?as=doctor.
   - The register page heading changes to "Create your clinician account" so
     nobody completes the wrong form by accident.
   - /doctor/join now offers a real "Sign out and register as a clinician"
     button that returns to /doctor/join once the session clears.

SIGN-IN NO LONGER SENDS ANYONE SOMEWHERE THEY CANNOT GO
  lib/roles.ts gained canRoleOpen() and postLoginPath(). A callbackUrl is
  honoured only when the account can actually open it; otherwise the user goes
  to their own landing page. A client clicking "Doctor sign in" used to be
  pushed to /doctor/portal and bounced to /forbidden.

  Every post-auth redirect goes through it now — LoginForm, RegisterForm, and
  the already-signed-in guards on /login and /register, which previously
  discarded the callbackUrl entirely.
  Proof: prisma/verify-auth-roles.ts (25 cases, incl. refusing an absolute URL)

AUTH-BLIND UI
  /doctor offered "Doctor sign in" and "List your practice" to people already
  signed in and already listed. JoinHero, SimpleSteps and the closing CTA now
  take a `viewer` and say "Open your portal" / "Finish your listing" instead.
  The Footer's "Doctor sign in" — rendered on nearly every page — is gated the
  same way. RoleChooser no longer asks a signed-in user who they are.

THE GHOST TOOLTIP, AND WHY IT WAS A WHOLE CLASS OF BUG
  The navbar's hover tagline used bg-white/[0.04] — a dark-theme translucent —
  so on the light doctor chrome it rendered as a near-invisible box floating
  over the hero. It was also hover-only, so it did not exist on touch. Removed
  from the bar; taglines still appear in the mobile drawer where there is room.

  The same collision was everywhere:
   - .btn-ghost is white-on-white inside .theme-light — the Cancel button on
     every admin form, and on the "signed in as a client" screen itself.
   - .sheet is dark navy while .theme-light .text-ink is dark slate, so the
     ACCOUNT DROPDOWN was unreadable for every doctor and admin.
   - .chip, .card-soft and every border-white/* hairline, likewise.

  Fixed once in globals.css with .theme-light forms of those classes rather
  than at ~20 call sites, so a component used in both contexts keeps one class
  name and looks right wherever it lands.

OTHER FIXES
  - RoleAwareNavbar was falling back to the CLIENT cta and chrome, so doctors
    reading a treatment page saw the "Know About You" pill.
  - "My Profile" removed from the client nav AND the footer — it is in the
    account menu, which is where people look for their own records.
  - AccountMenu's doctor list had two rows pointing at /doctor/portal.
  - BrandLogo was dark-on-dark on /patient/know-you and /patient/book/[slug].
  - SkinReport's print background had been changed to 4% white by an earlier
    find/replace, so "Download PDF" printed near-transparent.
  - Breadcrumbs labelled "Treatments"/"Products" pointed at the practitioner
    recruitment page; /doctor#treatments was a dead anchor.
  - "Request clinical access" scrolled to a footer instead of requesting
    anything — now a mailto.
  - Two dead ends given actions: the doctor profile page with no linked record,
    and /doctor/join's "ask us to link you" with nothing to ask with.
  - Orphan removed: components/hub/LocationGreeting.tsx.

STILL OPEN, DELIBERATELY
  - A doctor signing out of the portal lands on / (the client home) rather
    than /doctor. Defensible either way; not changed.
  - EnquiryModal remains a dialog — six fields, and making it a page would
    cost the reader their place in a long article.

===============================================================================
APPENDIX E  -  A LOGIN WITH NO PRACTICE, 19 Aug 2026
===============================================================================
Reported: a doctor registers, opens /doctor/join, and is told "No practice
record yet — send us a note".

CAUSE, AND IT WAS INTRODUCED BY THE PREVIOUS FIX
  A practitioner login and a practice record are two rows. They were created
  together in exactly ONE place: /doctor/join's own first step
  (startDoctorSignup). Appendix D made /register?as=doctor work — which
  created DOCTOR users through a second path that made the login and nothing
  else. Every one of those accounts arrived at the dead end.

  It was never only the new path. The same hole swallowed:
   - any login an admin gave the Doctor role in /admin/users
   - any signup where the account was created and the rest then failed

FIX
  lib/doctor/ensurePractice.ts — idempotent, returns the existing record when
  there is one, creates a DRAFT when there is not. Used by both paths:
   - /api/auth/register creates the login and the draft practice in ONE
     transaction, so a half-made account is not a state the app can reach.
   - /doctor/join calls it on render and simply continues into the wizard. A
     DOCTOR with no practice IS somebody who needs to onboard; making the
     draft is the answer, not asking them to email us.

  ADMIN is excluded on purpose. Administrators can open /doctor/join because
  middleware treats ADMIN as a superset of DOCTOR, and creating a practice for
  them would put a staff account in the practitioner directory.

  The "no practice" screen still exists but now says the truth — that creation
  failed at our end — and offers Try again plus a contact link.

  Proof: prisma/verify-doctor-signup.ts. Exercises the register path, the
  admin-made path, repeat calls, two practitioners with identical names, and
  checks a draft never reaches the public directory. Cleans up after itself.

WHAT A NEW PRACTICE LOOKS LIKE
  status DRAFT, isActive false, and every display field EMPTY rather than
  invented — the wizard fills them in. A half-finished application must never
  read as a real listing.

===============================================================================
APPENDIX F  -  PORTAL SHELL, AND WHAT IS STILL PENDING
===============================================================================

THE SHELL
  The portal was assembled from the ADMIN component set — PageHeader, Table,
  EmptyState — on a grey page behind a row of underlined tabs. That is a
  back-office look, and it is why the portal read as an internal tool beside
  the client experience.

  It now has a dark navy rail carrying the brand, navigation, the practice's
  live/draft status and the Requests count, with the working canvas staying
  LIGHT. Deliberately not the client side's dark theme: this is read across a
  whole clinic day, and the calendar's per-clinic colour swatches need a
  high-contrast ground. Dark chrome, light canvas — the pattern pro tools use.

  components/doctor/portalUi.tsx is the portal's own primitive set, kept
  separate from admin/ui.tsx rather than shared. The two surfaces have
  different jobs and will keep diverging; one shared set means every change to
  either has to be checked against both.

  Removed: DoctorPortalNav (the tab strip the rail replaces).

===============================================================================
PENDING  -  verified against the codebase, 19 Aug 2026
===============================================================================

BLOCKED ON THE OWNER — nothing works until these arrive
  1. RAZORPAY_KEY_ID / KEY_SECRET / WEBHOOK_SECRET absent from .env.
     Every payment path degrades silently: appointments confirm without
     charging, the membership cannot be bought, the webhook returns 503.
  2. CRON_SECRET absent. /api/cron/reminders refuses to run, so no appointment
     reminder has ever been sent.
  3. Images: 1.1 GB under public/, not in git, and 588 database rows point at
     local /images/... paths (384 hub treatments, 145 media assets, 30
     categories, 18 clinic photos, 7 doctors, 4 banners). They must be rehosted
     to S3/CloudFront before any deploy or every one of them 404s.
     S3_BUCKET and CDN_BASE_URL are already configured; prisma/rehost-images.ts
     exists for exactly this.
  4. No deploy target in the repo — no vercel.json, CI workflow, Dockerfile or
     Procfile, and no deploy CLI installed.

ADMIN CRUD NOT BUILT
  5. Clinic. Clinics can only be created through doctor onboarding. An admin
     cannot add, edit, merge or deactivate one.
  6. SubscriptionPlan. Seeded by script; price, perks and benefits are only
     editable by a developer.

SUBSCRIPTION
  7. Renewal reminders. Subscription.renewalNoticeSentAt exists and is reset on
     settle, but nothing sends the notice. Needs a cron route beside
     api/cron/reminders.
  8. Auto-debit. One-time orders per term by design (DEC-3). Real recurring
     billing needs the Razorpay Subscriptions API and dashboard Plans.

DATA GAPS
  9. Geocoding. Clinic.lat/lng exist and the demo data is populated, but no
     address is geocoded on save, so "clinics near me" cannot sort by distance
     for a real clinic.
  10. Anonymous intake responses are stored with userId null and are never
      linked if that person later registers — so the doctor's pre-read never
      finds them.
  11. Appointment.confirmationSentAt is declared and written nowhere.
  12. Prescription.fileUrl is writable from admin but not from the doctor's
      prescribe form — a doctor cannot attach a PDF.

SCALE / ROBUSTNESS
  13. No pagination anywhere in the portal or admin — three hard take:200 caps.
      A busy practice silently loses rows past 200.
  14. Rate limiting is in-memory per process (lib/rateLimit.ts). It stops
      working the moment the app runs on more than one instance.
  15. No in-app notifications. Everything is email.

BRIEF SECTIONS NOT STARTED  (docs/requirements-brief.txt)
  16. Sec 4 — CME Corner: Be Our Speaker, Learn Forever, exhibitions,
      the ~USD 10 study-material subscription. Nothing exists.
  17. Sec 5 — Inventory Corner: doctors ordering supplies, vendor onboarding.
  18. Sec 6 — Setup Clinic: franchise enquiry, equipment leasing.
  19. G-4 — the hair analyzer. Blocked on Q-8 (who supplies it).
  20. A-1/A-2 — AI-search optimisation. Zero schema.org/JSON-LD in the app and
      no llms.txt. This one is cheap and was the stated reason the entry UX
      avoids a modal gate.

---

## Appendix G — "can't access the portal"

Reported as *"still in white theme design is not changed in doctor portal and
can't able to access portal and calender also etc for doctor"*. The redesign
was in fact live; the report was about not being able to reach it. Three
separate defects sat between the reader and the page.

**1. The nav pointed at a brochure.** `buildDoctorMenu()` gave every reader
`{ label: "Your portal", href: "/doctor#portal" }` — an anchor scrolling to the
marketing *section about* the portal. A signed-in practitioner clicking "Your
portal" therefore landed on a white marketing page, which is exactly what the
report describes. The menu now takes `{ hasPortal }`: a listed practitioner
gets `/doctor/portal`, a stranger keeps the anchor, relabelled "The portal" so
it stops claiming ownership.

**2. The refusal page was a dead end.** The reader was signed in as a PATIENT
(`karan`), so middleware correctly bounced them — to a page reading *"your
account doesn't have the right permissions… contact your administrator"*. On a
consumer platform there is no administrator to contact, and the reader is
rarely a stranger; they are usually one person holding both a client and a
practitioner login, signed in with the wrong one. The page now names the
refused account, says what the destination needs, and offers the switch. A
client refused at the portal is also offered `/doctor` — some of them are
practitioners who never registered as one. Middleware and `requireRole()` both
forward the attempted path as `?from=` so the page can say any of this.

**3. An open redirect, found on the way.** `postLoginPath()` sanitised its
`callbackUrl` with `startsWith("/")` alone. `//evil.com` and `/\evil.com` both
pass that test and both are read by browsers as protocol-relative URLs pointing
at another host, so `/login?callbackUrl=//evil.com` sent the user off-site after
a successful sign-in — a phishing link genuinely hosted on our own domain. One
`internalPath()` helper in `lib/roles.ts` now guards both `postLoginPath()` and
the new `?from=`, so the two cannot drift apart.

Verified end to end against a running server with minted session cookies, since
none of this is reachable without one:

| Account | `/doctor/portal` |
| --- | --- |
| `dr.test@bluderma.local` (APPROVED) | 200, dark rail |
| `velu3prabhakaran@gmail.com` (DRAFT) | 200, dark rail + "not submitted yet" |
| `karanneeraj253@gmail.com` (PATIENT) | 307 → `/forbidden?from=/doctor/portal` |

All five portal routes return 200 for both doctor accounts. `prisma/verify-portal-access.ts`
(29 checks) covers the menu, the path hand-off, the refusal copy, and the
sanitizer.

---

## Appendix H — uploads, and moving the imagery to S3

Reported as *"image is not able to upload"* on the onboarding photo field, with
the field showing "Upload failed. Please try again or paste a URL."

### Why it failed

Nothing was wrong with the credentials, the presign endpoint, or the bucket
permissions to write. `HeadBucket`, `GetBucketLocation` and a server-side
`PutObject` all succeeded on first try. **The bucket had no CORS configuration
at all.**

Uploads go straight from the browser to S3 via a presigned PUT, so the browser
sends a cross-origin preflight first. A bucket with no CORS rules refuses that
preflight, which makes `fetch` *throw* rather than return a failed response —
so the code fell through to the outer `catch`, whose message was the generic
"Upload failed. Please try again or paste a URL." The far more useful branch
("rejected by storage. Check bucket CORS") sat on `!put.ok` and could never run,
because the request never completed.

### A second failure hiding behind the first

Fixing CORS made the PUT succeed — and the uploaded image then returned **403
on read**. The bucket policy granted public read to `bluderma/*`, but
`buildKey()` writes to top-level prefixes (`doctors/`, `clinics/`, …). Nothing
the app had ever uploaded was covered by it. Both halves are now applied by one
idempotent script, `prisma/setup-s3.ts`.

Public read is an **allow-list**, not a wildcard, because two prefixes must
never be readable without a signature:

| Prefix | Why |
| --- | --- |
| `credentials/` | Medical registration certificates. The onboarding form tells the doctor it "goes to our review team and nowhere else". |
| `prescriptions/` | Patient medical documents. |

Those are reached through `/api/uploads/view`, which authorises **per object,
not per role**: an admin may open any of them; a doctor may open their own
certificate; a patient or a doctor may open a prescription that is theirs;
everyone else gets 403. Uploading an object also counts as owning it, which is
the only proof available between the upload finishing and the form being saved
— the window in which the doctor is looking at a preview of their own
certificate.

Verified live, against the running app with minted sessions:

| | result |
| --- | --- |
| preflight from `localhost:3000` / `127.0.0.1:3000` | 200 |
| preflight from another port / `evil.example` | 403 |
| presigned PUT | 200 |
| public read of the uploaded portrait | 200 |
| doctor presigning into `treatments/` | 403 |
| certificate read anonymously from S3 | 403 |
| certificate via `/api/uploads/view` — owner / admin | 307 |
| certificate via `/api/uploads/view` — other user / signed out | 403 |

### Moving the existing imagery

The app served ~1.1GB of imagery out of `public/`, which works on one machine
and stops working the moment it runs anywhere that does not carry that folder.
`prisma/rehost-local-images.ts` uploads it and rewrites the rows. It is
idempotent and resumable — a URL already on our base is skipped, an object
already in the bucket is not re-uploaded, and the key is derived from the path
so a re-run produces the same key.

Result: **1,716 files uploaded (870MB), 2,164 column values rewritten across 15
columns in 12 tables, 0 rows still pointing at `public/`.**

Eight further paths are written into source rather than stored in a row (a hero
background and the fallback avatar pool). They are uploaded too and resolved at
render time by `src/lib/assetUrl.ts`, which returns the path untouched when
`NEXT_PUBLIC_ASSET_BASE_URL` is unset — so a missing variable degrades to
serving from `public/` rather than to a broken image.

`public/images` itself is left in place. Nothing in the database or the source
depends on it any more, so it can be deleted once a deploy has been seen
working, but that is a decision to make deliberately rather than a side effect
of this change.

### Before going live

`S3_CORS_ORIGINS` must gain the production domain and `prisma/setup-s3.ts` must
be re-run, or uploads will fail in production exactly as they did locally. The
upload origin list is deliberately explicit — `PUT` is never open to `*`.

`prisma/verify-uploads.ts` (34 checks) covers key building, the public/private
split, URL round-tripping, the view route's authorisation, the client's error
branches, and the live bucket CORS and policy.

---

## Appendix I — the visit intake, doctor links, and the report chain

### The problem

A booking reached the doctor as a name, a time, and an optional free-text note
that patients almost never filled in. The portal could truthfully say only that
*"the appointment was scheduled"*. Every consultation therefore started with the
doctor asking questions the patient had already had a form open to answer.

### What the patient now answers

Five required questions on their own step, between choosing a mode and giving
contact details. All five are one tap except the description:

| Field | Why it is required |
| --- | --- |
| `reason` (12 fixed options) | Triage. A fixed list can be sorted, counted and coloured; free text cannot. |
| `reasonDetail` (min 10 chars) | The list cannot carry "it flares when I use retinol". |
| `symptomDuration` | A rash of three days and a rash of three years are different consultations. |
| `severity` 1–5 | Worded as impact on daily life, not as a clinical grade — a patient cannot grade their own acne, but they know if it stops them going out. |
| `isFirstVisit` | Decides slot length and whether notes exist to read. |

Optional history follows on the details step: what they have already tried,
current medication, allergies, and anything else. `allergies` renders on the
doctor's side even when blank — as *"None reported"* — because an empty row
reads as "not asked", and it always is asked.

Two additions the brief did not ask for but that dermatology needs:

- **Photo consent**, asked once and recorded on the booking. Clinical
  photography is routine and consent for it is not something to assume. The
  drawer says *"Not given — ask before photographing"* rather than staying
  silent.
- **Age and sex, snapshotted** onto the appointment from the profile rather
  than joined. Both change how a presentation reads, and a profile edited next
  year must not change what the doctor was told at the time.

### Where it surfaces

Today's list and the requests queue carry a one-line summary under the patient's
name, so a doctor never has to open a row to find out what it is for. Severity
4–5 renders in rose and prefixes the doctor's email subject with `[Urgent]`.
The drawer gets a full **"Why they are coming"** section placed *above* money
and logistics. The patient sees their own answers read back on
`/patient/appointments` — someone who cannot see what the clinic was told has no
way to notice it is wrong.

### The skin report

The attach control used to sit behind a button and only reveal what it knew
once pressed, so a patient with no scan pressed it and got what looked like
nothing. `SkinReportAttach` asks on mount and states the answer: here is your
report, or you have none and here is a free scan.

One bug found while wiring it: `/api/skin/my-latest` returns the newest of two
different systems — the legacy `SkinAnalysis` simulator and the camera
`SkinScan` — as a bare `id`. A single foreign key would have silently dropped
every camera scan. The API now says which system the id belongs to and the
appointment carries `skinAnalysisId` **and** `skinScanId`. Ownership is
re-checked server-side either way; a scan belonging to somebody else is dropped
rather than failing the booking.

### Doctor links

`Doctor` gains `instagram`, `facebook`, `linkedin`, `youtube` beside the
existing `website`. People type these three ways — `@drmenon`, `drmenon`, or the
full URL — so `lib/social.ts` normalises all three to a full https URL on save.
A LinkedIn URL pasted into the Instagram field is dropped rather than saved,
because the icon would otherwise lie about where the link goes.

The portal profile also gained **"How your listing reads"** — the listing
rendered exactly as a client sees it, plus a list of what is missing from it. A
practitioner asking why nobody books them was usually looking at a listing with
no photo, no languages and no links, and had nowhere that said so.

### Mobile

Two real defects fixed: the reschedule slot picker ran four columns on a 360px
screen (now three, four from `sm`), and the marketing week preview squeezed five
168px-tall day columns onto a phone (now scrolls inside its own container). The
admin table and the month calendar were already handling narrow screens
correctly and were left alone. All new controls are full-width stacked cards on
mobile and only go two-up from `sm`.

### Verified

`prisma/verify-visit-intake.ts` — 66 checks covering required-field enforcement,
the enum vocabulary being complete, triage thresholds, the email block, social
normalisation including hostile hosts and credentialed URLs, and that each
surface is actually wired. Proved live against a running server: a seeded
booking rendered as *"Hair loss or thinning · More than a year · 4/5 · Marked ·
First visit"* on Today, in the requests queue, and through the drawer's API.

### Known gap

The doctor's social links are editable and visible in the portal but are not yet
rendered on the public booking page — that surface takes a cast DTO which would
need widening. Deliberately left rather than half-wired.

---

## Appendix J — the nativeEnum crash, and patient photographs

### "Cannot convert undefined or null to object"

`/doctor/portal/requests` threw at `validation.ts:104`, inside
`z.nativeEnum(VisitReason, …)`. The enum was `undefined` at that moment.

The cause was not the code — the same page returned 200 on a server started
after the migration. It was a **dev server started before `prisma generate`**:
Node had already cached the old generated client, so `VisitReason` did not
exist on it, and `z.nativeEnum(undefined)` threw while rendering a page that
had nothing to do with validation. A restart fixes the symptom.

Reading a generated enum as a *runtime value* is the underlying fragility,
though: it couples every schema to whether `node_modules` happens to be current,
and drags `@prisma/client` into any bundle that validates input. The schema now
takes its permitted values from `VISIT_REASON_VALUES` / `SYMPTOM_DURATION_VALUES`
in `lib/booking/visitIntake.ts` — plain string literals — and imports the Prisma
enums as **types only**. The suite compares those arrays against the real enum,
so they cannot silently drift.

### Patient photographs

`AppointmentPhoto` (up to four per booking), attached on the details step and
shown in the doctor's drawer.

These are clinical images of a named person, so `patients/` is a **private**
bucket prefix — added to `PRIVATE_PREFIXES` in both `prisma/setup-s3.ts` (which
enforces it) and `lib/storage.ts` (which knows to sign). Nothing here is
publicly readable, and the drawer renders each thumbnail through
`/api/uploads/view` rather than at the stored URL.

Authorisation is per-object:

| Who | Result |
| --- | --- |
| The patient who attached it | 307 — signed link |
| The doctor whose appointment it is | 307 — signed link |
| **A different doctor** | **403** |
| Signed out | 403 |
| Anonymous, direct from S3 | 403 |

Uploads are scoped the same way: a PATIENT may presign into `patients/` and
nowhere else — `doctors/`, `treatments/` and `credentials/` all return 403.
Keys are re-checked server-side against `MediaAsset.uploadedById` before being
attached, so a key belonging to somebody else cannot be bolted onto a booking
and then read back through the signed route.

`capture` is deliberately not set on the file input. Most of these are taken on
a phone, but forcing the camera would block the common case of choosing a photo
taken last week when the flare was at its worst.

### Verified

`prisma/verify-visit-intake.ts` grew to 87 checks, including that the public
prefix list never contains `patients`, `credentials` or `prescriptions` —
scoped to that array specifically, because a loose match runs on into the
private list and passes for the wrong reason. Proved live: upload, scoping
refusals, and the full four-way access matrix above. Probe appointment, photo
and bucket object all deleted afterwards.

---

## Appendix K — invisible text on /patient/appointments

The site is dark by default: `text-ink` is near-white, and the standard raised
surface is a wash of translucent white over navy. `.theme-light` is the escape
hatch that flips both.

`/patient/appointments` set a light **background** (`bg-[#f7fafc]`) and never
added the **class**. So near-white ink was drawn on a near-white page, over
cards whose 4% white wash over `#f7fafc` is just `#f7fafc`. The doctor's name,
the date, "In clinic", "Reschedule" and "Cancel" were all technically rendered
and all invisible. The one readable element was the Confirmed pill, because
that single entry in `STATUS_STYLE` had already been corrected to a dark green
while its four siblings still used dark-theme colours.

An audit of every `page.tsx` and `layout.tsx` found this was the **only** page
with a light background and no `theme-light` — admin, doctor/join and the
doctor portal all had it.

Three fixes, in increasing order of reach:

1. **The page** now declares `theme-light`.
2. **`STATUS_STYLE`** uses dark ink on a tinted ground for all five states.
   `text-rose-300` / `text-brand-200` / `text-teal-300` in the two components
   that render only on this page were darkened to their 700 steps. `text-white`
   was left alone where it sits on a saturated fill — the gradient hero and the
   coloured buttons — which is the only place white reads.
3. **The escape hatch itself** was incomplete. It flipped ink, borders and
   `.card`, but not the `bg-white/[0.0x]` raised-surface idiom that appears 120
   times across the app, nor `ring-white/*`. Those now resolve to real white and
   slate surfaces inside `.theme-light`, so the next light page works without
   anyone rediscovering this.

### A test that did not test anything

`prisma/verify-theme.ts` sweeps every page for a light background without the
class. Its first pattern ended in `\b` — and a word boundary after `]` never
matches, so it skipped `bg-[#f7fafc]`: the exact class that caused the bug. It
reported 0 offenders on the unfixed code.

Caught by running the detector against known inputs rather than trusting a
green result. Each alternative now carries its own right-hand guard, and the
detector is checked against nine cases including `bg-slate-500` and
`bg-white/[0.04]`, which must NOT flag. 25 checks total.

---

## Appendix L — the migration/dev-server trap

Three separate reports in one session — `Cannot convert undefined or null to
object`, then `Invalid prisma.appointment.findMany()` on `/doctor/portal/requests`,
then the same on `/doctor/portal` — all had one cause, and none of them were
in the code.

`next dev` loads `@prisma/client` into memory once at boot and caches it for the
life of the process. It also holds `query_engine-windows.dll.node` open, so
`prisma generate` cannot replace the engine and reports `EPERM` — harmless in
itself, because the engine binary is versioned with the Prisma package rather
than with the schema. What matters is that the **generated JavaScript** is
rewritten, and a server started before that happened keeps answering from a
client that has never heard of the new columns.

The evidence was unambiguous once looked for:

```
prisma client written : 13:23:20
dev server started    : 12:16:51   ← 66 minutes earlier
```

and the exact failing query ran clean in a fresh process. Nothing in the
codebase can repair a module already cached in another process.

**`npm run db:apply`** (`prisma/apply-migrations.ts`) now applies migrations,
regenerates, checks whether the client JS was actually rewritten, distinguishes
the harmless engine-lock EPERM from a real failure, and prints an unmissable
restart notice when one is needed.

One genuine code fix came out of this: `validation.ts` had read `VisitReason`
as a runtime *value* from the generated client, so a stale client made
`z.nativeEnum(undefined)` throw during render — a crash in input validation
caused by an unrelated `node_modules` state. It now uses literal string values
and imports the Prisma enums as types only. That removed the first of the three
symptoms permanently; the other two were always going to need a restart.

---

## Appendix M — white cards on a dark page, ₹0, and the locked name

### The inverse theming bug, and this one was mine

Appendix K fixed a light page rendering dark-theme text. This is the mirror
image: `PhotoAttach` and `SkinReportAttach` — both written earlier in this
session — used solid `bg-white` cards with `text-ink` headings. `text-ink` is
near-white in the dark theme, and the booking wizard is dark, so "Photos of the
area" and "Your skin report" were white text on white cards. The only visible
thing in either was the one button with a saturated fill.

Both now use the wizard's own idiom — `bg-white/[0.04]` with `ring-white/10` —
and their accents moved to the 300 steps. That markup is also correct on a
light page, because `.theme-light` maps it; a hardcoded `bg-white` can only
ever be right on one of the two.

`verify-theme.ts` gained a guard over `src/components/booking`: no solid light
surface, and no dark-step accent that is not sitting on a saturated fill. It
was checked against the exact string that shipped
(`border border-slate-200 bg-white p-4` → flags) and against six things that
must not flag, including `bg-white/10` and `bg-brand-500/[12%]`.

### ₹0

Not a bug in the data — `0` is the documented way to say "on enquiry", and the
onboarding field says so. The profile header just rendered it literally as
`· ₹0 · 0★ (0)`, which reads as broken. It now says **"Fee on enquiry"** and
**"No reviews yet"**, and points at *My practice*, where fees actually live
(they are per-clinic since the multi-clinic work — `Doctor.fee` is only the
legacy headline, synced from the primary).

### The name

`updateOwnProfile` deliberately excluded `name`, on the reasoning that a
practitioner should not be able to inflate their own standing.

That reasoning does not survive contact with the rest of the form. The same
doctor could already rewrite their photograph, headline, specialty and
biography — the whole of how they present. Meanwhile `verified`, `rating`,
`reviews`, `fee`, `status`, `regCouncil` and `regNumber` are all admin-only,
and those are what actually carry standing. Locking the one remaining field
prevented no impersonation, and guaranteed that anyone whose account was opened
under a company name or with a typo could never fix it — which is exactly what
had happened: a practice listed as "Race Auto India" with no way to correct it.

The name is now editable, and a change is recorded in the audit trail with both
the old and new value so it stays reviewable.

An intermediate design — editable until approved, admin-only afterwards — was
built first and then removed. It read as a reasonable compromise but did not
help the actual case: the profile had already been approved, so it would have
left the same dead end while adding a rule to explain.

---

## Appendix N — the onboarding-first portal, AI assist, and the dashboard

Four phases, built against docs/plan `glowing-hugging-falcon`.

### 1. The portal is the application

A practitioner used to sign up and land on a marketing page asking them to list
their practice — having just done exactly that — then be walked through a
wizard on a separate route while the portal sat behind it showing three empty
tiles. Signup now lands in `/doctor/portal`, and until the listing is approved
that page **is** the application.

The step components were not forked: they take `redirectTo`/`nextHref`/
`backHref` as props defaulting to today's literals, so `/doctor/portal/practice`
(which already hosted two of them in `mode="manage"`) is untouched.
`/doctor/join` stays public for step 0 and redirects signed-in doctors
**preserving `?step=`**, so every link ever emailed still lands correctly.

Two defects fixed on the way:

- **`applicationGaps` was an exported server action taking a `doctorId`** — a
  public endpoint that would tell any caller which fields any practitioner was
  missing. It is now a plain module, `lib/doctor/gaps.ts`.
- **Two disagreeing "what's missing" lists** (8 blocking items in the wizard, 6
  different advisory ones on the profile) are one list with a `blocking` flag.

A live check caught the progress counter reading **"-2 of 6 done"** — it
subtracted *gaps* from *steps*, and step 1 alone holds four gaps.

### 2. AI assist that works without a key

Every field is usable unconfigured, which is how it shipped and how it was
tested: specialty is a curated combobox, treatments search the real 384-name
catalogue, the address comes from India Post, and the About box is a plain
textarea. Only *drafting* and *long-tail matching* need the key.

**The anti-hallucination guarantee is structural, not a prompt.** The model is
handed the catalogue and told to choose from it — and the answer is then
intersected with that catalogue regardless. `["Botox", "Quantum Skin Reversal"]`
returns `["Botox"]`. An invented treatment cannot reach a profile even if the
instruction is ignored entirely.

**Addresses are never generated.** `api.postalpincode.in` is free, keyless and
real; a PIN code is the one field a doctor cannot sanity-check by reading it
back, so no model is asked to produce one. Every failure mode leaves the form
manual.

A live test caught the model writing **"he"** about a practitioner whose gender
was never supplied — inferred from the name. The prompt now forbids gendered
pronouns outright, and the templates never used them.

### 3. The dashboard

Revenue is **appointment-derived**: `Payment` has no `doctorId` and no rows.
Because `COMPLETED` is set by hand, a single total keyed on it would quietly
under-report every untidy diary — so there are four tiers, including an
**`unresolved`** bucket for visits that happened and were never closed. That is
a nudge, not a hidden fudge, and the UI explains it.

Projections are arithmetic and say so. Capacity reproduces the inclusive
`t <= end` slot endpoint from `availability.ts` — 09:00–10:00 at 30 minutes is
**three** slots — or the dashboard would disagree with the booking grid the same
doctor can see. Every rate carries its sample and prints "—" below five.

### 4. Insights, cached once a day

`DoctorDailyInsight` is keyed on the **clinic wall-clock day** — 19:00Z is
already tomorrow in Chennai, and a UTC key would roll the cache at 05:30,
mid-clinic. The unique key makes concurrent first-renders idempotent.

The model receives computed metrics and is told to quote them verbatim; it is
never asked to calculate. **Every number in the generated prose is then checked
against the metrics it was given, and one unsupported figure discards the whole
response.** Blunt on purpose: a doctor reading an invented "₹48,000" is worse
than a plainer sentence that is true. The strip labels itself "AI suggestions"
or "Practice pointers" so a deterministic set is never passed off as more.

### Verified

14 suites, 500+ checks. New: `verify-onboarding-portal` (57),
`verify-ai-assist` (77), `verify-doctor-metrics` (54, every rupee asserted
against a seeded fixture), `verify-ai-insights` (36). Live: all six portal
routes at DRAFT and APPROVED, real India Post lookups, real OpenAI drafts and
treatment matching, and the insight strip generating and caching.

Three test-only bugs were caught rather than shipped: a stale regex after a
module split, a comment matching its own "never use nativeEnum" assertion, and
an environment assumption (`no key is configured`) that failed the moment a key
was added.

---

## Appendix O — the dark-inside-light regression

The portal rail rendered as a **white box with white text in it**, the active
nav item vanished, and the dashboard's sparkline area was a blank white panel.

The cause was Appendix K's own fix. `.theme-light` was taught to repaint the
dark theme's translucent-white "raise" surfaces solid, so cards would read on a
light canvas. But the portal's navigation rail (`#0b1220`) and the dashboard's
revenue band are deliberately dark **and live inside that same `theme-light`
wrapper** — so every `bg-white/[0.05]`, `bg-white/[0.09]` and `ring-white/10`
painted on them turned opaque white, taking their white text with it.

The fix is an explicit opt-out, `.on-dark`, applied to the outermost element of
each dark region. It restores the washes, the hairlines and the inverted ink
tokens, and carries one more class than the rule it undoes (0,3,0 over 0,2,0)
so it wins without `!important`.

Marked: `PortalRail` (desktop rail, mobile bar, drawer), the dashboard hero
band, and `JoinHero` — which uses `border-white/20` on a dark hero sitting on
the light `/doctor` page and was being remapped the same way.

`verify-theme.ts` now checks that the escape exists, that it restores ink as
well as surfaces, and that any component painting a `#0xxxxx` background while
also using translucent whites marks it. 40 checks.

### And the polish

The same pass addressed "not attractive enough": the rail identity gained a
gradient monogram and a real card, the active nav item a directional gradient
with an inset highlight, and the revenue band two soft colour blooms behind the
figure. The sparkline's empty state stopped being a white panel with a sentence
in it and became a flat ghost of the chart that will be there — nothing is
claimed, every bar is level. When a month has no bookings at all the hero says
so in a sentence instead of printing a row of ₹0 chips.

---

## Appendix P — the calendar on a phone, and a chart-led dashboard

### The calendar was unusable on mobile

The week view laid out `56px + repeat(7, 1fr)`. On a 360px screen that is about
**43 pixels per day** — narrower than the time labels inside it. Month cells
were the same width and held text chips.

- **Week** now scrolls sideways with a 116px floor per day column. Compressing
  was the wrong trade: a doctor would rather swipe than squint.
- **Month** shows coloured dots below `sm` and the whole cell opens the day;
  full chips return at `sm` and up. Cells shrank to 64px since they only carry
  dots.
- **Toolbar** stacks: heading and arrows on one row, then a full-width
  three-way segmented control. Previously the heading, two arrows, "Today" and
  three view buttons shared one 360px line.
- **Clinic filter** became one scrolling row — five locations used to wrap into
  a block that pushed the calendar off the first screen.

### The dashboard was text where it should have been shape

Four AI cards were four paragraphs, and the analytics were mostly sentences.
Replaced with infographics:

| Was | Now |
|---|---|
| Four ₹ figures in a list | **Donut** of booked value by state, total in the hole |
| Seven text rows of "booked/capacity" | **Stacked bars** — every bar full height, so the eye compares the *filled* portion, which is the actual question |
| Five labelled rates | **Four radial gauges** + two compact figures |
| — | **New**: bookings by start hour |
| Paragraph cards | **Icon + metric + ≤12 words** |

The insight contract changed with it: `metric` (one figure copied from the
JSON) and `kind` (an icon) joined `title` and `body`, and the prompt caps the
title at four words and the body at twelve. Titles must be human phrases, not
JSON field names — the first run produced *"48 Weekly Capacity"*, which is a
field name with a number in front of it.

The fabrication tripwire now covers `metric` too, and hard length caps discard
any card the model writes long anyway.

Gauges below their sample threshold draw an empty ring and say "Needs 5" rather
than showing a confident arc built from three appointments — the same rule the
figures already followed.

### Verified

14 suites. Three assertions had to be rewritten because they tested copy rather
than behaviour — "Nothing needs your attention", "2 booking" in a title, and a
sentence that moved. They now assert the shape (`metric` + `title` + `body`
together, icon in the known set, lengths within the card's caps), which is what
actually has to hold.

Every portal route re-checked at 200 under an iPhone user agent, with the week
scroll, month dots and segmented toggle confirmed in the served markup.

---

## Appendix Q — charts above the fold, and real density

The previous pass added charts but left them all *below* four text cards and
four stat tiles, so the first screen was a headline figure, four paragraphs and
four numbers — no chart at all. Three things changed.

**Order.** The donut and the week chart now sit directly under the hero, ahead
of the AI strip. A dashboard's first screen should show a shape.

**The hero carries the practice, not one number.** It gained a
month-on-month delta chip and four inline figures — clients, upcoming, week
filled, rating — inside the dark band. The four standalone `StatTile`s below it
were **deleted rather than kept**: they printed the same values a second time,
which is padding, not density.

**More that is actually new**, rather than more of the same:

| Panel | Answers |
| --- | --- |
| Request → Accepted → Seen | Where bookings fall out of the pipe, with the drop between each stage |
| Across your locations | Which clinic the work happens at, by count and value |
| Month-on-month delta | Direction, not just position |

`prevMonthBooked` uses the same exclusion rule as the current month — an
unaccepted request is not money — and `monthDelta` is **null** rather than
+100% when there is no prior month, because a first month is not infinite
growth.

One small thing that mattered more than it should: the fallback insight glyph
was a sunburst, which at 18px reads as a loading spinner. Four cards each
appeared to be still loading. It is a bolt now.

`verify-doctor-metrics` grew to 63 checks, including that a chart precedes the
AI strip in the source, that the funnel never grows downstream, and that the
delta is null with no prior month.

---

## Appendix R — the calendar click that did nothing

Clicking an appointment opened no drawer. The instinct is to blame the click
handler; the handler was fine.

Evidence gathered before changing anything:

- the `onOpen` chain from `TimeBlock` → `TimeGrid` → `setOpenId` → the drawer
  was intact;
- `GET /api/doctor/appointments/{id}` returned **200** with every field the
  drawer reads (`photos`, `reason`, `member`, `scans`, `history`, `profile`,
  `intake` all present).

So the data path worked. The dev server log had the answer:

```
Error: Cannot find module './vendor-chunks/next.js'
Error: Syntax Error
<w> [webpack.cache.PackFileCacheStrategy] Caching failed …
```

A corrupted `.next` dev build. React never hydrated, so **no click handler on
any page was attached** — the calendar was simply the first place that made it
obvious, because everything else on the portal is a link and links work without
JavaScript.

Fix: stop the server, delete `.next`, restart. Verified afterwards by counting
the client chunks the page ships (8) and confirming the log is clean.

Worth remembering: "the button does nothing" on a Next dev server is more often
a broken bundle than a broken handler, and the dev log says so plainly.

### Calendar polish

While in there: today's column gets a tinted ground and a shadowed pill on the
date; appointment blocks became rounded with a hover lift and a left accent;
and a **live now-line** was added to today's column — mount-gated and ticking
each minute, because rendering a position from `Date.now()` during SSR is a
hydration mismatch, which is precisely the class of bug that caused the
original complaint.

The hour rules also gained `pointer-events-none`. They are zero-height and sat
under the blocks, so they were not the cause here — but a full-width absolute
element layered over a calendar is exactly the thing that steals a click later.

---

## Appendix S — the drawer that opened and closed itself

Reported as *"sudden modal appears and gets closed"*. Different bug from
Appendix R, and a genuine one in our own code.

`reactStrictMode` is on, and in development React deliberately runs every
effect twice: mount, tear down, mount again. `useBackGuard` therefore

1. armed — pushed its sentinel,
2. tore down — saw the sentinel was still its own and called `history.back()`,
3. re-armed — re-attached its popstate listener.

**popstate is asynchronous.** The pop from step 2 landed after step 3 had put
the listener back, so the guard caught its own teardown, read it as the user
pressing Back, and closed the overlay in the same tick it opened.

The fix is a `selfPop` ref: set before any `history.back()` we initiate, and
checked in the listener, which swallows exactly one pop. A ref survives the
StrictMode cycle because the component instance is reused — only the effects
are replayed. It is also correct in production: a back() we caused ourselves
should never be read as navigation the user asked for.

This affects **every overlay on the site**, not just the calendar —
`AppointmentDrawer`, `EnquiryModal`, `DoctorDirectory` and `IntakeFlow` all use
this guard.

### Why the suite missed it

`FakeHistory.back()` invoked its listeners **synchronously**. Under that model
the teardown removes the listener before back() fires, so nothing catches the
pop and the bug is invisible. The model now queues pops and delivers them via
`flush()`, which is what a browser does, and the four existing scenarios were
updated to flush after each simulated Back press.

Scenario 5 exercises the exact sequence — render, teardown, render, flush — and
asserts the overlay survives, one sentinel remains, and a *real* Back still
closes it afterwards. Confirmed non-vacuous by removing the `selfPop` check and
watching it fail.

---

## Appendix T — a period to compare against, and five things the dashboard could not answer

An audit of the finished dashboard turned up one genuine defect and a set of
questions a practitioner would ask that the screen had no answer for. The
defect first, because it is the one that was actively misleading.

### The hours chart was not in clock order

`busiestHours` was built as `[...hourMap.entries()].sort((a, b) => b.count -
a.count).slice(0, 4)` — the four busiest hours, **ranked by volume**, handed to
a chart titled *"When your day fills"* and plotted on a time-labelled X axis. A
doctor could be shown `11:00, 09:00, 16:00, 10:00` left to right and read a
curve that was not in their diary.

It now returns every hour between the first and the last the practice sees
work, in clock order, quiet ones included. The gap matters more than the peak:
the demo practice draws `10 11 12 13 [14 15 16 = 0] 17 18 19`, and that trough
is the lunch break — the single most actionable bar on the chart, and the one
the old version deleted.

The guard in `verify-doctor-metrics.ts` is deliberately built so a volume sort
cannot pass it: the fixture books three appointments at 09:00 and the heaviest
hour at 10:00, so *the first bar must not be the busiest one*. Confirmed
non-vacuous — restoring the old two lines fails four checks.

### The period control

The dashboard was hard-wired to the calendar month, so "what did I book last
month" had no answer at all. `DashboardPeriod` is now `this-month`,
`last-month`, `last-3`, `last-6`, `this-year`, read from `?period=` through
`parsePeriod()` (which never throws — an unknown value falls back to the month
rather than 500-ing a doctor's home screen).

Three decisions worth recording:

- **Every window starts on the first of a month**, and is compared against the
  same number of months before it. "Last 3 months" against the 3 months before
  those, not against a rolling 90 days that overlaps them.
- **Only the money figures follow it.** The rates, the demand mix and the busy
  hours stay on their rolling 90 days and say so, because they answer *how does
  my practice behave*, not *how did that month go*.
- **A closed period does not forecast.** `last-month` sets `isComplete`, which
  drops the "on track for" line and the three uplift cards — `uplift` computes
  to zero for a finished window, and three cards reading "+0" look like a
  broken dashboard rather than a question that does not apply.

The month-named fields were renamed rather than quietly redefined:
`monthBooked` to `periodBooked`, `prevMonthBooked` to `prevPeriodBooked`,
`monthDelta` to `periodDelta`, `projectedMonth` to `projected`, `daysInMonth`
to `daysInPeriod`, `monthLabel` to `periodLabel`. A field called `monthBooked`
holding six months of takings is the kind of name that costs somebody an
afternoon later.

The sparkline follows the window too, and buckets by **week** past ten weeks —
180 daily slivers on a phone is noise. `seriesGrain` is returned alongside the
data and the tooltip says "Week of 3 Jun", because a chart that silently
changes what a point means is a chart that lies quietly.

**The insight cache had to move with it.** `DoctorDailyInsight` is keyed on
`(doctorId, dateKey)`, and the strip quotes rupee figures that are checked
against the metrics they were generated from. Serving August's set on a page
showing July would put numbers on screen the tripwire never approved for that
window, so `dateKeyNow(period)` appends the period — `2026-08-20:last-month`.
`this-month` keeps the bare date, so rows written before the control still
resolve.

### The five gaps

All five had their data in the schema already; none needed a migration.

| Added | Why | Column that was going unread |
|---|---|---|
| **Next appointment today** | The first question a doctor opening this between two patients has, and the answer lived on another page | — |
| **Who cancelled** | A cancel *rate* is not actionable. The clinic cancelling on clients and clients cancelling on the clinic are opposite problems with opposite fixes | `Appointment.cancelledBy` |
| **Reviews awaiting moderation** | A client leaves a review and the doctor sees *nothing* until it clears — which reads as the review never arriving | `Review.status = PENDING` |
| **Listing gaps once live** | The "no photo, no languages, no links" checklist ran all through onboarding and then never again — yet that is exactly what costs an approved doctor bookings | `advisoryGaps()` |
| **Upcoming time off** | Booked leave was invisible on the screen that shows the diary | `DoctorTimeOff` |

Plus the **booking link**, with copy and WhatsApp. A practitioner whose month
reads zero is not helped by being told so twice; the useful thing the page can
hand them is the address that turns a message into a booking. The origin is
read in the browser rather than baked server-side — this runs on localhost, on
staging and on the live domain, and a card that confidently shows a doctor a
`localhost` address is worse than no card.

The pending-review panel deliberately shows the **count and nothing else**. An
unmoderated rating on a named clinician is precisely what moderation exists
for; the doctor is told one is waiting, not what it says.

`appointments.todayCount` was computed and never rendered. It was dropped
rather than carried, because under a non-current period it would also have
been wrong.

---

## Appendix U — the demo practice, and the difference between a mock-up and a lie

Every screen in the portal is driven by real rows. That is correct, and it also
means an empty database renders a correct, empty dashboard — you cannot tell a
working chart from a broken one.

`prisma/seed-demo-doctor.ts` builds one practitioner with **fourteen months**
behind them: three clinics, eleven working windows, roughly 2,250 appointments
across every status, a payment ledger with declines and refunds in it, sixteen
published reviews and three unmoderated ones, members, cancellations attributed
to both sides, and leave booked ahead. Over a year, because "This year" in the
period control was otherwise indistinguishable from "Last 6 months".

The client account is deep enough to judge every panel of My Profile against:
six analyses trending upward over fourteen months, a camera scan with its
per-concern rows and the entitlement that authorised it, eighteen visits across
**three different doctors** (one name in "Doctors you've seen" is a panel
nobody can assess), two membership terms — one expired, one live — five
prescriptions, ten orders, seven discounts, a questionnaire, three reviews of
which one is still with moderation, and the payments behind all of it.

`Payment` is worth a note. The dashboard never reads it — the table has no
`doctorId` and, with Razorpay unconfigured, no rows — which is why every figure
on that screen is appointment-derived and says "booked value". The admin
payments and refunds screens *do* read it, and they were empty. The seed now
writes what a settled term looks like: mostly `PAID`, a few declined, the
occasional refund against a clinic-side cancellation, and deliberately **not**
one row per completed visit, because plenty of consultations are settled at the
desk. That gap between "booked" and "paid" is real and the dashboard's wording
depends on it.

Two bugs the widening exposed, both worth recording:

- The teardown deleted appointments **by doctorId**, so the demo client's
  visits to the two other listed doctors were merely detached from the account
  and a re-seed piled a fresh set on top of them every time. Every row the file
  writes now carries an id prefix (`demoappt`, `democli`, `demopay`,
  `democlipay`, `demosubpay`) and the purge deletes by prefix — exact rather
  than approximate. `IntakeResponse` needed an explicit delete too: its
  `userId` is `SetNull`, so removing the account left an anonymous
  questionnaire behind.
- Those cross-doctor visits were written with `clinicId: null`, which broke
  `verify-booking-clinic`'s "every appointment has a clinic". A null clinic is
  a row that predates multi-clinic support; writing new ones re-opens a closed
  invariant. They now resolve the other doctor's own primary clinic.

Inserts are batched through `createMany` with ids generated up front. One row
at a time was fine for six months; at four hundred days it is two and a half
thousand round trips.

Three rules it works under:

1. **Deterministic.** One seeded mulberry32, no `Math.random`. Two runs produce
   the same practice, so "the chart changed after a re-seed" is not
   indistinguishable from a bug in the chart.
2. **Labelled.** The name, the registration number (`TNMC-DEMO-88417`) and
   every account domain say *demo*. This codebase has deleted invented data
   before; the way to keep demo data safe is to make it obvious.
3. **Reversible.** `--purge` removes exactly what it wrote and nothing else,
   and the seed purges before it seeds. `Appointment.doctorId` has no cascade —
   deliberately, so a practice cannot be deleted out from under its own history
   — so the teardown runs in dependency order rather than trusting the database
   to follow, and appointments belonging to *other* practitioners have their
   `patientUserId` nulled rather than being deleted.

It reuses the existing seeded Chennai clinics rather than inventing a second
set, so the calendar's colour key and the clinic photographs are the real ones.
Cancelled rows release their `slotLock`, exactly as the booking action does —
otherwise every cancelled slot would be permanently unbookable.

### The client profile, and the `Sample` badge

`/patient/profile` was ten sections down one scroll. It now has an index: a
sticky rail on a desktop, a sticky strip of pills on a phone. Anchors, not
routes — every section is already rendered in one server pass, so `#wallet`
costs nothing and Back does the obvious thing. Turning them into ten routes
would mean ten round trips to read your own file. The highlight is driven by
`IntersectionObserver` rather than scroll arithmetic, because the sections are
wildly different heights and any offset-based guess picks the wrong one on the
short ones.

Three of the ten sections describe products that do not exist yet: there is no
`Wallet` table, no credit provider, and no address book. They are shown so the
finished shape can be reviewed, and **every panel they feed carries a `Sample`
badge**. That badge is the whole reason the sections are allowed to exist: a
wallet balance a client cannot distinguish from their own money is not a
mock-up, it is a lie. When the tables land, the import swaps and the badge
comes off; nothing else about the page changes.

`My conditions` is new and is **not** a diagnosis, which the section says out
loud. It carries two sources — the client's own last scan, and the reason they
picked from a fixed list at booking — kept as separate labelled rows rather
than merged into one unattributed claim.

The derivation lives in `profileCore.ts` rather than `profileData.ts` for the
familiar reason: `profileData` wraps its query in React's `cache()`, which
throws the moment a `tsx` script imports it. Same split as `aiAssistCore` and
`insightsCore`.

**A bug the split immediately caught.** Bar widths scaled against
`Math.max(...allReasons)` — *including* the "no reason recorded" bucket, which
is filtered out of the rendered list. A client with nine unlabelled old visits
and four for acne would have seen acne drawn at 44% of a bar whose full width
belonged to a row that was not on the page. The unnamed bucket is now dropped
before the scale is taken.

The location section lists clinics by **area, and says why**: `Clinic.lat` and
`Clinic.lng` exist and nothing populates them, so no distance is printed
anywhere — the same refusal `/api/clinics` already makes.

---

## Appendix V — the front door stops being white

`/doctor` was the one page on the site that greeted a visitor with a white
screen, sitting between a dark home page and a dark navbar; arriving felt like
landing on a different product. The `.theme-light` wrapper is gone and the
sections now sit on `var(--surface)` with the rest of the client side.

The **portal** stays light. A working tool wants a light canvas; the marketing
page in front of it does not.

The one thing still white is `PortalPreview`'s calendar sketch, which depicts
the portal — recolouring it dark to match the page would be a lie about the
product. It is framed as a screenshot instead. The trap there is that `text-ink`
resolves to a near-**white** outside `.theme-light`, so every colour inside that
frame is a literal slate value and `bg-ink` became `bg-slate-900`. `verify-theme`
now asserts that nothing inside the frame uses an ink token — the failure mode
is white type on white, which is invisible rather than merely ugly.

### While we were in there

Two client-side complaints with the same root cause, both fixed alongside:

- The **skin analyzer card** on `/patient/explore` was `#070d1c` — byte for
  byte the page background — so the one section that has to be noticed had no
  edge at all and read as loose text on a phone. It now carries the brand
  gradient the home banner uses.
- The **category icon chips** were eighteen translucent `/20` gradients over a
  dark canvas, which on screen collapsed to the same near-grey every time; the
  icons carried no information. Every tint is now full-strength in the hue it
  already had, in `src/data/hub.ts` and in the `hub_categories` rows
  (`prisma/recolor-hub-categories.ts`, idempotent). The explorer's unselected
  tile keeps its own colour and simply steps back, rather than being flattened
  to grey — seventeen of eighteen icons were previously colourless at any given
  moment.

### Moving the data to a server

`npm run db:dump` writes a full `mysqldump` to `backups/<db>-<stamp>.sql`
(3.1 MB as of writing — 62 tables, 54 with rows). `--schema-only` for the
structure alone; `--out` to choose the path.

Three things about it that are deliberate:

- **It is destructive on import.** `--add-drop-table` is what makes the dump
  reproducible and also what makes loading it *replace* the target rather than
  merge into it. The script prints that in full rather than burying it in a
  comment, because "seed a fresh environment" and "restore over a live one"
  look identical at the command line and only one of them is safe.
- **It is a credential.** The file carries bcrypt password hashes and every
  client record in the database. `/backups/` is gitignored.
- **The password never reaches argv.** It goes to `mysqldump` through
  `MYSQL_PWD`, because an argument is visible to every other process on the
  machine through the process list. It is read out of `DATABASE_URL` and
  percent-decoded first — ours contains an `@`, and a literal `%40` fails with
  an authentication error that says nothing about encoding.

The six-line `.env` reader is there because every other script in `prisma/`
gets `DATABASE_URL` for free as a side effect of constructing a Prisma client.
This one shells out to `mysqldump` and has no other reason to load the engine.

---

## Appendix W — Google sign-in is wired correctly and cannot work

Asked to check whether Google sign-in was linked properly. The code half is
right in every respect, which is precisely why it was worth checking: nothing
in the repository is wrong, and every BluDerma user would still have hit
`Error 400: redirect_uri_mismatch`.

### What is correct

- `GoogleProvider` registers, gated on `googleConfigured` so an unconfigured
  app still boots — NextAuth throws at startup on a provider with an empty
  `clientId`.
- `PrismaAdapter` is attached; sessions are JWT because credentials sign-in
  requires it, and the adapter still handles OAuth user creation and linking.
- `Account.refresh_token`, `access_token` and `id_token` are all `@db.Text`.
  This is the single most common MySQL failure with NextAuth: Google's
  `id_token` is a long JWT that does not fit the default `VARCHAR(191)`, and
  the sign-in then dies at the database with an error that says nothing about
  OAuth.
- `allowDangerousEmailAccountLinking: false`, which is the right call —
  silently attaching a Google login to an existing password account is an
  account-takeover vector when the email was never verified. It has a visible
  consequence, and `LoginForm` carries copy for `OAuthAccountNotLinked`
  instead of showing a bare error code.
- Google always creates a `PATIENT` (the adapter has no notion of intent), so
  the doctor sign-up routes through `/doctor/join/start` →
  `promoteCurrentUserToDoctor()`, which only ever promotes a PATIENT and
  leaves an ADMIN alone.

### What is broken, and where

The OAuth client's **Authorised redirect URIs** list, in a Google Cloud
project this repository shares with another product. None of BluDerma's
callbacks is on it — not production, and not even localhost.

That failure lives entirely outside the codebase. No amount of reading the
source finds it, which is why `prisma/verify-google-oauth.ts` asks Google
directly: one read-only GET per redirect URI to the authorization endpoint,
which answers before any user is involved. The client_id is public by design
(it ships in every browser redirect); the secret is never sent.

### The trap in that probe, and the controls that caught it

A first pass reported all three URIs as **accepted**, and it was wrong.

An unauthenticated request to Google's auth endpoint is bounced to the sign-in
page *before* the redirect URI is validated, so a bare `302` is byte-identical
for a registered and an unregistered URI. Following the chain and decoding the
`authError` payload — base64url protobuf, with the reason as plain ASCII
inside — is the only reading that is not a guess.

The second pass then reported everything as **rejected**, which is equally
unfalsifiable: a probe that fails everything looks the same as a probe that is
simply broken. So the suite runs two controls:

- a URI that cannot be registered, which must come back with a *different*
  error (`invalid_request`, not `redirect_uri_mismatch`);
- and a positive case, to prove it can report a pass at all.

Both were exercised by hand against a sibling domain registered in the same
project: `OK ... reached sign-in` alongside `FAIL ... redirect_uri_mismatch`,
in one run. If the controls misbehave, the suite prints **INCONCLUSIVE** and
withholds a verdict rather than inventing one.

The linked-account count is reported and is deliberately *not* a check. Zero
is what a brand-new environment looks like and also what a broken one looks
like — the number cannot tell you it works, only that somebody once got
through.

### What has to happen outside the repo

In the Google Cloud console, on this OAuth client, add under **Authorised
redirect URIs**:

```
http://localhost:3000/api/auth/callback/google
https://<production-domain>/api/auth/callback/google
```

and the bare origins under **Authorised JavaScript origins**. Production's
`NEXTAUTH_URL` must match its domain exactly and carry no trailing slash —
NextAuth builds the callback by concatenation, so a trailing slash yields a
double slash that will not match what Google holds.

Worth a separate decision: the OAuth client belongs to a shared project, so
the consent screen shows *that* project's app name and support email. A
product asking people to sign in should own its own client.
