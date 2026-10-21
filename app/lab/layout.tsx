import { notFound } from "next/navigation";

// Build helpers only: never served in production.
export default function LabLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
