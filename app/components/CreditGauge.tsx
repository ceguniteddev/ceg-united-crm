"use client";

import React from "react";
import type { BureauScore } from "../types/crm";
import { useI18n } from "../lib/i18n";

interface CreditGaugeProps {
  bureau: "equifax" | "experian" | "transunion";
  data?: BureauScore;
}

export function CreditGauge({ bureau, data }: CreditGaugeProps) {
  const { t, locale } = useI18n();
  const score = data?.score;

  // Determine score color and percentage (300 to 850 range)
  let color = "#ef4444"; // critical / red
  let rating = t("Fair");
  let pct = 0;

  if (score) {
    pct = Math.min(100, Math.max(0, ((score - 300) / 550) * 100));
    if (score >= 740) {
      color = "#10b981"; // excellent green
      rating = locale === "es" ? "Excelente" : "Excellent";
    } else if (score >= 670) {
      color = "#3b82f6"; // good blue
      rating = t("Good");
    } else if (score >= 580) {
      color = "#f59e0b"; // fair orange
      rating = t("Fair");
    } else {
      color = "#ef4444";
      rating = locale === "es" ? "Bajo" : "Poor";
    }
  }

  const dateStr = data?.pulledAt
    ? new Date(data.pulledAt).toLocaleDateString(
        locale === "es" ? "es-ES" : "en-US",
        {
          month: "short",
          day: "numeric",
        },
      )
    : t("NoPull");

  return (
    <div className="bureau">
      <div className="bureau-name">{bureau}</div>
      <div
        className="gauge"
        style={{
          background: score
            ? `conic-gradient(${color} ${pct}%, rgba(255,255,255,0.08) 0)`
            : "rgba(255,255,255,0.08)",
        }}
      >
        <div>
          <b>{score ?? "—"}</b>
          <small>{score ? rating : t("NoPull")}</small>
        </div>
      </div>
      <small>
        {t("LastPull")}: {dateStr}
      </small>
      {data?.change30d != null && (
        <div
          style={{
            fontSize: "10px",
            marginTop: "4px",
            color: data.change30d >= 0 ? "#34d399" : "#f87171",
          }}
        >
          {data.change30d >= 0 ? `+${data.change30d}` : data.change30d} pts
          (30d)
        </div>
      )}
    </div>
  );
}
