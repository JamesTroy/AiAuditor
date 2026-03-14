import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  safelist: [
    // Blue
    "bg-blue-600", "bg-blue-700", "hover:bg-blue-500", "hover:bg-blue-600", "border-blue-500", "text-blue-400", "hover:bg-blue-500/10",
    // Red
    "bg-red-600", "bg-red-700", "hover:bg-red-500", "hover:bg-red-600", "border-red-500", "text-red-400", "hover:bg-red-500/10",
    // Yellow (light — use -800 for white-text contrast)
    "bg-yellow-600", "bg-yellow-700", "bg-yellow-800", "hover:bg-yellow-500", "hover:bg-yellow-600", "hover:bg-yellow-700", "border-yellow-500", "text-yellow-400", "hover:bg-yellow-500/10",
    // Green
    "bg-green-600", "bg-green-700", "hover:bg-green-500", "hover:bg-green-600", "border-green-500", "text-green-400", "hover:bg-green-500/10",
    // Purple
    "bg-purple-600", "bg-purple-700", "hover:bg-purple-500", "hover:bg-purple-600", "border-purple-500", "text-purple-400", "hover:bg-purple-500/10",
    // Orange
    "bg-orange-600", "bg-orange-700", "hover:bg-orange-500", "hover:bg-orange-600", "border-orange-500", "text-orange-400", "hover:bg-orange-500/10",
    // Cyan (light — use -800)
    "bg-cyan-600", "bg-cyan-700", "bg-cyan-800", "hover:bg-cyan-500", "hover:bg-cyan-600", "hover:bg-cyan-700", "border-cyan-500", "text-cyan-400", "hover:bg-cyan-500/10",
    // Slate
    "bg-slate-600", "bg-slate-700", "hover:bg-slate-500", "hover:bg-slate-600", "border-slate-500", "text-slate-400", "hover:bg-slate-500/10", "text-slate-300", "border-slate-400",
    // Amber (light — use -800)
    "bg-amber-600", "bg-amber-700", "bg-amber-800", "hover:bg-amber-500", "hover:bg-amber-600", "hover:bg-amber-700", "border-amber-500", "text-amber-400", "hover:bg-amber-500/10",
    // Pink
    "bg-pink-600", "bg-pink-700", "hover:bg-pink-500", "hover:bg-pink-600", "border-pink-500", "text-pink-400", "hover:bg-pink-500/10",
    // Teal
    "bg-teal-600", "bg-teal-700", "hover:bg-teal-500", "hover:bg-teal-600", "border-teal-500", "text-teal-400", "hover:bg-teal-500/10",
    // Indigo
    "bg-indigo-600", "bg-indigo-700", "hover:bg-indigo-500", "hover:bg-indigo-600", "border-indigo-500", "text-indigo-400", "hover:bg-indigo-500/10",
    // Emerald (dependency-security)
    "bg-emerald-600", "bg-emerald-700", "hover:bg-emerald-500", "hover:bg-emerald-600", "border-emerald-500", "text-emerald-400", "hover:bg-emerald-500/10",
    // Violet (design agents)
    "bg-violet-600", "bg-violet-700", "hover:bg-violet-500", "hover:bg-violet-600", "border-violet-500", "text-violet-400", "hover:bg-violet-500/10",
    // Fuchsia (design agents)
    "bg-fuchsia-600", "bg-fuchsia-700", "hover:bg-fuchsia-500", "hover:bg-fuchsia-600", "border-fuchsia-500", "text-fuchsia-400", "hover:bg-fuchsia-500/10",
    // Sky (design agents)
    "bg-sky-600", "bg-sky-700", "hover:bg-sky-500", "hover:bg-sky-600", "border-sky-500", "text-sky-400", "hover:bg-sky-500/10",
    // Rose (design agents)
    "bg-rose-600", "bg-rose-700", "hover:bg-rose-500", "hover:bg-rose-600", "border-rose-500", "text-rose-400", "hover:bg-rose-500/10",
    // Lime (design agents — light, use -800)
    "bg-lime-600", "bg-lime-700", "bg-lime-800", "hover:bg-lime-500", "hover:bg-lime-600", "hover:bg-lime-700", "border-lime-500", "text-lime-400", "hover:bg-lime-500/10",
  ],
  theme: {
    extend: {
      screens: {
        xs: "480px",
      },
      animation: {
        "fade-up": "fade-up 0.3s ease-out both",
        "star-pop": "star-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "blink": "blink 1s step-end infinite",
        "pulse-slow": "pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2s linear infinite",
        "slide-in": "slide-in 0.2s ease-out both",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "star-pop": {
          from: { opacity: "0", transform: "scale(0.5)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "shimmer": {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
