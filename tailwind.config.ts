import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        orange: {
          50: "#FFA500",
          100: "#FFA500",
          200: "#FFA500",
          300: "#FFA500",
          400: "#FFA500",
          DEFAULT: "#FFA500",
          500: "#FFA500",
          600: "#FFA500",
          700: "#FFA500",
          800: "#FFA500",
          900: "#FFA500",
        },
        charcoal: {
          DEFAULT: "#0F0F10",
          50: "#F4F4F5",
          100: "#E4E4E7",
          400: "#6B6B70",
          600: "#3F3F42",
          800: "#1C1C1E",
          900: "#141415",
          950: "#0A0A0B",
        },
        cream: {
          DEFAULT: "#FFFFFF",
          soft: "#F7F6F4",
          muted: "#F0EFEC",
        },
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      backgroundSize: { blueprint: "32px 32px" },
      boxShadow: {
        card: "0 1px 2px rgba(15,15,16,0.04), 0 8px 24px -8px rgba(15,15,16,0.12)",
        "card-hover": "0 4px 8px rgba(15,15,16,0.06), 0 16px 32px -12px rgba(255,165,0,0.25)",
      },
      borderRadius: { xl2: "1.25rem" },
      maxWidth: { content: "1280px" },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.6s ease-out both",
        fadeIn: "fadeIn 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
