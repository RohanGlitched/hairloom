import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="visually-hidden">Skip to content</a>
      <Nav />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
