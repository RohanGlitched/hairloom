import type { Metadata } from "next";
import { Studio } from "@/components/studio/Studio";

export const metadata: Metadata = {
  title: "Studio",
  description: "Keep a record of your hair, try wigs, brows and headwear on your own face, and send a sealed shortlist to your wig fitter.",
};

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ p?: string; step?: string; wig?: string }> }) {
  const { p, step, wig } = await searchParams;
  return (
    <div className="wrap">
      <Studio initialPersona={p} initialStep={step} initialWig={wig} />
    </div>
  );
}
