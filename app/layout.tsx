import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import PWARegister from "@/components/PWARegister";
import "./globals.css";

// Montserrat for headings / big display type (exposed as --font-heading).
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AWOS — Agency CMS",
  description: "Schlankes, personalisiertes Agentur-CMS",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "AWOS", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1117",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={montserrat.variable}>
      <head>
        {/* Apply the saved theme before first paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('awos-theme');if(t==='light'||t==='dark'||t==='aw')document.documentElement.dataset.theme=t;}catch(e){}",
          }}
        />
      </head>
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
