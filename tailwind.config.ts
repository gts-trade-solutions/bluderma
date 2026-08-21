import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    // Class names live in the data layer too — category tints, score bars,
    // concern badges. Left out of the scan they compile to nothing and the
    // colour silently goes missing.
    "./src/data/**/*.{js,ts}",
    "./src/lib/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      colors: {
        // BluDerma brand palette — clinical blue + calming teal
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          200: "#bce0ff",
          300: "#8ecdff",
          400: "#59b0ff",
          500: "#328ff0",
          600: "#1f6fd6",
          700: "#1a58ad",
          800: "#1b4a8c",
          900: "#1c4074",
          950: "#152847",
        },
        teal: {
          50: "#effcf9",
          100: "#c8f5ec",
          200: "#92ead9",
          300: "#54d7c2",
          400: "#28bda9",
          500: "#0fa08e",
          600: "#088073",
          700: "#0a665d",
          800: "#0c514b",
          900: "#0e433f",
        },
        /*
         * "ink" is the reading colour, and the site reads on navy now, so it
         * is light. Flipping it here rather than at 650 call sites is the
         * whole point of it being a token — but it does mean anything set on
         * a white surface (a pill, a button) needs its dark colour stated
         * explicitly rather than inherited.
         */
        ink: {
          DEFAULT: "#eef2f8",
          soft: "rgba(255,255,255,0.72)",
          muted: "rgba(255,255,255,0.52)",
        },
      },
      fontFamily: {
        // The tail of these stacks is the ONLY fallback now — globals.css no
        // longer declares --font-sans, because a :root declaration there beat
        // next/font's class and silently disabled the body font entirely.
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        // Bricolage Grotesque. Falls through to the body face if the display
        // font ever fails to load, so a heading degrades to the wrong family
        // rather than to Times.
        display: [
          "var(--font-display)",
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(16, 42, 71, 0.18)",
        soft: "0 4px 20px -6px rgba(16, 42, 71, 0.12)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-fast": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "ken-burns": {
          "0%": { transform: "scale(1)" },
          "100%": { transform: "scale(1.12)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        // Dot travelling down inside the mouse outline.
        "scroll-dot": {
          "0%": { transform: "translateY(0)", opacity: "0" },
          "30%": { opacity: "1" },
          "60%": { transform: "translateY(10px)", opacity: "1" },
          "100%": { transform: "translateY(13px)", opacity: "0" },
        },
        // Gentle vertical nudge for the whole cue.
        "scroll-nudge": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(5px)" },
        },
        // Scanning line sweeping down the skin-analyzer hero card.
        scanline: {
          "0%, 100%": { top: "8%" },
          "50%": { top: "92%" },
        },
        // Running banner. The track holds two identical copies, so -50%
        // lands exactly where it started and the loop is seamless.
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.6s ease-out both",
        "fade-in-fast": "fade-in-fast 0.3s ease-out both",
        "ken-burns": "ken-burns 18s ease-out alternate infinite",
        "scale-in": "scale-in 0.25s ease-out both",
        "scroll-dot": "scroll-dot 1.8s ease-in-out infinite",
        "scroll-nudge": "scroll-nudge 2s ease-in-out infinite",
        scanline: "scanline 3.2s ease-in-out infinite",
        marquee: "marquee 34s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
