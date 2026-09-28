import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "./lib/i18n";
import { AuthProvider } from "./provider/AuthContext";

export const metadata: Metadata = {
  title: "CEG Console · CRM",
  description:
    "Omnichannel Client Relationship Management System for CEG United",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-[#060b18] text-[#e6ebf5] antialiased overflow-hidden">
        <AuthProvider>
          <I18nProvider>{children}</I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
