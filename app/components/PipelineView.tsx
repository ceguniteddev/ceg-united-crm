"use client";

import React from "react";
import { useI18n } from "../lib/i18n";
import { useCrmStore } from "../store/crmStore";

const STAGES = [
  "Lead",
  "Diagnostic",
  "Enrolled",
  "Repair",
  "Build",
  "Fund",
  "Funded",
] as const;

export function PipelineView() {
  const { t, labels } = useI18n();
  const { clients, setSelectedClient, setView } = useCrmStore();

  const handleOpenClient = (id: string) => {
    setSelectedClient(id);
    setView("inbox");
  };

  return (
    <div className="pipeline">
      {STAGES.map((stage) => {
        const stageClients = clients.filter((c) => {
          const match = c.tags.some(
            (tag) => tag.toLowerCase() === stage.toLowerCase(),
          );
          if (stage === "Lead") {
            return (
              match ||
              !c.tags.some((x) =>
                [
                  "diagnostic",
                  "enrolled",
                  "repair",
                  "build",
                  "fund",
                  "funded",
                ].includes(x.toLowerCase()),
              )
            );
          }
          return match;
        });

        return (
          <div className="pipeline-column" key={stage}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <h3>{labels.stage(stage)}</h3>
              <span className="badge">{stageClients.length}</span>
            </div>

            {stageClients.map((client) => (
              <button
                type="button"
                className="pipeline-card"
                key={client.id}
                onClick={() => handleOpenClient(client.id)}
              >
                <b>{client.displayName}</b>
                <small>{client.tags.join(" · ")}</small>
                <span>{client.lastMessagePreview || t("NoMessagesYet")}</span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
