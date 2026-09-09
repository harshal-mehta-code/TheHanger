import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
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
  themeColor: "#2f2d02",
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
        {/* Light unless she has explicitly chosen dark. Resolved before first
            paint so the page never flashes one theme then the other. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.dataset.theme=localStorage.getItem("hanger-theme")==="dark"?"dark":"light";}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        <AuthProvider>
          <ClosetProvider>{children}</ClosetProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
