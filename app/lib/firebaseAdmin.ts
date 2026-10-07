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

  // Check if Base64 encoded service account is provided
  if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    try {
      const decoded = Buffer.from(
        process.env.FIREBASE_PRIVATE_KEY_BASE64,
        "base64",
      ).toString("utf-8");
      const credentials = JSON.parse(decoded);
      return initializeApp({
        credential: cert({
          projectId: credentials.project_id,
          clientEmail: credentials.client_email,
          privateKey: formatPrivateKey(credentials.private_key),
        }),
        storageBucket:
          process.env.FIREBASE_STORAGE_BUCKET ||
          process.env.FIREBASE_STORAGE_NAME ||
          `${credentials.project_id}.firebasestorage.app`,
        projectId: credentials.project_id,
      });
    } catch (e) {
      console.error(
        "Failed to initialize Firebase Admin with FIREBASE_PRIVATE_KEY_BASE64:",
        e,
      );
    }
  }

  // Fallback for individual environment variables
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      "ceg-united-llc-prod";
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      }),
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET ||
        process.env.FIREBASE_STORAGE_NAME ||
        `${projectId}.firebasestorage.app`,
      projectId,
    });
  }

  return initializeApp({
    projectId:
      process.env.FIREBASE_PROJECT_ID ??
      process.env.GOOGLE_CLOUD_PROJECT ??
      "ceg-united-llc-prod",
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.FIREBASE_STORAGE_NAME ||
      "ceg-united-llc-prod.firebasestorage.app",
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
