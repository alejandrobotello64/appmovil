import type { Metadata, Viewport } from "next";
import {
  DM_Sans,
  IBM_Plex_Sans,
  Inter,
  Manrope,
  Nunito,
  Roboto,
  Source_Sans_3,
} from "next/font/google";
import Script from "next/script";
import { DocumentPreviewHost } from "@/components/print/document-preview-host";
import { LocaleProvider, localeInitScript } from "@/components/locale-provider";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";
import { ZoomProvider, zoomInitScript } from "@/components/zoom-provider";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});
const ibmPlex = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
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
  minimumScale: 0.5,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3B46A5" },
    { media: "(prefers-color-scheme: dark)", color: "#00BFFF" },
  ],
};

const fontVariables = [
  manrope.variable,
  inter.variable,
  dmSans.variable,
  sourceSans.variable,
  ibmPlex.variable,
  nunito.variable,
  roboto.variable,
].join(" ");

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${fontVariables} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        <Script
          id="mas-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <Script
          id="mas-zoom-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: zoomInitScript }}
        />
        <Script
          id="mas-locale-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: localeInitScript }}
        />
        <ThemeProvider>
          <LocaleProvider>
            <ZoomProvider>
              {children}
              <DocumentPreviewHost />
            </ZoomProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
