"use client";

import React from "react";
import type { CrmClient, Channel, AppSettings, Role } from "../types/crm";
import { useI18n } from "../lib/i18n";
import { channelIcon, initials } from "../lib/utils";
import { BrainLink } from "./BrainLink";
import { useCrmStore } from "../store/crmStore";

interface ScreenpopCardProps {
  client: CrmClient;
  channel: Channel;
  settings?: AppSettings;
  role?: Role;
  onAccept: () => void;
  onDismiss: () => void;
}

export function ScreenpopCard({
  client,
  channel,
  settings,
  role = "rep",
  onAccept,
  onDismiss,
}: ScreenpopCardProps) {
  const { t, labels } = useI18n();
  const { profiles } = useCrmStore();
  const profile = profiles[client.id];

  const scores = profile
    ? Object.entries(profile.credit)
        .map(
          ([name, v]) => `${name.slice(0, 3).toUpperCase()} ${v.score ?? "—"}`,
        )
        .join(" · ")
    : t("CreditLoading");

  return (
    <div className="popup">
      <div className="pop-head">
        <span className={`ch-icon ${channel}`}>{channelIcon[channel]}</span>{" "}
        {t(channel === "call" ? "IncomingCall" : "NewMessage")} ·{" "}
        {labels.channel(channel)} <b>{t("Live")}</b>
      </div>

      <div className="pop-avatar">{initials(client.displayName)}</div>
      <h2>{client.displayName}</h2>
      <p className="muted">
        {profile?.business.name || client.tags.slice(0, 2).join(" · ")} ·{" "}
        {t("Owner")}:{" "}
        {client.ownerRepId?.replace("rep_", "") || t("Unassigned")}
      </p>

      <div className="pop-snap">
        <b>{t("ClientSnapshot")}</b>
        <div className="pop-facts">
          <span>{scores}</span>
          <span>
            {profile?.billing?.status
              ? t(
                  (
                    {
                      current: "Current",
                      past_due: "PastDueStatus",
                      failed: "Failed",
                      canceled: "Canceled",
                      trial: "Trial",
                      unknown: "Unknown",
                    } as const
                  )[profile.billing.status] || "Unknown",
                )
              : t("MembershipPending")}
          </span>
          <span>{labels.stage(profile?.lifecycle.stage || "Client")}</span>
        </div>
        {client.aiSummary && <p>✧ {client.aiSummary.text.slice(0, 160)}…</p>}
        <small>
          {client.handles.phones[0] || ""}{" "}
          {client.handles.emails[0] ? `· ${client.handles.emails[0]}` : ""}
        </small>
        <div style={{ marginTop: "6px" }}>
          ⚡ {t(client.highPriority ? "HighPriorityClient" : "ReviewHistory")}
        </div>
      </div>

      <div className="actions">
        <button className="btn primary" onClick={onAccept}>
          {t(channel === "call" ? "Answer" : "Open")}
        </button>
        <BrainLink client={client} settings={settings} role={role} />
        <button className="btn" onClick={onDismiss}>
          {t("Dismiss")}
        </button>
      </div>
    </div>
  );
}
