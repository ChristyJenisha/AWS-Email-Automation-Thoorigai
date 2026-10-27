import { describe, it, expect } from "vitest";
import {
  isValidConfirmNote,
  compareActiveBatchesUrgency,
  isApproverRoute,
  filterBatches,
  sortBatches,
  formatBatchId,
  formatStageDuration,
} from "./utils";
import { BatchRecord } from "../types";

describe("isValidConfirmNote", () => {
  it("rejects non-string values, null, and undefined", () => {
    expect(isValidConfirmNote(null)).toBe(false);
    expect(isValidConfirmNote(undefined)).toBe(false);
    // @ts-expect-error testing invalid type input
    expect(isValidConfirmNote(12345)).toBe(false);
  });

  it("rejects empty strings and whitespace-only strings", () => {
    expect(isValidConfirmNote("")).toBe(false);
    expect(isValidConfirmNote("   ")).toBe(false);
    expect(isValidConfirmNote("          ")).toBe(false); // 10 spaces
  });

  it("rejects strings with fewer than 10 characters after trimming", () => {
    expect(isValidConfirmNote("123456789")).toBe(false); // 9 characters
    expect(isValidConfirmNote("  123456789  ")).toBe(false); // 9 characters with spaces
    expect(isValidConfirmNote("Approved")).toBe(false); // 8 characters
    expect(isValidConfirmNote("   ok   ")).toBe(false);
  });

  it("accepts strings with 10 or more characters after trimming", () => {
    expect(isValidConfirmNote("1234567890")).toBe(true); // exactly 10 characters
    expect(isValidConfirmNote("   1234567890   ")).toBe(true); // 10 characters with surrounding whitespace
    expect(isValidConfirmNote("Approved via phone call")).toBe(true);
    expect(isValidConfirmNote("Spoke with director Rajesh on WhatsApp")).toBe(true);
  });
});

describe("compareActiveBatchesUrgency (Deterministic Sort)", () => {
  const createMockBatch = (
    id: string,
    status: "ALERTED" | "ESCALATED",
    alertedAt: string,
    reminderCount: number
  ): BatchRecord => ({
    id,
    status: "IN_PROGRESS",
    stepInstances: [
      {
        id: `step-${id}`,
        status,
        alertedAt,
        reminderCount,
        nextReminderAt: null,
        lastComment: null,
      },
    ],
  });

  it("prioritizes ESCALATED batches ahead of ALERTED batches even if ALERTED has been waiting longer", () => {
    // Batch A has been alerted for 3 days, but not escalated
    const batchA = createMockBatch("batch-alerted-older", "ALERTED", "2026-10-18T10:00:00Z", 2);
    // Batch B was escalated recently (1 hour ago)
    const batchB = createMockBatch("batch-escalated-newer", "ESCALATED", "2026-10-21T09:00:00Z", 3);

    const list = [batchA, batchB].sort(compareActiveBatchesUrgency);
    expect(list[0].id).toBe("batch-escalated-newer");
    expect(list[1].id).toBe("batch-alerted-older");
  });

  it("sorts by oldest alertedAt first when escalation statuses match", () => {
    const olderBatch = createMockBatch("batch-older", "ALERTED", "2026-10-19T08:00:00Z", 1);
    const newerBatch = createMockBatch("batch-newer", "ALERTED", "2026-10-20T14:00:00Z", 1);

    const list = [newerBatch, olderBatch].sort(compareActiveBatchesUrgency);
    expect(list[0].id).toBe("batch-older");
    expect(list[1].id).toBe("batch-newer");
  });

  it("uses reminderCount as a tiebreaker when alertedAt timestamps match", () => {
    const sameTime = "2026-10-20T12:00:00Z";
    const batchWithMoreReminders = createMockBatch("batch-more-reminders", "ALERTED", sameTime, 3);
    const batchWithFewerReminders = createMockBatch("batch-fewer-reminders", "ALERTED", sameTime, 1);

    const list = [batchWithFewerReminders, batchWithMoreReminders].sort(compareActiveBatchesUrgency);
    expect(list[0].id).toBe("batch-more-reminders");
    expect(list[1].id).toBe("batch-fewer-reminders");
  });
});

describe("isApproverRoute (Shell Bypass)", () => {
  it("bypasses shell for all /approve variants", () => {
    expect(isApproverRoute("/approve")).toBe(true);
    expect(isApproverRoute("/approve/")).toBe(true);
    expect(isApproverRoute("/approve/token-signed-12345")).toBe(true);
    expect(isApproverRoute("/approve/step-99?otp=123456")).toBe(true);
  });

  it("does not bypass shell for admin routes", () => {
    expect(isApproverRoute("/")).toBe(false);
    expect(isApproverRoute("/batches")).toBe(false);
    expect(isApproverRoute("/batches/batch-123")).toBe(false);
    expect(isApproverRoute("/payments")).toBe(false);
    expect(isApproverRoute("/settings")).toBe(false);
    expect(isApproverRoute("/legacy")).toBe(false);
    expect(isApproverRoute(null)).toBe(false);
    expect(isApproverRoute(undefined)).toBe(false);
  });
});

describe("filterBatches", () => {
  const sampleBatches: BatchRecord[] = [
    {
      id: "batch-101",
      status: "IN_PROGRESS",
      createdAt: "2026-10-18T10:00:00Z",
      bills: [{ billNumber: "INV-1001", amount: 15000 }],
      stepInstances: [
        {
          id: "step-1",
          status: "ALERTED",
          stage: { contact: { id: "contact-salomi", name: "Salomi" } },
        },
      ],
    },
    {
      id: "batch-102",
      status: "READY_FOR_PAYMENT",
      createdAt: "2026-10-19T10:00:00Z",
      bills: [{ billNumber: "INV-1002", amount: 25000 }],
      stepInstances: [
        {
          id: "step-2",
          status: "COMPLETED",
          stage: { contact: { id: "contact-rajesh", name: "Rajesh" } },
        },
      ],
    },
    {
      id: "batch-103",
      status: "COMPLETED",
      createdAt: "2026-10-20T10:00:00Z",
      bills: [{ billNumber: "INV-2001", amount: 50000 }],
      stepInstances: [],
    },
  ];

  it("filters accurately by status", () => {
    expect(filterBatches(sampleBatches, { status: "IN_PROGRESS" })).toHaveLength(1);
    expect(filterBatches(sampleBatches, { status: "READY_FOR_PAYMENT" })).toHaveLength(1);
    expect(filterBatches(sampleBatches, { status: "ALL" })).toHaveLength(3);
    expect(filterBatches(sampleBatches, {})).toHaveLength(3);
  });

  it("filters accurately by approver contact ID", () => {
    const salomiBatches = filterBatches(sampleBatches, { approver: "contact-salomi" });
    expect(salomiBatches).toHaveLength(1);
    expect(salomiBatches[0].id).toBe("batch-101");

    const nonExistent = filterBatches(sampleBatches, { approver: "contact-unknown" });
    expect(nonExistent).toHaveLength(0);
  });

  it("searches accurately across batch IDs and invoice numbers", () => {
    const byBatchId = filterBatches(sampleBatches, { search: "102" });
    expect(byBatchId).toHaveLength(1);
    expect(byBatchId[0].id).toBe("batch-102");

    const byInvoice = filterBatches(sampleBatches, { search: "inv-2001" });
    expect(byInvoice).toHaveLength(1);
    expect(byInvoice[0].id).toBe("batch-103");
  });
});

describe("sortBatches", () => {
  const sampleBatches: BatchRecord[] = [
    {
      id: "batch-b",
      createdAt: "2026-10-19T10:00:00Z",
      bills: [
        { billNumber: "INV-1", amount: 10000 },
        { billNumber: "INV-2", amount: 20000 },
      ],
    },
    {
      id: "batch-a",
      createdAt: "2026-10-18T10:00:00Z",
      bills: [{ billNumber: "INV-3", amount: 50000 }],
    },
    {
      id: "batch-c",
      createdAt: "2026-10-20T10:00:00Z",
      bills: [{ billNumber: "INV-4", amount: 5000 }],
    },
  ];

  it("sorts by date descending and ascending", () => {
    const desc = sortBatches(sampleBatches, "date", "desc");
    expect(desc.map((b) => b.id)).toEqual(["batch-c", "batch-b", "batch-a"]);

    const asc = sortBatches(sampleBatches, "date", "asc");
    expect(asc.map((b) => b.id)).toEqual(["batch-a", "batch-b", "batch-c"]);
  });

  it("sorts by total bill amount descending and ascending", () => {
    const desc = sortBatches(sampleBatches, "amount", "desc");
    expect(desc.map((b) => b.id)).toEqual(["batch-a", "batch-b", "batch-c"]); // 50k, 30k, 5k

    const asc = sortBatches(sampleBatches, "amount", "asc");
    expect(asc.map((b) => b.id)).toEqual(["batch-c", "batch-b", "batch-a"]); // 5k, 30k, 50k
  });

  it("sorts by bills count descending and ascending", () => {
    const desc = sortBatches(sampleBatches, "bills", "desc");
    expect(desc[0].id).toBe("batch-b"); // 2 bills
  });
});

describe("formatBatchId", () => {
  it("handles null, undefined, or empty ids safely", () => {
    expect(formatBatchId(null)).toBe("");
    expect(formatBatchId(undefined)).toBe("");
    expect(formatBatchId("")).toBe("");
  });

  it("extracts the last 6 characters uppercase and prefixes with B-", () => {
    expect(formatBatchId("cmvgc000a0001xyz")).toBe("B-001XYZ");
    expect(formatBatchId("cmvgc000a0002abc")).toBe("B-002ABC");
    expect(formatBatchId("batch-123456")).toBe("B-123456");
    expect(formatBatchId("demo-batch")).toBe("B-DEMO-01");
  });

  it("handles short ids smaller than 6 characters gracefully", () => {
    expect(formatBatchId("b42")).toBe("B-B42");
  });
});

describe("formatStageDuration", () => {
  const baseNow = new Date("2026-10-22T12:00:00Z").getTime();

  it("handles null, undefined, or empty timestamps safely", () => {
    expect(formatStageDuration(null, baseNow)).toBe("Just started");
    expect(formatStageDuration(undefined, baseNow)).toBe("Just started");
    expect(formatStageDuration("", baseNow)).toBe("Just started");
  });

  it("formats durations less than 1 hour", () => {
    const twentyMinsAgo = new Date(baseNow - 20 * 60 * 1000).toISOString();
    expect(formatStageDuration(twentyMinsAgo, baseNow)).toBe("< 1h in stage");
  });

  it("formats durations in hours under 24h", () => {
    const fiveHoursAgo = new Date(baseNow - 5 * 3600 * 1000).toISOString();
    expect(formatStageDuration(fiveHoursAgo, baseNow)).toBe("5h in stage");
  });

  it("formats durations in days and hours over 24h", () => {
    const twoDaysThreeHoursAgo = new Date(baseNow - (48 + 3) * 3600 * 1000).toISOString();
    expect(formatStageDuration(twoDaysThreeHoursAgo, baseNow)).toBe("2d 3h in stage");

    const exactTwoDaysAgo = new Date(baseNow - 48 * 3600 * 1000).toISOString();
    expect(formatStageDuration(exactTwoDaysAgo, baseNow)).toBe("2d in stage");
  });
});
