import { createHash } from "node:crypto";
import type { InAppNotificationStatus } from "@shared/factory";

export const NOTIFICATION_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1_000;

export type FailureAggregationInput = {
  ownerId: number;
  projectId: number;
  jobType: string;
  error: string;
};

export type NotificationAggregationState = {
  status: InAppNotificationStatus;
  repeatCount: number;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  latestFailureAt: Date | null;
};

/** Removes volatile worker details so one recurring failure maps to one inbox item. */
export function normalizeFailureFingerprint(error: string) {
  return error
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<uuid>")
    .replace(/\b\d+\b/g, "<number>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
}

export function failureAggregationKey(input: FailureAggregationInput) {
  const fingerprint = normalizeFailureFingerprint(input.error);
  const digest = createHash("sha256").update(fingerprint).digest("hex").slice(0, 32);
  return `background-failure:${input.ownerId}:${input.projectId}:${input.jobType}:${digest}`;
}

export function nextNotificationAggregationState(
  existing: NotificationAggregationState | undefined,
  now: Date
): NotificationAggregationState {
  if (!existing || !existing.latestFailureAt || now.getTime() - existing.latestFailureAt.getTime() > NOTIFICATION_DEDUPE_WINDOW_MS) {
    return { status: "UNREAD", repeatCount: 1, acknowledgedAt: null, resolvedAt: null, latestFailureAt: now };
  }
  return {
    status: existing.status === "RESOLVED" ? "UNREAD" : existing.status,
    repeatCount: existing.repeatCount + 1,
    acknowledgedAt: existing.acknowledgedAt,
    resolvedAt: null,
    latestFailureAt: now,
  };
}

export function groupedFailureMessage(input: { projectName: string; repeatCount: number; attemptCount: number; error: string }) {
  const repetition = input.repeatCount === 1 ? "once" : `${input.repeatCount} times`;
  return `The persistent worker reported this background workflow failure for ${input.projectName} ${repetition}. Latest attempt count: ${input.attemptCount}. ${input.error.slice(0, 1_500)}`;
}
