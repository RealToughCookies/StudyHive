/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '.dark-mode'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          dark: 'var(--color-primary-dark)',
          light: 'var(--color-primary-light)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          dark: 'var(--color-secondary-dark)',
        },
        accent: 'var(--color-accent)',
      },
      backgroundColor: {
        theme: 'var(--color-bg)',
        'theme-card': 'var(--color-bg-card)',
      },
      textColor: {
        theme: 'var(--color-text)',
        'theme-secondary': 'var(--color-text-secondary)',
      },
      borderColor: {
        theme: 'var(--color-border)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
