import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const readText = (relativePath: string): string => readFileSync(new URL(relativePath, import.meta.url), "utf8");

const parseFrontmatter = (markdown: string): { frontmatter: Record<string, string>; body: string } => {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("Missing YAML frontmatter.");
  }

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      throw new Error(`Invalid frontmatter line: ${line}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    frontmatter[key] = value;
  }

  return { frontmatter, body: match[2] };
};

const skillMd = readText("../skill/felo-api/SKILL.md");
const apiContract = readText("../skill/felo-api/references/api-contract.md");
const workflow = readText("../skill/felo-api/references/workflow.md");
const references = `${apiContract}\n${workflow}`;

describe("felo-api skill artifact", () => {
  it("keeps SKILL.md frontmatter limited to name and description", () => {
    const { frontmatter } = parseFrontmatter(skillMd);
    expect(Object.keys(frontmatter).sort()).toEqual(["description", "name"]);
    expect(frontmatter.name).toBe("felo-api-agent");
    expect(frontmatter.description.length).toBeGreaterThan(0);
  });

  it("documents openapi URL and POST /v2/chat in skill and references", () => {
    const { body } = parseFrontmatter(skillMd);
    expect(body).toContain("https://openapi.felo.ai");
    expect(body).toContain("POST https://openapi.felo.ai/v2/chat");
    expect(body).toContain("references/api-contract.md");
    expect(body).toContain("references/workflow.md");
    expect(apiContract).toContain("`https://openapi.felo.ai`");
    expect(apiContract).toContain("`POST /v2/chat`");
    expect(workflow).toContain("https://openapi.felo.ai");
    expect(workflow).toContain("`POST /v2/chat`");
  });

  it("documents FELO_API_KEY bearer authentication", () => {
    expect(skillMd).toContain("`FELO_API_KEY`");
    expect(skillMd).toContain("Authorization: Bearer <FELO_API_KEY>");
    expect(apiContract).toContain("Env var: `FELO_API_KEY`");
    expect(apiContract).toContain("`Authorization: Bearer <FELO_API_KEY>`");
  });

  it("documents query constraint 1..2000", () => {
    expect(skillMd).toContain("1..2000");
    expect(apiContract).toContain("1..2000");
    expect(workflow).toContain("1..2000");
  });

  it("includes success/error schemas and key error codes in references", () => {
    expect(references).toContain("\"status\": \"ok\"");
    expect(references).toContain("\"message\": null");
    expect(references).toContain("\"data\": {");
    expect(references).toContain("\"id\":");
    expect(references).toContain("\"message_id\":");
    expect(references).toContain("\"answer\":");
    expect(references).toContain("\"query_analysis\": {");
    expect(references).toContain("\"queries\": [");
    expect(references).toContain("\"resources\": [");

    expect(references).toContain("\"status\": \"error\"");
    expect(references).toContain("\"code\":");
    expect(references).toContain("\"message\":");
    expect(references).toContain("\"request_id\":");

    const requiredErrorCodes = [
      "INVALID_API_KEY",
      "MISSING_AUTHORIZATION",
      "MALFORMED_AUTHORIZATION",
      "MISSING_PARAMETER",
      "INVALID_PARAMETER",
      "QUERY_TOO_LONG",
      "RATE_LIMIT_EXCEEDED",
      "CHAT_FAILED",
      "SERVICE_UNAVAILABLE",
    ];

    for (const code of requiredErrorCodes) {
      expect(references).toContain(code);
    }
  });
});
