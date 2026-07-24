# Brand assets

Drop the BluDerma logo here as **`logo.png`** (this exact path: `public/brand/logo.png`).

- Used everywhere via `src/components/BrandLogo.tsx`.
- Square-ish PNG with a transparent background works best (it's rendered inside a
  rounded box at 36–48px). A ~256×256 or larger export keeps it crisp on retina.
- Until the file is present, `BrandLogo` automatically falls back to the original
  droplet glyph, so nothing looks broken while the asset is being finalised.

Optional: add `favicon.ico` / `icon.png` under `src/app/` to update the browser tab icon.
