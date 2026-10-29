import type { Metadata } from "next";
import { FitterDesk } from "@/components/fitter/FitterDesk";

export const metadata: Metadata = {
  title: "Fitter desk",
  description: "Open a client's sealed kept-hair record and shortlist before their wig fitting, and tag stock from photos.",
};

export default function FitterPage() {
  return <FitterDesk />;
}
