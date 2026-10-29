import type { Metadata, Viewport } from "next";
import { Albert_Sans, Bodoni_Moda } from "next/font/google";
import "./globals.css";

const bodoni = Bodoni_Moda({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-bodoni", display: "swap" });
const albert = Albert_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-albert", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_ORIGIN ?? "https://hairloom-studio.vercel.app"),
  title: { default: "Hairloom: your own hair, back at week 4", template: "%s · Hairloom" },
  description:
    "Your own hair, back at week 4: Hairloom keeps a record of your hair before treatment, then puts that hair, any wig, a headscarf or your brows back on your own photo, and sends your fitter one sealed brief. Choose your wig while you still have your hair. Built on the YouCam API.",
};

export const viewport: Viewport = { themeColor: "#24192a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodoni.variable} ${albert.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
