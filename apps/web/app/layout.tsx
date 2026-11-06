import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "KKINGG AI", description: "Personal operating system" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="m-0 min-h-screen antialiased">{children}</body>
    </html>
  );
}
