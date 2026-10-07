import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

const firebaseConfigProd = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyBCaC_CvDUy75nBT4oRlYQksNe3SDHOcbw",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "ceg-united-llc-prod.firebaseapp.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ceg-united-llc-prod",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "ceg-united-llc-prod.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "516470017287",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:516470017287:web:832520958098e585f949a2",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-NY8EHMK975",
};

const firebaseConfigStaging = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyCxaMKdokoSQ9Ztraigdwgsfc8YWlYHdqQ",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "cegunitedllc.firebaseapp.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "cegunitedllc",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "cegunitedllc.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "898492424787",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:898492424787:web:305c0ba09c8de0694bdca6",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-X6TW83PVFY",
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

