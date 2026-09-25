import type { Metadata, Viewport } from "next";
import { Inter, Oswald } from "next/font/google";
import { APP_NAME, TEAM_NAME, TEAM_NUMBER } from "@/lib/constants";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: `Tasks, checklists, and Q&A for FTC ${TEAM_NUMBER} ${TEAM_NAME}.`,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: "Huskyteers", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#4CA256",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
