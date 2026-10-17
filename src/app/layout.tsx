import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "600", "700", "800"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Love Fusion Badminton League — Predict the Top 2",
    template: "%s | Love Fusion Badminton League",
  },
  description:
    "Predict the top 2 qualifiers from each group and win ₹11,000! Vadodara's premier badminton tournament — 16 teams, 4 groups, 24–25 October 2026.",
  keywords: [
    "Love Fusion Cup",
    "Badminton League",
    "Prediction Contest",
    "Vadodara",
    "Mowgly Ventures",
  ],
  authors: [{ name: "Mowgly Ventures" }],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "Love Fusion Badminton League",
    title: "Love Fusion Badminton League — Predict the Top 2",
    description: "Predict the top 2 qualifiers from each group and win ₹11,000!",
  },
  twitter: {
    card: "summary_large_image",
    title: "Love Fusion Badminton League — Predict the Top 2",
    description: "Predict the top 2 qualifiers from each group and win ₹11,000!",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} dark`}>
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}
