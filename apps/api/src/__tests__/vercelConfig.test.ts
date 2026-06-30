import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const apiRoot = new URL("../../", import.meta.url);
const vercel = JSON.parse(
  readFileSync(new URL("vercel.json", apiRoot), "utf8"),
) as {
  $schema?: string;
  functions?: Record<string, { maxDuration?: number }>;
};
const packageJson = JSON.parse(
  readFileSync(new URL("package.json", apiRoot), "utf8"),
) as { engines?: { node?: string } };
const repositoryPackageJson = JSON.parse(
  readFileSync(new URL("../../../../package.json", import.meta.url), "utf8"),
) as { packageManager?: string };

describe("Vercel API deployment", () => {
  it("runs the Express entry with the configured 60-second function limit", () => {
    expect(vercel.$schema).toBe("https://openapi.vercel.sh/vercel.json");
    expect(vercel.functions?.["src/server.ts"]?.maxDuration).toBe(60);
  });

  it("uses a Vercel-compatible pnpm version", () => {
    expect(repositoryPackageJson.packageManager).toBe("pnpm@10.34.4");
  });

  it("uses Node 22 and removes the blocked Render blueprint", () => {
    expect(packageJson.engines?.node).toBe("22.x");
    expect(
      existsSync(new URL("../../../../render.yaml", import.meta.url)),
    ).toBe(false);
  });
});
