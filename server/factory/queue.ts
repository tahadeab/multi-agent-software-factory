import { enqueueWorkflowWork, recordEvent } from "./db";
import { signalBackgroundWorker } from "./workerSignal";

export async function scheduleWorkflowAdvance(input: {
  projectId: number;
  reason: string;
  priority?: number;
}) {
  const job = await enqueueWorkflowWork(input);
  if (!job) throw new Error("Workflow job could not be queued.");
  await recordEvent({
    projectId: input.projectId,
    eventType: "WORKFLOW_QUEUED",
    actor: "workflow-queue",
    summary: "Workflow work queued for the persistent background worker.",
    payload: { jobId: job.id, reason: input.reason, status: job.status },
  });
  signalBackgroundWorker();
  return job;
}
