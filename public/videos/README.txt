BluDerma — Hero background video
================================

The homepage hero (doctor & patient) is designed to play a full-screen,
muted, looping background video — the "Korean clinic" style feel.

To enable it:
  1. Add your video file here as:  hero.mp4
     (Recommended: 1920x1080, H.264/MP4, 8–15 seconds, muted, < 8 MB)
  2. Refresh the page — it will autoplay and loop automatically.

Where to find free, license-safe clinic/skincare footage:
  • https://www.pexels.com/videos/   (search "skin clinic", "facial", "spa")
  • https://mixkit.co/free-stock-video/
  • https://coverr.co/

If no hero.mp4 is present, the hero gracefully falls back to a cinematic
Ken-Burns still image, so the site always looks complete.

You can change the file name / add multiple sources in:
  src/components/HeroVideo.tsx  (the `sources` prop)
