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
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          DEFAULT: "#6C3CE1",
          dark: "#5A2DC7",
          light: "#8B63E8",
        },
        "brand-green": {
          DEFAULT: "#0F9D58",
          dark: "#0B7B44",
          light: "#12B866",
        },
      },
    },
  },
  plugins: [],
};
export default config;
