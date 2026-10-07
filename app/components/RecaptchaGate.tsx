"use client";
import { usePathname } from "next/navigation";
import Script from "next/script";

export default function RecaptchaGate() {
  const pathname = usePathname();
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  if (!siteKey) {
    return null;
  }

  return (
    <Script
      key={pathname}
      strategy="afterInteractive"
      src={`https://www.google.com/recaptcha/enterprise.js?render=${siteKey}`}
    />
  );
}
