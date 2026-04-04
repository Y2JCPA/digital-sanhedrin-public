import type { Metadata } from "next";
import { Frank_Ruhl_Libre } from "next/font/google";
import "./globals.css";

const frankRuhl = Frank_Ruhl_Libre({
  variable: "--font-hebrew",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "The Digital Sanhedrin",
  description: "Interactive semicircle of the 71 scholars of the Sanhedrin HaGadol",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" className={`${frankRuhl.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
