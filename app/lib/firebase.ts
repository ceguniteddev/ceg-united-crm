import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

export const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyB1NpKx3XX1ei-EOsmRrdj6N-3yy5fdddE",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "cegunitedllc.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "cegunitedllc",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "cegunitedllc.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "898492424787",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:898492424787:web:380b9fae0ba7f0b44bdca6",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-58EJ9Y19W1",
};

// Initialize Firebase App singleton
export const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const databaseId =
  process.env.FIREBASE_DB_NAME || "ceg-united-db-staging";

// Auth, Firestore & Storage instances
export const auth: Auth = getAuth(app);
export const db: Firestore = initializeFirestore(
  app,
  { ignoreUndefinedProperties: true },
  databaseId,
);
export const storage: FirebaseStorage = getStorage(app);

// Analytics (browser only)
let analyticsInstance: Analytics | null = null;
if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) {
        analyticsInstance = getAnalytics(app);
      }
    })
    .catch(() => {
      // Ignore analytics init error in non-standard environments
    });
}

export const analytics = analyticsInstance;
