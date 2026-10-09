import { passcodeMatches } from "@/lib/compare-access";

// Makes the admin page its own icon on the home screen. The icon opens the page with the passcode,
// so it works without typing it. The passcode is only added for someone who already has it.
export function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code") ?? "";
  const startUrl = passcodeMatches(code) ? `/admin?code=${encodeURIComponent(code)}` : "/admin";
  return Response.json(
    {
      id: "/admin",
      name: "PlateWise Admin",
      short_name: "PW Admin",
      description: "How PlateWise is doing.",
      start_url: startUrl,
      scope: "/admin",
      display: "standalone",
      background_color: "#fbf5ee",
      theme_color: "#fbf5ee",
      icons: [
        { src: "/icons/admin-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/admin-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/admin-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "private, no-store" } },
  );
}
