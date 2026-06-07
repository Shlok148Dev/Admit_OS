/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        border: "#e2e8f0",
        background: "#f8fafc",
        primary: "#0f3370", // Navy Blue
        accent: "#0d9488", // Teal
        // Dark mode colors from tokens.ts
        darkBg: "#0A0A0F",
        darkSurface: "#111118",
        darkSurfaceElevated: "#1A1A24",
        darkBorder: "#2A2A38",
        darkMuted: "#6B7280",
        darkBody: "#E2E8F0",
        darkHeading: "#F8FAFC",
        darkBrand: "#2563EB",
        darkSafe: "#10B981",
        darkTarget: "#3B82F6",
        darkReach: "#F59E0B",
        // Calm design shades
        admitBlue: {
          50: "#f0f7ff",
          100: "#e0efff",
          200: "#badcff",
          500: "#0c7eff",
          800: "#003f8a",
          900: "#063670",
        },
        admitGreen: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          800: "#166534",
        },
        admitTeal: {
          50: "#f0fdfa",
          500: "#14b8a6",
          800: "#115e59",
        }
      },
    },
  },
  plugins: [],
}
