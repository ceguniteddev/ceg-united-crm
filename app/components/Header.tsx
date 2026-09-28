"use client";

import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { useCrmStore } from "../store/crmStore";
import { useAuth } from "../provider/AuthContext";
import { initials } from "../lib/utils";

export function Header() {
  const { t, labels } = useI18n();
  const { adminUser, logOut } = useAuth();
  const {
    searchQuery,
    setSearchQuery,
    agentSettings,
    setView,
    activeRepUid,
    reps,
    selectedClientId,
    clients,
    view,
  } = useCrmStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [menuOpen]);

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
  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const getTitle = () => {
    if (selectedClient) return selectedClient.displayName;
    const titles: Record<string, string> = {
      inbox: t("Inbox"),
      priority: t("Priority"),
      agent: t("AiAgent"),
      mine: t("Mine"),
      sla: t("SLA"),
      clients: t("Clients"),
      deals: t("Deals"),
      tasks: t("Tasks"),
      me: t("Me"),
    };
    return titles[view] || "CEG Console CRM";
  };

  const displayName = adminUser?.displayName || currentRep.name;
  const displayEmail = adminUser?.email || currentRep.email;

  return (
    <>
      {/* Desktop Header */}
      <header className="desktop-header">
        <div className="brand">
          <div className="brand-mark">▥</div>
          CEG <b>Console</b>
          <span>CRM</span>
        </div>

        <div className="desktop-search">
          ⌕{" "}
          <input
            placeholder={t("Search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <kbd>⌘ K</kbd>
        </div>

        <button
          type="button"
          className={`agent-pill ${agentSettings.enabled ? "on" : ""}`}
          onClick={() => setView("agent")}
        >
          ✧ {t("AiAgent")} {t(agentSettings.enabled ? "AgentOn" : "AgentOff")}
        </button>

        <div
          className="header-right"
          ref={menuRef}
          style={{ position: "relative" }}
        >
          <button
            type="button"
            className="header-user-btn"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              background: menuOpen
                ? "rgba(255, 255, 255, 0.08)"
                : "transparent",
              border: 0,
              padding: "4px 8px",
              borderRadius: "12px",
              cursor: "pointer",
              color: "inherit",
              transition: "background 150ms ease",
            }}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <span
              className={`online-dot ${currentRep.status || "available"}`}
            />
            <div className="rep-mini" style={{ textAlign: "left" }}>
              <b>{displayName}</b>
              <small>
                {adminUser ? "Admin" : labels.role(currentRep.role)} ·{" "}
                {labels.status(currentRep.status || "available")}
              </small>
            </div>
            <span className="avatar tiny">{initials(displayName)}</span>
          </button>

          {/* User Profile / Sign-out Dropdown Menu */}
          {menuOpen && (
            <div
              className="user-dropdown-menu"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: "240px",
                background: "#121d34",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "14px",
                boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
                padding: "12px",
                zIndex: 100,
                backdropFilter: "blur(20px)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                animation: "cegCardIn 180ms ease-out",
              }}
            >
              <div
                style={{
                  padding: "4px 6px 8px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <b
                  style={{
                    display: "block",
                    fontSize: "13px",
                    color: "#f5f8ff",
                  }}
                >
                  {displayName}
                </b>
                <small
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "#8a9ab8",
                    marginTop: "2px",
                    wordBreak: "break-all",
                  }}
                >
                  {displayEmail}
                </small>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#93c5fd",
                    background: "rgba(59, 130, 246, 0.16)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    marginTop: "6px",
                  }}
                >
                  System Administrator
                </span>
              </div>

              <button
                type="button"
                className="dropdown-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "transparent",
                  border: 0,
                  color: "#c7d2e6",
                  fontSize: "13px",
                  fontWeight: 500,
                  padding: "8px 10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
                onClick={() => {
                  setView("me");
                  setMenuOpen(false);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "rgba(255, 255, 255, 0.06)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#c7d2e6";
                }}
              >
                <span>👤</span>
                <span>Profile & Settings</span>
              </button>

              <button
                type="button"
                className="dropdown-item danger"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "#fca5a5",
                  fontSize: "13px",
                  fontWeight: 600,
                  padding: "8px 10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  marginTop: "4px",
                }}
                onClick={async () => {
                  setMenuOpen(false);
                  await logOut();
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.16)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
                  e.currentTarget.style.color = "#fca5a5";
                }}
              >
                <span>🚪</span>
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Header */}
      <div className="mobile-header">
        <button
          type="button"
          className="brand-mark"
          onClick={() => setView("inbox")}
        >
          ▥
        </button>
        <div>
          <strong>{getTitle()}</strong>
          <small>
            {selectedClient
              ? t("ClientIntelligence")
              : view === "inbox"
                ? `${clients.length} ${t("Conversations")}`
                : "CEG United · CRM"}
          </small>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            className="icon-btn"
            aria-label={t("SearchTooltip")}
            onClick={() =>
              document
                .querySelector<HTMLInputElement>(".mobile-search input")
                ?.focus()
            }
          >
            ⌕
          </button>
          <button
            type="button"
            className="avatar tiny"
            style={{
              width: "30px",
              height: "30px",
              fontSize: "10px",
              cursor: "pointer",
              border: "1px solid rgba(255, 255, 255, 0.15)",
            }}
            aria-label="User profile and sign out"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            {initials(displayName)}
          </button>
        </div>
      </div>
    </>
  );
}
