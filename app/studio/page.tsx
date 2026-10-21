import type { Metadata } from "next";
import { Studio } from "@/components/studio/Studio";

export const metadata: Metadata = {
  title: "Studio",
  description: "Keep a hair passport, try wigs, brows and headwear on your own face, and send a sealed shortlist to your wig fitter.",
};

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  return (
    <div className="wrap">
      <Studio initialPersona={p} />
    </div>
  );
}
