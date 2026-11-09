import type { Metadata, Viewport } from "next";
import { DM_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", axes: ["wdth"], display: "swap" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Basket: personal inflation from your own receipts", template: "%s · Basket" },
  description: "Basket reads your grocery receipts, remembers every price on Walrus Memory and shows the inflation of the things you actually buy.",
  applicationName: "Basket",
};

export const viewport: Viewport = {
  themeColor: "#1c1c1c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-radius="round" className={`${instrument.variable} ${dmMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
