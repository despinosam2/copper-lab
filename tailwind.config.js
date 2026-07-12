/** @type {import('tailwindcss').Config} */
// Paleta "instrumento científico" (05 UI SPEC): banco de trabajo oscuro,
// cobre metálico y pátina/verdigris como acentos.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          700: "#28313b",
          850: "#171c22",
          900: "#12161a",
        },
        patina: {
          DEFAULT: "#4fb3a0",
          light: "#79d4c2",
        },
        copper: {
          light: "#e0a274",
          deep: "#9a5a36",
        },
        ink: {
          100: "#e8ecef",
          300: "#aab4bd",
          // R21 (C4c): antes #78838d — 4.43:1 sobre el panel #171c22, bajo el
          // AA (4.5:1) para el texto pequeño donde se usa (eyebrows de 11px).
          // #7d8892 da 4.74:1 en panel y 5.03:1 en fondo con el cambio visual
          // mínimo (+5 por canal), calculado con la fórmula WCAG.
          500: "#7d8892",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
