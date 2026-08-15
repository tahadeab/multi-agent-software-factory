import { describe, expect, it } from "vitest";
import { assertToolPermission, getScopedTools } from "./tools";

describe("scoped tool registry", () => {
  it("only enables allowed tools for an agent", () => {
    const tools = getScopedTools("architect");
    expect(tools.find(tool => tool.name === "web_search")?.enabled).toBe(true);
    expect(tools.find(tool => tool.name === "deployment")?.enabled).toBe(false);
  });

  it("rejects an unauthorized tool invocation", () => {
    expect(() => assertToolPermission("requirements", "terminal")).toThrow("not permitted");
  });
});
