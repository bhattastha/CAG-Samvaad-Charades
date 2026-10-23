/** Design tokens: CLAUDE.md §7 + the CAG Anuvaad visual language (navy, saffron, gold) for a professional game portal. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#E85A1A", strong: "#C2410C", soft: "#FFF3EB", ring: "#FDBA74" },
        royal: { DEFAULT: "#13315C", bright: "#1D4E89", soft: "#EEF3F9", deep: "#0B2545" },
        navy: { DEFAULT: "#0B2545", 900: "#071A33", 800: "#0B2545", 700: "#13315C", 600: "#1D4E89", 50: "#F1F5FA" },
        ink: "#0F172A",
        cream: "#FBF7F0",
        muted: "#5B6576",
        success: { DEFAULT: "#15803D", soft: "#DCFCE7" },
        timer: { bg: "#FDECEC", text: "#B42318" },
        gold: { DEFAULT: "#C49B3D", light: "#E9D7A6", soft: "#FBF6EA", deep: "#8A6A1F" },
      },
      fontFamily: {
        sans: ['"Noto Sans Devanagari"', '"Noto Sans"', "system-ui", "sans-serif"],
        latin: ['"Noto Sans"', "system-ui", "sans-serif"],
      },
      borderRadius: { card: "12px", ui: "8px" },
      boxShadow: {
        card: "0 1px 2px rgba(11,37,69,.06), 0 6px 24px -12px rgba(11,37,69,.14)",
        pop: "0 24px 60px -20px rgba(11,37,69,.45)",
        glow: "0 6px 18px -6px rgba(232,90,26,.5)",
        gold: "0 0 0 1px rgba(196,155,61,.5), 0 8px 26px -10px rgba(196,155,61,.6)",
      },
      keyframes: {
        pop: { "0%": { transform: "scale(.6)", opacity: "0" }, "70%": { transform: "scale(1.08)" }, "100%": { transform: "scale(1)", opacity: "1" } },
        rise: { "0%": { transform: "translateY(12px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        shine: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        wiggle: { "0%,100%": { transform: "rotate(0)" }, "25%": { transform: "rotate(-6deg)" }, "75%": { transform: "rotate(6deg)" } },
        breathe: { "0%,100%": { transform: "scale(1)" }, "50%": { transform: "scale(1.045)" } },
      },
      animation: {
        pop: "pop .5s cubic-bezier(.2,.9,.3,1.3) both",
        rise: "rise .45s ease-out both",
        float: "float 4s ease-in-out infinite",
        shine: "shine 2.5s linear infinite",
        wiggle: "wiggle .5s ease-in-out",
        breathe: "breathe 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
