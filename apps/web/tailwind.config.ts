import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    },
    extend: {
      colors: {
        brand: {
          50: '#EEF4FF',
          100: '#D9E5FF',
          200: '#B4CCFF',
          300: '#88AEFF',
          400: '#5E8FFF',
          500: '#3D6DFD',
          600: '#2D55E0',
          700: '#2342B3',
          800: '#1B3286',
          900: '#142563',
        },
        neutral: {
          0: '#FFFFFF',
          50: '#F7F8FA',
          100: '#EEF0F4',
          200: '#DDE1E8',
          300: '#C2C8D2',
          400: '#9AA1AE',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#0B1220',
        },
        success: { 50: '#E8F8EF', 500: '#16A34A', 700: '#0F7A37' },
        warning: { 50: '#FFF6E5', 500: '#F59E0B', 700: '#B5730A' },
        danger: { 50: '#FDECEC', 500: '#DC2626', 700: '#9B1C1C' },
        info: { 50: '#E6F4FB', 500: '#0EA5E9', 700: '#0369A1' },
        surface: {
          DEFAULT: 'hsl(var(--surface-bg) / <alpha-value>)',
          raised: 'hsl(var(--surface-raised) / <alpha-value>)',
          column: 'hsl(var(--surface-column) / <alpha-value>)',
          drawer: 'hsl(var(--surface-drawer) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'hsl(var(--border-default) / <alpha-value>)',
          subtle: 'hsl(var(--border-subtle) / <alpha-value>)',
          strong: 'hsl(var(--border-strong) / <alpha-value>)',
          focus: 'hsl(var(--border-focus) / <alpha-value>)',
        },
        fg: {
          DEFAULT: 'hsl(var(--fg-primary) / <alpha-value>)',
          secondary: 'hsl(var(--fg-secondary) / <alpha-value>)',
          tertiary: 'hsl(var(--fg-tertiary) / <alpha-value>)',
          disabled: 'hsl(var(--fg-disabled) / <alpha-value>)',
          onBrand: 'hsl(var(--fg-on-brand) / <alpha-value>)',
          link: 'hsl(var(--fg-link) / <alpha-value>)',
        },
        type: {
          epic: { DEFAULT: '#7C3AED', border: '#5B21B6', fg: '#FFFFFF' },
          feature: { DEFAULT: '#2563EB', border: '#1E40AF', fg: '#FFFFFF' },
          story: { DEFAULT: '#059669', border: '#065F46', fg: '#FFFFFF' },
          task: { DEFAULT: '#E5E7EB', border: '#9CA3AF', fg: '#1F2937' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        xs: '2px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        pill: '999px',
      },
      boxShadow: {
        xs: '0 1px 1px rgba(11,18,32,0.04)',
        sm: '0 1px 2px rgba(11,18,32,0.06), 0 1px 1px rgba(11,18,32,0.04)',
        md: '0 4px 8px rgba(11,18,32,0.08), 0 2px 4px rgba(11,18,32,0.04)',
        lg: '0 12px 24px rgba(11,18,32,0.10), 0 4px 8px rgba(11,18,32,0.06)',
        xl: '0 24px 48px rgba(11,18,32,0.14), 0 8px 16px rgba(11,18,32,0.08)',
        focus: '0 0 0 3px rgba(61,109,253,0.40)',
        drag: '0 16px 32px rgba(11,18,32,0.18), 0 6px 12px rgba(11,18,32,0.10)',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
        emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
        exit: 'cubic-bezier(0.4, 0, 1, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '320ms',
      },
      zIndex: {
        raised: '10',
        sticky: '20',
        drawer: '40',
        modal: '50',
        popover: '60',
        toast: '70',
        tooltip: '80',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-out-right': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms cubic-bezier(0.2, 0, 0, 1)',
        'fade-out': 'fade-out 200ms cubic-bezier(0.4, 0, 1, 1)',
        'slide-in-right': 'slide-in-right 320ms cubic-bezier(0.3, 0, 0, 1)',
        'slide-out-right': 'slide-out-right 200ms cubic-bezier(0.4, 0, 1, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
