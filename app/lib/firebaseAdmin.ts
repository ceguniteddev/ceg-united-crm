import {
  initializeApp,
  getApps,
  getApp,
  cert,
  type App,
} from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import type { Role } from "../types/crm";

import { getStorage, type Storage } from "firebase-admin/storage";

export const formatPrivateKey = (privateKey: string) =>
  privateKey.replace(/\\n/g, "\n");

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_NAME,
  });
}

export const adminApp = getAdminApp();
export const adminAuth: Auth = getAuth(adminApp);

function getFirestoreDatabaseId(): string {
  const databaseId =
    process.env.FIREBASE_DB_NAME ||
    process.env.CRM_FIRESTORE_DATABASE_ID ||
    "ceg-united-db-production";

  return databaseId;
}

export const adminDb: Firestore = getFirestore(
  adminApp,
  getFirestoreDatabaseId(),
);

export const adminStorage: Storage = getStorage(adminApp);

export async function verifyUserToken(
  token: string,
): Promise<{ uid: string; role: Role; email?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    let role: Role = (decoded.crmRole as Role) || "viewer";

    if (!decoded.crmRole) {
      // Check in user collection
      const userDoc = await adminDb.collection("user").doc(decoded.uid).get();
      if (userDoc.exists && userDoc.data()?.role) {
        const userRole = userDoc.data()!.role;
        role = userRole === "Admin" ? "owner" : "viewer";
      }
    }

    return {
      uid: decoded.uid,
      role,
      email: decoded.email,
    };
  } catch (error) {
    console.error("Error verifying Firebase token:", error);
    throw new Error("Unauthorized");
  }
}
