import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-text)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          DEFAULT: "#232323",
          muted: "#666664",
          soft: "#8c8c89",
        },
        paper: {
          DEFAULT: "#f6f6f4",
          card: "#ffffff",
          surface: "#f0f0ee",
          dark: "#181818",
        },
        mint: {
          DEFAULT: "#a1ffcb",
          deep: "#113823",
          border: "#6ee7b7",
        },
      },
    },
  },
  plugins: [],
};
export default config;

