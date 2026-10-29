import type { Metadata } from "next";
import { Embed } from "@/components/Embed";
import { WIGS } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Try this wig", robots: { index: false } };

/**
 * The retailer widget: an iframe-able page for one wig, e.g. /embed?wig=asha. A shop may add
 * &shop=<its https product or reserve page> to show a "Reserve" handoff back to itself.
 */
export default async function EmbedPage({ searchParams }: { searchParams: Promise<{ wig?: string; shop?: string }> }) {
  const { wig, shop } = await searchParams;
  const w = WIGS.find((x) => x.id === wig) ?? WIGS[0];
  let url: string | undefined;
  try { const u = new URL(shop ?? ""); if (u.protocol === "https:" && u.href.length <= 300) url = u.href; } catch { /* no handoff */ }
  return <Embed wigId={w.id} shop={url} />;
}
