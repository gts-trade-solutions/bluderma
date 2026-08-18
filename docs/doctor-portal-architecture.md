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
