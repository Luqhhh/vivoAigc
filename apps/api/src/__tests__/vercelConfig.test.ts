import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const apiRoot = new URL("../../", import.meta.url);
const vercel = JSON.parse(
  readFileSync(new URL("vercel.json", apiRoot), "utf8"),
) as {
  $schema?: string;
  functions?: unknown;
};
const packageJson = JSON.parse(
  readFileSync(new URL("package.json", apiRoot), "utf8"),
) as { engines?: { node?: string } };
const serverSource = readFileSync(new URL("src/server.ts", apiRoot), "utf8");
const repositoryPackageJson = JSON.parse(
  readFileSync(new URL("../../../../package.json", import.meta.url), "utf8"),
) as { packageManager?: string };

describe("Vercel API deployment", () => {
  it("directly creates the Express app in the Vercel entrypoint", () => {
    expect(serverSource).toMatch(/import express from ["']express["'];/);
    expect(serverSource).toMatch(/createApp\(express\(\)\)/);
  });

  it("keeps the app factory outside Vercel's recognized entrypoint names", () => {
    expect({
      app: existsSync(new URL("src/app.ts", apiRoot)),
      createApp: existsSync(new URL("src/createApp.ts", apiRoot)),
    }).toEqual({ app: false, createApp: true });
  });

  it("uses zero-config Express detection without traditional function globs", () => {
    expect(vercel.$schema).toBe("https://openapi.vercel.sh/vercel.json");
    expect(vercel.functions).toBeUndefined();
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
