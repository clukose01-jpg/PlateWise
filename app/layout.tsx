import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlateWise",
  description: "Plan the week's family dinners in a few minutes.",
  // On iPhone, opening from the home screen shows PlateWise full screen, like an app.
  appleWebApp: { capable: true, title: "PlateWise", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the tab bar sit above the iPhone home bar.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf5ee" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1b1a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
