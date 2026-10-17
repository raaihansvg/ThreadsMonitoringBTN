import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "canvas-outer": "#E4E9F2",
        "frame-main": "#F4F7FB",
        "bento-well": "rgba(233, 238, 246, 0.7)",
        "card-tinted": "#EBF3FF",
        "card-brand": "#0055FF",
        "btn-blue": "#0055FF",
        "btn-red": "#E60012",
        "deep-navy": "#0A192F",
        "text-primary": "#0A192F",
        "text-secondary": "#475569",
        "text-muted": "#5A6A7E",
        "text-danger": "#C10010",
      },
      borderRadius: {
        bento: "28px",
        well: "32px",
        frame: "36px",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
export default config;
