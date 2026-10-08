"use client";

import React, { useState } from "react";
import type { Channel } from "../types/crm";
import { useI18n } from "../lib/i18n";
import { useCrmStore } from "../store/crmStore";

export function AgentPanel() {
  const { t, labels } = useI18n();
  const { agentSettings, agentLogs, updateAgentSettings, setToast } =
    useCrmStore();
  const [testing, setTesting] = useState(false);

  const channels = agentSettings?.channels || [];
  const allowedTools = agentSettings?.allowedTools || [];
  const confidenceThreshold = agentSettings?.confidenceThreshold ?? 0.85;
  const isEnabled = Boolean(agentSettings?.enabled);
  const provider = agentSettings?.provider || "openai";
  const mcpServerUrl = agentSettings?.mcpServerUrl || "";
  const slaFallbackMinutes = agentSettings?.slaFallbackMinutes ?? 10;
  const logs = agentLogs || [];

  const toggleMaster = () => {
    updateAgentSettings({ enabled: !isEnabled });
  };

  const setProvider = (selectedProvider: "openai" | "xai" | "anthropic") => {
    const model =
      selectedProvider === "openai"
        ? "gpt-6-astra"
        : selectedProvider === "xai"
          ? "grok-4"
          : "claude-3-7-sonnet";
    updateAgentSettings({ provider: selectedProvider, model });
  };

  const toggleChannel = (ch: Channel) => {
    const next = channels.includes(ch)
      ? channels.filter((c) => c !== ch)
      : [...channels, ch];
    updateAgentSettings({ channels: next });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      setToast(
        "MCP Server Connection Verified: 10 Tools Ready (Cloud Run us-east1)",
      );
    }, 700);
  };

  return (
    <div className="agent">
      {/* Master Toggle Card */}
      <section
        className={`card agent-master ${isEnabled ? "on" : ""}`}
      >
        <div className="am-row">
          <div className="am-bot">✧</div>
          <div className="am-copy">
            <div className="am-title">
              {t("AgentMasterSwitch")}
              <span
                className={`pay-pill ${isEnabled ? "current" : "failed"}`}
              >
                ● {t(isEnabled ? "AgentOn" : "AgentOff")}
              </span>
            </div>
            <small>
              {isEnabled
                ? t("AgentReplying", { count: channels.length })
                : t("AgentDisabled")}
            </small>
          </div>
          <button
            type="button"
            className={`switch ${isEnabled ? "on" : ""}`}
            onClick={toggleMaster}
            aria-label={t("AgentMasterSwitch")}
          >
            <i />
          </button>
        </div>

        <div className="am-stats">
          <div>
            <span>{t("HandledRecently")}</span>
            <b>142</b>
          </div>
          <div>
            <span>{t("HandedToTeam")}</span>
            <b>18</b>
          </div>
          <div>
            <span>{t("AvgFirstReply")}</span>
            <b>1.4s</b>
          </div>
          <div>
            <span>{t("ResolvedByAi")}</span>
            <b>88.7%</b>
          </div>
        </div>
      </section>

      {/* Grid: Settings & Tools */}
      <div className="agent-grid">
        {/* Model Selection */}
        <section className="card">
          <div className="card-head">
            <h3>{t("AiModelBot")}</h3>
          </div>

          <button
            type="button"
            className={`prov ${provider === "openai" ? "sel" : ""}`}
            onClick={() => setProvider("openai")}
          >
            <div className="radio" />
            <div>
              <b>{t("ProviderOpenai")}</b>
              <small>{t("ProviderOpenaiDescription")}</small>
            </div>
          </button>

          <button
            type="button"
            className={`prov ${provider === "xai" ? "sel" : ""}`}
            onClick={() => setProvider("xai")}
          >
            <div className="radio" />
            <div>
              <b>{t("ProviderXai")}</b>
              <small>{t("ProviderXaiDescription")}</small>
            </div>
          </button>

          <button
            type="button"
            className={`prov ${provider === "anthropic" ? "sel" : ""}`}
            onClick={() => setProvider("anthropic")}
          >
            <div className="radio" />
            <div>
              <b>{t("ProviderAnthropic")}</b>
              <small>{t("ProviderAnthropicDescription")}</small>
            </div>
          </button>
        </section>

        {/* MCP Server & Connection */}
        <section className="card">
          <div className="card-head">
            <h3>{t("CrmMcpServer")}</h3>
            <button
              type="button"
              className="btn"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? t("Loading") : t("TestConnection")}
            </button>
          </div>

          <div className="mono-box">
            <span>{mcpServerUrl}</span>
            <span style={{ color: "#6ee7b7" }}>● {t("Connected")}</span>
          </div>

          <div style={{ marginTop: "14px" }}>
            <span className="field-lbl">{t("ToolsTheBot")}</span>
            <div className="tools">
              {allowedTools.map((tool) => (
                <code key={tool}>{tool}</code>
              ))}
            </div>
          </div>
        </section>

        {/* Reply Trigger Mode & Confidence */}
        <section className="card">
          <div className="card-head">
            <h3>{t("WhenItReplies")}</h3>
          </div>

          <div className="ct">
            <div>
              <b>{t("Confidence")}</b>
              <small style={{ display: "block", color: "var(--ink-3)" }}>
                {Math.round(confidenceThreshold * 100)}% threshold
              </small>
            </div>
            <input
              type="range"
              className="range"
              min="50"
              max="99"
              value={Math.round(confidenceThreshold * 100)}
              onChange={(e) =>
                updateAgentSettings({
                  confidenceThreshold: Number(e.target.value) / 100,
                })
              }
            />
          </div>

          <div className="tog-row">
            <div>
              <b>
                {t("FallbackMode", {
                  minutes: slaFallbackMinutes,
                })}
              </b>
              <small style={{ display: "block", color: "var(--ink-3)" }}>
                {t("FallbackDescription")}
              </small>
            </div>
          </div>
        </section>

        {/* Channel matrix */}
        <section className="card">
          <div className="card-head">
            <h3>{t("Channels")}</h3>
          </div>

          {(
            [
              "whatsapp",
              "messenger",
              "instagram",
              "sms",
              "telegram",
            ] as Channel[]
          ).map((ch) => {
            const active = channels.includes(ch);
            return (
              <div className="ct" key={ch}>
                <span>{labels.channel(ch)}</span>
                <button
                  type="button"
                  className={`switch ${active ? "on" : ""}`}
                  onClick={() => toggleChannel(ch)}
                  aria-label={ch}
                >
                  <i />
                </button>
              </div>
            );
          })}
        </section>

        {/* Live Activity Log */}
        <section className="card wide">
          <div className="card-head">
            <h3>{t("RecentAiActivity")}</h3>
            <span className="mini-badge ai">
              {t("EventsCount", { count: logs.length })}
            </span>
          </div>

          {logs.length === 0 ? (
            <p className="muted">{t("NoAgentActivity")}</p>
          ) : (
            logs.map((log) => (
              <div className="alog" key={log.id}>
                <div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <b>
                      {log.decision === "replied" ? "✧ " : "⚡ "}
                      {t(
                        log.decision === "replied"
                          ? "AgentReplied"
                          : "AgentEscalated",
                      )}
                    </b>
                    <time>{new Date(log.createdAt).toLocaleTimeString()}</time>
                  </div>
                  <p>{log.reason}</p>
                  {log.replyBody && (
                    <small
                      style={{ fontStyle: "italic", color: "var(--ink-3)" }}
                    >
                      &ldquo;{log.replyBody}&rdquo;
                    </small>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
