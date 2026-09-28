import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CrmClient, Channel } from "../types/crm";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CHANNELS: Channel[] = [
  "call",
  "voicemail",
  "sms",
  "whatsapp",
  "messenger",
  "instagram",
  "email",
  "telegram",
];

export const channelName: Record<Channel, string> = {
  call: "Call",
  voicemail: "Voicemail",
  sms: "SMS",
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  instagram: "Instagram",
  email: "Email",
  telegram: "Telegram",
  note: "Note",
};

export const channelIcon: Record<Channel, string> = {
  call: "☎",
  voicemail: "◉",
  sms: "▤",
  whatsapp: "◉",
  messenger: "◉",
  instagram: "◎",
  email: "✉",
  telegram: "➤",
  note: "▧",
};

export const initials = (name: string): string => {
  if (!name) return "CEG";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

export const date = (v?: string | null, locale: "en" | "es" = "en"): string => {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
};

export const fullDate = (
  v?: string | null,
  locale: "en" | "es" = "en",
): string => {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

export const relative = (
  v?: string | null,
  locale: "en" | "es" = "en",
): string => {
  if (!v) return "—";
  try {
    const diffMs = Date.now() - new Date(v).getTime();
    const m = Math.max(0, Math.floor(diffMs / 60000));
    if (m < 1) return locale === "es" ? "ahora" : "now";
    if (m < 60) return `${m}m`;
    if (m < 1440) return `${Math.floor(m / 60)}h`;
    return `${Math.floor(m / 1440)}d`;
  } catch {
    return "—";
  }
};

export const money = (
  v?: number | null,
  locale: "en" | "es" = "en",
): string => {
  if (v == null) return "—";
  return new Intl.NumberFormat(locale === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
};

export function brainProfileUrl(
  template: string | undefined,
  brainUid: string | null | undefined,
): string | null {
  if (
    !brainUid ||
    !template ||
    !/^https:\/\//i.test(template) ||
    !template.includes("{uid}") ||
    template.includes("<")
  ) {
    return null;
  }
  return template.replace("{uid}", encodeURIComponent(brainUid));
}

export type ComposeRule = {
  allowed: boolean;
  remaining: string | null;
  requiresTemplate: boolean;
  humanTag: boolean;
  humanTagAvailable: boolean;
  smsWarning: boolean;
};

export function composerRule(
  client: CrmClient,
  channel: Channel,
  options: { templateName?: string; humanAgentTag?: boolean } = {},
): ComposeRule {
  const meta =
    channel === "whatsapp" ||
    channel === "messenger" ||
    channel === "instagram";
  const end = meta
    ? new Date(client.metaWindowExpiresAt[channel] || 0).getTime()
    : 0;
  const remaining =
    meta && end > Date.now()
      ? `${Math.floor((end - Date.now()) / 3600000)}h ${Math.floor(
          ((end - Date.now()) % 3600000) / 60000,
        )}m`
      : null;
  const requiresTemplate = channel === "whatsapp" && !remaining;
  const humanTag =
    (channel === "messenger" || channel === "instagram") && !remaining;
  const humanTagAvailable =
    !humanTag || (end > 0 && Date.now() - end <= 6 * 86400000);

  return {
    allowed:
      !(requiresTemplate && !options.templateName) &&
      !(humanTag && (!options.humanAgentTag || !humanTagAvailable)) &&
      !(channel === "sms" && !client.smsConsent),
    remaining,
    requiresTemplate,
    humanTag,
    humanTagAvailable,
    smsWarning: channel === "sms" && !client.smsConsent,
  };
}
