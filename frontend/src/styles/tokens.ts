/** Typed CSS variable references — use instead of inline rgb(var(--primary-500)) */
export const token = {
  primary:       "rgb(var(--primary-500))",
  primaryDark:   "rgb(var(--primary-600))",
  primarySoft:   "rgb(var(--primary-500) / 0.10)",
  primaryBorder: "rgb(var(--primary-500) / 0.25)",
  primaryGlow:   "rgb(var(--primary-500) / 0.35)",
} as const;

/** Ready-to-use Tailwind class strings */
export const tw = {
  primaryBg:         "bg-[rgb(var(--primary-500))]",
  primaryBgHover:    "hover:bg-[rgb(var(--primary-600))]",
  primaryText:       "text-[rgb(var(--primary-500))]",
  /** Always white on primary backgrounds — WCAG AA compliance */
  primaryButtonText: "text-white",
} as const;
