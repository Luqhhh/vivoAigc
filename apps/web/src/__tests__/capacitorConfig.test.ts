import { describe, expect, it } from "vitest";
import config from "../../capacitor.config";

describe("Capacitor configuration", () => {
  it("packages CodeMotion Web assets without a remote server URL", () => {
    expect(config).toMatchObject({
      appId: "com.codemotion.visualizer",
      appName: "CodeMotion",
      webDir: "dist",
    });
    expect(config.server?.url).toBeUndefined();
  });
});
