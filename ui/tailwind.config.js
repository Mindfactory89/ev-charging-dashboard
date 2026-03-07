/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'SF Pro Display', 'Inter', 'Segoe UI', 'Roboto', 'Arial']
      },
      boxShadow: {
        glass: "0 10px 30px rgba(0,0,0,0.55)",
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px rgba(0,0,0,0.55)"
      }
    }
  },
  plugins: []
}
