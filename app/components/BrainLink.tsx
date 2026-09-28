"use client";

import React from "react";
import type { AppSettings, CrmClient, Role } from "../types/crm";
import { can } from "../lib/permissions";
import { useI18n } from "../lib/i18n";
import { brainProfileUrl } from "../lib/utils";

interface BrainLinkProps {
  client: CrmClient;
  settings?: AppSettings;
  role?: Role;
}

export function BrainLink({ client, settings, role = "rep" }: BrainLinkProps) {
  const { t } = useI18n();

  if (!can(role, "openBrainAdmin")) {
    return null;
  }

  const url = brainProfileUrl(
    settings?.brainAdminUrl ||
      "https://cegunitedllc.firebaseapp.com/admin/clients/{uid}",
    client.brainUid,
  );

  if (!client.brainUid || !url) {
    return (
      <span className="brain-btn disabled" title={t("BrainLinkTooltip")}>
        ✦ {t("BrainLink")}
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="brain-btn"
      title={t("BrainLink")}
    >
      ✦ {t("BrainLink")} ↗
    </a>
  );
}
