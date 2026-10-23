/** Design tokens from CLAUDE.md §7, brightened per the client's light, playful brief. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#E8590C", strong: "#C2410C", soft: "#FFF1E6", ring: "#FDBA74" },
        royal: { DEFAULT: "#1D4ED8", bright: "#2563EB", soft: "#EAF2FF", deep: "#1E3A8A" },
        navy: "#22293B",
        cream: "#FCF3EA",
        muted: "#6B7280",
        success: { DEFAULT: "#16A34A", soft: "#DCFCE7" },
        timer: { bg: "#FDECEC", text: "#B42318" },
        gold: "#F59E0B",
      },
      fontFamily: {
        sans: ['"Noto Sans Devanagari"', '"Noto Sans"', "system-ui", "sans-serif"],
        latin: ['"Noto Sans"', "system-ui", "sans-serif"],
      },
      borderRadius: { card: "12px" },
      boxShadow: {
        card: "0 4px 20px -6px rgba(34,41,59,.12), 0 1px 3px rgba(34,41,59,.06)",
        pop: "0 18px 50px -12px rgba(29,78,216,.28)",
        glow: "0 8px 24px -6px rgba(232,89,12,.55)",
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
