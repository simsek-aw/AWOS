import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AWOS — Agency CMS",
  description: "Schlankes, personalisiertes Agentur-CMS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
