import type { Metadata, Viewport } from "next";
import { Roboto, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeColorSync } from "@/components/ThemeColorSync";
import { headers } from "next/headers";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Residents work on their phone in daylight, so they get the light theme;
// admins spend the day in the app, so they get the dark one. The role comes
// from the proxy, before anything is painted, so nobody sees the wrong theme
// first. Either of them can switch, and their choice is remembered.
const THEME_BACKGROUND = { light: "#f0e8de", dark: "#171311" } as const;

async function defaultThemeForRequest(): Promise<"light" | "dark"> {
  const role = (await headers()).get("x-user-role");
  return role === "admin" ? "dark" : "light";
}

export async function generateMetadata(): Promise<Metadata> {
  const theme = await defaultThemeForRequest();

  return {
    title: "After-Sales Platform",
    description: "Plateforme de gestion de service après-vente",
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      // A translucent bar draws its text in white, which disappears over the
      // light theme, so only the dark default keeps it.
      statusBarStyle: theme === "dark" ? "black-translucent" : "default",
      title: "After-Sales",
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: THEME_BACKGROUND[await defaultThemeForRequest()] };
}

const CAPTURE_INSTALL_PROMPT = `
(function () {
  window.__installPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__installPrompt = e;
    window.dispatchEvent(new Event('installpromptchange'));
  });
  window.addEventListener('appinstalled', function () {
    window.__installPrompt = null;
    window.dispatchEvent(new Event('installpromptchange'));
  });
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${roboto.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: CAPTURE_INSTALL_PROMPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme={await defaultThemeForRequest()}
          enableSystem={false}
          disableTransitionOnChange={false}
        >
          <TooltipProvider>
            <ThemeColorSync colors={THEME_BACKGROUND} />
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
