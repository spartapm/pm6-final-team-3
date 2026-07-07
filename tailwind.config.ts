import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: "#fff8ef",
        peach: "#ff9f7a",
        apricot: "#ffd8b8",
        mint: "#bfe8dc",
        ink: "#342a24",
        soft: "#f8efe6",
      },
      boxShadow: {
        card: "0 18px 40px rgba(117, 78, 45, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
