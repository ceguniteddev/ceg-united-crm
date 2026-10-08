"use client";

import React from "react";
import type { View } from "../store/crmStore";
import { useI18n } from "../lib/i18n";
import { useCrmStore } from "../store/crmStore";

export function MobileTabbar() {
  const { t } = useI18n();
  const { view, setView, prioritySignals } = useCrmStore();

  const attentionCount = prioritySignals.filter((p) => p.score >= 50).length;

  const TABS: [View, string, string][] = [
    ["inbox", "▣", t("Inbox")],
    ["clients", "♧", t("Clients")],
    ["priority", "⚡", t("Priority")],
    ["tasks", "☑", t("Tasks")],
    ["me", "◉", t("Me")],
  ];

  return (
    <nav className="mobile-tabbar" aria-label="Mobile Navigation">
      {TABS.map(([v, icon, label]) => {
        const isPriority = v === "priority";
        const isActive = view === v;

        return (
          <button
            key={v}
            type="button"
            className={`mobile-tab ${isPriority ? "center" : ""} ${isActive ? "active" : ""}`}
            onClick={() => setView(v)}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
          >
            <span className={isPriority ? "prio-fab" : ""}>{icon}</span>
            <small>{label}</small>
            {isPriority && attentionCount > 0 && <i>{attentionCount}</i>}
          </button>
        );
      })}
    </nav>
  );
}
