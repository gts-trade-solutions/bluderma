import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
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
        ink: {
          DEFAULT: "#0f172a",
          soft: "#334155",
          muted: "#64748b",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
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
      },
      animation: {
        "fade-in": "fade-in 0.6s ease-out both",
        "fade-in-fast": "fade-in-fast 0.3s ease-out both",
        "ken-burns": "ken-burns 18s ease-out alternate infinite",
        "scale-in": "scale-in 0.25s ease-out both",
        "scroll-dot": "scroll-dot 1.8s ease-in-out infinite",
        "scroll-nudge": "scroll-nudge 2s ease-in-out infinite",
        scanline: "scanline 3.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
