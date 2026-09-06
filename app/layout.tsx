import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { ClosetProvider } from "@/lib/store";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: "The Hanger — your wardrobe, beautifully kept",
  description:
    "A calm, fashion-first way to catalogue every piece you own, see what you actually wear, and rediscover the rest.",
  applicationName: "The Hanger",
  appleWebApp: { capable: true, title: "The Hanger", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#fbf6f0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh antialiased">
        <ClosetProvider>{children}</ClosetProvider>
      </body>
    </html>
  );
}
