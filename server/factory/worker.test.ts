import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  leasedJobs: [] as Array<Record<string, unknown>>,
  recoveredJobs: [] as Array<Record<string, unknown>>,
  callbacks: [] as Array<() => void>,
  completeBackgroundJob: vi.fn(),
  createBackgroundJobFailureNotification: vi.fn(),
  failBackgroundJob: vi.fn(),
  recordEvent: vi.fn(),
  scheduleWorkflowAdvance: vi.fn(),
  runWorkflow: vi.fn(),
}));

vi.mock("./db", () => ({
  leaseNextBackgroundJob: vi.fn(async () => mocks.leasedJobs.shift()),
  recoverExpiredBackgroundLeases: vi.fn(async () => mocks.recoveredJobs),
  completeBackgroundJob: mocks.completeBackgroundJob,
  createBackgroundJobFailureNotification: mocks.createBackgroundJobFailureNotification,
  failBackgroundJob: mocks.failBackgroundJob,
  recordEvent: mocks.recordEvent,
}));

vi.mock("./orchestrator", () => ({ runWorkflow: mocks.runWorkflow }));
vi.mock("./queue", () => ({ scheduleWorkflowAdvance: mocks.scheduleWorkflowAdvance }));
vi.mock("./workerSignal", () => ({
  subscribeToBackgroundWork: vi.fn((callback: () => void) => {
    mocks.callbacks.push(callback);
    return () => undefined;
  }),
}));

import { isPersistentWorkerEnabled, PersistentWorkflowWorker } from "./worker";

const leasedJob = (overrides: Record<string, unknown> = {}) => ({
  id: 19,
  projectId: 7,
  attemptCount: 1,
  maxAttempts: 8,
  leaseOwner: "worker",
  leaseExpiresAt: new Date(Date.now() + 60_000),
  ...overrides,
});

describe("PersistentWorkflowWorker", () => {
  beforeEach(() => {
    mocks.leasedJobs.splice(0);
    mocks.recoveredJobs.splice(0);
    mocks.callbacks.splice(0);
    vi.clearAllMocks();
  });

  it("recognizes explicit worker enablement only", () => {
    expect(isPersistentWorkerEnabled("true")).toBe(true);
    expect(isPersistentWorkerEnabled("false")).toBe(false);
    expect(isPersistentWorkerEnabled()).toBe(true);
  });

  it("recovers expired leases and advances a queued workflow without an HTTP request", async () => {
    mocks.recoveredJobs.push({ id: 4, projectId: 7, leaseOwner: "prior-worker" });
    mocks.leasedJobs.push(leasedJob());
    mocks.runWorkflow.mockResolvedValue({ projectId: 7, status: "COMPLETED", message: "done" });
    const worker = new PersistentWorkflowWorker();

    await worker.start();
    await vi.waitFor(() => expect(mocks.completeBackgroundJob).toHaveBeenCalledWith({ jobId: 19, workerId: expect.stringContaining("forgeflow-worker-") }));

    expect(mocks.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "WORKER_RECOVERED_LEASE", projectId: 7 }));
    expect(mocks.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "WORKER_COMPLETED_JOB", projectId: 7 }));
    worker.stop();
  });

  it("schedules a follow-up queue item only when orchestration reaches its batch boundary", async () => {
    mocks.leasedJobs.push(leasedJob());
    mocks.runWorkflow.mockResolvedValue({ projectId: 7, status: "RUNNING", message: "another batch" });
    const worker = new PersistentWorkflowWorker();

    await worker.start();
    await vi.waitFor(() => expect(mocks.scheduleWorkflowAdvance).toHaveBeenCalledWith({ projectId: 7, reason: "Workflow requires another background batch." }));
    worker.stop();
  });

  it("records a terminal worker failure instead of leaving a lease stranded", async () => {
    mocks.leasedJobs.push(leasedJob({ attemptCount: 9, maxAttempts: 8 }));
    mocks.createBackgroundJobFailureNotification.mockResolvedValue({ id: 73 });
    const worker = new PersistentWorkflowWorker();

    await worker.start();
    await vi.waitFor(() => expect(mocks.failBackgroundJob).toHaveBeenCalledWith(expect.objectContaining({ jobId: 19, error: expect.stringContaining("retry budget") })));
    expect(mocks.createBackgroundJobFailureNotification).toHaveBeenCalledWith(expect.objectContaining({ projectId: 7, backgroundJobId: 19, attemptCount: 9 }));
    expect(mocks.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "WORKER_FAILED_JOB", payload: expect.objectContaining({ notificationId: 73 }) }));
    worker.stop();
  });
});
