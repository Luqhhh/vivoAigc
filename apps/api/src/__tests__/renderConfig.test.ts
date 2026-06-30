import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const renderBlueprintUrl = new URL("../../../../render.yaml", import.meta.url);

function scalarValue(blueprint: string, key: string): string {
  const match = blueprint.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, "m"));

  expect(match, `missing ${key} in render.yaml`).not.toBeNull();
  return match![1].trim();
}

describe("Render Blueprint", () => {
  it("defines the production API service contract", async () => {
    const blueprint = await readFile(renderBlueprintUrl, "utf8");
    const buildCommand = scalarValue(blueprint, "buildCommand");
    const startCommand = scalarValue(blueprint, "startCommand");

    expect(scalarValue(blueprint, "runtime")).toBe("node");
    expect(scalarValue(blueprint, "branch")).toBe("codex/real-lanxin-apk");
    expect(buildCommand).toContain(
      "pnpm install --frozen-lockfile --prod=false",
    );
    expect(buildCommand).toContain("pnpm --filter @codemotion/api build");
    expect(startCommand).toContain("pnpm --filter @codemotion/api start");
    expect(scalarValue(blueprint, "healthCheckPath")).toBe("/api/health");
    expect(blueprint).toMatch(
      /-\s+key:\s+LANXIN_APP_ID\s+sync:\s+false/,
    );
    expect(blueprint).toMatch(
      /-\s+key:\s+LANXIN_APP_KEY\s+sync:\s+false/,
    );
    expect(blueprint).toContain(
      "https://api-ai.vivo.com.cn/v1/chat/completions",
    );
    expect(blueprint).toMatch(
      /-\s+key:\s+FRONTEND_ORIGIN\s+value:\s+https:\/\/localhost/,
    );
  });
});
