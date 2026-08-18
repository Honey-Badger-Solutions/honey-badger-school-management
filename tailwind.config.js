/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Honey-on-paper — carried over from HoneyBadger Courses (light theme)
        paper: '#FAF7F0',
        surface: '#FFFFFF',
        surface2: '#F4EFE3',
        surface3: '#E9E2D0',
        line: '#E0D8C4',
        'line-soft': '#EBE4D3',
        ink: '#1D1810',
        soft: '#5C5544',
        dim: '#8B8371',
        gold: '#A87800',
        honey: '#F0B400',
        'honey-dark': '#DD8600',
        amber: '#C2620A',
        good: '#188A57',
        warn: '#D64545',
      },
      fontFamily: {
        display: ['Montserrat', 'Noto Sans Ethiopic', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'Noto Sans Ethiopic', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '12px',
        xl: '14px',
        '2xl': '18px',
      },
      boxShadow: {
        card: '0 6px 24px rgba(96,78,24,.10)',
        lift: '0 18px 50px rgba(96,78,24,.16)',
      },
      maxWidth: {
        app: '1180px',
      },
    },
  },
  plugins: [],
}
