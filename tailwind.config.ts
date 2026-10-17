import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Love Fusion brand palette
        gold: {
          50:  "#fdfae8",
          100: "#faf3c0",
          200: "#f7e57a",
          300: "#f3d133",
          400: "#d4af37", // primary gold
          500: "#c9a227",
          600: "#a67c14",
          700: "#875e0e",
          800: "#6d4a10",
          900: "#5c3d13",
        },
        obsidian: {
          900: "#050507", // deepest black
          800: "#0a0a0f",
          700: "#111118",
          600: "#1a1a24",
          500: "#252530",
          400: "#333340",
        },
        // Accent colours
        champagne: "#F7E7CE",
        ivory:     "#FFFFF0",
      },
      fontFamily: {
        sans:     ["var(--font-inter)", "system-ui", "sans-serif"],
        playfair: ["var(--font-playfair)", "Georgia", "serif"],
        mono:     ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #d4af37 0%, #f3d133 40%, #c9a227 100%)",
        "dark-gradient": "linear-gradient(180deg, #050507 0%, #111118 100%)",
        "shimmer":       "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.15) 50%, transparent 100%)",
      },
      boxShadow: {
        "gold-glow":   "0 0 20px rgba(212,175,55,0.4), 0 0 60px rgba(212,175,55,0.15)",
        "gold-strong": "0 0 40px rgba(212,175,55,0.6), 0 0 80px rgba(212,175,55,0.25)",
        "card":        "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.6)",
      },
      animation: {
        "shimmer":        "shimmer 2.5s ease-in-out infinite",
        "float":          "float 6s ease-in-out infinite",
        "pulse-gold":     "pulse-gold 2s ease-in-out infinite",
        "spin-slow":      "spin 8s linear infinite",
        "bounce-subtle":  "bounce-subtle 2s ease-in-out infinite",
        "fade-in":        "fade-in 0.5s ease-out forwards",
        "slide-up":       "slide-up 0.5s ease-out forwards",
        "scale-in":       "scale-in 0.3s ease-out forwards",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-12px)" },
        },
        "pulse-gold": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(212,175,55,0.4)" },
          "50%":      { boxShadow: "0 0 40px rgba(212,175,55,0.8)" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-6px)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
