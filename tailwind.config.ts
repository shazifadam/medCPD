import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          hover: "hsl(var(--primary-hover))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          subtle: "hsl(var(--success-subtle))",
          "subtle-foreground": "hsl(var(--success-subtle-foreground))",
          border: "hsl(var(--success-border))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // CPD status tokens — entries / events / certificates states.
        // Usage: text-status-pending bg-status-pending-bg border-status-pending-border
        status: {
          draft: "hsl(var(--status-draft))",
          "draft-bg": "hsl(var(--status-draft-bg))",
          "draft-border": "hsl(var(--status-draft-border))",
          pending: "hsl(var(--status-pending))",
          "pending-bg": "hsl(var(--status-pending-bg))",
          "pending-border": "hsl(var(--status-pending-border))",
          approved: "hsl(var(--status-approved))",
          "approved-bg": "hsl(var(--status-approved-bg))",
          "approved-border": "hsl(var(--status-approved-border))",
          rejected: "hsl(var(--status-rejected))",
          "rejected-bg": "hsl(var(--status-rejected-bg))",
          "rejected-border": "hsl(var(--status-rejected-border))",
          "under-review": "hsl(var(--status-under-review))",
          "under-review-bg": "hsl(var(--status-under-review-bg))",
          "under-review-border": "hsl(var(--status-under-review-border))",
          revoked: "hsl(var(--status-revoked))",
          "revoked-bg": "hsl(var(--status-revoked-bg))",
          "revoked-border": "hsl(var(--status-revoked-border))",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)"],
        mono: ["var(--font-jetbrains-mono)"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      spacing: {
        navbar: "var(--navbar-height)",
        sidebar: "var(--sidebar-width)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
