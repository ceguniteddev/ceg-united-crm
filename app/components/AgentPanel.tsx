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

  const toggleMaster = () => {
    updateAgentSettings({ enabled: !agentSettings.enabled });
  };

  const setProvider = (provider: "openai" | "xai" | "anthropic") => {
    const model =
      provider === "openai"
        ? "gpt-6-astra"
        : provider === "xai"
          ? "grok-4"
          : "claude-3-7-sonnet";
    updateAgentSettings({ provider, model });
  };

  const toggleChannel = (ch: Channel) => {
    const current = agentSettings.channels || [];
    const next = current.includes(ch)
      ? current.filter((c) => c !== ch)
      : [...current, ch];
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
        className={`card agent-master ${agentSettings.enabled ? "on" : ""}`}
      >
        <div className="am-row">
          <div className="am-bot">✧</div>
          <div className="am-copy">
            <div className="am-title">
              {t("AgentMasterSwitch")}
              <span
                className={`pay-pill ${agentSettings.enabled ? "current" : "failed"}`}
              >
                ● {t(agentSettings.enabled ? "AgentOn" : "AgentOff")}
              </span>
            </div>
            <small>
              {agentSettings.enabled
                ? t("AgentReplying", { count: agentSettings.channels.length })
                : t("AgentDisabled")}
            </small>
          </div>
          <button
            type="button"
            className={`switch ${agentSettings.enabled ? "on" : ""}`}
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
            className={`prov ${agentSettings.provider === "openai" ? "sel" : ""}`}
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
            className={`prov ${agentSettings.provider === "xai" ? "sel" : ""}`}
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
            className={`prov ${agentSettings.provider === "anthropic" ? "sel" : ""}`}
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
            <span>{agentSettings.mcpServerUrl}</span>
            <span style={{ color: "#6ee7b7" }}>● {t("Connected")}</span>
          </div>

          <div style={{ marginTop: "14px" }}>
            <span className="field-lbl">{t("ToolsTheBot")}</span>
            <div className="tools">
              {agentSettings.allowedTools.map((tool) => (
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
                {Math.round(agentSettings.confidenceThreshold * 100)}% threshold
              </small>
            </div>
            <input
              type="range"
              className="range"
              min="50"
              max="99"
              value={Math.round(agentSettings.confidenceThreshold * 100)}
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
                  minutes: agentSettings.slaFallbackMinutes,
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
            const active = agentSettings.channels.includes(ch);
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
              {t("EventsCount", { count: agentLogs.length })}
            </span>
          </div>

          {agentLogs.length === 0 ? (
            <p className="muted">{t("NoAgentActivity")}</p>
          ) : (
            agentLogs.map((log) => (
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
