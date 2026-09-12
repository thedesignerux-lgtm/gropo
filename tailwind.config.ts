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
        // Paleta de marca — teal, derivada del wordmark (12-sep-2026).
        // Los ratios son contraste con texto blanco; AA exige 4,5:1.
        brand: {
          DEFAULT: "#024947", // 10,26:1 · color de acción
          dark: "#013230",    // 14,00:1 · hover y pressed
          light: "#04817E",   //  4,72:1 · secundario
          tint: "#F0F7F7",    // fondos — antes #F0EDFF
          tint2: "#DEEDEC",   // bordes y separadores
        },
        // Naranja de marca. SOLO acento: sobre blanco da 2,87:1 y NO pasa AA.
        // Nunca como fondo con texto claro ni como texto sobre blanco; para
        // texto, `accent.dark` (5,42:1).
        accent: {
          DEFAULT: "#FF6A00",
          dark: "#B24A00",
        },
        "brand-green": {
          DEFAULT: "#0B7B44", // 5,34:1 · antes #0F9D58, que daba 3,51:1 y fallaba AA
          dark: "#095F35",
          light: "#12B866",
        },
      },
    },
  },
  plugins: [],
};
export default config;
