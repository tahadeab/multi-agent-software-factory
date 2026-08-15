import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectResults: [] as Array<Array<Record<string, unknown>>>,
  updateResults: [] as unknown[],
  updateCalls: [] as Array<Record<string, unknown>>,
  insertCalls: [] as Array<Record<string, unknown>>,
}));

function createQuery(result: Array<Record<string, unknown>>) {
  return {
    from: () => ({
      where: () => ({
        limit: async () => result,
        orderBy: () => ({ limit: async () => result }),
      }),
    }),
  };
}

const fakeDb = {
  select: vi.fn(() => createQuery(mocks.selectResults.shift() ?? [])),
  update: vi.fn(() => ({
    set: (values: Record<string, unknown>) => {
      mocks.updateCalls.push(values);
      return { where: async () => mocks.updateResults.shift() ?? [{ affectedRows: 1 }] };
    },
  })),
  insert: vi.fn(() => ({
    values: (values: Record<string, unknown>) => {
      mocks.insertCalls.push(values);
      return { $returningId: async () => [{ id: 1 }] };
    },
  })),
};

vi.mock("../db", () => ({ getDb: vi.fn(async () => fakeDb) }));

import { enqueueWorkflowWork, leaseNextBackgroundJob } from "./db";

describe("durable background queue data operations", () => {
  beforeEach(() => {
    mocks.selectResults.splice(0);
    mocks.updateResults.splice(0);
    mocks.updateCalls.splice(0);
    mocks.insertCalls.splice(0);
    vi.clearAllMocks();
  });

  it("claims a queued job only when the conditional durable update succeeds", async () => {
    mocks.selectResults.push([{ id: 11, projectId: 3, attemptCount: 0, status: "QUEUED", priority: 100, createdAt: new Date() }]);
    mocks.updateResults.push([{ affectedRows: 1 }]);

    const claimed = await leaseNextBackgroundJob({ workerId: "worker-a", leaseMs: 30_000 });

    expect(claimed).toEqual(expect.objectContaining({ id: 11, status: "LEASED", leaseOwner: "worker-a", attemptCount: 1 }));
    expect(mocks.updateCalls[0]).toEqual(expect.objectContaining({ status: "LEASED", leaseOwner: "worker-a" }));
  });

  it("does not claim a job when another worker wins the conditional update", async () => {
    mocks.selectResults.push([{ id: 11, projectId: 3, attemptCount: 0, status: "QUEUED", priority: 100, createdAt: new Date() }]);
    mocks.updateResults.push([{ affectedRows: 0 }]);

    await expect(leaseNextBackgroundJob({ workerId: "worker-b", leaseMs: 30_000 })).resolves.toBeUndefined();
  });

  it("requeues an existing project workflow job instead of inserting a duplicate", async () => {
    mocks.selectResults.push(
      [{ id: 21, projectId: 5, dedupeKey: "workflow", status: "SUCCEEDED", priority: 100 }],
      [{ id: 21, projectId: 5, dedupeKey: "workflow", status: "QUEUED", priority: 100 }]
    );

    const job = await enqueueWorkflowWork({ projectId: 5, reason: "manual retry" });

    expect(job).toEqual(expect.objectContaining({ id: 21, status: "QUEUED" }));
    expect(mocks.insertCalls).toHaveLength(0);
    expect(mocks.updateCalls[0]).toEqual(expect.objectContaining({ status: "QUEUED", payload: expect.objectContaining({ reason: "manual retry" }) }));
  });
});
