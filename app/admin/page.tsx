import type { Metadata } from "next";
import AdminDashboard from "@/components/AdminDashboard";
import { passcodeMatches } from "@/lib/compare-access";

type Props = { searchParams: Promise<{ code?: string | string[] }> };

// Its own home screen icon and name, so it isn't mixed up with the family app.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { code } = await searchParams;
  const manifest =
    typeof code === "string" && passcodeMatches(code)
      ? `/api/admin/manifest?code=${encodeURIComponent(code)}`
      : "/api/admin/manifest";
  return {
    manifest,
    icons: { icon: "/icons/admin-192.png", apple: "/icons/admin-apple.png" },
    appleWebApp: { capable: true, title: "PW Admin", statusBarStyle: "default" },
  };
}

export default function AdminPage() {
  return <AdminDashboard />;
}
