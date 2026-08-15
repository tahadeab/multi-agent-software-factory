import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DEFAULT_ORCHESTRATOR_SETTINGS, orchestratorSettingsSchema } from "@shared/factory";
import { notifyOwner } from "../_core/notification";
import { ENV } from "../_core/env";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createApproval,
  cancelQueuedWorkflowWork,
  acknowledgeNotification,
  createProjectWorkflow,
  getOwnedProject,
  getProjectSnapshot,
  listOpenApprovals,
  listNotificationsForOwner,
  listProjectsForOwner,
  listUnreadNotificationsForOwner,
  recordEvent,
  recoverInterruptedWorkflows,
  resolveApproval,
  resolveNotification,
  updateProject,
} from "../factory/db";
import { previewReadyAgents, runWorkflow } from "../factory/orchestrator";
import { scheduleWorkflowAdvance } from "../factory/queue";

const projectIdInput = z.object({ projectId: z.number().int().positive() });

async function requireOwnedProject(projectId: number, ownerId: number) {
  const project = await getOwnedProject(projectId, ownerId);
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
  return project;
}

export const factoryRouter = router({
  list: protectedProcedure.query(({ ctx }) => listProjectsForOwner(ctx.user.id)),

  worker: router({
    status: protectedProcedure.query(() => ({
      enabled: ENV.persistentWorkerEnabled,
      mode: ENV.persistentWorkerEnabled ? "persistent" : "disabled",
    })),
  }),

  notifications: router({
    list: protectedProcedure.query(({ ctx }) => listNotificationsForOwner(ctx.user.id)),
    listUnread: protectedProcedure.query(({ ctx }) => listUnreadNotificationsForOwner(ctx.user.id)),
    acknowledge: protectedProcedure
      .input(z.object({ notificationId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const notification = await acknowledgeNotification({ notificationId: input.notificationId, ownerId: ctx.user.id });
        if (!notification) throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found." });
        return notification;
      }),
    resolve: protectedProcedure
      .input(z.object({ notificationId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const notification = await resolveNotification({ notificationId: input.notificationId, ownerId: ctx.user.id });
        if (!notification) throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found." });
        return notification;
      }),
  }),

  create: protectedProcedure
    .input(z.object({
      requirement: z.string().trim().min(20, "Please provide a more detailed software requirement.").max(20_000),
      projectName: z.string().trim().min(1).max(160).optional(),
      settings: orchestratorSettingsSchema.partial().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await createProjectWorkflow({
        ownerId: ctx.user.id,
        rawRequirement: input.requirement,
        name: input.projectName,
        settings: { ...DEFAULT_ORCHESTRATOR_SETTINGS, ...(input.settings ?? {}) },
      });
      if (!project) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Project could not be created." });
      const job = await scheduleWorkflowAdvance({ projectId: project.id, reason: "Project submitted from intake." });
      return { projectId: project.id, workflow: { status: "RUNNING", message: "Workflow queued for the persistent worker.", jobId: job.id } };
    }),

  get: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    await requireOwnedProject(input.projectId, ctx.user.id);
    return getProjectSnapshot(input.projectId);
  }),

  readyAgents: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    await requireOwnedProject(input.projectId, ctx.user.id);
    return previewReadyAgents(input.projectId);
  }),

  run: protectedProcedure.input(projectIdInput).mutation(async ({ ctx, input }) => {
    await requireOwnedProject(input.projectId, ctx.user.id);
    const job = await scheduleWorkflowAdvance({ projectId: input.projectId, reason: "Manual workflow run requested." });
    return { projectId: input.projectId, status: "RUNNING", message: "Workflow queued for the persistent worker.", jobId: job.id };
  }),

  pause: protectedProcedure.input(projectIdInput).mutation(async ({ ctx, input }) => {
    await requireOwnedProject(input.projectId, ctx.user.id);
    await updateProject({ projectId: input.projectId, values: { status: "PAUSED", currentPhase: "Paused by owner" } });
    await cancelQueuedWorkflowWork(input.projectId);
    await recordEvent({ projectId: input.projectId, eventType: "WORKFLOW_PAUSED", actor: "owner", summary: "Workflow paused by the project owner." });
    return { success: true };
  }),

  resume: protectedProcedure.input(projectIdInput).mutation(async ({ ctx, input }) => {
    await requireOwnedProject(input.projectId, ctx.user.id);
    const recovered = await recoverInterruptedWorkflows();
    await updateProject({ projectId: input.projectId, values: { status: "PLANNING", currentPhase: "Resuming workflow" } });
    await recordEvent({ projectId: input.projectId, eventType: "WORKFLOW_RESUMED", actor: "owner", summary: "Workflow resumed by the project owner.", payload: { recoveredInterruptedTasks: recovered } });
    const job = await scheduleWorkflowAdvance({ projectId: input.projectId, reason: "Workflow resumed by owner." });
    return { projectId: input.projectId, status: "RUNNING", message: "Workflow queued for the persistent worker.", jobId: job.id, recoveredInterruptedTasks: recovered };
  }),

  updateSettings: protectedProcedure
    .input(projectIdInput.extend({ settings: orchestratorSettingsSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireOwnedProject(input.projectId, ctx.user.id);
      const settings = orchestratorSettingsSchema.parse({ ...(project.settings as Record<string, unknown>), ...input.settings });
      await updateProject({ projectId: input.projectId, values: { settings } });
      await recordEvent({ projectId: input.projectId, eventType: "PROJECT_UPDATED", actor: "owner", summary: "Workflow settings updated.", payload: input.settings });
      return { success: true, settings };
    }),

  approvals: router({
    listOpen: protectedProcedure.query(({ ctx }) => listOpenApprovals(ctx.user.id)),
    request: protectedProcedure
      .input(z.object({
        projectId: z.number().int().positive(),
        action: z.enum(["ARCHITECTURE_APPROVAL", "REPOSITORY_CREATION", "EXTERNAL_API_COST", "DESTRUCTIVE_DATABASE_MIGRATION", "PRODUCTION_DEPLOYMENT"]),
        requestedAction: z.string().trim().min(5).max(1_000),
        rationale: z.string().trim().min(5).max(2_000),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await requireOwnedProject(input.projectId, ctx.user.id);
        const approval = await createApproval({
          projectId: input.projectId,
          action: input.action,
          requestedBy: "owner-requested-gate",
          requestedAction: input.requestedAction,
          rationale: input.rationale,
        });
        await updateProject({ projectId: input.projectId, values: { status: "AWAITING_HUMAN_APPROVAL", currentPhase: "Human approval required" } });
        await recordEvent({
          projectId: input.projectId,
          eventType: "APPROVAL_REQUESTED",
          actor: "owner",
          summary: input.requestedAction,
          payload: { approvalId: approval?.id, action: input.action },
        });
        const notificationSent = await notifyOwner({
          title: `Approval required — ${project.name}`,
          content: `The project “${project.name}” is awaiting your approval for: ${input.requestedAction}`,
        });
        return { approval, notificationSent };
      }),
    resolve: protectedProcedure
      .input(z.object({ approvalId: z.number().int().positive(), approved: z.boolean(), note: z.string().trim().max(2_000).optional() }))
      .mutation(async ({ ctx, input }) => {
        const open = await listOpenApprovals(ctx.user.id);
        const approval = open.find(item => item.id === input.approvalId);
        if (!approval) throw new TRPCError({ code: "NOT_FOUND", message: "Open approval was not found." });
        const resolved = await resolveApproval({ approvalId: input.approvalId, userId: ctx.user.id, approved: input.approved, note: input.note });
        await recordEvent({
          projectId: approval.projectId,
          eventType: input.approved ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED",
          actor: "owner",
          summary: input.approved ? `Approved: ${approval.requestedAction}` : `Rejected: ${approval.requestedAction}`,
          payload: { approvalId: input.approvalId, action: approval.action, note: input.note },
        });
        if (!input.approved) {
          await updateProject({ projectId: approval.projectId, values: { status: "PAUSED", currentPhase: "Approval rejected" } });
          return { approval: resolved, workflow: null };
        }
        await updateProject({ projectId: approval.projectId, values: { status: "PLANNING", currentPhase: "Approval granted" } });
        const job = await scheduleWorkflowAdvance({ projectId: approval.projectId, reason: "Human approval granted." });
        return { approval: resolved, workflow: { projectId: approval.projectId, status: "RUNNING", message: "Workflow queued after approval.", jobId: job.id } };
      }),
  }),

  notifyApproval: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), action: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireOwnedProject(input.projectId, ctx.user.id);
      const success = await notifyOwner({
        title: `Approval required — ${project.name}`,
        content: `The project “${project.name}” is awaiting your approval for: ${input.action}`,
      });
      return { success };
    }),
});
