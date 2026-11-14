/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aero: {
          obsidian: '#050a14',
          cyan: '#00d2ff',
          cobalt: '#0051ff',
          emerald: '#00ff9d',
          ruby: '#ff1e56',
          amber: '#ffb800',
        }
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'Frutiger', '"Frutiger Linotype"', '"Dejavu Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Consolas', '"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
};
