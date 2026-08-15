import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueWorkflowWork: vi.fn(),
  recordEvent: vi.fn(),
  signalBackgroundWorker: vi.fn(),
}));

vi.mock("./db", () => ({
  enqueueWorkflowWork: mocks.enqueueWorkflowWork,
  recordEvent: mocks.recordEvent,
}));
vi.mock("./workerSignal", () => ({ signalBackgroundWorker: mocks.signalBackgroundWorker }));

import { scheduleWorkflowAdvance } from "./queue";

describe("scheduleWorkflowAdvance", () => {
  it("records durable queueing before signaling the in-process worker", async () => {
    mocks.enqueueWorkflowWork.mockResolvedValue({ id: 44, status: "QUEUED" });
    const job = await scheduleWorkflowAdvance({ projectId: 9, reason: "manual run" });

    expect(job).toEqual({ id: 44, status: "QUEUED" });
    expect(mocks.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 9,
      eventType: "WORKFLOW_QUEUED",
      payload: expect.objectContaining({ jobId: 44, reason: "manual run" }),
    }));
    expect(mocks.signalBackgroundWorker).toHaveBeenCalledOnce();
  });
});
