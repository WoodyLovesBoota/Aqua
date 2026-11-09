import type { Metadata, Viewport } from "next";

import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.scss";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: { default: "Aqua — Plush Sea Creatures", template: "%s — Aqua" },
  description: "A tiny jelly lagoon to watch — customise plush sea creatures and release them into the water.",
};

export const viewport: Viewport = {
  themeColor: "#ebe7e0",
  // 캔버스가 화면을 꽉 채우므로 핀치 줌은 막지 않되 레이아웃 폭은 기기에 맞춘다
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrument.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
