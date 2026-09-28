"use server";

import { adminDb } from "../lib/firebaseAdmin";
import type {
  AgentLogEntry,
  AgentSettings,
  AppSettings,
  BrainProfile,
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

    // Fetch credit reports
    const crsSnap = await adminDb
      .collection("crs-report-data")
      .where("userId", "==", clientId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    const crsData = !crsSnap.empty ? crsSnap.docs[0].data() : null;

    const baseProfile: BrainProfile = {
      uid: clientId,
      displayName:
        `${u?.firstName || ""} ${u?.lastName || ""}`.trim() ||
        u?.email ||
        "Client",
      email: u?.email || "",
      phone: u?.phoneNumber || "",
      credit: {
        equifax: {
          score: crsData?.scores?.equifax ?? 710,
          pulledAt: crsData?.createdAt
            ? toIsoString(crsData.createdAt)
            : new Date().toISOString(),
        },
        experian: {
          score: crsData?.scores?.experian ?? 725,
          pulledAt: crsData?.createdAt
            ? toIsoString(crsData.createdAt)
            : new Date().toISOString(),
        },
        transunion: {
          score: crsData?.scores?.transunion ?? 718,
          pulledAt: crsData?.createdAt
            ? toIsoString(crsData.createdAt)
            : new Date().toISOString(),
        },
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
      alerts: [],
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
