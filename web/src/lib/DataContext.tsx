"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { AppUser, BatchRecord, ContactRecord, DisplayBill, WorkflowRecord } from "../types";
import { fetchDashboardData, loginApi } from "./api";
import { toDisplayBills } from "./utils";

interface DataContextType {
  batches: BatchRecord[];
  bills: DisplayBill[];
  contacts: ContactRecord[];
  workflows: WorkflowRecord[];
  currentUser: AppUser | null;
  authToken: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  secondsAgo: number;
  lastUpdated: Date | null;
  error: string | null;
  overdueCount: number;
  inFlightCount: number;
  readyForPaymentCount: number;
  refreshData: () => Promise<void>;
  setCurrentUser: (user: AppUser | null) => void;
  setAuthToken: (token: string | null) => void;
  loginWithCredentials: (email: string, password?: string) => Promise<boolean>;
  signOut: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [bills, setBills] = useState<DisplayBill[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);

  // Sign In function
  const loginWithCredentials = useCallback(async (email: string, password = "demo123"): Promise<boolean> => {
    setError(null);
    try {
      const result = await loginApi(email, password);
      if (result && isMountedRef.current) {
        setAuthToken(result.token);
        setCurrentUser(result.user);
        window.localStorage.setItem("thoorigai-token", result.token);
        window.localStorage.setItem("thoorigai-user", JSON.stringify(result.user));
        return true;
      }
      throw new Error("Invalid credentials or server unavailable");
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Sign-in failed");
      }
      return false;
    }
  }, []);

  // Sign Out function
  const signOut = useCallback(() => {
    setCurrentUser(null);
    setAuthToken(null);
    setBatches([]);
    setBills([]);
    setContacts([]);
    setWorkflows([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("thoorigai-token");
      window.localStorage.removeItem("thoorigai-user");
    }
  }, []);

  // Initialize Auth from localStorage or allow unauthenticated login
  useEffect(() => {
    isMountedRef.current = true;
    const initAuth = async () => {
      const savedToken = typeof window !== "undefined" ? window.localStorage.getItem("thoorigai-token") : null;
      const savedUser = typeof window !== "undefined" ? window.localStorage.getItem("thoorigai-user") : null;

      if (savedToken && savedUser) {
        try {
          const user = JSON.parse(savedUser) as AppUser;
          setAuthToken(savedToken);
          setCurrentUser(user);
          setIsLoading(false);
          return;
        } catch {
          // ignore corrupted local storage
        }
      }

      // No saved session found; finish loading so SignInView can be presented
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    };

    void initAuth();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch Dashboard Data with request sequencing
  const loadData = useCallback(async (isBackground = false) => {
    console.count("loadData");
    if (!authToken || !currentUser) return;

    const currentSeq = ++requestSeqRef.current;

    if (isBackground) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const orgId = currentUser.organizationId || "demo-org";
      const [workflowsRes, batchesRes, contactsRes] = await fetchDashboardData(authToken, orgId);

      if (!workflowsRes.ok || !batchesRes.ok || !contactsRes.ok) {
        throw new Error("Unable to fetch ledger data");
      }

      const [freshWorkflows, freshBatches, freshContacts] = await Promise.all([
        workflowsRes.json() as Promise<WorkflowRecord[]>,
        batchesRes.json() as Promise<BatchRecord[]>,
        contactsRes.json() as Promise<ContactRecord[]>,
      ]);

      // Guard against slow background polls overwriting fresher responses
      if (currentSeq < requestSeqRef.current) {
        return;
      }

      if (isMountedRef.current) {
        setWorkflows(freshWorkflows);
        setBatches(freshBatches);
        setBills(toDisplayBills(freshBatches));
        setContacts(freshContacts);
        setLastUpdated(new Date());
        setSecondsAgo(0);
      }
    } catch (err) {
      if (currentSeq >= requestSeqRef.current && isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Error refreshing dashboard");
      }
    } finally {
      if (currentSeq >= requestSeqRef.current && isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [authToken, currentUser]);

  const [nowMs, setNowMs] = useState(() => Date.now());

  // 60-second ticker for aging calculations
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Initial load when auth becomes available (deferred to next tick to avoid cascading renders)
  useEffect(() => {
    if (authToken && currentUser) {
      const timer = setTimeout(() => {
        void loadData(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [authToken, currentUser, loadData]);

  // Visibility-aware 30s background poll + immediate refetch on tab visibility change
  useEffect(() => {
    if (!authToken || !currentUser) return;

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void loadData(true);
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    const intervalId = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void loadData(true);
      }
    }, 30000);

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      clearInterval(intervalId);
    };
  }, [authToken, currentUser, loadData]);

  // Seconds-ago ticker (every 1s)
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute live attention counts
  const overdueCount = batches.filter((b) => {
    if (b.status !== "IN_PROGRESS") return false;
    const step = b.stepInstances?.find((s) => s.status === "ALERTED" || s.status === "ESCALATED");
    if (!step) return false;
    if (step.status === "ESCALATED") return true;
    if ((step.reminderCount ?? 0) > 1) return true;
    if (step.alertedAt) {
      const hours = (nowMs - new Date(step.alertedAt).getTime()) / (1000 * 60 * 60);
      return hours > 24;
    }
    return false;
  }).length;

  const inFlightCount = batches.filter((b) => b.status === "IN_PROGRESS").length;
  const readyForPaymentCount = batches.filter((b) => b.status === "READY_FOR_PAYMENT").length;

  const refreshData = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  return (
    <DataContext.Provider
      value={{
        batches,
        bills,
        contacts,
        workflows,
        currentUser,
        authToken,
        isLoading,
        isRefreshing,
        secondsAgo,
        lastUpdated,
        error,
        overdueCount,
        inFlightCount,
        readyForPaymentCount,
        refreshData,
        setCurrentUser,
        setAuthToken,
        loginWithCredentials,
        signOut,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useDataContext() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useDataContext must be used within a DataProvider");
  }
  return context;
}
