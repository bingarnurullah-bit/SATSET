/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{svelte,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans-satset': ['Inter', 'sans-serif'],
        'serif-satset': ['Playfair Display', 'serif'],
      },
      colors: {
        'udemy-purple': '#a435f0',
        'udemy-purple-hover': '#8710d8',
        'udemy-black': '#1c1d1f',
        'udemy-gray': '#6a6f73',
        'udemy-light': '#f7f9fa',
        'gold': '#D4AF37',
        'navy': '#0F172A',
      },
      boxShadow: {
        'card-hover': '0 2px 4px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.16)',
        'float': '0 10px 25px rgba(0,0,0,0.1)',
      }
    }
  },
  plugins: [],
}