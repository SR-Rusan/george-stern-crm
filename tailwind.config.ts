import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#F9F8F6',
          subtle: '#F3F1ED',
          card: '#FFFFFF',
        },
        ink: {
          DEFAULT: '#141B29',
          secondary: '#475569',
          muted: '#64748B',
        },
        // Set from the active client file (layout.tsx) and Settings → brand colour.
        brand: {
          DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)',
          hover: 'rgb(var(--brand-hover-rgb) / <alpha-value>)',
          light: 'var(--brand-accent-light, #E8F0EC)',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
