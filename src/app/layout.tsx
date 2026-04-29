import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import { AppearancePreferenceBridge } from "@/components/shared/AppearancePreferenceBridge";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ledgerify",
  description: "A private, family-friendly money home for everyday clarity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppearancePreferenceBridge />
        {children}
      </body>
    </html>
  );
}
