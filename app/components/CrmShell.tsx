"use client";

import React, { useEffect, useState } from "react";
import { useI18n } from "../lib/i18n";
import { useCrmStore } from "../store/crmStore";
import { useAuth } from "../provider/AuthContext";
import { DesktopRail } from "./DesktopRail";
import { MobileTabbar } from "./MobileTabbar";
import { Header } from "./Header";
import { InboxPane } from "./InboxPane";
import { DetailPane } from "./DetailPane";
import { PriorityList } from "./PriorityList";
import { AgentPanel } from "./AgentPanel";
import { PipelineView } from "./PipelineView";
import { TasksView } from "./TasksView";
import { MeView } from "./MeView";
import { ScreenpopCard } from "./ScreenpopCard";
import { ComposeModal } from "./ComposeModal";
import { TaskModal } from "./TaskModal";

export function CrmShell() {
  const { t } = useI18n();
  const { adminUser } = useAuth();
  const {
    view,
    selectedClientId,
    setSelectedClient,
    setView,
    composeChannel,
    setComposeChannel,
    isTaskModalOpen,
    toastMessage,
    setToast,
    screenpops,
    dismissedPops,
    dismissScreenpop,
    clients,
    interactions,
    prioritySignals,
    appSettings,
    activeRepUid,
    reps,
    syncAdminUser,
    initSubscriptions,
    searchQuery,
    isSyncing,
  } = useCrmStore();

  useEffect(() => {
    if (adminUser) {
      syncAdminUser({
        uid: adminUser.uid,
        email: adminUser.email,
        displayName: adminUser.displayName,
      });
    }
  }, [adminUser, syncAdminUser]);

  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const unsub = initSubscriptions();
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsub();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [initSubscriptions]);

  const currentRep = reps.find((r) => r.uid === activeRepUid);
  const role = currentRep?.role || "rep";
  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  // Active undismissed screenpops
  const activePops = screenpops.filter((p) => !dismissedPops[p.id]);

  const renderContent = () => {
    switch (view) {
      case "inbox":
      case "clients":
        return (
          <div
            className={`split-layout ${selectedClientId ? "has-detail" : ""}`}
          >
            <InboxPane />
            <DetailPane />
          </div>
        );

      case "priority":
        return (
          <div className="section-scroll">
            <div className="section-header">
              <span>{t("YourActionQueue")}</span>
              <h1>
                {t("Priority")} <em>⚡</em>
              </h1>
              <p>{t("RightConversations")}</p>
            </div>
            <PriorityList />
          </div>
        );

      case "agent":
        return (
          <div className="section-scroll">
            <div className="section-header">
              <span>{t("AutomationCenter")}</span>
              <h1>{t("AiAgent")}</h1>
              <p>{t("AgentSubtitle")}</p>
            </div>
            <AgentPanel />
          </div>
        );

      case "tasks":
        return (
          <div className="section-scroll">
            <div className="section-header">
              <span>{t("Workspace")}</span>
              <h1>{t("Tasks")}</h1>
              <p>{t("TaskSubtitle")}</p>
            </div>
            <TasksView />
          </div>
        );

      case "deals":
        return (
          <div className="section-scroll">
            <div className="section-header">
              <span>{t("Pipeline")}</span>
              <h1>{t("Deals")}</h1>
              <p>{t("DealSubtitle")}</p>
            </div>
            <PipelineView />
          </div>
        );

      case "mine":
        const qMine = searchQuery.toLowerCase().trim();
        const mineClients = clients
          .filter(
            (c) =>
              c.ownerRepId === activeRepUid || c.repIds.includes(activeRepUid),
          )
          .filter((c) => {
            if (!qMine) return true;
            return [
              c.displayName,
              c.brainUid || "",
              ...c.handles.phones,
              ...c.handles.emails,
              ...c.tags,
            ].some((x) => x && x.toLowerCase().includes(qMine));
          })
          .sort((a, b) => {
            const getLatestTime = (client: typeof a) => {
              const clientIxs = interactions[client.id] || [];
              const lastIx = clientIxs[clientIxs.length - 1];
              const times = [
                lastIx?.ts,
                client.lastInboundAt,
                client.lastOutboundAt,
                client.updatedAt,
                client.createdAt,
              ].filter(Boolean) as string[];

              return times.reduce((max, t) => (t > max ? t : max), "");
            };

            const latestA = getLatestTime(a);
            const latestB = getLatestTime(b);
            return latestB.localeCompare(latestA);
          });

        return (
          <div className="section-scroll">
            <div className="section-header">
              <span>{t("MyDesk")}</span>
              <h1>{t("Mine")}</h1>
              <p>{t("MineSubtitle")}</p>
            </div>
            <div>
              {isSyncing && clients.length === 0 ? (
                <div className="skeleton-wrap" aria-label={t("Loading")}>
                  <div className="skeleton" style={{ height: "64px" }} />
                  <div className="skeleton" style={{ height: "64px" }} />
                  <div className="skeleton" style={{ height: "64px" }} />
                </div>
              ) : mineClients.length === 0 ? (
                <div className="empty">{t("NoResults")}</div>
              ) : (
                mineClients.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className="inbox-row"
                    onClick={() => {
                      setSelectedClient(c.id);
                      setView("inbox");
                    }}
                  >
                    <div className="row-avatar">
                      {c.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="row-body">
                      <b>{c.displayName}</b>
                      <small>
                        {c.lastMessagePreview || t("NoMessagesYet")}
                      </small>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        );

      case "sla":
        return (
          <div className="section-scroll">
            <div className="section-header">
              <span>{t("ServiceLevels")}</span>
              <h1>{t("SLA")}</h1>
              <p>{t("SlaSubtitle")}</p>
            </div>
            <div style={{ display: "grid", gap: "10px" }}>
              {prioritySignals
                .filter((p) =>
                  p.signals.some(
                    (s) => s.type === "unanswered" || s.type === "missed_call",
                  ),
                )
                .map((p) => (
                  <article className="prio-card lvl-critical" key={p.id}>
                    <b>{p.displayName}</b>
                    <div className="pc-flags">
                      {p.signals
                        .filter(
                          (s) =>
                            s.type === "unanswered" || s.type === "missed_call",
                        )
                        .map((s, i) => (
                          <span className="pf critical" key={i}>
                            {s.label}
                          </span>
                        ))}
                    </div>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => {
                        if (p.clientId) {
                          setSelectedClient(p.clientId);
                          setView("inbox");
                        }
                      }}
                    >
                      {t("Respond")} ↗
                    </button>
                  </article>
                ))}
            </div>
          </div>
        );

      case "me":
        return (
          <div className="section-scroll">
            <div className="section-header">
              <span>{t("WorkspaceHeading")}</span>
              <h1>{t("Me")}</h1>
              <p>{t("AccountSubtitle")}</p>
            </div>
            <MeView />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="ceg-console">
      {/* Offline Alert */}
      {!online && <div className="offline">{t("OfflineNotice")}</div>}

      {/* Top Header */}
      <Header />

      {/* Shell Body: Rail + Main Content View */}
      <div className="shell-body">
        <DesktopRail />
        <main className="main-view">{renderContent()}</main>
      </div>

      {/* Mobile Tabbar */}
      <MobileTabbar />

      {/* Popups & Modals */}
      {selectedClient && composeChannel && (
        <ComposeModal
          client={selectedClient}
          initialChannel={composeChannel}
          onClose={() => setComposeChannel(null)}
        />
      )}

      {isTaskModalOpen && <TaskModal />}

      {/* Screenpop notifications */}
      {activePops.slice(0, 2).map((pop) => {
        const client = clients.find((c) => c.id === pop.clientId);
        if (!client) return null;
        return (
          <ScreenpopCard
            key={pop.id}
            client={client}
            channel={pop.channel}
            settings={appSettings}
            role={role}
            onAccept={() => {
              dismissScreenpop(pop.id);
              setSelectedClient(client.id);
              setView("inbox");
            }}
            onDismiss={() => dismissScreenpop(pop.id)}
          />
        );
      })}

      {/* Toast Notification */}
      {toastMessage && (
        <button type="button" className="toast" onClick={() => setToast(null)}>
          {toastMessage} ✕
        </button>
      )}
    </div>
  );
}
