"use server";

import { adminAuth, adminDb } from "../lib/firebaseAdmin";
import type { AdminUserData } from "../provider/AuthContext";

export async function verifyAdminUserAction(idToken: string): Promise<{
  success: boolean;
  adminUser?: AdminUserData;
  error?: string;
}> {
  try {
    if (!idToken) {
      return { success: false, error: "Authentication token missing." };
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.collection("user").doc(uid).get();

    if (!userDoc.exists) {
      return {
        success: false,
        error: "User record not found in system database.",
      };
    }

    const userData = userDoc.data();

    if (userData?.activeStatus === "InActive") {
      return {
        success: false,
        error: "Your account has been deactivated. Please contact support.",
      };
    }

    // Role check: Support Admin, Owner, Manager, Broker
    const rawRole = (
      userData?.role ||
      decoded.crmRole ||
      (decoded.admin ? "Admin" : "") ||
      ""
    )
      .toString()
      .trim();
    const normalizedRole = rawRole.toLowerCase();
    const isStaffOrAdmin =
      normalizedRole === "admin" ||
      normalizedRole === "owner" ||
      normalizedRole === "manager" ||
      normalizedRole === "broker" ||
      normalizedRole === "senior_rep" ||
      normalizedRole === "rep";

    if (!isStaffOrAdmin) {
      return {
        success: false,
        error:
          "Access denied. CEG Console CRM is restricted to Administrators only.",
      };
    }

    const displayName =
      `${userData?.firstName || ""} ${userData?.lastName || ""}`.trim() ||
      decoded.name ||
      decoded.email?.split("@")[0] ||
      "Administrator";

    const adminUser: AdminUserData = {
      uid,
      email: decoded.email || userData?.email || "",
      displayName,
      role: "Admin",
      activeStatus: userData?.activeStatus || "Active",
      phoneNumber: userData?.phoneNumber,
    };

    return { success: true, adminUser };
  } catch (err: unknown) {
    console.error("verifyAdminUserAction Error:", err);
    const errMsg = err instanceof Error ? err.message : "Authentication verification failed.";
    return {
      success: false,
      error: errMsg,
    };
  }
}
