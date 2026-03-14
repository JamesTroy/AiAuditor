import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  safelist: [
    "bg-blue-600", "hover:bg-blue-500", "border-blue-500", "text-blue-400", "hover:bg-blue-500/10",
    "bg-red-600",  "hover:bg-red-500",  "border-red-500",  "text-red-400",  "hover:bg-red-500/10",
    "bg-yellow-600","hover:bg-yellow-500","border-yellow-500","text-yellow-400","hover:bg-yellow-500/10",
    "bg-green-600","hover:bg-green-500","border-green-500","text-green-400","hover:bg-green-500/10",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
