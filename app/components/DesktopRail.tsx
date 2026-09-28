"use client";

import React from "react";
import type { View } from "../store/crmStore";
import { useI18n } from "../lib/i18n";
import { useCrmStore } from "../store/crmStore";

export function DesktopRail() {
  const { t } = useI18n();
  const { view, setView, prioritySignals } = useCrmStore();

  const attentionCount = prioritySignals.filter((p) => p.score >= 50).length;

  const NAV_ITEMS: [View, string, string][] = [
    ["inbox", "▣", t("Inbox")],
    ["priority", "⚡", t("Priority")],
    ["agent", "✧", t("AiAgent")],
    ["mine", "♙", t("Mine")],
    ["sla", "◷", t("SLA")],
    ["clients", "♧", t("Clients")],
    ["deals", "▤", t("Deals")],
    ["tasks", "☑", t("Tasks")],
  ];

  return (
    <nav className="desktop-rail">
      <div className="rail-list">
        {NAV_ITEMS.map(([v, icon, label]) => (
          <button
            key={v}
            type="button"
            className={`rail-item ${view === v ? "active" : ""}`}
            onClick={() => setView(v)}
            title={label}
          >
            <span>{icon}</span>
            <small>{label}</small>
            {v === "priority" && attentionCount > 0 && <i>{attentionCount}</i>}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`rail-item rail-bottom ${view === "me" ? "active" : ""}`}
        onClick={() => setView("me")}
        title={t("Me")}
      >
        <span>◉</span>
        <small>{t("Me")}</small>
      </button>
    </nav>
  );
}
