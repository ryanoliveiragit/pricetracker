import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["GeistVariable", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50:  "#fff3ee",
          100: "#ffe4d1",
          400: "#ff6a2e",
          500: "#fa5d19",
          600: "#d44c14",
        },
      },
      backgroundImage: {
        "noise": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E\")",
      },
      animation: {
        "marquee":      "marquee 28s linear infinite",
        "marquee-rev":  "marquee-rev 28s linear infinite",
        "fade-up":      "fade-up 0.6s ease-out both",
        "fade-in":      "fade-in 0.5s ease-out both",
        "glow-pulse":   "glow-pulse 4s ease-in-out infinite",
        "spin-slow":    "spin 20s linear infinite",
      },
      keyframes: {
        "marquee": {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "marquee-rev": {
          "0%":   { transform: "translateX(-50%)" },
          "100%": { transform: "translateX(0)" },
        },
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%":      { opacity: "0.7", transform: "scale(1.1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
