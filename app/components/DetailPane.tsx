"use client";

import React from "react";
import type { Subtab } from "../store/crmStore";
import { useI18n } from "../lib/i18n";
import { useCrmStore } from "../store/crmStore";
import { useAuth } from "../provider/AuthContext";
import { ClientProfile } from "./ClientProfile";
import { Timeline } from "./Timeline";
import { BrainLink } from "./BrainLink";

export function DetailPane() {
  const { t, locale } = useI18n();
  const { adminUser } = useAuth();
  const {
    clients,
    selectedClientId,
    setSelectedClient,
    subtab,
    setSubtab,
    setComposeChannel,
    setToast,
    prioritySignals,
    tasks,
    appSettings,
    activeRepUid,
    reps,
    profiles,
    setTaskModalOpen,
    toggleTaskStatus,
  } = useCrmStore();

  const client = selectedClientId
    ? clients.find((c) => c.id === selectedClientId) || null
    : null;
  const currentRep = reps.find((r) => r.uid === activeRepUid);
  const role =
    (adminUser?.role === "Admin" ? "admin" : currentRep?.role) || "admin";

  const attentionCount = prioritySignals.filter((p) => p.score >= 50).length;
  const overdueTasksCount = tasks.filter((t) => t.status === "overdue").length;

  const handleCall = () => {
    if (!client) return;
    const phone = client.handles.phones[0];
    if (phone) {
      window.open(`tel:${phone}`, "_self");
    } else {
      setToast(t("NoPhone"));
    }
  };

  if (!client) {
    return (
      <div className="welcome-pane">
        <div className="welcome-icon">✦</div>
        <h2>{t("WelcomeTitle")}</h2>
        <p>{t("WelcomeDescription")}</p>
        <div className="welcome-stats">
          <span>
            <b>{clients.length}</b> {t("Clients").toLowerCase()}
          </span>
          <span>
            <b>{attentionCount}</b> {t("NeedAttention")}
          </span>
          <span>
            <b>{overdueTasksCount}</b> {t("OverdueTasks")}
          </span>
        </div>
      </div>
    );
  }

  const clientTasks = tasks.filter((t) => t.clientId === client.id);

  return (
    <div className="detail-pane">
      {/* Detail Header */}
      <div className="detail-header">
        <button
          type="button"
          className="back mobile-only"
          aria-label={t("Back")}
          onClick={() => setSelectedClient(null)}
        >
          ‹
        </button>

        <div>
          <h2>{client.displayName}</h2>
          <small>
            {[
              client.handles.phones[0],
              client.handles.emails[0],
              ...client.tags.slice(0, 2),
            ]
              .filter(Boolean)
              .join(" · ") || t("Client")}
          </small>
        </div>
      </div>

      {/* Subtabs Bar */}
      <div className="subtabs">
        {(["profile", "timeline", "details", "documents", "tasks"] as Subtab[]).map((s) => (
          <button
            key={s}
            type="button"
            className={subtab === s ? "active" : ""}
            onClick={() => setSubtab(s)}
          >
            {s === "profile"
              ? t("Profile")
              : s === "timeline"
                ? t("Timeline")
                : s === "details"
                  ? t("Details")
                  : s === "documents"
                    ? "Documents"
                    : t("Tasks")}
          </button>
        ))}
      </div>

      {/* Subtab Content Scroll Area */}
      <div className="detail-scroll">
        {subtab === "profile" && (
          <ClientProfile
            client={client}
            onCall={handleCall}
            onCompose={() =>
              setComposeChannel(client.lastChannel || "whatsapp")
            }
          />
        )}

        {subtab === "timeline" && <Timeline client={client} />}

        {subtab === "details" && (
          <div className="profile-grid">
            <section className="card">
              <div className="card-head">
                <h3>{t("ContactDetails")}</h3>
              </div>
              <div className="kv">
                <span>{t("FieldPhones")}</span>
                <b>{client.handles.phones.join(", ") || "—"}</b>
              </div>
              <div className="kv">
                <span>{t("FieldEmails")}</span>
                <b>{client.handles.emails.join(", ") || "—"}</b>
              </div>
              <div className="kv">
                <span>{t("FieldWaIds")}</span>
                <b>{client.handles.waIds.join(", ") || "—"}</b>
              </div>
              <div className="kv">
                <span>{t("FieldIgsids")}</span>
                <b>{client.handles.igsids.join(", ") || "—"}</b>
              </div>
              <div className="kv">
                <span>{t("FieldTelegramChatIds")}</span>
                <b>{client.handles.telegramChatIds.join(", ") || "—"}</b>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h3>{t("LinkedAccount")}</h3>
              </div>
              <div className="kv">
                <span>{t("BrainUid")}</span>
                <b>{client.brainUid || t("NotLinked")}</b>
              </div>
              <div style={{ marginTop: "12px" }}>
                <BrainLink client={client} settings={appSettings} role={role} />
              </div>
            </section>
          </div>
        )}

        {subtab === "documents" && (
          <div className="profile-grid">
            <section className="card wide">
              <div className="card-head">
                <h3>Uploaded Documents (Cloud Storage)</h3>
              </div>
              {!profiles[client.id]?.documents ||
              profiles[client.id].documents!.length === 0 ? (
                <p className="muted">No uploaded documents found for this client.</p>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {profiles[client.id].documents!.map((doc, idx) => (
                    <div
                      key={doc.path || idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        background: "rgba(30, 41, 59, 0.5)",
                        borderRadius: "8px",
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                      }}
                    >
                      <div>
                        <b style={{ color: "#f8fafc", fontSize: "13px" }}>
                          {doc.name}
                        </b>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#94a3b8",
                            marginTop: "2px",
                          }}
                        >
                          {doc.contentType || "Document"} ·{" "}
                          {doc.size
                            ? `${(doc.size / 1024).toFixed(1)} KB`
                            : "—"}
                          {doc.updated
                            ? ` · ${new Date(doc.updated).toLocaleDateString()}`
                            : ""}
                        </div>
                      </div>
                      {doc.signedUrl && (
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn"
                          style={{
                            fontSize: "11px",
                            padding: "4px 10px",
                            textDecoration: "none",
                            color: "#38bdf8",
                            border: "1px solid rgba(56, 189, 248, 0.3)",
                            borderRadius: "4px",
                          }}
                        >
                          View ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {subtab === "tasks" && (
          <div>
            <div style={{ marginBottom: "12px" }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => setTaskModalOpen(true)}
              >
                + {t("NewTask")}
              </button>
            </div>

            {clientTasks.length === 0 ? (
              <p className="muted">{t("NoActiveTasks")}</p>
            ) : (
              clientTasks.map((task) => {
                const isDone = task.status === "done";
                return (
                  <div className="task-card" key={task.id}>
                    <div className="task-row">
                      <button
                        type="button"
                        className={`task-check ${isDone ? "done" : ""}`}
                        onClick={() => toggleTaskStatus(task.id)}
                      >
                        {isDone && "✓"}
                      </button>
                      <div>
                        <b
                          style={{
                            textDecoration: isDone ? "line-through" : "none",
                          }}
                        >
                          {task.title}
                        </b>
                        <small>
                          {task.dueAt
                            ? new Date(task.dueAt).toLocaleDateString(
                                locale === "es" ? "es-ES" : "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )
                            : "No due date"}
                        </small>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
