import { AppUser, BatchHistoryRecord, PaymentRecord } from "../types";

export function getApiBase(): string {
  if (typeof window !== "undefined") {
    return "/api";
  }
  return process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export async function loginApi(
  email: string,
  password?: string
): Promise<{ token: string; user: AppUser } | null> {
  const apiBase = getApiBase();
  const effectivePassword = password ?? (process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "demo123" : "");
  const response = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password: effectivePassword }),
  });

  if (!response.ok) return null;
  return (await response.json()) as { token: string; user: AppUser };
}

export async function logoutApi(): Promise<void> {
  const apiBase = getApiBase();
  await fetch(`${apiBase}/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("thoorigai-token");
    window.localStorage.removeItem("thoorigai-user");
  }
}

export async function getMeApi(): Promise<AppUser | null> {
  const apiBase = getApiBase();
  try {
    const res = await authFetch(`${apiBase}/auth/me`, null);
    if (!res.ok) return null;
    return (await res.json()) as AppUser;
  } catch {
    return null;
  }
}

export async function authFetch(
  url: string,
  token?: string | null,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  });
}

export async function fetchDashboardData(
  token?: string | null,
  organizationId = "demo-org"
) {
  const apiBase = getApiBase();
  return Promise.all([
    authFetch(
      `${apiBase}/workflows?organizationId=${encodeURIComponent(organizationId)}`,
      token,
      { cache: "no-store" }
    ),
    authFetch(
      `${apiBase}/batches?organizationId=${encodeURIComponent(organizationId)}`,
      token,
      { cache: "no-store" }
    ),
    authFetch(
      `${apiBase}/contacts?organizationId=${encodeURIComponent(organizationId)}`,
      token,
      { cache: "no-store" }
    ),
  ]);
}

export async function fetchPaymentsForBatch(
  batchId: string,
  token?: string | null
): Promise<PaymentRecord[]> {
  const apiBase = getApiBase();
  const response = await authFetch(
    `${apiBase}/payments/batch/${encodeURIComponent(batchId)}`,
    token,
    { cache: "no-store" }
  );
  if (!response.ok) return [];
  return (await response.json()) as PaymentRecord[];
}

export async function fetchBatchHistory(
  batchId: string,
  token?: string | null
): Promise<BatchHistoryRecord> {
  const apiBase = getApiBase();
  const response = await authFetch(
    `${apiBase}/batches/${encodeURIComponent(batchId)}/history`,
    token,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error("Unable to load batch audit trail and history.");
  }
  return (await response.json()) as BatchHistoryRecord;
}

