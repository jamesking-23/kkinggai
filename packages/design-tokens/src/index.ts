/** Dark graphite base, electric blue primary, restrained violet secondary. */
export const colors = {
  bg: "#0e1014",
  surface: "#161920",
  surfaceRaised: "#1d212a",
  border: "#2a2f3a",
  text: "#e8eaf0",
  textMuted: "#8b93a5",
  primary: "#2f7bff",
  accent: "#7c6cf0",
  success: "#2fbf71",
  warning: "#e0a030",
  danger: "#e5484d",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14 } as const;

export type ColorToken = keyof typeof colors;
