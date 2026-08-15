import { describe, expect, it } from "vitest";
import {
  failureAggregationKey,
  nextNotificationAggregationState,
  normalizeFailureFingerprint,
  NOTIFICATION_DEDUPE_WINDOW_MS,
} from "./notificationAggregation";

describe("smart notification aggregation", () => {
  it("normalizes volatile identifiers so repeated failures share a fingerprint", () => {
    expect(normalizeFailureFingerprint("Worker 18 failed for run 550e8400-e29b-41d4-a716-446655440000"))
      .toBe(normalizeFailureFingerprint("Worker 19 failed for run 550e8400-e29b-41d4-a716-446655440000"));
  });

  it("keeps the same group for repeated failures in one project and separates projects", () => {
    const first = { ownerId: 4, projectId: 10, jobType: "WORKFLOW_ADVANCE", error: "Database timeout on attempt 1" };
    expect(failureAggregationKey(first)).toBe(failureAggregationKey({ ...first, error: "Database timeout on attempt 2" }));
    expect(failureAggregationKey(first)).not.toBe(failureAggregationKey({ ...first, projectId: 11 }));
  });

  it("creates one unread notification for the first failure", () => {
    expect(nextNotificationAggregationState(undefined, new Date())).toMatchObject({ status: "UNREAD", repeatCount: 1, resolvedAt: null });
  });

  it("increments active groups without creating a new alert", () => {
    const now = new Date();
    const state = nextNotificationAggregationState({ status: "ACKNOWLEDGED", repeatCount: 2, acknowledgedAt: new Date(), resolvedAt: null, latestFailureAt: new Date(now.getTime() - 5_000) }, now);
    expect(state).toMatchObject({ status: "ACKNOWLEDGED", repeatCount: 3, resolvedAt: null });
  });

  it("reopens a resolved group as one unread alert", () => {
    const now = new Date();
    const state = nextNotificationAggregationState({ status: "RESOLVED", repeatCount: 3, acknowledgedAt: new Date(), resolvedAt: new Date(), latestFailureAt: new Date(now.getTime() - 5_000) }, now);
    expect(state).toMatchObject({ status: "UNREAD", repeatCount: 4, resolvedAt: null });
  });

  it("resets the group after the deduplication window expires", () => {
    const now = new Date();
    const state = nextNotificationAggregationState({ status: "ACKNOWLEDGED", repeatCount: 8, acknowledgedAt: new Date(), resolvedAt: null, latestFailureAt: new Date(now.getTime() - NOTIFICATION_DEDUPE_WINDOW_MS - 1) }, now);
    expect(state).toMatchObject({ status: "UNREAD", repeatCount: 1, resolvedAt: null });
  });
});
