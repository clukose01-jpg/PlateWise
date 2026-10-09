import type { Metadata } from "next";
import CompareTool from "@/components/CompareTool";

export const metadata: Metadata = {
  title: "Speed test · PlateWise",
  robots: { index: false, follow: false },
};

export default function ComparePage() {
  return <CompareTool />;
}
