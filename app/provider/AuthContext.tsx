"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { verifyAdminUserAction } from "../actions/auth";
import AppError from "@/error/AppError";
import { createEnterpriseAssessment } from "@/lib/captcha/captcha";

export interface AdminUserData {
  uid: string;
  email: string;
  displayName: string;
  role: "Admin";
  activeStatus?: string;
  phoneNumber?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  adminUser: AdminUserData | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (token: string | null, email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Validate Firestore user document and enforce Admin role via Server Action
  const validateAndFetchAdmin = useCallback(
    async (firebaseUser: FirebaseUser): Promise<AdminUserData | null> => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const res = await verifyAdminUserAction(idToken);

        if (!res.success || !res.adminUser) {
          console.warn("Validation failed:", res.error);
          await signOut(auth);
          return null;
        }

        return res.adminUser;
      } catch (err) {
        console.error("Error validating admin role:", err);
        await signOut(auth);
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentFirebaseUser) => {
        if (currentFirebaseUser) {
          const adminData = await validateAndFetchAdmin(currentFirebaseUser);
          if (adminData) {
            setUser(currentFirebaseUser);
            setAdminUser(adminData);
          } else {
            setUser(null);
            setAdminUser(null);
          }
        } else {
          setUser(null);
          setAdminUser(null);
        }
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [validateAndFetchAdmin]);

  const signIn = useCallback(
    async (
      token: string | null,
      email: string,
      password: string,
    ): Promise<void> => {
      if (!token) {
        throw new AppError("Failed to login. Please refresh the page.");
      }

      const captchaData = await createEnterpriseAssessment(token, "login");
      if (!captchaData || captchaData.score < 0.5) {
        throw new AppError("Captcha verification failed. Please try again.");
      }

      const normalizedEmail = email.trim().toLowerCase();

      const userCredential = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password,
      );
      const firebaseUser = userCredential.user;

      const idToken = await firebaseUser.getIdToken(true);
      const res = await verifyAdminUserAction(idToken);

      if (!res.success || !res.adminUser) {
        await signOut(auth);
        throw new Error(
          res.error ||
            "Access denied. CEG Console CRM is restricted to Administrators only.",
        );
      }

      setUser(firebaseUser);
      setAdminUser(res.adminUser);
    },
    [],
  );

  const logOut = useCallback(async (): Promise<void> => {
    try {
      await signOut(auth);
    } finally {
      setUser(null);
      setAdminUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      adminUser,
      loading,
      isAdmin: adminUser?.role === "Admin",
      signIn,
      logOut,
    }),
    [user, adminUser, loading, signIn, logOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
