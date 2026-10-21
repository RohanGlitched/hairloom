import type { Metadata } from "next";
import { Embed } from "@/components/Embed";
import { WIGS } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Try this wig", robots: { index: false } };

/** The retailer widget: an iframe-able page for one wig, e.g. /embed?wig=asha */
export default async function EmbedPage({ searchParams }: { searchParams: Promise<{ wig?: string }> }) {
  const { wig } = await searchParams;
  const w = WIGS.find((x) => x.id === wig) ?? WIGS[0];
  return <Embed wigId={w.id} />;
}
