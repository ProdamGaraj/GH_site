/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Golden House Brand Colors
        gh: {
          gold: '#D29F66',
          'gold-light': '#E4C9A8',
          'gold-dark': '#B8864D',
          white: '#FFFFFF',
          black: '#403E3D',
          gray: '#B1B2B2',
          'gray-light': '#F5F5F5',
        },
      },
      fontFamily: {
        muller: ['Muller', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
