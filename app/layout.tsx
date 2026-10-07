import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/app/Providers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "XBookmarkVault",
  description: "Your X bookmarks, searchable and sorted.",
  applicationName: "XBookmarkVault",
  // Home screen install on iOS: full screen, no Safari chrome, status bar drawn over the app.
  appleWebApp: { capable: true, title: "XBookmarkVault", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the app extend under the notch and home indicator; layouts pad with env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F2EE" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1115" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${serif.variable} dark`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
