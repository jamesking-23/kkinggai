import type { ReactNode } from "react";
import { colors } from "@kkingg/design-tokens";

export const metadata = { title: "KKINGG AI", description: "Personal operating system" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: colors.bg,
          color: colors.text,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
