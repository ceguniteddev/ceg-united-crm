"use client";

import React from "react";
import type { CrmClient } from "../types/crm";
import { useI18n } from "../lib/i18n";
import { money, initials, fullDate } from "../lib/utils";
import { useCrmStore } from "../store/crmStore";
import { useAuth } from "../provider/AuthContext";
import { CreditGauge } from "./CreditGauge";
import { BrainLink } from "./BrainLink";
import { redactProfile } from "../lib/permissions";
import { PositiveAccountsCard } from "./PositiveAccountsCard";
import { DisputesCard } from "./DisputesCard";

interface ClientProfileProps {
  client: CrmClient;
  onCall: () => void;
  onCompose: () => void;
}

export function ClientProfile({
  client,
  onCall,
  onCompose,
}: ClientProfileProps) {
  const { t, labels, locale } = useI18n();
  const { adminUser } = useAuth();
  const {
    appSettings,
    tasks,
    activeRepUid,
    reps,
    refreshAiSummary,
    profiles,
    loadClient360,
  } = useCrmStore();

  React.useEffect(() => {
    if (!profiles[client.id]) {
      loadClient360(client.id);
    }
  }, [client.id, profiles, loadClient360]);

  const rawProfile = profiles[client.id] || null;
  const currentRep = reps.find((r) => r.uid === activeRepUid);
  const role =
    (adminUser?.role === "Admin" ? "admin" : currentRep?.role) || "admin";
  const isOwnClient =
    client.ownerRepId === activeRepUid || client.repIds.includes(activeRepUid);

  const profile = rawProfile
    ? redactProfile(rawProfile, role, isOwnClient).profile
    : null;

  // Calculate average FICO score
  const validScores = profile
    ? [
        profile.credit.equifax.score,
        profile.credit.experian.score,
        profile.credit.transunion.score,
      ].filter((s): s is number => s !== null)
    : [];
  const avgFico = validScores.length
    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    : null;
  const openTasksCount = tasks.filter(
    (t) => t.clientId === client.id && t.status !== "done",
  ).length;

  const STAGES = [
    "Lead",
    "Diagnostic",
    "Enrolled",
    "Repair",
    "Build",
    "Fund",
    "Funded",
  ] as const;
  const currentStage = profile?.lifecycle.stage || "Lead";

  return (
    <div className="profile">
      {/* Hero Header */}
      <div className="hero">
        <div className="hero-id">
          <div className="hero-avatar">{initials(client.displayName)}</div>
          <div className="hero-txt">
            <h1>{client.displayName}</h1>
            <div className="hero-badges">
              <span className="lane-pill">{labels.stage(currentStage)}</span>
              {client.tags.map((tag) => (
                <span className="badge" key={tag}>
                  {tag}
                </span>
              ))}
              {client.vip && <span className="mini-badge ai">★ VIP</span>}
            </div>
          </div>
          <div className="actions" style={{ marginLeft: "auto" }}>
            <button
              className="icon-btn"
              title={t("CallTooltip")}
              onClick={onCall}
            >
              ☎
            </button>
            <button className="btn primary" onClick={onCompose}>
              {t("Reply")} ↗
            </button>
            <BrainLink client={client} settings={appSettings} role={role} />
          </div>
        </div>

        {/* Hero Quick Stats */}
        <div className="hero-stats">
          <div>
            <small>{t("AvgFico")}</small>
            <b>{avgFico ?? "—"}</b>
          </div>
          <div>
            <small>{t("Membership")}</small>
            <b className="sm">
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
                    )[profile.billing.status] || "—",
                  )
                : "—"}
            </b>
            {profile?.billing?.walletBalance != null && (
              <span
                style={{
                  fontSize: "10px",
                  color: "#34d399",
                  fontWeight: 600,
                  display: "block",
                  marginTop: "2px",
                }}
              >
                Wallet: {money(profile.billing.walletBalance)}
              </span>
            )}
          </div>
          <div>
            <small>{t("OpenTasks")}</small>
            <b>{openTasksCount}</b>
          </div>
          <div>
            <small>{t("Alerts")}</small>
            <b
              style={{
                color:
                  (profile?.alerts.length || 0) > 0 ? "#f87171" : "#34d399",
              }}
            >
              {profile?.alerts.length || 0}
            </b>
          </div>
        </div>
      </div>

      {/* Active Alerts */}
      {profile?.alerts && profile.alerts.length > 0 && (
        <div className="alert-stack">
          {profile.alerts.map((a) => (
            <div className={`alert ${a.severity}`} key={a.id}>
              ⚠ {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Profile Grid */}
      <div className="profile-grid">
        {/* 3-Bureau Credit Snapshot */}
        <section className="card wide">
          <div className="card-head">
            <h3>{t("CreditSnapshot")}</h3>
          </div>
          <div className="bureau-grid">
            <CreditGauge bureau="experian" data={profile?.credit.experian} />
            <CreditGauge bureau="equifax" data={profile?.credit.equifax} />
            <CreditGauge
              bureau="transunion"
              data={profile?.credit.transunion}
            />
          </div>

          {/* Tradelines & Positive Account Coach Card */}
          <PositiveAccountsCard brainUid={client.brainUid || undefined} />

          {/* Credit Repair Dispute Module v3 Matrix Card */}
          <DisputesCard brainUid={client.brainUid || undefined} />
        </section>

        {/* Business Overview */}
        <section className="card">
          <div
            className="card-head"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3
              style={{
                textTransform: "uppercase",
                fontSize: "11px",
                letterSpacing: "0.08em",
                color: "#94a3b8",
                margin: 0,
              }}
            >
              {t("Business")}
            </h3>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {profile?.business?.businessCreditScore != null && (
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#38bdf8",
                    background: "rgba(56, 189, 248, 0.15)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                  }}
                >
                  Score {profile.business.businessCreditScore}
                </span>
              )}
              {(profile?.business?.entityType || profile?.business?.state) && (
                <span
                  style={{
                    padding: "2px 10px",
                    borderRadius: "9999px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#cbd5e1",
                    background: "rgba(30, 41, 59, 0.8)",
                    border: "1px solid rgba(51, 65, 85, 0.8)",
                  }}
                >
                  {[profile?.business?.entityType, profile?.business?.state]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </div>
          </div>

          <div style={{ marginTop: "6px" }}>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.01em",
              }}
            >
              {profile?.business?.name || "—"}
            </div>
            {(profile?.business?.industry || profile?.business?.naics) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "4px",
                  flexWrap: "wrap",
                }}
              >
                {profile?.business?.industry && (
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#94a3b8",
                      fontWeight: 500,
                    }}
                  >
                    {profile.business.industry}
                  </span>
                )}
                {profile?.business?.naics && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "#94a3b8",
                      background: "rgba(30, 41, 59, 0.9)",
                      border: "1px solid rgba(51, 65, 85, 0.6)",
                      padding: "1px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    NAICS {profile.business.naics}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="profile-subgrid">
            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#64748b",
                }}
              >
                {t("TimeInBusiness")}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#ffffff",
                  marginTop: "3px",
                }}
              >
                {profile?.business?.timeInBusiness || "—"}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#64748b",
                }}
              >
                {t("AnnualRevenue")}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#ffffff",
                  marginTop: "3px",
                }}
              >
                {profile?.business?.annualRevenue != null
                  ? money(profile.business.annualRevenue)
                  : "—"}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#64748b",
                }}
              >
                {t("BusinessCredit")}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#ffffff",
                  marginTop: "3px",
                }}
              >
                {profile?.business?.businessCredit || "—"}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#64748b",
                }}
              >
                {t("MonthlyDeposits")}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#ffffff",
                  marginTop: "3px",
                }}
              >
                {profile?.business?.monthlyDeposits != null
                  ? money(profile.business.monthlyDeposits)
                  : profile?.business?.annualRevenue
                    ? money(Math.round(profile.business.annualRevenue / 12))
                    : "—"}
              </div>
            </div>
          </div>
        </section>

        {/* Payment Status (Billing & Membership) */}
        <section className="card">
          <div
            className="card-head"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3
              style={{
                textTransform: "uppercase",
                fontSize: "11px",
                letterSpacing: "0.08em",
                color: "#94a3b8",
                margin: 0,
              }}
            >
              {t("PaymentStatus")}
            </h3>
            {profile?.billing?.status && (
              <span
                className={`pay-pill ${profile.billing.status}`}
                style={{
                  margin: 0,
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                ●{" "}
                {t(
                  (
                    {
                      current: "Current",
                      past_due: "PastDueStatus",
                      failed: "Failed",
                      canceled: "Canceled",
                      trial: "Trial",
                      unknown: "Unknown",
                    } as const
                  )[profile.billing.status],
                )}
              </span>
            )}
          </div>

          <div
            style={{
              marginTop: "6px",
              display: "flex",
              alignItems: "baseline",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.01em",
              }}
            >
              {profile?.billing?.planName || "—"}
            </span>
            {profile?.billing?.amount != null && (
              <span
                style={{
                  fontSize: "14px",
                  color: "#94a3b8",
                  fontWeight: 500,
                }}
              >
                {money(profile.billing.amount)}/{t("PerMonth")}
              </span>
            )}
          </div>

          <div className="profile-subgrid">
            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#64748b",
                }}
              >
                {t("NextCharge")}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#ffffff",
                  marginTop: "3px",
                }}
              >
                {profile?.billing?.nextBillDate
                  ? fullDate(profile.billing.nextBillDate, locale)
                  : "—"}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#64748b",
                }}
              >
                {t("LastPaid")}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#ffffff",
                  marginTop: "3px",
                }}
              >
                {profile?.billing?.lastPaidAt
                  ? fullDate(profile.billing.lastPaidAt, locale)
                  : "—"}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#64748b",
                }}
              >
                {t("LifetimeValue")}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#ffffff",
                  marginTop: "3px",
                }}
              >
                {profile?.billing?.lifetimeValue != null
                  ? money(profile.billing.lifetimeValue)
                  : "—"}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#64748b",
                }}
              >
                {t("Method")}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#ffffff",
                  marginTop: "3px",
                }}
              >
                {profile?.billing?.paymentMethod || "—"}
              </div>
            </div>
          </div>

          {/* 12-Month Payment History Track */}
          <div style={{ marginTop: "16px", paddingTop: "4px" }}>
            <div
              style={{
                display: "flex",
                gap: "4px",
                alignItems: "center",
                width: "100%",
              }}
            >
              {(
                profile?.billing?.paymentHistory || [
                  { monthLabel: "O", status: "empty" },
                  { monthLabel: "N", status: "empty" },
                  { monthLabel: "D", status: "empty" },
                  { monthLabel: "J", status: "empty" },
                  { monthLabel: "F", status: "empty" },
                  { monthLabel: "M", status: "empty" },
                  { monthLabel: "A", status: "empty" },
                  { monthLabel: "M", status: "empty" },
                  { monthLabel: "J", status: "empty" },
                  { monthLabel: "J", status: "empty" },
                  { monthLabel: "A", status: "empty" },
                  { monthLabel: "S", status: "empty" },
                ]
              ).map((item, idx) => {
                const isPaid = item.status === "paid";
                const isUpcoming = item.status === "upcoming";
                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "12px",
                        borderRadius: "3px",
                        background: isPaid
                          ? "#10b981"
                          : isUpcoming
                            ? "transparent"
                            : "rgba(30, 41, 59, 0.7)",
                        border: isUpcoming
                          ? "1px dashed rgba(100, 116, 139, 0.8)"
                          : "1px solid transparent",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 600,
                        color: "#64748b",
                        marginTop: "4px",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.monthLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Programs & Progress */}
        <section className="card">
          <div className="card-head">
            <h3>{t("ProgramsProgress")}</h3>
          </div>
          {profile?.enrollments && profile.enrollments.length > 0 ? (
            profile.enrollments.map((p) => (
              <div className="program" key={p.programId}>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <b>{p.name}</b>
                  <small>{p.progressPercent}%</small>
                </div>
                <div className="progress">
                  <i style={{ width: `${p.progressPercent}%` }} />
                </div>
              </div>
            ))
          ) : (
            <p className="muted">{t("NoPrograms")}</p>
          )}
        </section>

        {/* Suggested Upgrades */}
        <section className="card">
          <div className="card-head">
            <h3>{t("SuggestedUpgrades")}</h3>
          </div>
          {profile?.recommendations && profile.recommendations.length > 0 ? (
            profile.recommendations.map((rec) => (
              <div className="upgrade" key={rec.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <b>{rec.title}</b>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    {rec.amount != null && rec.amount > 0 && (
                      <span style={{ fontSize: "12px", color: "#34d399", fontWeight: 700 }}>
                        {money(rec.amount)}
                      </span>
                    )}
                    <span className="lane-pill fit">
                      {rec.status || `${rec.fitScore}% ${t("Fit")}`}
                    </span>
                  </div>
                </div>
                <small>{rec.reason}</small>
              </div>
            ))
          ) : (
            <p className="muted">{t("NoSuggestions")}</p>
          )}
        </section>

        {/* Funding Applications */}
        {profile?.fundingApplications && profile.fundingApplications.length > 0 && (
          <section className="card wide">
            <div className="card-head">
              <h3>Funding Applications</h3>
              <span className="badge">{profile.fundingApplications.length} Active</span>
            </div>
            <div style={{ display: "grid", gap: "8px" }}>
              {profile.fundingApplications.map((app) => (
                <div
                  key={app.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    background: "rgba(30, 41, 59, 0.4)",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <div>
                    <b style={{ color: "#f8fafc", fontSize: "13px" }}>
                      {app.fundingType || app.interestedProduct || "Funding Application"}
                    </b>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                      Ref: {app.referenceNumber || app.id}
                      {app.appliedDate ? ` · Applied ${new Date(app.appliedDate).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {(app.businessAmountFunding || app.personalAmountFunding) && (
                      <span style={{ fontSize: "12px", color: "#34d399", fontWeight: 700 }}>
                        {money(app.businessAmountFunding || app.personalAmountFunding || 0)}
                      </span>
                    )}
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background:
                          app.status === "Approved" || app.status === "Offer Accepted"
                            ? "rgba(16, 185, 129, 0.2)"
                            : "rgba(59, 130, 246, 0.2)",
                        color:
                          app.status === "Approved" || app.status === "Offer Accepted"
                            ? "#34d399"
                            : "#60a5fa",
                      }}
                    >
                      {app.status || "Submitted"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Internal Staff Notes */}
        <section className="card wide">
          <div className="card-head">
            <h3>Internal Notes (Unified)</h3>
            <span className="badge">{profile?.notes?.length || 0}</span>
          </div>
          {profile?.notes && profile.notes.length > 0 ? (
            <div style={{ display: "grid", gap: "8px" }}>
              {profile.notes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    padding: "10px 14px",
                    background: "rgba(30, 41, 59, 0.4)",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                    }}
                  >
                    <b style={{ fontSize: "12px", color: "#f8fafc" }}>
                      {note.author}
                    </b>
                    <small style={{ fontSize: "11px", color: "#94a3b8" }}>
                      {new Date(note.createdAt).toLocaleDateString()}{" "}
                      {new Date(note.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#cbd5e1" }}>
                    {note.text}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No internal notes logged yet.</p>
          )}
        </section>

        {/* Lifecycle Stepper */}
        <section className="card wide">
          <div className="card-head">
            <h3>{t("Lifecycle")}</h3>
          </div>
          <div className="stepper">
            {STAGES.map((s) => (
              <span className={s === currentStage ? "current" : ""} key={s}>
                {labels.stage(s)}
              </span>
            ))}
          </div>
        </section>

        {/* AI Client Brief */}
        <section className="card wide">
          <div className="card-head">
            <h3>{t("AiClientBrief")}</h3>
            <button
              type="button"
              className="link-btn"
              onClick={() => refreshAiSummary(client.id)}
            >
              ✧ {t("Refresh")}
            </button>
          </div>
          {client.aiSummary ? (
            <div>
              <p className="summary">{client.aiSummary.text}</p>
              <small className="muted">
                Model: {client.aiSummary.model} · Updated:{" "}
                {new Date(client.aiSummary.updatedAt).toLocaleTimeString()}
              </small>
            </div>
          ) : (
            <p className="muted">{t("NoAiBrief")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
