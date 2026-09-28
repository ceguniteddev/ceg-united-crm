"use client";

import React, { useState } from "react";
import type { CrmClient } from "../types/crm";
import { useI18n } from "../lib/i18n";
import { channelIcon, relative } from "../lib/utils";
import { useCrmStore } from "../store/crmStore";

interface TimelineProps {
  client: CrmClient;
}

export function Timeline({ client }: TimelineProps) {
  const { t, labels, locale } = useI18n();
  const { interactions } = useCrmStore();
  const [expandedTurns, setExpandedTurns] = useState<Record<string, boolean>>(
    {},
  );

  const clientIxs = interactions[client.id] || [];
  const sorted = [...clientIxs].sort((a, b) => b.ts.localeCompare(a.ts));

  const toggleTurn = (id: string) => {
    setExpandedTurns((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!sorted.length) {
    return <div className="empty">{t("NoMessagesYet")}</div>;
  }

  return (
    <div className="timeline">
      {sorted.map((ix) => {
        const isInbound = ix.direction === "in";
        const ch = ix.channel;
        const call = ix.call;
        const isMissed = call?.missed;
        const isVoicemail = call?.voicemail;

        return (
          <div className={`tl ${isInbound ? "in" : "out"}`} key={ix.id}>
            <div className="tl-head">
              <span className={`ch-icon ${ch}`}>{channelIcon[ch]}</span>
              <b>{labels.channel(ch)}</b>
              <span className={`dir ${isInbound ? "in" : ""}`}>
                {t(isInbound ? "Incoming" : "Outgoing")}
              </span>
              {ix.aiHandled && (
                <span className="mini-badge ai">{t("AiHandled")}</span>
              )}
              <time>{relative(ix.ts, locale)}</time>
            </div>

            <div className="tl-body">
              {ix.subject && <b className="subject">{ix.subject}</b>}
              {ix.body && <p>{ix.body}</p>}

              {/* Call Details & Transcripts */}
              {call && (
                <div style={{ marginTop: "6px" }}>
                  {isMissed && (
                    <div
                      className="danger"
                      style={{ fontWeight: 700, marginBottom: "4px" }}
                    >
                      ☎ {t(isVoicemail ? "Voicemail" : "MissedCall")} (
                      {Math.floor(call.durationSec / 60)}m{" "}
                      {call.durationSec % 60}s)
                    </div>
                  )}

                  {call.summary && (
                    <div
                      className="summary"
                      style={{ fontSize: "12px", fontStyle: "italic" }}
                    >
                      ✧ {call.summary}
                    </div>
                  )}

                  {call.nextSteps && call.nextSteps.length > 0 && (
                    <div className="next-steps">
                      <b>{t("NextSteps")}:</b>
                      <ul>
                        {call.nextSteps.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {call.transcript && call.transcript.length > 0 && (
                    <div className="transcript">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                        onClick={() => toggleTurn(ix.id)}
                      >
                        <span>✧ Deepgram {t("Transcript")}</span>
                        <button type="button" className="link-btn">
                          {t(expandedTurns[ix.id] ? "Hide" : "Show")}
                        </button>
                      </div>

                      {expandedTurns[ix.id] && (
                        <div
                          style={{
                            marginTop: "8px",
                            fontSize: "11px",
                            lineHeight: 1.6,
                          }}
                        >
                          {call.transcript.map((tr, i) => (
                            <div key={i} style={{ marginBottom: "4px" }}>
                              <b style={{ color: "#93c5fd" }}>{tr.speaker}:</b>{" "}
                              {tr.text}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Attachments */}
              {ix.attachments && ix.attachments.length > 0 && (
                <div style={{ marginTop: "8px" }}>
                  {ix.attachments.map((att, idx) => (
                    <div className="attachment" key={idx}>
                      📎 {att.name || att.type}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
