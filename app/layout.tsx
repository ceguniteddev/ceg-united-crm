import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "./lib/i18n";
import { AuthProvider } from "./provider/AuthContext";
import RecaptchaGate from "./components/RecaptchaGate";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#060b18",
};

export const metadata: Metadata = {
  title: "CEG Console · CRM",
  description:
    "Omnichannel Client Relationship Management System for CEG United",
  icons: {
    icon: "/icon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="min-h-full bg-[#060b18] text-[#e6ebf5] antialiased overflow-x-hidden">
        <AuthProvider>
          <I18nProvider>{children}</I18nProvider>
          <RecaptchaGate />
        </AuthProvider>
      </body>
    </html>
  );
}
