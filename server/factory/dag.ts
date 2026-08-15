import { AGENT_DEFINITIONS, type AgentId, type AgentRunState, type ProjectState } from "@shared/factory";

export type DependencyTask = {
  id: number;
  status: AgentRunState;
  dependencies: number[];
};

export function readyTasks<T extends DependencyTask>(tasks: T[]) {
  const succeeded = new Set(tasks.filter(task => task.status === "SUCCEEDED").map(task => task.id));
  return tasks.filter(task =>
    (task.status === "WAITING" || task.status === "RETRYING") &&
    task.dependencies.every(dependencyId => succeeded.has(dependencyId))
  );
}

export function workflowIsBlocked<T extends DependencyTask>(tasks: T[]) {
  const unfinished = tasks.filter(task => task.status !== "SUCCEEDED");
  const hasTerminalFailure = unfinished.some(task => task.status === "FAILED");
  const hasActiveRun = unfinished.some(task => task.status === "RUNNING");
  return unfinished.length > 0 && readyTasks(tasks).length === 0 && !hasActiveRun && !hasTerminalFailure;
}

export function canRetry(attemptCount: number, maxAttempts: number) {
  return attemptCount < maxAttempts;
}

export function stateAfterAgent(agentId: AgentId): ProjectState {
  return AGENT_DEFINITIONS[agentId].stateAfterSuccess;
}
