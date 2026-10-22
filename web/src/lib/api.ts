import {
  AppUser,
  BatchHistoryRecord,
  BatchRecord,
  ContactRecord,
  PaymentRecord,
  WorkflowRecord,
} from "../types";

export function getApiBase(): string {
  if (typeof window !== "undefined") {
    return "/api";
  }
  return process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export async function loginApi(
  email: string,
  password = "demo123"
): Promise<{ token: string; user: AppUser } | null> {
  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) return null;
  return (await response.json()) as { token: string; user: AppUser };
}

export async function authFetch(
  url: string,
  token: string | null,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  let activeToken = token;
  if (!activeToken && typeof window !== "undefined") {
    activeToken = window.localStorage.getItem("thoorigai-token");
  }
  if (activeToken) {
    headers.set("Authorization", `Bearer ${activeToken}`);
  }
  let response = await fetch(url, { ...init, headers });

  // If unauthorized due to an expired token in demo mode, auto-refresh and retry seamlessly
  if (
    response.status === 401 &&
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  ) {
    try {
      const storedUser = window.localStorage.getItem("thoorigai-user");
      let loginEmail = "admin@example.test";
      if (storedUser) {
        const parsed = JSON.parse(storedUser) as { email?: string };
        if (parsed?.email) loginEmail = parsed.email;
      }
      const refreshed = await loginApi(loginEmail, "demo123");
      if (refreshed?.token) {
        window.localStorage.setItem("thoorigai-token", refreshed.token);
        window.localStorage.setItem("thoorigai-user", JSON.stringify(refreshed.user));
        headers.set("Authorization", `Bearer ${refreshed.token}`);
        response = await fetch(url, { ...init, headers });
      }
    } catch {
      // return original response
    }
  }

  return response;
}

export async function fetchDashboardData(token: string, organizationId = "demo-org") {
  const apiBase = getApiBase();
  const headers = { Authorization: `Bearer ${token}` };
  return Promise.all([
    fetch(`${apiBase}/workflows?organizationId=${encodeURIComponent(organizationId)}`, {
      cache: "no-store",
      headers,
    }),
    fetch(`${apiBase}/batches?organizationId=${encodeURIComponent(organizationId)}`, {
      cache: "no-store",
      headers,
    }),
    fetch(`${apiBase}/contacts?organizationId=${encodeURIComponent(organizationId)}`, {
      cache: "no-store",
      headers,
    }),
  ]);
}

export async function fetchPaymentsForBatch(
  batchId: string,
  token: string
): Promise<PaymentRecord[]> {
  const apiBase = getApiBase();
  const response = await fetch(
    `${apiBase}/payments/batch/${encodeURIComponent(batchId)}`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok) return [];
  return (await response.json()) as PaymentRecord[];
}

export async function fetchBatchHistory(
  batchId: string,
  token: string
): Promise<BatchHistoryRecord> {
  const apiBase = getApiBase();
  const response = await fetch(
    `${apiBase}/batches/${encodeURIComponent(batchId)}/history`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok) {
    throw new Error("Unable to load batch audit trail and history.");
  }
  return (await response.json()) as BatchHistoryRecord;
}

