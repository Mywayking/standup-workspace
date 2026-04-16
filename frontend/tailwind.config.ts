import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Structure = blue
        struct: { DEFAULT: "#3b82f6", light: "#dbeafe" },
        // Attitude = purple
        attitude: { DEFAULT: "#a855f7", light: "#f3e8ff" },
        // Technique = green
        tech: { DEFAULT: "#22c55e", light: "#dcfce7" },
        // Problem = orange
        problem: { DEFAULT: "#f97316", light: "#ffedd5" },
        // Note = gray
        note: { DEFAULT: "#6b7280", light: "#f3f4f6" },
      },
      fontFamily: {
        mono: ["ui-monospace", "Menlo", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
