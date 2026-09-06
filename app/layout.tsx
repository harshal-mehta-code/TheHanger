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
    // The theme script below stamps data-theme on this element before React
    // hydrates, which is a deliberate server/client difference.
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Resolve the theme before first paint so the page never flashes
            light before switching to dark. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("hanger-theme")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme:dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        <ClosetProvider>{children}</ClosetProvider>
      </body>
    </html>
  );
}
