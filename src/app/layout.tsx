import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import Script from "next/script";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Medical Advanced Supplies",
  title: {
    default: "Medical Advanced Supplies",
    template: "%s | Medical Advanced Supplies",
  },
  description:
    "Sistema interno de almacén e inventario — Medical Advanced Supplies",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MAS",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    title: "Medical Advanced Supplies",
    description: "Sistema interno de almacén e inventario",
    siteName: "Medical Advanced Supplies",
    images: [{ url: "/assets/logo.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3B46A5" },
    { media: "(prefers-color-scheme: dark)", color: "#00BFFF" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        <Script
          id="mas-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
