import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

const firebaseConfigProd = {
  apiKey: "AIzaSyD5_7Ro5j9O-Om4WhvAqzE7yetKiZ7t0yA",
  authDomain: "ceg-united-llc-prod.firebaseapp.com",
  projectId: "ceg-united-llc-prod",
  storageBucket: "ceg-united-llc-prod.firebasestorage.app",
  messagingSenderId: "516470017287",
  appId: "1:516470017287:web:499badccab197cccf949a2",
  measurementId: "G-157BMQ4J17",
};

const firebaseConfigStaging = {
  apiKey: "AIzaSyB1NpKx3XX1ei-EOsmRrdj6N-3yy5fdddE",
  authDomain: "cegunitedllc.firebaseapp.com",
  projectId: "cegunitedllc",
  storageBucket: "cegunitedllc.firebasestorage.app",
  messagingSenderId: "898492424787",
  appId: "1:898492424787:web:380b9fae0ba7f0b44bdca6",
  measurementId: "G-58EJ9Y19W1",
};

export const firebaseConfig =
  process.env.NEXT_PUBLIC_ENVIRONMENT === "staging"
    ? firebaseConfigStaging
    : firebaseConfigProd;

// Initialize Firebase App singleton
export const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const databaseId =
  process.env.FIREBASE_DB_NAME ||
  (process.env.NEXT_PUBLIC_ENVIRONMENT === "staging"
    ? "ceg-united-db-staging"
    : "ceg-united-db-production");

// Auth & Storage instances
export const auth: Auth = getAuth(app);
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
