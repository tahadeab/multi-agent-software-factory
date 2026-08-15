import { describe, expect, it } from "vitest";
import { canRetry, readyTasks, stateAfterAgent, workflowIsBlocked } from "./dag";

describe("workflow DAG resolution", () => {
  it("releases independent tasks together after their dependencies succeed", () => {
    const tasks = [
      { id: 1, status: "SUCCEEDED" as const, dependencies: [] },
      { id: 2, status: "WAITING" as const, dependencies: [1] },
      { id: 3, status: "WAITING" as const, dependencies: [1] },
      { id: 4, status: "WAITING" as const, dependencies: [2, 3] },
    ];
    expect(readyTasks(tasks).map(task => task.id)).toEqual([2, 3]);
  });

  it("identifies an unsatisfiable dependency state without a running task", () => {
    const tasks = [
      { id: 1, status: "WAITING" as const, dependencies: [2] },
      { id: 2, status: "WAITING" as const, dependencies: [1] },
    ];
    expect(workflowIsBlocked(tasks)).toBe(true);
  });

  it("does not call an actively running workflow a deadlock", () => {
    const tasks = [
      { id: 1, status: "RUNNING" as const, dependencies: [] },
      { id: 2, status: "WAITING" as const, dependencies: [1] },
    ];
    expect(workflowIsBlocked(tasks)).toBe(false);
  });

  it("enforces a configured retry budget", () => {
    expect(canRetry(1, 3)).toBe(true);
    expect(canRetry(3, 3)).toBe(false);
  });

  it("maps an agent completion to its persisted workflow state", () => {
    expect(stateAfterAgent("developer")).toBe("IMPLEMENTATION");
    expect(stateAfterAgent("deployment")).toBe("DEPLOYMENT");
  });

  it("completes a synthetic software-delivery graph in dependency-respecting batches", () => {
    const tasks = [
      { id: 1, status: "WAITING" as const, dependencies: [] },
      { id: 2, status: "WAITING" as const, dependencies: [1] },
      { id: 3, status: "WAITING" as const, dependencies: [2] },
      { id: 4, status: "WAITING" as const, dependencies: [2] },
      { id: 5, status: "WAITING" as const, dependencies: [2] },
      { id: 6, status: "WAITING" as const, dependencies: [3, 4, 5] },
      { id: 7, status: "WAITING" as const, dependencies: [6] },
      { id: 8, status: "WAITING" as const, dependencies: [6] },
      { id: 9, status: "WAITING" as const, dependencies: [7, 8] },
      { id: 10, status: "WAITING" as const, dependencies: [9] },
      { id: 11, status: "WAITING" as const, dependencies: [10] },
      { id: 12, status: "WAITING" as const, dependencies: [11] },
    ];
    const batches: number[][] = [];
    while (tasks.some(task => task.status !== "SUCCEEDED")) {
      const batch = readyTasks(tasks);
      expect(batch.length).toBeGreaterThan(0);
      batches.push(batch.map(task => task.id));
      batch.forEach(task => { (task as { status: "SUCCEEDED" }).status = "SUCCEEDED"; });
    }
    expect(batches).toEqual([[1], [2], [3, 4, 5], [6], [7, 8], [9], [10], [11], [12]]);
  });
});
