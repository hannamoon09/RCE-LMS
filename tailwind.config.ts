import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          app: "hsl(var(--surface-app) / <alpha-value>)",
          sidebar: "hsl(var(--surface-sidebar) / <alpha-value>)",
          workspace: "hsl(var(--surface-workspace) / <alpha-value>)",
          card: "hsl(var(--surface-card) / <alpha-value>)",
          interactive: "hsl(var(--surface-interactive) / <alpha-value>)",
        },
        border: {
          DEFAULT: "hsl(var(--border-default))",
          subtle: "hsl(var(--border-subtle))",
          default: "hsl(var(--border-default))",
          strong: "hsl(var(--border-strong))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        warning: "hsl(var(--warning) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        "rce-soft": "0 18px 60px hsl(0 0% 0% / 0.34)",
        "rce-line": "inset 0 1px 0 hsl(var(--border-strong) / 0.32)",
      },
    },
  },
  plugins: [],
} satisfies Config;
