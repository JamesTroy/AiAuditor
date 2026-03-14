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
    "bg-purple-600","hover:bg-purple-500","border-purple-500","text-purple-400","hover:bg-purple-500/10",
    "bg-orange-600","hover:bg-orange-500","border-orange-500","text-orange-400","hover:bg-orange-500/10",
    "bg-cyan-600",  "hover:bg-cyan-500",  "border-cyan-500",  "text-cyan-400",  "hover:bg-cyan-500/10",
    "bg-slate-600", "hover:bg-slate-500", "border-slate-500", "text-slate-400", "hover:bg-slate-500/10",
    "bg-amber-600", "hover:bg-amber-500", "border-amber-500", "text-amber-400", "hover:bg-amber-500/10",
    "bg-pink-600",  "hover:bg-pink-500",  "border-pink-500",  "text-pink-400",  "hover:bg-pink-500/10",
    "bg-teal-600",  "hover:bg-teal-500",  "border-teal-500",  "text-teal-400",  "hover:bg-teal-500/10",
    "bg-indigo-600","hover:bg-indigo-500","border-indigo-500","text-indigo-400","hover:bg-indigo-500/10",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
