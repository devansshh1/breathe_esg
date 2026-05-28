/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          50: "#effcf6",
          100: "#d9f8e8",
          500: "#0f8a5f",
          600: "#0b6d4a",
          700: "#0a543a",
        },
      },
      boxShadow: {
        panel: "0 18px 60px -28px rgba(15, 23, 42, 0.24)",
      },
    },
  },
  plugins: [],
};
