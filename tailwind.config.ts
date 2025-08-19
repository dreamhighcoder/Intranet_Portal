import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      maxWidth: {
        'content': '1080px', // Reduced from 1280px for better readability
        'content-sm': '640px', // For very narrow content like forms
        'content-md': '768px', // Medium width content
        'content-lg': '960px', // Large but not full width
        'content-xl': '1080px', // Maximum content width
      },
      screens: {
        'xs': '480px',
        // Tailwind's defaults:
        // 'sm': '640px',
        // 'md': '768px',
        // 'lg': '1024px',
        // 'xl': '1280px',
        // '2xl': '1536px',
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '1.5rem',
          lg: '2rem',
        },
      },
    },
  },
  plugins: [],
}

export default config