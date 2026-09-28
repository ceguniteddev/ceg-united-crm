"use client";

import React from "react";
import type { CrmClient } from "../types/crm";
import { useI18n } from "../lib/i18n";
import { money, initials } from "../lib/utils";
import { useCrmStore } from "../store/crmStore";
import { useAuth } from "../provider/AuthContext";
import { CreditGauge } from "./CreditGauge";
import { BrainLink } from "./BrainLink";
import { redactProfile } from "../lib/permissions";

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
  const { t, labels } = useI18n();
  const { adminUser } = useAuth();
  const { appSettings, tasks, activeRepUid, reps, refreshAiSummary, profiles } =
    useCrmStore();

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
              {profile?.billing.status
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
                    )[profile.billing.status],
                  )
                : "—"}
            </b>
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
            <CreditGauge bureau="equifax" data={profile?.credit.equifax} />
            <CreditGauge bureau="experian" data={profile?.credit.experian} />
            <CreditGauge
              bureau="transunion"
              data={profile?.credit.transunion}
            />
          </div>
        </section>

        {/* Business Overview */}
        <section className="card">
          <div className="card-head">
            <h3>{t("Business")}</h3>
          </div>
          <div className="kv">
            <span>{t("Business")}</span>
            <b>{profile?.business.name || "—"}</b>
          </div>
          <div className="kv">
            <span>EIN</span>
            <b>{profile?.business.ein || t("Restricted")}</b>
          </div>
          <div className="kv">
            <span>{t("StateRegion")}</span>
            <b>{profile?.business.entityType || "—"}</b>
          </div>
          <div className="kv">
            <span>{t("LifetimeValue")}</span>
            <b>{money(profile?.business.annualRevenue)} / yr</b>
          </div>
        </section>

        {/* Billing & Membership */}
        <section className="card">
          <div className="card-head">
            <h3>{t("BillingMembership")}</h3>
          </div>
          {profile?.billing.status && (
            <span className={`pay-pill ${profile.billing.status}`}>
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
          <div className="kv">
            <span>{t("Plan")}</span>
            <b>{profile?.billing.planName || "—"}</b>
          </div>
          <div className="kv">
            <span>{t("NextPayment")}</span>
            <b>
              {money(profile?.billing.amount)} / {t("PerMonth")}
            </b>
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
                  <span className="lane-pill fit">
                    {rec.fitScore}% {t("Fit")}
                  </span>
                </div>
                <small>{rec.reason}</small>
              </div>
            ))
          ) : (
            <p className="muted">{t("NoSuggestions")}</p>
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
