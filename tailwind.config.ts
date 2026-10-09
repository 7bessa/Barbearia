import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'barber-bg': '#0A0A0A',
        'barber-card': '#141414',
        'barber-border': '#2A2A2A',
        'barber-gold': '#D4AF37',
        'barber-gold-hover': '#B8962E',
      },
      fontFamily: {
        serif: ['Playfair Display', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
