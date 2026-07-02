import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const listen = vi.fn();
  return {
    app: { listen },
    env: { PORT: 3001, LLM_MODE: "real" },
    listen,
  };
});

vi.mock("../createApp.js", () => ({
  createApp: vi.fn(() => mocks.app),
}));
vi.mock("../env.js", () => ({
  loadEnv: vi.fn(() => mocks.env),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  mocks.listen.mockClear();
});

describe("server entry", () => {
  it("exports the app without opening a listener on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");

    const module = await import("../server.js");

    expect(module.default).toBe(mocks.app);
    expect(mocks.listen).not.toHaveBeenCalled();
  });

  it("opens one listener for local startup", async () => {
    vi.stubEnv("VERCEL", undefined);

    await import("../server.js");

    expect(mocks.listen).toHaveBeenCalledTimes(1);
    expect(mocks.listen).toHaveBeenCalledWith(
      mocks.env.PORT,
      expect.any(Function),
    );
  });
});
