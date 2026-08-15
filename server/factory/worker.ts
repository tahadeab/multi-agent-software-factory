import { randomUUID } from "node:crypto";
import {
  completeBackgroundJob,
  createBackgroundJobFailureNotification,
  failBackgroundJob,
  leaseNextBackgroundJob,
  recordEvent,
  recoverExpiredBackgroundLeases,
} from "./db";
import { runWorkflow } from "./orchestrator";
import { scheduleWorkflowAdvance } from "./queue";
import { subscribeToBackgroundWork } from "./workerSignal";

const WORKER_LEASE_MS = 90 * 60 * 1_000;

export function isPersistentWorkerEnabled(value = process.env.FORGEFLOW_WORKER_ENABLED ?? "true") {
  return value !== "false";
}

export class PersistentWorkflowWorker {
  private readonly workerId = `forgeflow-worker-${randomUUID()}`;
  private started = false;
  private draining = false;
  private wakePending = false;
  private unsubscribe?: () => void;

  async start() {
    if (this.started) return;
    this.started = true;
    this.unsubscribe = subscribeToBackgroundWork(() => { void this.drain(); });
    const recovered = await recoverExpiredBackgroundLeases();
    await Promise.all(recovered.map(job => recordEvent({
      projectId: job.projectId,
      eventType: "WORKER_RECOVERED_LEASE",
      actor: this.workerId,
      summary: "Recovered workflow work after its worker lease expired.",
      payload: { jobId: job.id, previousLeaseOwner: job.leaseOwner },
    })));
    void this.drain();
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.started = false;
  }

  private async drain() {
    if (!this.started) return;
    if (this.draining) {
      this.wakePending = true;
      return;
    }
    this.draining = true;
    try {
      for (;;) {
        const job = await leaseNextBackgroundJob({ workerId: this.workerId, leaseMs: WORKER_LEASE_MS });
        if (!job) break;
        await recordEvent({
          projectId: job.projectId,
          eventType: "WORKER_CLAIMED_JOB",
          actor: this.workerId,
          summary: "Persistent worker claimed queued workflow work.",
          payload: { jobId: job.id, attempt: job.attemptCount, leaseExpiresAt: job.leaseExpiresAt?.toISOString() },
        });
        try {
          if (job.attemptCount > job.maxAttempts) {
            throw new Error("Background job exceeded its worker retry budget.");
          }
          const workflow = await runWorkflow(job.projectId);
          await completeBackgroundJob({ jobId: job.id, workerId: this.workerId });
          await recordEvent({
            projectId: job.projectId,
            eventType: "WORKER_COMPLETED_JOB",
            actor: this.workerId,
            summary: "Persistent worker completed workflow work.",
            payload: { jobId: job.id, workflowStatus: workflow.status, message: workflow.message },
          });
          if (workflow.status === "RUNNING") {
            await scheduleWorkflowAdvance({ projectId: job.projectId, reason: "Workflow requires another background batch." });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown persistent worker error";
          await failBackgroundJob({ jobId: job.id, workerId: this.workerId, error: message });
          let notificationId: number | undefined;
          try {
            const notification = await createBackgroundJobFailureNotification({
              projectId: job.projectId,
              backgroundJobId: job.id,
              jobType: job.jobType,
              error: message,
              attemptCount: job.attemptCount,
            });
            notificationId = notification?.id;
          } catch (notificationError) {
            console.error("Could not create in-app background failure notification:", notificationError);
          }
          await recordEvent({
            projectId: job.projectId,
            eventType: "WORKER_FAILED_JOB",
            actor: this.workerId,
            summary: "Persistent worker failed workflow work.",
            payload: { jobId: job.id, error: message, notificationId },
          });
        }
      }
    } finally {
      this.draining = false;
      if (this.wakePending) {
        this.wakePending = false;
        void this.drain();
      }
    }
  }
}

const worker = new PersistentWorkflowWorker();

export async function startPersistentWorkflowWorker() {
  if (!isPersistentWorkerEnabled()) return false;
  await worker.start();
  return true;
}

export function stopPersistentWorkflowWorkerForTests() {
  worker.stop();
}
