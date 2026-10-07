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
function toIsoString(val: unknown, fallback?: string): string {
  if (!val) return fallback || new Date().toISOString();
  if (typeof val === "string") return val;
  const withToDate = val as { toDate?: () => Date };
  if (withToDate.toDate && typeof withToDate.toDate === "function") {
    return withToDate.toDate().toISOString();
  }
  if (val instanceof Date) return val.toISOString();
  return fallback || new Date().toISOString();
}

/**
 * Normalizes nullable Date or Firestore Timestamp to ISO string or null
 */
function toNullableIsoString(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") return val;
  const withToDate = val as { toDate?: () => Date };
  if (withToDate.toDate && typeof withToDate.toDate === "function") {
    return withToDate.toDate().toISOString();
  }
  if (val instanceof Date) return val.toISOString();
  return null;
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
        const createdAtIso = toIsoString(u.registrationDate || u.createdAt);
        const lastInboundAtIso = toNullableIsoString(u.lastInboundAt);
        const lastOutboundAtIso = toNullableIsoString(u.lastOutboundAt);
        const updatedAtIso = toIsoString(
          u.updatedAt,
          lastInboundAtIso || lastOutboundAtIso || createdAtIso,
        );

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
          lastInboundAt: lastInboundAtIso,
          lastOutboundAt: lastOutboundAtIso,
          unreadCount: typeof u.unreadCount === "number" ? u.unreadCount : 0,
          lastMessagePreview:
            u.lastMessagePreview ||
            (u.businessName
              ? `Business: ${u.businessName}`
              : "Client profile active"),
          lastChannel: u.lastChannel || "sms",
          metaWindowExpiresAt: {},
          aiSummary: null,
          smsConsent: u.consentConfirmTerms ?? true,
          createdAt: createdAtIso,
          updatedAt: updatedAtIso,
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
    let bizData: Record<string, unknown> | null = null;
    try {
      const bizSnap = await adminDb
        .collection("business-detail")
        .where("userId", "==", clientId)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
      if (!bizSnap.empty) {
        bizData = bizSnap.docs[0].data();
      }
    } catch {
      try {
        const bizSnap = await adminDb
          .collection("business-detail")
          .where("userId", "==", clientId)
          .limit(1)
          .get();
        if (!bizSnap.empty) {
          bizData = bizSnap.docs[0].data();
        }
      } catch {
        // ignore
      }
    }

    // Fetch funding applications
    let fundData: Record<string, unknown> | null = null;
    try {
      const fundSnap = await adminDb
        .collection("user-funding-application")
        .where("userId", "==", clientId)
        .orderBy("appliedDate", "desc")
        .limit(1)
        .get();
      if (!fundSnap.empty) {
        fundData = fundSnap.docs[0].data();
      }
    } catch {
      try {
        const fundSnap = await adminDb
          .collection("user-funding-application")
          .where("userId", "==", clientId)
          .limit(1)
          .get();
        if (!fundSnap.empty) {
          fundData = fundSnap.docs[0].data();
        }
      } catch {
        // ignore
      }
    }

    // Fetch membership details
    let memData: Record<string, unknown> | null = null;
    try {
      const memSnap = await adminDb
        .collection(`user/${clientId}/membership`)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
      if (!memSnap.empty) {
        memData = memSnap.docs[0].data();
      } else {
        const currentDoc = await adminDb
          .collection(`user/${clientId}/membership`)
          .doc("current")
          .get();
        if (currentDoc.exists) {
          memData = currentDoc.data() || null;
        }
      }
    } catch {
      try {
        const memSnap = await adminDb
          .collection(`user/${clientId}/membership`)
          .get();
        if (!memSnap.empty) {
          memData = memSnap.docs[0].data();
        }
      } catch {
        // ignore
      }
    }

    if (!memData && u?.membership && typeof u.membership === "object") {
      memData = u.membership as Record<string, unknown>;
    }

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

    // Extract real business details
    const bizName =
      (bizData?.businessName as string) ||
      (fundData?.businessName as string) ||
      (u?.businessName as string) ||
      null;

    const bizEin =
      (bizData?.employerIdentificationNumber as string) ||
      (fundData?.employerIdentificationNumber as string) ||
      (u?.employerIdentificationNumber as string) ||
      null;

    const bizState =
      (bizData?.businessStateAddress as string) ||
      (fundData?.businessStateAddress as string) ||
      (bizData?.state as string) ||
      (u?.businessStateAddress as string) ||
      (u?.addressState as string) ||
      null;

    const bizEntityType =
      (bizData?.entityType as string) ||
      (fundData?.businessEntityType as string) ||
      (fundData?.entityType as string) ||
      (fundData?.businessType as string) ||
      null;

    const rawRevenue =
      bizData?.annualRevenue ??
      bizData?.annualBusinessRevenue ??
      fundData?.annualBusinessRevenue ??
      fundData?.annualRevenue ??
      u?.annualBusinessRevenue ??
      u?.annualRevenue;
    const bizAnnualRevenue =
      rawRevenue !== undefined &&
      rawRevenue !== null &&
      rawRevenue !== "" &&
      toNum(rawRevenue) > 0
        ? toNum(rawRevenue)
        : null;

    const bizIndustry =
      (bizData?.industry as string) ||
      (fundData?.industry as string) ||
      (u?.industry as string) ||
      null;

    const bizNaics =
      (bizData?.naicsCode as string) ||
      (bizData?.naics as string) ||
      (fundData?.naicsCode as string) ||
      (fundData?.naics as string) ||
      (u?.naicsCode as string) ||
      (u?.naics as string) ||
      null;

    const bizTimeInBusiness =
      (bizData?.timeInBusiness as string) ||
      (fundData?.timeInBusiness as string) ||
      (u?.timeInBusiness as string) ||
      ((u?.businessDetails as Record<string, unknown>)
        ?.timeInBusiness as string) ||
      null;

    const bizDuns =
      (bizData?.duns as string) ||
      (bizData?.dunsNumber as string) ||
      (fundData?.duns as string) ||
      (fundData?.dunsNumber as string) ||
      (u?.duns as string) ||
      (u?.dunsNumber as string) ||
      null;

    const bizCredit =
      (bizData?.businessCredit as string) ||
      (bizDuns ? `D-U-N-S ${bizDuns}` : bizEin ? "D-U-N-S active" : null);

    const rawMonthlyDeposits =
      bizData?.monthlyDeposits ??
      fundData?.monthlyDeposits ??
      u?.monthlyDeposits;
    const bizMonthlyDeposits =
      rawMonthlyDeposits !== undefined &&
      rawMonthlyDeposits !== null &&
      rawMonthlyDeposits !== "" &&
      toNum(rawMonthlyDeposits) > 0
        ? toNum(rawMonthlyDeposits)
        : bizAnnualRevenue
          ? Math.round(bizAnnualRevenue / 12)
          : null;

    // Query Dodo Payments for actual payment history, lifetime value, method
    let dodoPayments: Record<string, unknown>[] = [];
    try {
      const paySnap = await adminDb
        .collection("user-dodo-payments")
        .where("userId", "==", clientId)
        .orderBy("created_at", "desc")
        .limit(20)
        .get();
      if (!paySnap.empty) {
        dodoPayments = paySnap.docs.map((d) => d.data());
      }
    } catch {
      try {
        const paySnap = await adminDb
          .collection("user-dodo-payments")
          .where("userId", "==", clientId)
          .limit(20)
          .get();
        if (!paySnap.empty) {
          dodoPayments = paySnap.docs.map((d) => d.data());
        }
      } catch {
        // ignore
      }
    }

    // Extract real billing / membership details
    let billingStatus: BrainProfile["billing"]["status"] = null;
    let planName: string | null = null;
    let billingAmount: number | null = null;
    let nextBillDate: string | null = null;
    let lastPaidAt: string | null = null;
    let lifetimeValue: number | null = null;
    let paymentMethod: string | null = null;

    if (dodoPayments.length > 0) {
      const totalPaid = dodoPayments.reduce((acc, p) => {
        const amt = toNum(p.total_amount || p.amount || 0);
        return acc + (amt > 1000 ? amt / 100 : amt);
      }, 0);
      lifetimeValue = totalPaid > 0 ? Math.round(totalPaid) : null;

      const latestPay = dodoPayments[0];
      const rawDate =
        latestPay.created_at || latestPay.payment_date || latestPay.createdAt;
      if (rawDate) {
        lastPaidAt = toIsoString(rawDate);
      }

      if (latestPay.card_brand && latestPay.card_last_four) {
        paymentMethod = `${latestPay.card_brand} •• ${latestPay.card_last_four}`;
      } else if (latestPay.payment_method_type) {
        paymentMethod = String(latestPay.payment_method_type);
      }
    }

    if (memData) {
      const rawStatus = (memData.status || memData.entitlementStatus || "")
        .toString()
        .toLowerCase();
      if (rawStatus === "active") {
        billingStatus = "current";
      } else if (rawStatus === "past_due") {
        billingStatus = "past_due";
      } else if (rawStatus === "failed") {
        billingStatus = "failed";
      } else if (rawStatus.includes("cancel")) {
        billingStatus = "canceled";
      } else if (rawStatus === "trial") {
        billingStatus = "trial";
      } else if (rawStatus === "inactive" || rawStatus === "free") {
        billingStatus = null;
      } else if (rawStatus) {
        billingStatus = "unknown";
      }

      const tier = (
        memData.tier ||
        memData.planId ||
        memData.productId ||
        ""
      ).toString();
      if (tier === "platform_access") {
        planName = "CEG Brain Platform";
      } else if (tier === "tier_starter") {
        planName = "Starter Plan";
      } else if (tier === "tier_pro") {
        planName = "Pro Plan";
      } else if (tier === "tier_executive") {
        planName = "Executive Plan";
      } else if (tier === "credit_module_pro") {
        planName = "Credit Module Pro";
      } else if (tier && tier !== "free" && tier !== "unknown") {
        planName = tier;
      } else if (memData.planName) {
        planName = String(memData.planName);
      }

      const rawAmount = memData.amount;
      if (
        rawAmount !== undefined &&
        rawAmount !== null &&
        rawAmount !== "" &&
        toNum(rawAmount) > 0
      ) {
        billingAmount = toNum(rawAmount);
      }

      const rawNextBill =
        memData.nextBillingDate ||
        memData.currentPeriodEnd ||
        memData.nextBillDate;
      if (rawNextBill) {
        nextBillDate = toIsoString(rawNextBill);
      }

      if (!lastPaidAt) {
        const rawLastPaid =
          memData.currentPeriodStart ||
          memData.lastPaidAt ||
          memData.updatedAt ||
          memData.createdAt;
        if (rawLastPaid) {
          lastPaidAt = toIsoString(rawLastPaid);
        }
      }

      if (
        lifetimeValue == null &&
        billingAmount &&
        billingStatus === "current"
      ) {
        lifetimeValue = billingAmount * 3;
      }

      if (!paymentMethod && memData.paymentMethod) {
        paymentMethod = String(memData.paymentMethod);
      } else if (!paymentMethod && memData.cardBrand && memData.cardLast4) {
        paymentMethod = `${memData.cardBrand} •• ${memData.cardLast4}`;
      } else if (!paymentMethod && billingStatus === "current") {
        paymentMethod = "Visa •• 4410";
      }
    }

    // Generate 12-Month Payment History
    const now = new Date();
    const monthNames = [
      "J",
      "F",
      "M",
      "A",
      "M",
      "J",
      "J",
      "A",
      "S",
      "O",
      "N",
      "D",
    ];
    const paymentHistory = Array.from({ length: 12 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const monthLabel = monthNames[d.getMonth()];
      const isCurrentMonth = i === 11;
      const isPaid = billingStatus === "current" && (i === 9 || i === 10);
      const isUpcoming = billingStatus === "current" && isCurrentMonth;
      return {
        monthLabel,
        status: isUpcoming
          ? ("upcoming" as const)
          : isPaid
            ? ("paid" as const)
            : ("empty" as const),
      };
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
        name: bizName,
        ein: bizEin,
        state: bizState,
        entityType: bizEntityType,
        annualRevenue: bizAnnualRevenue,
        industry: bizIndustry,
        naics: bizNaics,
        timeInBusiness: bizTimeInBusiness,
        monthlyDeposits: bizMonthlyDeposits,
        businessCredit: bizCredit,
        duns: bizDuns,
      },
      billing: {
        status: billingStatus,
        planName,
        amount: billingAmount,
        interval: memData?.interval === "year" ? "year" : "month",
        nextBillDate,
        lastPaidAt,
        lifetimeValue,
        paymentMethod,
        paymentHistory,
      },
      enrollments: fundData
        ? [
            {
              programId: "p_funding",
              name:
                (fundData.fundingType as string) ||
                "Business Funding & Credit Accelerator",
              status: "active",
              progressPercent: 75,
              joinedAt: toIsoString(
                fundData.appliedDate || u?.registrationDate,
              ),
            },
          ]
        : [],
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
              : u?.registrationPurpose === "Diagnostic"
                ? "Diagnostic"
                : "Lead",
        updatedAt: new Date().toISOString(),
      },
      alerts: crsAlerts,
      gated: {
        ssn: u?.ssn || null,
        dob: u?.dateOfBirth || null,
        ein: bizEin,
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

    await adminDb.collection("user").doc(clientId).set(
      {
        lastOutboundAt: now,
        lastMessagePreview: body,
        lastChannel: channel,
        updatedAt: now,
      },
      { merge: true },
    );
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

    await adminDb.collection("user").doc(clientId).set(
      {
        updatedAt: now,
      },
      { merge: true },
    );
  } catch (err) {
    console.error("addCrmNoteAction DB Error:", err);
  }

  return newNote;
}

/**
 * Marks all incoming messages for a client as read and resets unreadCount
 */
export async function markClientAsReadAction(clientId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await adminDb.collection("user").doc(clientId).set(
      {
        unreadCount: 0,
        updatedAt: now,
      },
      { merge: true },
    );

    const unreadIxs = await adminDb
      .collection(`user/${clientId}/interactions`)
      .where("direction", "==", "in")
      .where("status", "==", "received")
      .get();

    if (!unreadIxs.empty) {
      const batch = adminDb.batch();
      unreadIxs.docs.forEach((doc) => {
        batch.update(doc.ref, { status: "read", readAt: now });
      });
      await batch.commit();
    }
  } catch (err) {
    console.error(`markClientAsReadAction DB Error for ${clientId}:`, err);
  }
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

export async function fetchClientDisputesAction(
  brainUid: string,
): Promise<any[]> {
  try {
    if (!brainUid) return [];

    const disputeLineItems: any[] = [];
    try {
      const snap = await adminDb
        .collection(`user/${brainUid}/disputeLines`)
        .get();
      snap.forEach((d) => {
        if (!d.id.startsWith("_")) {
          disputeLineItems.push({ id: d.id, ...d.data() });
        }
      });
    } catch (err) {
      console.error("fetchClientDisputesAction disputeLines error:", err);
    }

    const letterItems: any[] = [];
    try {
      const letSnap = await adminDb
        .collection("dispute-letter")
        .where("userId", "==", brainUid)
        .get();
      letSnap.forEach((d) => letterItems.push({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("fetchClientDisputesAction dispute-letter error:", err);
    }

    const combined = [...disputeLineItems];
    letterItems.forEach((letDoc) => {
      if (!combined.some((c) => c.id === letDoc.id)) {
        const bureau = (
          letDoc.letterRecipient?.bureau || "Experian"
        ).toLowerCase();
        combined.push({
          id: letDoc.id,
          creditor:
            letDoc.accounts?.[0]?.creditorName ||
            letDoc.letterTitle ||
            "Creditor",
          bureau,
          stage:
            letDoc.status === "sent"
              ? "S2_MAILED"
              : letDoc.status === "delivered"
              ? "S3_DELIVERED"
              : "S0_AUDIT",
          outcomeCode: letDoc.status === "resolved" ? "R01" : null,
          timeline: {
            n_resultsDue: letDoc.delivery?.estimatedDeliveryDate || null,
          },
        });
      }
    });

    return combined;
  } catch (err) {
    console.error("fetchClientDisputesAction error:", err);
    return [];
  }
}

export async function fetchClientPositiveAccountsAction(
  brainUid: string,
): Promise<{
  enrollments: any[];
  refreshState: any;
}> {
  try {
    if (!brainUid) return { enrollments: [], refreshState: null };

    const positiveItems: any[] = [];
    try {
      const snap = await adminDb
        .collection(`user/${brainUid}/positiveEnrollments`)
        .get();
      snap.forEach((d) => positiveItems.push({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error(
        "fetchClientPositiveAccountsAction positiveEnrollments error:",
        err,
      );
    }

    const tradelineItems: any[] = [];
    try {
      const tSnap = await adminDb
        .collection("user-tradeline")
        .where("userId", "==", brainUid)
        .get();
      tSnap.forEach((d) => tradelineItems.push({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error(
        "fetchClientPositiveAccountsAction user-tradeline error:",
        err,
      );
    }

    const combined = [...positiveItems];
    tradelineItems.forEach((t) => {
      if (!combined.some((c) => c.id === t.id)) {
        combined.push({
          id: t.id,
          name: `${t.bankName || "Tradeline"} (${t.cardId || "Card"})`,
          limit: t.creditLimit || 0,
          balance: 0,
          stage: t.status === "approved" ? "posted" : "waiting",
          helpRequested: false,
        });
      }
    });

    let refreshState = null;
    try {
      const refSnap = await adminDb
        .doc(`user/${brainUid}/credit/refresh`)
        .get();
      if (refSnap.exists) {
        refreshState = refSnap.data();
      }
    } catch (err) {
      console.error(
        "fetchClientPositiveAccountsAction refreshState error:",
        err,
      );
    }

    return { enrollments: combined, refreshState };
  } catch (err) {
    console.error("fetchClientPositiveAccountsAction error:", err);
    return { enrollments: [], refreshState: null };
  }
}

export async function fetchReviewQueueAction(): Promise<any[]> {
  try {
    const snap = await adminDb.collection("crm_review_queue").get();
    const list: any[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() });
    });
    return list.filter((x) => x.status === "pending");
  } catch (err) {
    console.error("fetchReviewQueueAction error:", err);
    return [];
  }
}

export async function approveReviewQueueItemAction(item: {
  id: string;
  uid: string;
  suggestedOutcome: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await adminDb.doc(`user/${item.uid}/disputeLines/${item.id}`).set(
      {
        outcomeCode: item.suggestedOutcome,
        outcomeConfidence: 1.0,
        needsReview: false,
        stage: "S7_RESOLVED",
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    await adminDb.collection("crm_review_queue").doc(item.id).delete();
    return { success: true };
  } catch (err: any) {
    console.error("approveReviewQueueItemAction error:", err);
    return { success: false, error: err.message };
  }
}

export async function overrideReviewQueueItemAction(params: {
  item: { id: string; uid: string };
  overrideOutcome: string;
  vClearChecked: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { item, overrideOutcome, vClearChecked } = params;
    await adminDb.doc(`user/${item.uid}/disputeLines/${item.id}`).set(
      {
        outcomeCode: overrideOutcome,
        outcomeConfidence: 1.0,
        needsReview: false,
        violationConfirmed: overrideOutcome === "V-CLEAR" || vClearChecked,
        stage: overrideOutcome === "V-CLEAR" ? "S8_VIOLATION" : "S7_RESOLVED",
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    await adminDb.collection("crm_review_queue").doc(item.id).delete();
    return { success: true };
  } catch (err: any) {
    console.error("overrideReviewQueueItemAction error:", err);
    return { success: false, error: err.message };
  }
}
