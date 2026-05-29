/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { base: '#0b132b', surface: '#1c2541', border: '#2c3961' },
        brand: {
          400: '#34d399', 500: '#10b981', 600: '#059669',
        },
      },
    },
  },
  plugins: [],
};
