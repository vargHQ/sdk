/**
 * Design System for Varg CLI
 * Luxury Minimal aesthetic - Vercel/Linear inspired
 */

export const theme = {
  colors: {
    // Primary accent - single color for emphasis
    accent: "cyan",

    // Semantic colors
    success: "green",
    error: "red",
    warning: "yellow",

    // Neutrals (Ink uses color names, not hex)
    text: {
      primary: "white",
      secondary: "gray",
      muted: "gray",
    },

    // Borders
    border: "gray",
  },

  spacing: {
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
  },

  borders: {
    style: "round" as const, // Rounded corners: ╭╮╰╯
  },

  animation: {
    // Elegant braille spinner
    spinnerFrames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    spinnerInterval: 80,
  },

  layout: {
    maxWidth: 64,
    boxPadding: 1,
  },
} as const;

// Status icons - refined geometric shapes
export const icons = {
  running: "●",
  success: "✓",
  error: "✗",
  warning: "!",
  info: "○",
  arrow: "→",
  bullet: "·",
  required: "*",
} as const;

export type ThemeColors = keyof typeof theme.colors;
