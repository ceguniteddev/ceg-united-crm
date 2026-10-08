"use client";

import React from "react";
import type { RepStatus } from "../types/crm";
import { useI18n } from "../lib/i18n";
import { useCrmStore } from "../store/crmStore";
import { useAuth } from "../provider/AuthContext";
import { initials } from "../lib/utils";

export function MeView() {
  const { t, labels, locale, setLocale } = useI18n();
  const { adminUser, logOut } = useAuth();
  const { reps, activeRepUid, setActiveRep, setRepStatus, setView, clients } =
    useCrmStore();

  const currentRep =
    reps.find((r) => r.uid === activeRepUid) ||
    (adminUser
      ? {
          uid: adminUser.uid,
          name: adminUser.displayName,
          email: adminUser.email,
          role: "owner" as const,
          status: "available" as const,
        }
      : reps[0]!);
  const displayName = adminUser?.displayName || currentRep.name;
  const email = adminUser?.email || currentRep.email;
  const myClientsCount = clients.filter(
    (c) => c.ownerRepId === currentRep.uid || c.repIds.includes(currentRep.uid),
  ).length;

  const STATUSES: RepStatus[] = ["available", "busy", "away", "offline"];

  return (
    <div style={{ maxWidth: "800px", margin: "auto", paddingBottom: "60px" }}>
      {/* Rep Hero Card */}
      <div className="me-hero">
        <div className="hero-avatar">{initials(displayName)}</div>
        <div style={{ flex: 1 }}>
          <h2>{displayName}</h2>
          <p>{email}</p>
          <small className="muted">
            {adminUser ? "System Administrator" : labels.role(currentRep.role)}{" "}
            ·{" "}
            <span className={`rep-status ${currentRep.status}`}>
              ● {labels.status(currentRep.status)}
            </span>
          </small>
        </div>

        {/* Live Availability Selector */}
        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <small>{t("Availability")}</small>
          <select
            value={currentRep.status}
            onChange={(e) => setRepStatus(e.target.value as RepStatus)}
          >
            {STATUSES.map((st) => (
              <option value={st} key={st}>
                {labels.status(st)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gap: "12px" }}>
        {/* Account & Session Management */}
        <section className="card">
          <div className="card-head">
            <h3>Admin Account Session</h3>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ minWidth: "200px", flex: "1 1 auto" }}>
              <b style={{ display: "block", fontSize: "13px", wordBreak: "break-all" }}>
                {adminUser?.email || email}
              </b>
              <small className="muted">
                Authenticated with CEG United Administrator privileges.
              </small>
            </div>
            <button
              type="button"
              className="btn"
              style={{
                borderColor: "rgba(239, 68, 68, 0.4)",
                color: "#fca5a5",
                background: "rgba(239, 68, 68, 0.12)",
                padding: "8px 16px",
                minHeight: "38px",
              }}
              onClick={async () => {
                await logOut();
              }}
            >
              Sign Out of Console
            </button>
          </div>
        </section>

        {/* Language Selection */}
        <section className="card">
          <div className="card-head">
            <h3>{t("Language")}</h3>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className={`btn ${locale === "en" ? "primary" : ""}`}
              onClick={() => setLocale("en")}
            >
              English (US)
            </button>
            <button
              type="button"
              className={`btn ${locale === "es" ? "primary" : ""}`}
              onClick={() => setLocale("es")}
            >
              Español
            </button>
          </div>
        </section>

        {/* Rep Perspective Switcher (Development / Demo mode) */}
        <section className="card">
          <div className="card-head">
            <h3>{t("PreviewAsRep")}</h3>
          </div>
          <p className="muted" style={{ fontSize: "12px" }}>
            Switch user identity to test role-based access control, client
            masking, and assignments.
          </p>
          <select
            style={{ width: "100%", marginTop: "6px" }}
            value={activeRepUid}
            onChange={(e) => setActiveRep(e.target.value)}
          >
            {reps.map((r) => (
              <option value={r.uid} key={r.uid}>
                {r.name} · {labels.role(r.role)} ({r.status})
              </option>
            ))}
          </select>
        </section>

        {/* Shortcuts */}
        <section className="card">
          <div className="card-head">
            <h3>{t("WorkspaceHeading")}</h3>
          </div>
          <button
            type="button"
            className="workspace-link"
            onClick={() => setView("mine")}
          >
            <span>{t("MyClients")}</span>
            <b>{myClientsCount} ↗</b>
          </button>
          <button
            type="button"
            className="workspace-link"
            onClick={() => setView("deals")}
          >
            <span>{t("DealsPipeline")}</span>
            <b>7 Stages ↗</b>
          </button>
          <button
            type="button"
            className="workspace-link"
            onClick={() => setView("agent")}
          >
            <span>{t("AiAgent")}</span>
            <b>Active ↗</b>
          </button>
        </section>
      </div>
    </div>
  );
}
