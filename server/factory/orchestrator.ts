import {
  AGENT_DEFINITIONS,
  AGENT_IDS,
  type AgentId,
  type ProjectState,
} from "@shared/factory";
import {
  runArchitectAgent,
  runDatabaseAgent,
  runDeploymentAgent,
  runDeveloperAgent,
  runDocumentationAgent,
  runGitHubAgent,
  runPlannerAgent,
  runRequirementsAgent,
  runResearchAgent,
  runReviewerAgent,
  runSecurityAgent,
  runTestingAgent,
} from "./agents";
import {
  createAgentRun,
  createApproval,
  finishAgentRun,
  getProjectSnapshot,
  persistAgentStageOutput,
  recordEvent,
  saveRequirements,
  type SharedProjectState,
  updateProject,
  updateTask,
} from "./db";
import { persistGeneratedArtifacts } from "./artifacts";
import { notifyOwner } from "../_core/notification";
import { readyTasks, stateAfterAgent } from "./dag";
import { approvalGateFor } from "./gates";

type WorkflowTask = Awaited<ReturnType<typeof getProjectSnapshot>>["tasks"][number];

export type WorkflowResult = {
  projectId: number;
  status: "COMPLETED" | "PAUSED_FOR_APPROVAL" | "PAUSED" | "RUNNING" | "FAILED";
  completedAgents: AgentId[];
  failedAgents: AgentId[];
  nextReadyAgents: AgentId[];
  message: string;
};

function patchSharedState(agentId: AgentId, state: SharedProjectState, output: Record<string, unknown>): SharedProjectState {
  const keyByAgent: Partial<Record<AgentId, keyof SharedProjectState>> = {
    architect: "architecture",
    research: "research",
    database: "database",
    developer: "implementation",
    github: "repository",
    deployment: "deployment",
  };
  const key = keyByAgent[agentId];
  return key ? { ...state, [key]: output, generatedAt: new Date().toISOString() } : { ...state, generatedAt: new Date().toISOString() };
}

async function executeAgentTask(projectId: number, task: WorkflowTask) {
  const snapshot = await getProjectSnapshot(projectId);
  const project = snapshot.project;
  if (!project) throw new Error("Project was not found");

  const agentId = task.agentId as AgentId;
  const settings = project.settings as Record<string, unknown>;
  const sharedState = project.sharedState as SharedProjectState;
  const attempt = task.attemptCount + 1;
  const model = typeof settings.defaultModel === "string" ? settings.defaultModel : "gpt-5-mini";

  await updateTask({ taskId: task.id, status: "RUNNING", attemptCount: attempt, startedAt: new Date(), error: null });
  const runId = await createAgentRun({
    projectId,
    taskId: task.id,
    agentId,
    attempt,
    model,
    payload: { projectName: project.name, rawRequirement: project.rawRequirement, sharedState },
  });
  await recordEvent({ projectId, agentRunId: runId, eventType: "AGENT_STARTED", actor: agentId, summary: `${AGENT_DEFINITIONS[agentId].label} started.`, payload: { taskId: task.id, attempt } });

  try {
    const standardInput = {
      projectId,
      projectName: project.name,
      rawRequirement: project.rawRequirement,
      sharedState,
      taskId: task.id,
      attempt,
      model,
    };
    let output: Record<string, unknown>;
    let resultModel: string;
    let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number };

    if (agentId === "requirements") {
      const result = await runRequirementsAgent({ rawRequirement: project.rawRequirement, model });
      await saveRequirements(projectId, result.output);
      output = result.output;
      resultModel = result.model;
      usage = result.usage;
    } else {
      const runner = {
        planner: runPlannerAgent,
        architect: runArchitectAgent,
        research: runResearchAgent,
        database: runDatabaseAgent,
        developer: runDeveloperAgent,
        testing: runTestingAgent,
        security: runSecurityAgent,
        reviewer: runReviewerAgent,
        documentation: runDocumentationAgent,
        github: runGitHubAgent,
        deployment: runDeploymentAgent,
      }[agentId];
      const result = await runner(standardInput);
      output = result.output;
      resultModel = result.model;
      usage = result.usage;
      await updateProject({
        projectId,
        values: {
          status: stateAfterAgent(agentId),
          currentPhase: AGENT_DEFINITIONS[agentId].label,
          sharedState: patchSharedState(agentId, sharedState, output),
          lastError: null,
        },
      });
    }

    await finishAgentRun({ runId, status: "SUCCEEDED", output, usage });
    await persistAgentStageOutput({ projectId, agentRunId: runId, agentId, output });
    const generatedArtifacts = Array.isArray(output.artifacts)
      ? output.artifacts as Array<{ name: string; content: string; kind: string }>
      : [];
    if (generatedArtifacts.length > 0) {
      await persistGeneratedArtifacts({ projectId, agentRunId: runId, agentId, artifacts: generatedArtifacts });
    }
    await updateTask({ taskId: task.id, status: "SUCCEEDED", output, completedAt: new Date(), error: null });
    await recordEvent({
      projectId,
      agentRunId: runId,
      eventType: "AGENT_COMPLETED",
      actor: agentId,
      summary: `${AGENT_DEFINITIONS[agentId].label} completed.`,
      payload: { taskId: task.id, model: resultModel, usage },
    });
    return { agentId, succeeded: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown agent execution error";
    const retryable = attempt < task.maxAttempts;
    await finishAgentRun({ runId, status: "FAILED", error: message });
    await updateTask({
      taskId: task.id,
      status: retryable ? "RETRYING" : "FAILED",
      error: message,
      completedAt: retryable ? null : new Date(),
    });
    await recordEvent({
      projectId,
      agentRunId: runId,
      eventType: retryable ? "AGENT_RETRYING" : "AGENT_FAILED",
      actor: agentId,
      summary: retryable ? `${AGENT_DEFINITIONS[agentId].label} failed and will retry.` : `${AGENT_DEFINITIONS[agentId].label} failed after its retry budget.`,
      payload: { taskId: task.id, attempt, error: message },
    });
    return { agentId, succeeded: false as const, error: message };
  }
}

async function requestEligibleApprovals(projectId: number) {
  const snapshot = await getProjectSnapshot(projectId);
  const project = snapshot.project;
  if (!project) throw new Error("Project not found");
  const settings = project.settings as Record<string, unknown>;
  for (const task of snapshot.tasks.filter(item => item.status === "SUCCEEDED")) {
    const agentId = task.agentId as AgentId;
    const approval = approvalGateFor(agentId, settings);
    if (!approval) continue;
    const existing = snapshot.approvals.find(item => item.action === approval.action);
    if (existing) continue;
    const created = await createApproval({ projectId, requestedBy: agentId, ...approval });
    await updateProject({ projectId, values: { status: "AWAITING_HUMAN_APPROVAL", currentPhase: "Human approval required" } });
    await recordEvent({
      projectId,
      eventType: "APPROVAL_REQUESTED",
      actor: agentId,
      summary: approval.requestedAction,
      payload: { approvalId: created?.id, action: approval.action },
    });
    await notifyOwner({
      title: `Approval required — ${project.name}`,
      content: `The project “${project.name}” is awaiting your approval for: ${approval.requestedAction}`,
    });
    return created;
  }
  return undefined;
}

export async function runWorkflow(projectId: number): Promise<WorkflowResult> {
  const completedAgents: AgentId[] = [];
  const failedAgents: AgentId[] = [];
  const maxBatches = AGENT_IDS.length + 2;

  for (let batch = 0; batch < maxBatches; batch++) {
    const snapshot = await getProjectSnapshot(projectId);
    const project = snapshot.project;
    if (!project) throw new Error("Project not found");

    if (project.status === "PAUSED") {
      return { projectId, status: "PAUSED", completedAgents, failedAgents, nextReadyAgents: [], message: "Workflow is paused by the project owner." };
    }

    if (snapshot.approvals.some(approval => approval.status === "AWAITING_HUMAN_APPROVAL")) {
      await updateProject({ projectId, values: { status: "AWAITING_HUMAN_APPROVAL", currentPhase: "Human approval required" } });
      return { projectId, status: "PAUSED_FOR_APPROVAL", completedAgents, failedAgents, nextReadyAgents: [], message: "Workflow is paused at a human approval gate." };
    }

    const ready = readyTasks(snapshot.tasks);
    const allSucceeded = snapshot.tasks.every(task => task.status === "SUCCEEDED");
    if (allSucceeded) {
      await updateProject({ projectId, values: { status: "COMPLETED", progress: 100, currentPhase: "Completed" } });
      await recordEvent({ projectId, eventType: "WORKFLOW_COMPLETED", actor: "orchestrator", summary: "All planned agents completed successfully." });
      return { projectId, status: "COMPLETED", completedAgents, failedAgents, nextReadyAgents: [], message: "Workflow completed." };
    }

    if (ready.length === 0) {
      const terminalFailure = snapshot.tasks.some(task => task.status === "FAILED");
      await updateProject({ projectId, values: { status: "FAILED", currentPhase: terminalFailure ? "Agent failure" : "Deadlock detected", lastError: terminalFailure ? "An agent exhausted its retry budget." : "No unfinished task has satisfiable dependencies." } });
      await recordEvent({ projectId, eventType: "WORKFLOW_FAILED", actor: "orchestrator", summary: terminalFailure ? "Workflow stopped after a terminal agent failure." : "Workflow deadlock detected.", payload: { taskStates: snapshot.tasks.map(task => ({ id: task.id, agentId: task.agentId, status: task.status, dependencies: task.dependencies })) } });
      return { projectId, status: "FAILED", completedAgents, failedAgents, nextReadyAgents: [], message: terminalFailure ? "An agent exhausted its retry budget." : "The orchestrator detected a dependency deadlock." };
    }

    await updateProject({ projectId, values: { status: "PLANNING", currentPhase: `Running ${ready.length} ready agent${ready.length === 1 ? "" : "s"}` } });
    const outcomes = await Promise.all(ready.map(task => executeAgentTask(projectId, task)));
    outcomes.forEach(outcome => (outcome.succeeded ? completedAgents.push(outcome.agentId) : failedAgents.push(outcome.agentId)));

    const approval = await requestEligibleApprovals(projectId);
    if (approval) {
      return { projectId, status: "PAUSED_FOR_APPROVAL", completedAgents, failedAgents, nextReadyAgents: [], message: approval.requestedAction };
    }
  }

  return { projectId, status: "RUNNING", completedAgents, failedAgents, nextReadyAgents: [], message: "Workflow reached its batch safety limit and can be resumed." };
}

export async function previewReadyAgents(projectId: number) {
  const snapshot = await getProjectSnapshot(projectId);
  return readyTasks(snapshot.tasks).map(task => task.agentId as AgentId);
}
