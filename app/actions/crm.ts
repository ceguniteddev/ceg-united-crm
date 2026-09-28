"use server";

import { adminDb } from "../lib/firebaseAdmin";
import type {
  AgentLogEntry,
  AgentSettings,
  AppSettings,
  BrainProfile,
  BureauScore,
  Channel,
  CrmClient,
  Interaction,
  PrioritySignals,
  Rep,
  RepStatus,
  Role,
  Task,
  TaskStatus,
} from "../types/crm";
import { redactProfile } from "../lib/permissions";
import { comparePriority, scoreSignals } from "../lib/priority";

const DEFAULT_APP_SETTINGS: AppSettings = {
  brainAdminUrl: "https://cegunitedllc.firebaseapp.com/admin/clients/{uid}",
  timezone: "America/New_York",
  businessHours: { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] },
  unansweredMinutes: 15,
  slaMinutes: 30,
};

const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  enabled: true,
  mode: "copilot",
  provider: "openai",
  model: "gpt-6-astra",
  confidenceThreshold: 0.85,
  channels: ["whatsapp", "messenger", "instagram", "sms", "telegram"],
  allowedTools: [
    "crm_find_client",
    "crm_get_profile_summary",
    "crm_get_task_status",
    "crm_create_task",
    "crm_log_note",
    "crm_send_message",
    "crm_send_upload_link",
    "crm_send_payment_link",
    "crm_book_appointment",
    "crm_escalate_to_human",
  ],
  mcpServerUrl: "https://mcp-crm-prod-380b9fae.run.app",
  alwaysEscalate: [
    "pricing_negotiation",
    "dispute_legal",
    "funding_decision",
    "upset_client",
    "vip_client",
  ],
  autoReplyDelaySeconds: 45,
  slaFallbackMinutes: 10,
  systemPrompt: `You are the CEG United CRM AI Specialist. Assist clients with program onboarding, document uploads, appointment bookings, and status inquiries with professionalism and empathy. Never disclose sensitive PII (full SSN, EIN, bank accounts).`,
  updatedAt: new Date().toISOString(),
};

/**
 * Normalizes Date or Firestore Timestamp to ISO string
 */
function toIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === "string") return val;
  const withToDate = val as { toDate?: () => Date };
  if (withToDate.toDate && typeof withToDate.toDate === "function") {
    return withToDate.toDate().toISOString();
  }
  if (val instanceof Date) return val.toISOString();
  return new Date().toISOString();
}

/**
 * Fetches clients directly from the live 'user' collection where role === 'Client'
 */
export async function fetchCrmDataAction(): Promise<{
  clients: CrmClient[];
  prioritySignals: PrioritySignals[];
  appSettings: AppSettings;
  agentSettings: AgentSettings;
  agentLogs: AgentLogEntry[];
  reps: Rep[];
}> {
  try {
    // 1. Fetch real users from 'user' collection where role === 'Client'
    const usersSnap = await adminDb.collection("user").get();

    const clientsList: CrmClient[] = [];
    const repsList: Rep[] = [];

    for (const doc of usersSnap.docs) {
      const u = doc.data();
      const uid = doc.id;
      const role = u.role || "Client";

      if (role === "Client" || role === "User") {
        const displayName =
          `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
          u.email?.split("@")[0] ||
          "Client";
        const phone = u.phoneNumber || "";
        const email = u.email || "";
        const createdAtIso = toIsoString(u.registrationDate);

        clientsList.push({
          id: uid,
          brainUid: uid,
          displayName,
          handles: {
            phones: phone ? [phone] : [],
            emails: email ? [email] : [],
            waIds: phone ? [phone.replace(/\D/g, "")] : [],
            igsids: [],
            psids: [],
            telegramChatIds: [],
          },
          ownerRepId: u.brokerId || null,
          repIds: u.brokerId ? [u.brokerId] : [],
          tags: [
            u.registrationPurpose || "Funding",
            u.addressState || "",
            u.activeStatus || "Active",
          ].filter(Boolean),
          vip: Boolean(u.vip),
          highPriority: Boolean(u.highPriority),
          lastInboundAt: createdAtIso,
          lastOutboundAt: null,
          unreadCount: 0,
          lastMessagePreview: u.businessName
            ? `Business: ${u.businessName}`
            : "Client profile active",
          lastChannel: "sms",
          metaWindowExpiresAt: {},
          aiSummary: null,
          smsConsent: u.consentConfirmTerms ?? true,
          createdAt: createdAtIso,
          updatedAt: createdAtIso,
        });
      } else if (role === "Admin" || role === "Broker") {
        repsList.push({
          uid,
          name:
            `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
            u.email?.split("@")[0] ||
            "Administrator",
          email: u.email || "",
          role: role === "Admin" ? "owner" : "rep",
          channels: [
            "call",
            "sms",
            "whatsapp",
            "messenger",
            "instagram",
            "email",
            "telegram",
            "voicemail",
            "note",
          ],
          status: "available",
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // 2. Generate Priority Signals for Clients
    const prioritySignals: PrioritySignals[] = clientsList
      .slice(0, 10)
      .map((c) => {
        const signals = [
          {
            type: "new_lead" as const,
            label: `Client Account: ${c.displayName}`,
            since: c.createdAt,
          },
        ];
        return {
          id: `prio_${c.id}`,
          kind: "client" as const,
          clientId: c.id,
          leadId: null,
          displayName: c.displayName,
          phone: c.handles.phones[0],
          email: c.handles.emails[0],
          ownerRepId: c.ownerRepId,
          score: scoreSignals(signals),
          signals,
          updatedAt: c.updatedAt,
        };
      })
      .sort(comparePriority);

    // 3. App and Agent Settings
    const appDoc = await adminDb.collection("crm_settings").doc("app").get();
    const appSettings: AppSettings = appDoc.exists
      ? (appDoc.data() as AppSettings)
      : DEFAULT_APP_SETTINGS;

    const agentDoc = await adminDb
      .collection("crm_settings")
      .doc("ai_agent")
      .get();
    const agentSettings: AgentSettings = agentDoc.exists
      ? (agentDoc.data() as AgentSettings)
      : DEFAULT_AGENT_SETTINGS;

    return {
      clients: clientsList,
      prioritySignals,
      appSettings,
      agentSettings,
      agentLogs: [],
      reps: repsList,
    };
  } catch (error) {
    console.error("fetchCrmDataAction Error:", error);
    return {
      clients: [],
      prioritySignals: [],
      appSettings: DEFAULT_APP_SETTINGS,
      agentSettings: DEFAULT_AGENT_SETTINGS,
      agentLogs: [],
      reps: [],
    };
  }
}

/**
 * Fetches interactions subcollection directly from user/{clientId}/interactions
 */
export async function fetchClientInteractionsAction(
  clientId: string,
): Promise<Interaction[]> {
  try {
    const snap = await adminDb
      .collection(`user/${clientId}/interactions`)
      .orderBy("ts", "asc")
      .get();

    if (!snap.empty) {
      return snap.docs.map((d) => ({
        ...(d.data() as Interaction),
        id: d.id,
      }));
    }

    return [];
  } catch (error) {
    console.error(
      `fetchClientInteractionsAction error for ${clientId}:`,
      error,
    );
    return [];
  }
}

/**
 * Fetches tasks subcollection directly from user/{clientId}/tasks
 */
export async function fetchClientTasksAction(
  clientId: string,
): Promise<Task[]> {
  try {
    const snap = await adminDb
      .collection(`user/${clientId}/tasks`)
      .orderBy("createdAt", "desc")
      .get();

    if (!snap.empty) {
      return snap.docs.map((d) => ({
        ...(d.data() as Task),
        id: d.id,
      }));
    }

    return [];
  } catch (error) {
    console.error(`fetchClientTasksAction error for ${clientId}:`, error);
    return [];
  }
}

/**
 * Helper to normalize numbers from numeric strings or numbers
 */
function toNum(v?: unknown): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

interface CrsReportScore {
  scoreValue?: string | number;
  sourceType?: string;
  scoreModel?: string;
}

interface CrsCreditFileDetail {
  sourceType?: string;
}

interface CrsCreditFile {
  creditFileDetail?: CrsCreditFileDetail;
}

interface CrsRepositoryIncluded {
  experian?: boolean;
  transunion?: boolean;
  equifax?: boolean;
}

interface CrsResponseAlertMessage {
  responseAlertMessageText?: string;
  responseAlertMessageCategoryType?: string;
  sourceType?: string;
}

interface CrsReportPayload {
  scores?: CrsReportScore[];
  score?: string | number;
  creditFiles?: CrsCreditFile[];
  repositoryIncluded?: CrsRepositoryIncluded;
  responseAlertMessages?: CrsResponseAlertMessage[];
  responseDetail?: { dateRequested?: string };
}

interface CrsReportDocument {
  type?: string;
  id: string;
  report?: CrsReportPayload;
  scores?: Record<string, number | string | undefined> & {
    scoreValue?: string | number;
  };
  score?: string | number;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
}

/**
 * Identify bureau name from sourceType or string
 */
function bureauLabel(
  sourceType?: string,
): "Experian" | "Equifax" | "TransUnion" | string {
  const s = (sourceType || "").toLowerCase();
  if (s.includes("experian")) return "Experian";
  if (s.includes("equifax")) return "Equifax";
  if (s.includes("trans")) return "TransUnion";
  return sourceType || "Unknown";
}

/**
 * Determine bureau for a given report (referencing ClientCreditReport.tsx detectBureau)
 */
function detectBureau(
  report?: CrsReportPayload | null,
  fallbackType?: string,
): "Experian" | "TransUnion" | "Equifax" | null {
  if (!report) {
    if (fallbackType) {
      const b = bureauLabel(fallbackType);
      if (b === "Experian" || b === "TransUnion" || b === "Equifax") return b;
    }
    return null;
  }
  const fromScore = report.scores?.[0]?.sourceType;
  if (fromScore) {
    const b = bureauLabel(fromScore);
    if (b === "Experian" || b === "TransUnion" || b === "Equifax") return b;
  }
  const fromFile = report.creditFiles?.[0]?.creditFileDetail?.sourceType;
  if (fromFile) {
    const b = bureauLabel(fromFile);
    if (b === "Experian" || b === "TransUnion" || b === "Equifax") return b;
  }
  const r = report.repositoryIncluded;
  if (r) {
    const truths = [
      r.experian ? "Experian" : null,
      r.transunion ? "TransUnion" : null,
      r.equifax ? "Equifax" : null,
    ].filter(Boolean) as ("Experian" | "TransUnion" | "Equifax")[];
    if (truths.length === 1) return truths[0];
  }
  if (fallbackType) {
    const b = bureauLabel(fallbackType);
    if (b === "Experian" || b === "TransUnion" || b === "Equifax") return b;
  }
  return null;
}

/**
 * Extracts FICO/bureau score from a report document
 */
function extractBureauScore(
  reportDoc: CrsReportDocument | null | undefined,
  bureau: string,
): number | null {
  if (!reportDoc) return null;
  const rep = reportDoc.report;
  if (rep?.scores && Array.isArray(rep.scores) && rep.scores.length > 0) {
    const val = toNum(rep.scores[0]?.scoreValue);
    if (val > 0) return val;
  }
  if (reportDoc.scores && typeof reportDoc.scores === "object") {
    const bKey = bureau.toLowerCase();
    const val = toNum(reportDoc.scores[bKey] ?? reportDoc.scores.scoreValue);
    if (val > 0) return val;
  }
  if (rep?.score) {
    const val = toNum(rep.score);
    if (val > 0) return val;
  }
  if (reportDoc.score) {
    const val = toNum(reportDoc.score);
    if (val > 0) return val;
  }
  return null;
}

/**
 * Extracts pull timestamp from a report document
 */
function extractBureauPulledAt(
  reportDoc: CrsReportDocument | null | undefined,
): string | null {
  if (!reportDoc) return null;
  const dr = reportDoc.report?.responseDetail?.dateRequested;
  if (dr) return toIsoString(dr);
  if (reportDoc.createdAt) return toIsoString(reportDoc.createdAt);
  if (reportDoc.updatedAt) return toIsoString(reportDoc.updatedAt);
  return null;
}

/**
 * Fetches 360 profile directly from live 'user', 'business-detail', 'user-funding-application', and 'crs-report-data'
 */
export async function fetchClient360Action(
  clientId: string,
  userRole: Role = "admin",
): Promise<BrainProfile | null> {
  try {
    const userDoc = await adminDb.collection("user").doc(clientId).get();
    if (!userDoc.exists) return null;
    const u = userDoc.data();

    // Fetch business details
    const bizSnap = await adminDb
      .collection("business-detail")
      .where("userId", "==", clientId)
      .limit(1)
      .get();
    const bizData = !bizSnap.empty ? bizSnap.docs[0].data() : null;

    // Fetch funding applications
    const fundSnap = await adminDb
      .collection("user-funding-application")
      .where("userId", "==", clientId)
      .orderBy("appliedDate", "desc")
      .limit(1)
      .get();
    const fundData = !fundSnap.empty ? fundSnap.docs[0].data() : null;

    // Fetch credit reports from 'crs-report-data'
    const crsDocRef = adminDb.collection("crs-report-data").doc(clientId);
    const crsDocSnap = await crsDocRef.get();

    const crsReportDocs: CrsReportDocument[] = [];

    const bureauKeys = ["equifax", "experian", "transunion"] as const;

    // 1. Check direct subcollections: crs-report-data/{clientId}/{bureau}
    await Promise.all(
      bureauKeys.map(async (bKey) => {
        try {
          const subSnap = await crsDocRef
            .collection(bKey)
            .orderBy("createdAt", "desc")
            .get();
          subSnap.docs.forEach((d) => {
            crsReportDocs.push({
              type: bKey,
              id: d.id,
              ...d.data(),
            });
          });
        } catch {
          try {
            const subSnap = await crsDocRef.collection(bKey).get();
            subSnap.docs.forEach((d) => {
              crsReportDocs.push({
                type: bKey,
                id: d.id,
                ...d.data(),
              });
            });
          } catch {
            // ignore
          }
        }
      }),
    );

    // 2. If subcollections empty, list all subcollections or inspect parent document
    if (crsReportDocs.length === 0 && crsDocSnap.exists) {
      try {
        const subcols = await crsDocRef.listCollections();
        await Promise.all(
          subcols.map(async (colRef) => {
            const qs = await colRef.orderBy("createdAt", "desc").get();
            qs.docs.forEach((d) => {
              crsReportDocs.push({
                type: colRef.id,
                id: d.id,
                ...d.data(),
              });
            });
          }),
        );
      } catch {
        // ignore
      }

      if (crsReportDocs.length === 0) {
        const parentData = crsDocSnap.data();
        if (parentData) {
          crsReportDocs.push({
            type: parentData.type || "unknown",
            id: crsDocSnap.id,
            ...parentData,
          });
        }
      }
    }

    // 3. Fallback to top-level crs-report-data query (where userId == clientId)
    if (crsReportDocs.length === 0) {
      try {
        const topSnap = await adminDb
          .collection("crs-report-data")
          .where("userId", "==", clientId)
          .orderBy("createdAt", "desc")
          .get();
        topSnap.docs.forEach((d) => {
          crsReportDocs.push({
            type: d.data().type,
            id: d.id,
            ...d.data(),
          });
        });
      } catch {
        try {
          const topSnap = await adminDb
            .collection("crs-report-data")
            .where("userId", "==", clientId)
            .get();
          topSnap.docs.forEach((d) => {
            crsReportDocs.push({
              type: d.data().type,
              id: d.id,
              ...d.data(),
            });
          });
        } catch {
          // ignore
        }
      }
    }

    const buildBureauScore = (
      bureau: "Equifax" | "Experian" | "TransUnion",
    ): BureauScore => {
      const matchingDocs = crsReportDocs
        .filter((d) => {
          const detected = detectBureau(d.report, d.type);
          return detected === bureau;
        })
        .sort((a, b) => {
          const timeA = a.createdAt
            ? new Date(toIsoString(a.createdAt)).getTime()
            : 0;
          const timeB = b.createdAt
            ? new Date(toIsoString(b.createdAt)).getTime()
            : 0;
          return timeB - timeA;
        });

      const latest = matchingDocs[0] || null;
      const prev = matchingDocs[1] || null;

      const score = latest ? extractBureauScore(latest, bureau) : null;
      const prevScore = prev ? extractBureauScore(prev, bureau) : null;
      const pulledAt = latest ? extractBureauPulledAt(latest) : null;
      const delta =
        score !== null && prevScore !== null ? score - prevScore : undefined;
      const change30d = delta;

      const history = matchingDocs
        .map((d) => {
          const s = extractBureauScore(d, bureau);
          const p = extractBureauPulledAt(d);
          return s !== null && p !== null ? { date: p, score: s } : null;
        })
        .filter((h): h is { date: string; score: number } => h !== null);

      return {
        score,
        pulledAt,
        delta,
        prevScore: prevScore ?? undefined,
        change30d,
        history: history.length > 0 ? history : undefined,
      };
    };

    const equifaxScore = buildBureauScore("Equifax");
    const experianScore = buildBureauScore("Experian");
    const transunionScore = buildBureauScore("TransUnion");

    // Extract alert messages from reports
    const crsAlerts: Array<{
      id: string;
      message: string;
      severity: "info" | "warning" | "critical";
      createdAt: string;
    }> = [];

    crsReportDocs.forEach((d, docIdx) => {
      const msgs = d.report?.responseAlertMessages || [];
      if (Array.isArray(msgs)) {
        msgs.forEach((m, mIdx) => {
          if (m?.responseAlertMessageText) {
            const cat = (
              m.responseAlertMessageCategoryType || ""
            ).toLowerCase();
            const isCritical = cat.includes("fraud") || cat.includes("block");
            const bName = bureauLabel(m.sourceType || d.type);
            crsAlerts.push({
              id: `crs_alert_${docIdx}_${mIdx}`,
              message: `${bName}: ${m.responseAlertMessageText}`,
              severity: isCritical ? "critical" : "warning",
              createdAt: toIsoString(d.createdAt),
            });
          }
        });
      }
    });

    const baseProfile: BrainProfile = {
      uid: clientId,
      displayName:
        `${u?.firstName || ""} ${u?.lastName || ""}`.trim() ||
        u?.email ||
        "Client",
      email: u?.email || "",
      phone: u?.phoneNumber || "",
      credit: {
        equifax: equifaxScore,
        experian: experianScore,
        transunion: transunionScore,
      },
      business: {
        name:
          bizData?.businessName ||
          fundData?.businessName ||
          u?.businessName ||
          "Business Profile",
        ein:
          bizData?.employerIdentificationNumber ||
          u?.employerIdentificationNumber ||
          null,
        entityType: bizData?.entityType || "LLC",
        annualRevenue:
          bizData?.annualRevenue || fundData?.annualRevenue || 500000,
        industry:
          bizData?.industry ||
          fundData?.industry ||
          "Commercial & Financial Services",
      },
      billing: {
        status: "current",
        planName: "CEG Platform Access",
        amount: 297,
        interval: "month",
        nextBillDate: new Date(Date.now() + 20 * 86400000).toISOString(),
      },
      enrollments: [
        {
          programId: "p_funding",
          name:
            fundData?.fundingType || "Business Funding & Credit Accelerator",
          status: "active",
          progressPercent: 75,
          joinedAt: toIsoString(u?.registrationDate),
        },
      ],
      recommendations: [
        {
          id: "rec_1",
          title: "Working Capital Line of Credit ($150,000)",
          fitScore: 95,
          reason:
            "Approved underwriting profile and active business registration.",
        },
      ],
      notes: [],
      lifecycle: {
        stage:
          fundData?.status === "Funded"
            ? "Funded"
            : fundData?.status === "Approved"
              ? "Fund"
              : "Diagnostic",
        updatedAt: new Date().toISOString(),
      },
      alerts: crsAlerts,
      gated: {
        ssn: u?.ssn || null,
        dob: u?.dateOfBirth || null,
        ein:
          bizData?.employerIdentificationNumber ||
          u?.employerIdentificationNumber ||
          null,
        bankAccounts: [],
      },
    };

    const { profile } = redactProfile(baseProfile, userRole, true);
    return profile;
  } catch (error) {
    console.error(`fetchClient360Action error for ${clientId}:`, error);
    return null;
  }
}

/**
 * Writes messages directly to user/{clientId}/interactions
 */
export async function sendCrmMessageAction(params: {
  clientId: string;
  channel: Channel;
  body: string;
  repId: string;
}): Promise<Interaction> {
  const { clientId, channel, body, repId } = params;
  const now = new Date().toISOString();
  const id = `ix_${Date.now()}`;

  const newIx: Interaction = {
    id,
    clientId,
    channel,
    direction: "out",
    ts: now,
    createdAt: now,
    from: repId,
    to: "",
    body,
    attachments: [],
    provider: "crm",
    providerId: `prov_${Date.now()}`,
    repId,
    aiHandled: false,
    status: "sent",
  };

  try {
    await adminDb
      .collection(`user/${clientId}/interactions`)
      .doc(id)
      .set(newIx);
  } catch (err) {
    console.error("sendCrmMessageAction DB Error:", err);
  }

  return newIx;
}

/**
 * Writes notes directly to user/{clientId}/interactions
 */
export async function addCrmNoteAction(params: {
  clientId: string;
  body: string;
  repId: string;
}): Promise<Interaction> {
  const { clientId, body, repId } = params;
  const now = new Date().toISOString();
  const id = `note_${Date.now()}`;

  const newNote: Interaction = {
    id,
    clientId,
    channel: "note",
    direction: "out",
    ts: now,
    createdAt: now,
    from: repId,
    to: "",
    body,
    attachments: [],
    provider: "crm",
    providerId: id,
    repId,
    aiHandled: false,
    status: "sent",
  };

  try {
    await adminDb
      .collection(`user/${clientId}/interactions`)
      .doc(id)
      .set(newNote);
  } catch (err) {
    console.error("addCrmNoteAction DB Error:", err);
  }

  return newNote;
}

/**
 * Writes tasks directly to user/{clientId}/tasks
 */
export async function createCrmTaskAction(params: {
  clientId: string;
  title: string;
  dueAt: string | null;
  repId: string;
}): Promise<Task> {
  const { clientId, title, dueAt, repId } = params;
  const now = new Date().toISOString();
  const id = `task_${Date.now()}`;

  const newTask: Task = {
    id,
    clientId,
    title,
    dueAt,
    status: "open",
    assigneeRepId: repId,
    priority: "normal",
    createdBy: repId,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await adminDb.collection(`user/${clientId}/tasks`).doc(id).set(newTask);
  } catch (err) {
    console.error("createCrmTaskAction DB Error:", err);
  }

  return newTask;
}

/**
 * Updates task status in user/{clientId}/tasks/{taskId}
 */
export async function toggleCrmTaskStatusAction(params: {
  clientId: string;
  taskId: string;
  nextStatus: TaskStatus;
}): Promise<void> {
  const { clientId, taskId, nextStatus } = params;
  const now = new Date().toISOString();

  try {
    await adminDb.collection(`user/${clientId}/tasks`).doc(taskId).update({
      status: nextStatus,
      updatedAt: now,
    });
  } catch (err) {
    console.error("toggleCrmTaskStatusAction DB Error:", err);
  }
}

export async function claimCrmLeadAction(leadId: string): Promise<void> {
  try {
    await adminDb.collection("crm_priority").doc(leadId).delete();
  } catch (err) {
    console.error("claimCrmLeadAction error:", err);
  }
}

export async function linkCrmClientToBrainAction(
  clientId: string,
  brainUid: string,
): Promise<void> {
  try {
    await adminDb.collection("user").doc(clientId).set(
      {
        brainUid,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (err) {
    console.error("linkCrmClientToBrainAction error:", err);
  }
}

export async function updateCrmAgentSettingsAction(
  settings: Partial<AgentSettings>,
): Promise<void> {
  try {
    await adminDb
      .collection("crm_settings")
      .doc("ai_agent")
      .set(
        { ...settings, updatedAt: new Date().toISOString() },
        { merge: true },
      );
  } catch (err) {
    console.error("updateCrmAgentSettingsAction error:", err);
  }
}

export async function refreshCrmAiSummaryAction(
  clientId: string,
): Promise<void> {
  try {
    await adminDb.collection("user").doc(clientId).set(
      {
        aiSummaryUpdatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (err) {
    console.error("refreshCrmAiSummaryAction error:", err);
  }
}

export async function setRepStatusAction(
  repUid: string,
  status: RepStatus,
): Promise<void> {
  try {
    await adminDb.collection("user").doc(repUid).set(
      {
        repStatus: status,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (err) {
    console.error("setRepStatusAction error:", err);
  }
}
