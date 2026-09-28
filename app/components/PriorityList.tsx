"use client";

import React from "react";
import { useI18n } from "../lib/i18n";
import { useCrmStore } from "../store/crmStore";
import { ScoreRing } from "./ScoreRing";
import { PRIORITY_ORDER } from "../lib/priority";

export function PriorityList() {
  const { t, labels } = useI18n();
  const {
    prioritySignals,
    priorityFilter,
    setPriorityFilter,
    setSelectedClient,
    setView,
    claimLead,
    setComposeChannel,
  } = useCrmStore();

  const filtered = prioritySignals.filter((item) => {
    if (priorityFilter === "all") return true;
    return item.signals.some((s) => s.type === priorityFilter);
  });

  const needAttentionCount = prioritySignals.filter(
    (p) => p.score >= 50,
  ).length;
  const missedCallsCount = prioritySignals.filter((p) =>
    p.signals.some((s) => s.type === "missed_call"),
  ).length;
  const unansweredCount = prioritySignals.filter((p) =>
    p.signals.some((s) => s.type === "unanswered"),
  ).length;
  const pastDueCount = prioritySignals.filter((p) =>
    p.signals.some((s) => s.type === "overdue_payment"),
  ).length;

  const handleOpen = (item: (typeof prioritySignals)[0]) => {
    if (item.clientId) {
      setSelectedClient(item.clientId);
      setView("inbox");
    }
  };

  const handleAction = (item: (typeof prioritySignals)[0]) => {
    if (item.kind === "lead" && item.leadId) {
      claimLead(item.leadId);
    } else if (item.clientId) {
      setSelectedClient(item.clientId);
      setView("inbox");
      setComposeChannel("sms");
    }
  };

  return (
    <div className="prio">
      {/* Summary Stat Grid */}
      <div className="prio-summary">
        <div className="ps-big">
          <b>{needAttentionCount}</b>
          <span>{t("NeedAttention")}</span>
        </div>
        <div>
          <b>{missedCallsCount}</b>
          <span>{t("MissedCalls")}</span>
        </div>
        <div>
          <b>{unansweredCount}</b>
          <span>{t("Unanswered")}</span>
        </div>
        <div>
          <b>{pastDueCount}</b>
          <span>{t("PastDue")}</span>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="chip-scroll prio-chips">
        <button
          type="button"
          className={`chip ${priorityFilter === "all" ? "active" : ""}`}
          onClick={() => setPriorityFilter("all")}
        >
          {t("AllPriority")}
        </button>
        {PRIORITY_ORDER.map((type) => (
          <button
            key={type}
            type="button"
            className={`chip ${priorityFilter === type ? "active" : ""}`}
            onClick={() => setPriorityFilter(type)}
          >
            {labels.priority(type)}
          </button>
        ))}
      </div>

      {/* Action Queue Cards */}
      {filtered.length === 0 ? (
        <div className="empty">{t("NoResults")}</div>
      ) : (
        filtered.map((item, index) => {
          const isCritical = item.score >= 70;
          const isWarn = item.score >= 40 && item.score < 70;

          return (
            <article
              className={`prio-card ${isCritical ? "lvl-critical" : isWarn ? "lvl-warn" : ""}`}
              key={item.id}
            >
              <div className="pc-top">
                <span className="rank">#{index + 1}</span>
                <div className="pc-id">
                  <b>{item.displayName}</b>
                  <small>
                    {item.phone || item.email || ""}{" "}
                    {item.kind === "lead" ? `· ${t("NewLead")}` : ""}
                  </small>
                </div>
                <ScoreRing score={item.score} />
              </div>

              {/* Urgency signal badges */}
              <div className="pc-flags">
                {item.signals.map((s, idx) => (
                  <span
                    className={`pf ${s.type === "overdue_payment" || s.type === "missed_call" ? "critical" : ""}`}
                    key={idx}
                  >
                    {labels.priority(s.type)}: {s.label}
                  </span>
                ))}
              </div>

              <div className="actions">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => handleAction(item)}
                >
                  {item.kind === "lead" ? t("Claim") : `${t("Respond")} ↗`}
                </button>
                {item.clientId && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleOpen(item)}
                  >
                    {t("Open")}
                  </button>
                )}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
