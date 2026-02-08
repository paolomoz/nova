import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: [
          '"Adobe Clean"',
          '"Source Sans Pro"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"Source Code Pro"',
          'Monaco',
          '"Cascadia Code"',
          'monospace',
        ],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: {
          DEFAULT: 'hsl(var(--background))',
          'layer-2': 'hsl(var(--background-layer-2, 0 0% 100%))',
        },
        foreground: {
          DEFAULT: 'hsl(var(--foreground))',
          heading: 'hsl(var(--foreground-heading, 0 0% 7.5%))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        positive: {
          DEFAULT: 'hsl(var(--positive, 152 69% 31%))',
          foreground: 'hsl(var(--positive-foreground, 0 0% 100%))',
        },
        notice: {
          DEFAULT: 'hsl(var(--notice, 30 100% 44%))',
          foreground: 'hsl(var(--notice-foreground, 0 0% 100%))',
        },
        informative: {
          DEFAULT: 'hsl(var(--informative, 230 96% 61%))',
          foreground: 'hsl(var(--informative-foreground, 0 0% 100%))',
        },
        /* AI extended palette */
        ai: {
          cyan: '#8AD5FF',
          purple: '#D0A7F3',
          indigo: '#7A6AFD',
          fuchsia: '#EC69FF',
          'fuchsia-dark': '#DF4DF5',
          'blue-tint': '#F5F9FF',
        },
      },
      borderRadius: {
        lg: '0.5rem',    /* 8px — large containers, panels, cards */
        md: '0.25rem',   /* 4px — default components */
        sm: '0.125rem',  /* 2px — small components */
        xl: '0.75rem',   /* 12px — modals, popovers */
        '2xl': '1rem',   /* 16px */
        cover: '2.5rem', /* 40px — cover/hero panels */
      },
      boxShadow: {
        emphasized: 'var(--shadow-emphasized)',
        elevated: 'var(--shadow-elevated)',
        dragged: 'var(--shadow-dragged)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in-up': 'fade-in-up 150ms ease-out',
        'fade-in': 'fade-in 150ms ease-out',
      },
      transitionDuration: {
        DEFAULT: '150ms',
        fast: '100ms',
        normal: '200ms',
        slow: '300ms',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
