import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlateWise",
  description: "Plan the week's family dinners in a few minutes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1517" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
