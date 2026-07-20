# BluDerma — Frontend MVP

A dermatology & aesthetic treatment reference platform for **doctors** and
**patients**, built as a **frontend-only** Next.js MVP (no backend).

On first visit, a modal asks whether you're a **Doctor** or a **Patient** and
routes you to the matching experience. The doctor flow is a clinical reference:
a hero video section, treatments grouped by category, and a dedicated page for
every treatment (concern → solution → benefits → clinical note) with an
**Enquiry to order** button for the matched product. The patient flow presents
the same catalogue in friendlier language.

## Tech stack

- **Next.js 14** (App Router) — stable/LTS line
- **React 18**
- **TypeScript**
- **Tailwind CSS 3**
- No backend, no database — enquiry submissions are captured in-browser
  (logged to the console) for demonstration only.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000

To build for production:

```bash
npm run build
npm start
```

## Project structure

```
src/
  app/
    page.tsx                 # Entry — Doctor/Patient role modal
    doctor/page.tsx          # Doctor hub (hero video + grouped treatments)
    patient/page.tsx         # Patient hub (friendlier framing)
    treatments/[slug]/page.tsx   # Per-treatment detail + enquiry
    not-found.tsx
    layout.tsx  globals.css  icon.svg
  components/                # Navbar, HeroVideo, RoleModal, EnquiryModal, cards…
  data/treatments.ts         # The 15-treatment catalogue (content + images)
  lib/roles.ts               # Role helpers
public/videos/               # Drop hero.mp4 here (see README.txt)
```

## Customising

- **Treatments & content:** edit `src/data/treatments.ts`. Each entry drives its
  own page automatically via the dynamic route.
- **Images:** each treatment has an `image` URL (free-license Unsplash CDN,
  matched to the treatment). Replace with your own asset URLs or `/public`
  paths. A graceful branded fallback shows if any image fails to load.
- **Hero video:** add `public/videos/hero.mp4` — see `public/videos/README.txt`.
  Without it, a cinematic still is shown instead.
- **Brand colours:** edit the `brand` / `teal` palettes in `tailwind.config.ts`.

## Notes

- This is an MVP for demonstration. Content is informational only and is not
  medical advice. Replace placeholder contact details in `Footer.tsx` before any
  real use.
- To wire real enquiries later, connect the form in
  `src/components/EnquiryModal.tsx` (`handleSubmit`) to your backend or a form
  service.
```
