"use client";

import React, { useState } from "react";
import type { Channel, CrmClient } from "../types/crm";
import { useI18n } from "../lib/i18n";
import { CHANNELS, channelIcon, composerRule } from "../lib/utils";
import { useCrmStore } from "../store/crmStore";

interface ComposeModalProps {
  client: CrmClient;
  initialChannel?: Channel;
  onClose: () => void;
}

export function ComposeModal({
  client,
  initialChannel = "sms",
  onClose,
}: ComposeModalProps) {
  const { t, labels } = useI18n();
  const { sendMessage, addNote } = useCrmStore();
  const [selectedChannel, setSelectedChannel] =
    useState<Channel>(initialChannel);
  const [body, setBody] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [humanAgentTag, setHumanAgentTag] = useState(false);
  const [sending, setSending] = useState(false);

  const isNote = selectedChannel === "note";
  const rule = composerRule(client, selectedChannel, {
    templateName,
    humanAgentTag,
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || sending) return;

    setSending(true);
    try {
      if (isNote) {
        await addNote(client.id, body.trim());
      } else {
        await sendMessage(client.id, selectedChannel, body.trim());
      }
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="compose-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="compose-sheet" onSubmit={handleSend}>
        <div className="sheet-grip mobile-only" />
        <div className="compose-head">
          <h2>
            {isNote ? t("Note") : t("Compose")} · {client.displayName}
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label={t("CloseComposer")}
          >
            ✕
          </button>
        </div>

        {/* Channel selector chips */}
        <div className="chip-scroll compose-channels">
          {CHANNELS.map((ch) => (
            <button
              key={ch}
              type="button"
              className={`chip ${selectedChannel === ch ? "active" : ""}`}
              onClick={() => setSelectedChannel(ch)}
            >
              {channelIcon[ch]} {labels.channel(ch)}
            </button>
          ))}
          <button
            type="button"
            className={`chip ${isNote ? "active" : ""}`}
            onClick={() => setSelectedChannel("note")}
          >
            {channelIcon["note"]} {t("Note")}
          </button>
        </div>

        {/* Meta 24h & SMS consent warnings */}
        {rule.remaining && (
          <div className="info-banner">
            {t("MetaCountdown", { remaining: rule.remaining })}
          </div>
        )}

        {rule.requiresTemplate && (
          <div className="warn">
            <div>{t("TemplateWarning")}</div>
            <label>
              {t("TemplateName")}
              <input
                required
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={t("TemplatePlaceholder")}
              />
            </label>
          </div>
        )}

        {rule.humanTag && rule.humanTagAvailable && (
          <div className="warn">
            <div>{t("HumanTagWarning")}</div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={humanAgentTag}
                onChange={(e) => setHumanAgentTag(e.target.checked)}
              />
              {t("UseHumanTag")}
            </label>
          </div>
        )}

        {rule.humanTag && !rule.humanTagAvailable && (
          <div className="warn" style={{ color: "#fca5a5" }}>
            {t("HumanTagExpired")}
          </div>
        )}

        {rule.smsWarning && (
          <div className="warn" style={{ color: "#fca5a5" }}>
            {t("SmsConsentWarning")}
          </div>
        )}

        {isNote && <div className="info-banner">{t("InternalNoteHint")}</div>}

        <textarea
          required
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            isNote
              ? t("WriteNote")
              : t("ReplyVia", { channel: labels.channel(selectedChannel) })
          }
        />

        <div className="compose-footer">
          <span>{t("Characters", { count: body.length })}</span>
          <button
            type="submit"
            className="btn primary"
            disabled={!body.trim() || !rule.allowed || sending}
          >
            {sending ? t("Sending") : isNote ? t("SaveNote") : `${t("Send")} ↗`}
          </button>
        </div>
      </form>
    </div>
  );
}
