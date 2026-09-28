"use client";

import React from "react";
import Image from "next/image";
import type { BureauScore } from "../types/crm";
import { useI18n } from "../lib/i18n";

interface CreditGaugeProps {
  bureau: "equifax" | "experian" | "transunion";
  data?: BureauScore;
}

function fmtPulled(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const nth = (day: number) => {
    if (day > 3 && day < 21) return "th";
    switch (day % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day}${nth(day)}, ${year}`;
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

  const dateStr = data?.pulledAt ? fmtPulled(data.pulledAt) : t("NoPull");

  const logoFileName =
    bureau === "equifax"
      ? "Equifax.png"
      : bureau === "experian"
        ? "Experian.png"
        : "Transunion.png";

  const bureauTitle = bureau.charAt(0).toUpperCase() + bureau.slice(1);

  const delta =
    data?.delta !== undefined
      ? data.delta
      : score !== null && score !== undefined && data?.prevScore !== undefined
        ? score - data.prevScore
        : undefined;

  const prevScore = data?.prevScore;

  return (
    <div className="bureau">
      {/* Bureau Logo Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: "6px",
        }}
      >
        <div
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            padding: "4px 10px",
            borderRadius: "6px",
            height: "28px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        >
          <Image
            src={`/icons/${logoFileName}`}
            alt={bureauTitle}
            width={80}
            height={22}
            style={{
              height: "20px",
              width: "auto",
              objectFit: "contain",
            }}
          />
        </div>
      </div>

      {/* Score Gauge */}
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

      <small style={{ display: "block", color: "var(--ink-4)" }}>
        {data?.pulledAt ? dateStr : `${t("LastPull")}: ${t("NoPull")}`}
      </small>

      {/* Delta & Previous Score */}
      {delta !== undefined && (
        <div style={{ marginTop: "6px", textAlign: "center" }}>
          <div
            style={{
              fontSize: "18px",
              fontWeight: "800",
              lineHeight: 1.1,
              color:
                delta > 0 ? "#34d399" : delta < 0 ? "#f87171" : "var(--ink-4)",
            }}
          >
            {delta > 0 ? `+${delta}` : delta}
          </div>
          {prevScore !== undefined && (
            <div
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: "var(--ink-3)",
                marginTop: "2px",
              }}
            >
              Prev Score: {prevScore}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
