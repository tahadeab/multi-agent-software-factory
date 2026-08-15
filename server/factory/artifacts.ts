import { storagePut } from "../storage";
import { saveArtifact } from "./db";
import type { AgentId } from "@shared/factory";

function safeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "artifact";
}

export async function persistGeneratedArtifacts(input: {
  projectId: number;
  agentRunId: number;
  agentId: AgentId;
  artifacts: Array<{ name: string; content: string; kind: string }>;
}) {
  const stored = [] as Array<{ name: string; url: string }>;
  for (const artifact of input.artifacts.slice(0, 12)) {
    const name = `${safeSegment(artifact.name)}.md`;
    const path = `factory/projects/${input.projectId}/${input.agentId}/${input.agentRunId}/${name}`;
    const content = Buffer.from(artifact.content, "utf8");
    const uploaded = await storagePut(path, content, "text/markdown; charset=utf-8");
    await saveArtifact({
      projectId: input.projectId,
      agentRunId: input.agentRunId,
      kind: artifact.kind,
      name: artifact.name,
      storageKey: uploaded.key,
      storageUrl: uploaded.url,
      contentType: "text/markdown; charset=utf-8",
      sizeBytes: content.byteLength,
      metadata: { agentId: input.agentId },
    });
    stored.push({ name: artifact.name, url: uploaded.url });
  }
  return stored;
}
