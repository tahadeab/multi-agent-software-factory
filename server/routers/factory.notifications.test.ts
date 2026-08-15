import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  listNotificationsForOwner: vi.fn(),
  listUnreadNotificationsForOwner: vi.fn(),
  acknowledgeNotification: vi.fn(),
  resolveNotification: vi.fn(),
}));

vi.mock("../factory/db", () => ({
  createApproval: vi.fn(),
  cancelQueuedWorkflowWork: vi.fn(),
  createProjectWorkflow: vi.fn(),
  getOwnedProject: vi.fn(),
  getProjectSnapshot: vi.fn(),
  listOpenApprovals: vi.fn(),
  listProjectsForOwner: vi.fn(),
  recordEvent: vi.fn(),
  recoverInterruptedWorkflows: vi.fn(),
  resolveApproval: vi.fn(),
  updateProject: vi.fn(),
  listNotificationsForOwner: mocks.listNotificationsForOwner,
  listUnreadNotificationsForOwner: mocks.listUnreadNotificationsForOwner,
  acknowledgeNotification: mocks.acknowledgeNotification,
  resolveNotification: mocks.resolveNotification,
}));

vi.mock("../factory/queue", () => ({ scheduleWorkflowAdvance: vi.fn() }));
vi.mock("../factory/orchestrator", () => ({ previewReadyAgents: vi.fn(), runWorkflow: vi.fn() }));

import { factoryRouter } from "./factory";

function callerFor(ownerId: number) {
  return factoryRouter.createCaller({
    user: {
      id: ownerId,
      openId: `notification-owner-${ownerId}`,
      name: "Notification owner",
      email: "owner@example.com",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  } as TrpcContext);
}

describe("factory.notifications", () => {
  it("lists notifications only through the requesting owner scope", async () => {
    mocks.listNotificationsForOwner.mockResolvedValue([{ id: 8, ownerId: 12 }]);

    const result = await callerFor(12).notifications.list();

    expect(mocks.listNotificationsForOwner).toHaveBeenCalledWith(12);
    expect(result).toEqual([{ id: 8, ownerId: 12 }]);
  });

  it("rejects acknowledgement when the owner-scoped data layer cannot find the alert", async () => {
    mocks.acknowledgeNotification.mockResolvedValue(undefined);

    await expect(callerFor(12).notifications.acknowledge({ notificationId: 99 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.acknowledgeNotification).toHaveBeenCalledWith({ notificationId: 99, ownerId: 12 });
  });

  it("returns the owner-scoped acknowledgement state after a successful review", async () => {
    mocks.acknowledgeNotification.mockResolvedValue({ id: 10, ownerId: 12, status: "ACKNOWLEDGED" });

    await expect(callerFor(12).notifications.acknowledge({ notificationId: 10 })).resolves.toEqual({ id: 10, ownerId: 12, status: "ACKNOWLEDGED" });
    expect(mocks.acknowledgeNotification).toHaveBeenCalledWith({ notificationId: 10, ownerId: 12 });
  });

  it("returns a resolved notification only after passing the requesting owner to the data layer", async () => {
    mocks.resolveNotification.mockResolvedValue({ id: 9, ownerId: 12, status: "RESOLVED" });

    await expect(callerFor(12).notifications.resolve({ notificationId: 9 })).resolves.toEqual({ id: 9, ownerId: 12, status: "RESOLVED" });
    expect(mocks.resolveNotification).toHaveBeenCalledWith({ notificationId: 9, ownerId: 12 });
  });
});
