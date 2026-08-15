import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { factoryRouter } from "./factory";

describe("factory.worker.status", () => {
  it("reports that the persistent worker is enabled by the server environment", async () => {
    const caller = factoryRouter.createCaller({
      user: {
        id: 1,
        openId: "worker-status-test",
        name: "Worker test",
        email: "worker@example.com",
        loginMethod: "test",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    } as TrpcContext);

    const status = await caller.worker.status();

    expect(status).toEqual({ enabled: true, mode: "persistent" });
  });
});
