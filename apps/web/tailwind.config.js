/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ember: '#fc5000',
        plasma: '#524ae9',
        sulfur: '#f5f28e',
        limestone: '#f7f6f2',
        pumice: '#e2e2df',
        obsidian: '#070607',
        chalk: '#ffffff',
        // Semantic aliases
        background: '#e2e2df',
        surface: '#f7f6f2',
        border: '#e2e2df',
        primary: '#fc5000',
        accent: '#524ae9',
      },
      fontFamily: {
        display: ['Bebas Neue', 'Anton', 'ui-sans-serif', 'sans-serif'],
        sans: ['DM Sans', 'ui-sans-serif', 'sans-serif'],
      },
      borderRadius: {
        'card': '40px',
        'pill': '800px',
        'input': '100px',
      },
    },
  },
  plugins: [],
};
