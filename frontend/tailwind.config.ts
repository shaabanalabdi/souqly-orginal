import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1E3A8A',
        accent: '#F59E0B',
        ink: '#111827',
        muted: '#6B7280',
        surface: '#F9FAFB',
      },
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'Tajawal', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 8px 24px rgba(17, 24, 39, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
