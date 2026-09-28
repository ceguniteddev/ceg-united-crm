"use client";

import React from "react";
import { useI18n } from "../lib/i18n";
import { CHANNELS, channelIcon, initials, relative } from "../lib/utils";
import { useCrmStore } from "../store/crmStore";
import { useAuth } from "../provider/AuthContext";
import { can } from "../lib/permissions";

export function InboxPane() {
  const { t, labels, locale } = useI18n();
  const { adminUser } = useAuth();
  const {
    clients,
    selectedClientId,
    setSelectedClient,
    channelFilter,
    setChannelFilter,
    searchQuery,
    setSearchQuery,
    interactions,
    activeRepUid,
    reps,
    view,
  } = useCrmStore();

  const currentRep = reps.find((r) => r.uid === activeRepUid);
  const role =
    (adminUser?.role === "Admin" ? "admin" : currentRep?.role) || "admin";

  const filteredClients = clients
    .filter((c) => {
      // Permission filtering: if not viewAllClients, can only see own/assigned clients
      if (
        !can(role, "viewAllClients") &&
        !c.repIds.includes(activeRepUid) &&
        c.ownerRepId !== activeRepUid
      ) {
        return false;
      }

      // Search query filter
      const q = searchQuery.toLowerCase().trim();
      if (
        q &&
        ![
          c.displayName,
          ...c.handles.phones,
          ...c.handles.emails,
          ...c.tags,
        ].some((x) => x.toLowerCase().includes(q))
      ) {
        return false;
      }

      // Channel filter
      if (channelFilter === "unread") return c.unreadCount > 0;
      if (channelFilter === "all") return true;

      const clientIxs = interactions[c.id] || [];
      return clientIxs.some((i) => i.channel === channelFilter);
    })
    .sort((a, b) => {
      const latestA = a.lastInboundAt || a.updatedAt;
      const latestB = b.lastInboundAt || b.updatedAt;
      return latestB.localeCompare(latestA);
    });

  const totalUnread = clients.reduce((acc, c) => acc + c.unreadCount, 0);

  return (
    <div className="inbox-pane">
      <div className="list-heading">
        <h2>{view === "clients" ? t("Clients") : t("Inbox")}</h2>
        <span>
          {filteredClients.length} {t("Conversations")}
        </span>
      </div>

      <div className="mobile-search">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("Search")}
        />
      </div>

      {/* Filter Chips */}
      {view === "inbox" && (
        <div className="chip-scroll">
          <button
            type="button"
            className={`chip ${channelFilter === "all" ? "active" : ""}`}
            onClick={() => setChannelFilter("all")}
          >
            {t("All")}
          </button>
          <button
            type="button"
            className={`chip ${channelFilter === "unread" ? "active" : ""}`}
            onClick={() => setChannelFilter("unread")}
          >
            {t("Unread")}{" "}
            {totalUnread > 0 && <span className="chip-n">{totalUnread}</span>}
          </button>
          {CHANNELS.map((ch) => (
            <button
              key={ch}
              type="button"
              className={`chip ${channelFilter === ch ? "active" : ""}`}
              onClick={() => setChannelFilter(ch)}
            >
              {channelIcon[ch]} {labels.channel(ch)}
            </button>
          ))}
        </div>
      )}

      {/* Conversation List */}
      <div className="inbox-list">
        {filteredClients.length === 0 ? (
          <div className="empty">{t("NoResults")}</div>
        ) : (
          filteredClients.map((client) => {
            const clientIxs = interactions[client.id] || [];
            const lastIx = clientIxs[clientIxs.length - 1];
            const ch = lastIx?.channel || client.lastChannel || "call";
            const isSelected = selectedClientId === client.id;
            const hasUnread = client.unreadCount > 0;

            return (
              <button
                type="button"
                className={`inbox-row ${isSelected ? "selected" : ""} ${hasUnread ? "unread" : ""}`}
                key={client.id}
                onClick={() => setSelectedClient(client.id)}
              >
                <div className="row-avatar">
                  {initials(client.displayName)}
                  <span className={`row-channel ch-icon ${ch}`}>
                    {channelIcon[ch]}
                  </span>
                </div>

                <div className="row-body">
                  <b>{client.displayName}</b>
                  <small>
                    {lastIx?.body ||
                      lastIx?.call?.summary ||
                      client.lastMessagePreview ||
                      t("NoMessagesYet")}
                  </small>
                </div>

                <div className="row-meta">
                  <time>
                    {relative(
                      lastIx?.ts || client.lastInboundAt || client.updatedAt,
                      locale,
                    )}
                  </time>
                  {hasUnread && (
                    <span className="unread-badge">{client.unreadCount}</span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
