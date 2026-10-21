import type { Metadata } from "next";
import { Journal } from "@/components/journal/Journal";

export const metadata: Metadata = {
  title: "Journal",
  description: "A plan for wigs, headwear and brows, by treatment dates or for alopecia and thinning, with optional skin check-ins.",
};

export default function JournalPage() {
  return (
    <>
      <section className="night" style={{ padding: "64px 0 8px" }}>
        <div className="wrap">
          <p className="kicker">Journal</p>
          <h1 className="h-hero" style={{ maxWidth: "16ch" }}>Plan around your hair.</h1>
          <p className="lede" style={{ marginTop: 14 }}>
            Enter your treatment dates, or choose alopecia or thinning, and Hairloom lays out when to keep your passport, choose a wig, expect changes and look for regrowth. Add a skin check-in once a cycle if it helps.
          </p>
        </div>
      </section>
      <Journal />
    </>
  );
}
