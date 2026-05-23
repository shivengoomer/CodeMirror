import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        foreground: "var(--foreground)",
        accent: {
          DEFAULT: "var(--accent)",
          alt: "var(--accent-alt)",
          green: "var(--accent-green)",
          blue: "var(--accent-blue)",
          foreground: "#FFFFFF",
        },
        error: "var(--error)",
        warning: "var(--warning)",
        success: "var(--success)",
        border: "var(--border)",
        card: {
          DEFAULT: "var(--card-bg)",
          foreground: "var(--foreground)",
          border: "var(--card-border)",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        none: "0",
        sm: "6px",
        DEFAULT: "12px",
        md: "12px",
        lg: "14px",
        xl: "14px",
        "2xl": "16px",
        "3xl": "16px",
        full: "9999px",
      },
      boxShadow: {
        premium: "0 0 0 1px var(--border), 0 8px 32px -8px rgba(0,0,0,0.5)",
        card: "0 2px 16px rgba(0,0,0,0.3), 0 0 0 1px var(--border)",
        glow: "0 0 30px var(--glow)",
        "glow-green": "0 0 30px rgba(16,217,134,0.2)",
        "glow-red": "0 0 30px rgba(255,80,88,0.2)",
        "inner-glow": "inset 0 0 20px rgba(108,99,255,0.02)",
      },
      animation: {
        "pulse-glow": "pulse-glow 5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 9s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-in": "slide-in-left 0.3s ease forwards",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.3", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.03)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%": { transform: "translateY(-15px) rotate(1.5deg)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "noise": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};

export default config;
